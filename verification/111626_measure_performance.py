"""Measure frame times of the site in a visible Firefox window at 2560x1440 (1280x720 CSS px at device-pixel-ratio 2).

Usage:  python 111626_measure_performance.py <firefox-binary> <out-dir>
GPU time comes from EXT_disjoint_timer_query (TIME_ELAPSED) wrapped around all of a frame's WebGL commands.
Firefox only exposes that extension when webgl.enable-privileged-extensions is set, so this script sets it in
its own throwaway profile; the page itself never needs it. Frame intervals come from requestAnimationFrame.
"""
import json
import sys
import time
from pathlib import Path

import numpy as np
from selenium import webdriver
from selenium.webdriver.firefox.options import Options

ROOT = Path(__file__).resolve().parent.parent
FIREFOX, OUT = sys.argv[1], Path(sys.argv[2])
OUT.mkdir(parents=True, exist_ok=True)

o = Options()
o.binary_location = FIREFOX
o.set_preference("webgl.enable-privileged-extensions", True)
o.set_preference("privacy.reduceTimerPrecision", False)
d = webdriver.Firefox(options=o)
try:
    d.set_window_rect(x=60, y=40, width=1280, height=805)
    d.get((ROOT / "index.html").as_uri() + "?perf" + (sys.argv[3] if len(sys.argv) > 3 else ""))
    for _ in range(300):
        if d.execute_script("return !!(window.__lab && (window.__lab.ready || window.__lab.errors.length))"):
            break
        time.sleep(0.1)
    env = d.execute_script("""const l=window.__lab, c=document.getElementById('gl'), g=c.getContext('webgl2'), x=g.getExtension('WEBGL_debug_renderer_info');
        return {ua:navigator.userAgent, inner:[innerWidth,innerHeight], dpr:devicePixelRatio, canvas:[c.width,c.height], size:l.size(), timer:l.timer, timerBits:l.timerBits,
                renderer:x?g.getParameter(x.UNMASKED_RENDERER_WEBGL):null, errors:l.errors, hidden:document.hidden}""")
    print(json.dumps(env))
    time.sleep(2.0)                                   # idle on the loading screen
    go = lambda v: d.execute_script("window.__lab.go(arguments[0])", v)
    back = lambda: d.execute_script("window.__lab.back()")
    d.execute_script("window.__lab.start()")
    time.sleep(6.0)                                   # intro zoom (3.8 s) + settle
    for v in ["education", "honors", "skills", "teaching", "publications", "contact", "ack"]:
        go(v); time.sleep(3.4 if v == "teaching" else 2.8)
        back(); time.sleep(2.6)
    go("research"); time.sleep(2.6)
    for v in ["barstow", "mason", "wolchok"]:
        go(v); time.sleep(2.8)
        back(); time.sleep(2.4)
    back(); time.sleep(3.0)
    data = d.execute_script("const l=window.__lab; return {frames:l.frames, marks:l.marks}")
finally:
    d.quit()

frames, marks = data["frames"], data["marks"]
(OUT / "111626_performance_frames.json").write_text(json.dumps({"env": env, "marks": marks, "frames": frames}))
t = np.array([f["t"] for f in frames]); raf = np.array([f["raf"] for f in frames]); cpu = np.array([f["cpu"] for f in frames])
gpu = np.array([np.nan if f.get("gpu") is None else f["gpu"] for f in frames], dtype=float)
moving = np.array([f["moving"] for f in frames], dtype=bool)
# an animation window: from each navigation until 2.2 s later (camera move 1.25-1.35 s, plus lids, drawers and page flips settling); intro: 4.0 s
anim = np.zeros(len(frames), dtype=bool); label = np.array([""] * len(frames), dtype=object)
for m in marks:
    w = 4.0 if m["view"] == "intro-zoom" else 2.2
    sel = (t >= m["t"]) & (t <= m["t"] + w * 1000)
    anim |= sel; label[sel] = m["view"]
first = marks[0]["t"]


def stats(x):
    x = x[~np.isnan(x)]
    return None if len(x) == 0 else {"n": int(len(x)), "avg": round(float(x.mean()), 2), "p50": round(float(np.percentile(x, 50)), 2), "p99": round(float(np.percentile(x, 99)), 2), "max": round(float(x.max()), 2)}


rows = {"all frames after start": t >= first, "during animations": anim, "camera in motion only": moving & (t >= first), "idle (no animation)": (~anim) & (t >= first)}
summary = {"env": env, "groups": {}, "per_animation": {}}
for k, sel in rows.items():
    summary["groups"][k] = {"gpu_ms": stats(gpu[sel]), "raf_interval_ms": stats(raf[sel]), "cpu_ms": stats(cpu[sel]),
                            "gpu_frames_over_16.7ms": int(np.nansum(gpu[sel] > 16.7)), "raf_intervals_over_25ms": int((raf[sel] > 25).sum()), "gpu_samples_missing": int(np.isnan(gpu[sel]).sum())}
for i, m in enumerate(marks):
    w = 4.0 if m["view"] == "intro-zoom" else 2.2
    sel = (t >= m["t"]) & (t <= m["t"] + w * 1000)
    summary["per_animation"][f"{i:02d} {m['view']}"] = {"gpu_ms": stats(gpu[sel]), "raf_max": round(float(raf[sel].max()), 2) if sel.any() else None}
(OUT / "111626_performance_summary.json").write_text(json.dumps(summary, indent=1))
for k, v in summary["groups"].items():
    print(f"{k:26s} gpu {v['gpu_ms']}  raf {v['raf_interval_ms']}  cpu {v['cpu_ms']}  gpu>16.7: {v['gpu_frames_over_16.7ms']}  raf>25: {v['raf_intervals_over_25ms']}  missing: {v['gpu_samples_missing']}")
for k, v in summary["per_animation"].items():
    print(f"  {k:22s} {v}")
