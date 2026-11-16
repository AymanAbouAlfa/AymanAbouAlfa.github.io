"""Capture renders of the site in headless Firefox at 2560x1440 (1280x720 CSS px at device-pixel-ratio 2).

Usage:  python 111626_capture_renders.py <firefox-binary> <out-dir> <plan> [more plans]
Plans: first | stills | intro | transitions | all
The page is driven through window.__lab in ?manual mode, so every frame is stepped deterministically.
"""
import base64
import io
import json
import sys
import time
from pathlib import Path

from PIL import Image
from selenium import webdriver
from selenium.webdriver.firefox.options import Options

ROOT = Path(__file__).resolve().parent.parent
FIREFOX, OUT, PLANS = sys.argv[1], Path(sys.argv[2]), sys.argv[3:]
OUT.mkdir(parents=True, exist_ok=True)

o = Options()
o.binary_location = FIREFOX
o.add_argument("-headless")
o.set_preference("layout.css.devPixelsPerPx", "2.0")
o.set_preference("privacy.reduceTimerPrecision", False)
d = webdriver.Firefox(options=o)
d.set_window_rect(x=0, y=0, width=1280, height=805)


def js(code, *a):
    return d.execute_script(code, *a)


def step(ms, dt=1000 / 60):
    js("const n=Math.round(arguments[0]/arguments[1]);for(let i=0;i<n;i++)window.__lab.step(arguments[1]);", ms, dt)


def shot(name):
    d.execute_async_script("const cb=arguments[0];requestAnimationFrame(()=>requestAnimationFrame(()=>cb()));")
    png = d.get_screenshot_as_png()
    (OUT / f"{name}.png").write_bytes(png)
    im = Image.open(io.BytesIO(png)).convert("RGB")
    im.resize((1280, 720), Image.LANCZOS).save(OUT / f"{name}_small.jpg", quality=88)
    print("shot", name, im.size)


def load():
    d.get((ROOT / "index.html").as_uri() + "?manual")
    for _ in range(300):
        r = js("return window.__lab ? {ready: window.__lab.ready, errors: window.__lab.errors} : null")
        if r and (r["ready"] or r["errors"]):
            break
        time.sleep(0.1)
    info = js("const l=window.__lab;return {ready:l.ready,errors:l.errors,atlas:l.atlas,tris:l.tris,size:l.size?l.size():null,inner:[innerWidth,innerHeight],dpr:devicePixelRatio,nogl:document.body.classList.contains('nogl')}")
    print(json.dumps(info)[:1500])
    return info


def enter():
    js("window.__lab.start()")
    step(4600)


def visit(view, settle=2600):
    js("window.__lab.go(arguments[0])", view)
    step(settle)


def home():
    while js("return window.__lab.st.view") != "home":
        js("window.__lab.back()")
        step(2200)


try:
    info = load()
    if not info["ready"]:
        sys.exit(1)
    for plan in PLANS:
        if plan == "first":
            shot("00_loader")
            enter()
            shot("01_home")
        elif plan == "stills":
            enter()
            shot("01_home")
            for v in ["education", "honors", "skills", "teaching", "publications", "contact", "ack"]:
                visit(v, 3200 if v == "teaching" else 2600)
                shot("10_" + v)
                home()
            visit("research")
            shot("20_research")
            for v in ["barstow", "mason", "wolchok"]:
                visit(v)
                shot("21_" + v)
                js("window.__lab.back()")
                step(2200)
            home()
        elif plan == "intro":
            shot("30_intro_loader")
            js("window.__lab.start()")
            for i, ms in enumerate([0, 600, 1200, 1800, 2400, 3000, 3800, 4600]):
                step(ms - ([0, 0, 600, 1200, 1800, 2400, 3000, 3800][i]) if i else 16.7)
                shot(f"31_intro_{ms:04d}ms")
        elif plan == "transitions":
            enter()
            for v, times in [("education", [300, 700, 1100, 1500]), ("teaching", [400, 800, 1200, 1600, 2000, 2600]), ("publications", [300, 700, 1100, 1700]), ("research", [500, 1000])]:
                js("window.__lab.go(arguments[0])", v)
                prev = 0
                for t in times:
                    step(t - prev)
                    prev = t
                    shot(f"40_{v}_{t:04d}ms")
                if v == "research":
                    js("window.__lab.go('barstow')")
                    prev = 0
                    for t in [300, 600, 900, 1300, 2000]:
                        step(t - prev)
                        prev = t
                        shot(f"41_barstow_{t:04d}ms")
                step(1500)
                home()
finally:
    d.quit()
