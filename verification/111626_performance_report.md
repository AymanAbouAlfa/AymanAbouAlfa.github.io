# Performance report

**Gate status: passed in all three final runs.** Target: GPU frame time ≤ 11 ms on average, with no frame
over 16.7 ms during animations, at 2560×1440.

| Run | Frames | GPU avg (ms) | GPU p99 (ms) | GPU max (ms) | Frames > 16.7 ms | Interval avg (ms) | Interval p99 (ms) | Interval max (ms) | Intervals > 25 ms | CPU avg (ms) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 3144 | 9.54 | 12.59 | 15.85 | 0 | 16.67 | 17.13 | 17.56 | 0 | 0.36 |
| 2 | 3140 | 8.99 | 11.94 | 14.58 | 0 | 16.69 | 17.31 | 48.08 | 3 | 0.34 |
| 3 | 3144 | 10.53 | 13.66 | 15.68 | 0 | 16.67 | 17.14 | 17.50 | 0 | 0.34 |

These are the frames inside animation windows. The three intervals over 25 ms in run 2 are at the very start
of the intro zoom (the first frames after the loading screen is dismissed).

## Setup

- MacBook Air, Apple M5, macOS 26.6.2, built-in display (60 Hz).
- Firefox 159.0.1 (official build from Mozilla's archive, checksum verified, run from a scratch directory with
  its updater disabled), in a visible window, fresh profile.
- Window content area 1280×720 CSS px at device-pixel-ratio 2, so the canvas drawing buffer is exactly
  2560×1440. Main pass is 4× multisampled.
- Script: `verification/111626_measure_performance.py`. Raw per-run summaries:
  `verification/111626_performance_summary_run1.json` to `run3.json`.

## What was measured

- **GPU time:** one `TIME_ELAPSED` query (`EXT_disjoint_timer_query`) wrapped around all of a frame's WebGL
  commands, from the first shadow pass to the final composite. It does not include Firefox's own compositor.
- **Frame interval:** the time between consecutive `requestAnimationFrame` callbacks.
- **CPU:** time spent in the page's own update and draw calls per frame.
- **Animation window:** from each navigation click until 2.2 s later (camera move of about 1.3 s plus drawers,
  lids and pages settling); 4.0 s for the intro zoom.
- **Tour:** intro zoom; into and out of Education, Honors, Skills, Teaching (with page flip), Publications,
  Contact and Acknowledgments (drawers opening and closing); into Research, then each of the three plates
  (lid lift) and back.

Two things differ from the wording of the brief:
- Firefox reports 0 bits for `TIMESTAMP` queries on this machine, so absolute GPU timestamps are not
  available. Elapsed-time queries are used instead.
- Firefox only exposes timer queries when `webgl.enable-privileged-extensions` is set. The measurement script
  sets it in its own throwaway profile; the site never needs it.

## Per animation (all three runs pooled)

| Animation | Frames | GPU avg (ms) | Worst-run p99 (ms) | GPU max (ms) |
|---|---|---|---|---|
| Intro zoom | 716 | 8.17 | 13.50 | 14.02 |
| To Education bottle | 396 | 9.87 | 13.74 | 14.58 |
| To Honors flask | 396 | 9.70 | 13.06 | 13.21 |
| To Skills tubes | 396 | 10.40 | 13.28 | 13.32 |
| To notebook, page flip | 396 | 9.86 | 13.56 | 13.82 |
| To Publications drawer, opening | 396 | 9.88 | 13.08 | 13.61 |
| To Contact drawer, opening | 396 | 9.99 | 13.40 | 14.04 |
| To Acknowledgments drawer, opening | 396 | 9.91 | 12.77 | 13.20 |
| To Research plates, and back from a plate | 1584 | 9.74 | 14.60 | 15.47 |
| To Barstow plate, lid lift | 396 | 9.71 | 12.20 | 13.05 |
| To Mason plate, lid lift | 396 | 9.80 | 13.40 | 14.11 |
| To Wolchok plate, lid lift | 396 | 9.26 | 13.70 | 14.50 |
| Back to home (drawers closing, pages turning back) | 3168 | 9.82 | 14.00 | 15.85 |

## Outside the animation windows

| Run | Frames | GPU avg (ms) | GPU p99 (ms) | GPU max (ms) | Frames > 16.7 ms | Interval max (ms) |
|---|---|---|---|---|---|---|
| 1 | 802 | 10.14 | 12.52 | 15.07 | 0 | 269.80 |
| 2 | 807 | 9.36 | 12.15 | 15.24 | 0 | 17.50 |
| 3 | 808 | 11.43 | 14.41 | 21.84 | 1 | 17.54 |

- Run 3's idle average is above 11 ms and it has one idle frame at 21.84 ms. The gate is on animation
  frames, but these are worth knowing about.
- Run 1 has one 270 ms gap between frames while idle. A blank page in the same browser, timed for 45 s
  straight after these runs, showed a 185 ms gap of the same kind, so this is the machine, not the site.

## Caveats

- **The GPU slows its clock when the load is light.** Rendering a quarter of the pixels took about half the
  time, not a quarter, and identical frames flip between a faster and a slower level a few milliseconds apart.
  So the averages sit in a band (9.0 to 10.5 ms across these runs) that depends on which level the GPU chooses,
  and idle frames can measure slower than animation frames. Treat run-to-run differences of 1 to 1.5 ms as
  noise.
- **The margin is modest.** The slowest run averaged 10.53 ms against the 11 ms limit, and the slowest single
  animation frame was 15.85 ms against 16.7 ms.
- **Other activity on the machine shows up in the numbers.** Earlier runs made while other work was running
  had stalls and occasional frames over 16.7 ms. Re-run the script on a quiet machine to reproduce.

## What made the difference

The first measurement of the finished scene averaged about 18 ms with dropped frames. The changes that brought
it down, largest first:
- Shadow filtering and ambient occlusion computed once in a third-resolution screen-space pass, instead of
  per pixel in the main pass.
- Static and moving shadow casters split, so an animation redraws only the moving objects into the shadow maps.
- Reflections and strip-light glints skipped on matte surfaces.
- Bloom computed from quarter resolution.
- HDR targets in a lighter 11/11/10-bit float format, with dithering so gradients do not band.
- Blurred shadows and a backdrop blur removed from the interface CSS, which were competing for the GPU
  during fades.

4× multisampling was kept: it cost about 1 ms.
