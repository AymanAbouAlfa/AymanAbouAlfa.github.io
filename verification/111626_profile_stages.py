"""Per-stage GPU time (one timer query per render stage) at 2560x1440 in a visible Firefox window.

Usage:  python 111626_profile_stages.py <firefox-binary> [extra-url-params]
"""
import sys
import time
from pathlib import Path

import numpy as np
from selenium import webdriver
from selenium.webdriver.firefox.options import Options

ROOT = Path(__file__).resolve().parent.parent
o = Options()
o.binary_location = sys.argv[1]
o.set_preference("webgl.enable-privileged-extensions", True)
o.set_preference("privacy.reduceTimerPrecision", False)
d = webdriver.Firefox(options=o)
try:
    d.set_window_rect(x=60, y=40, width=1280, height=805)
    d.get((ROOT / "index.html").as_uri() + "?perf&prof" + (sys.argv[2] if len(sys.argv) > 2 else ""))
    for _ in range(300):
        if d.execute_script("return !!(window.__lab && window.__lab.ready)"):
            break
        time.sleep(0.1)
    d.execute_script("window.__lab.start()")
    time.sleep(5.5)
    for v in ["education", "teaching", "publications", "research"]:
        d.execute_script("window.__lab.go(arguments[0])", v); time.sleep(2.6)
        d.execute_script("window.__lab.back()"); time.sleep(2.2)
    prof = d.execute_script("return window.__lab.prof")
finally:
    d.quit()
tot = 0
for k, v in prof.items():
    a = np.array(v); tot += a.mean()
    print(f"{k:18s} avg {a.mean():6.2f}  p99 {np.percentile(a, 99):6.2f}  max {a.max():6.2f}  n {len(a)}")
print(f"{'sum of averages':18s} {tot:10.2f}")
