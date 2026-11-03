# KartLab Physics Lab — v0.6 (live capture import)

An **independently coded**, free-to-host kart physics sandbox that can repeat
the user-recorded Smash Karts input sequence. This is **not** the original game,
and we cannot truthfully promise bit-for-bit identical physics without the
original controller source and runtime measurements.

## Reference footage used

The user's second recording was readable: **2274×1264, 30 fps, 61.57 seconds**.
The visible yellow keyboard overlay was sampled **15 times per second**,
providing an approximate W/A/S/D/SPACE input timeline:

| Video time | Visible held keys | Calibration use |
| --- | --- | --- |
| 29.2–32.7s | W+A | Sustained powered left circle |
| 32.7–37.2s | W+D | Sustained powered right circle |
| 45–51s | Mostly A alone, with brief W taps | Coast-and-turn / momentum |
| 52.6–54.9s | D alone | Clear unpowered steering segment |
| 14.7–21s | S with alternating A/D | Reverse steering |
| Several brief points | SPACE | Fire-key visual indicator |

The video has no known world-meter scale, no reliable absolute speed readout,
and a moving camera. Therefore measurements such as acceleration in m/s²,
steering torque or actual 1m/s threshold **cannot be directly recovered** from it.
The footage supports behavior and approximate timing, not exact source constants.

## v0.4 physics correction

v0.3 scrubbed most of the kart's speed in ~**1.07 seconds** after accelerating
and steering alone; that was too abrupt compared with the sustained movement
visible around the D-only 52.6–54.9s input interval.

v0.4 introduces **a separate lower lateral-grip setting when no throttle is
pressed** and lets steering torque depend on remaining total momentum during
coasting. Its repeatable W 3s → A-only benchmark now lasts about **2.31s**
before slowing under 1m/s. This is a model calibration hypothesis, **not** an
officially measured Smash Karts stop time.

Powered turning, reverse driving, acceleration, and camera tuning remain
experimental. The steering-circle test and all user controls remain intact.

## v0.5 — video comparison, reproducible drift fix

We extracted the user's actual W/A/S/D/SPACE states from the 61.6-second
recording at 15 Hz, then simulated all 924 recorded input frames with eight
120 Hz physics updates per frame. This is the *same key sequence*, not a
handwritten approximation of the driving pattern.

Before v0.5, coasting at an angle could make the kart's body-axis velocity
temporarily negative while it was still moving forward overall. The physics
mistakenly treated that as selecting reverse gear, so continued A-only or
D-only steering alternated direction. The drive direction is now retained
until the player intentionally accelerates in the opposite direction.

The clearest two sustained circles in the reference video were measured by
comparing repeated background landmarks at different video time offsets.
The **screen view** repeats approximately every **2.33s (W+A)** and **2.27s
(W+D)**. This estimate is affected by the follow camera and terrain and is
**not** an exact wheel rotation measurement. After replaying the exact video
inputs, KartLab's mean simulated turn periods are **2.27s** and **2.26s**.

During the video section at 52.6–54.93s, the user held only D after a W
acceleration. In KartLab's same-sequence replay, speed decreases from about
**21.8 to 1.0 model m/s**, while the heading rotates right about **239°**
with **zero unintended steering reversals**. Video confirms a continued sharp
turn and slowdown; the original game's real m/s and exact degrees cannot be
measured from these pixels alone.

The **RUN TESTS** panel and its exported JSON include these same-input
comparisons. The automated suite has regression tests, including
regressions for forward/reverse steering direction. Camera smoothing,
engine force, surface grip, map collisions, weapon handling and absolute
world scale still require additional ground-truth measurements.

## v0.6 — record your own live Smash Karts gameplay

The `capture-extension/` folder contains a minimal Manifest V3 Chrome/Edge
extension for `https://smashkarts.io` only. On that site it displays a small
capture panel. The player clicks Start, chooses whether to share the game's
tab as a local WebM recording, drives, then presses F9 to stop. It captures
the **exact relative millisecond timestamps** of W/A/S/D/arrow and Space
presses/releases, plus 50ms input samples. It does **not** access the game
internals, collect other keystrokes, transmit data, or upload files.

Download the resulting JSON and optional WebM separately. In KartLab's
Physics panel, use **import capture JSON** to replay the exact key states at
120Hz, and select the WebM in the local video field to view both side by
side. Existing 61.6-second reference playback remains the default; the
standard RUN TESTS benchmark still compares against that original reference.
The capture JSON import validates origin, duration, ordered timestamps, masks,
and file size before using it.

The new capture path can improve input timing precision enormously, but a
recording cannot prove identical 3D physics by itself: the original Unity
controller and its world-space measurements are not exposed. The plan is to
derive screen-motion/turn response from local videos and refine measured
segments; avoid interpreting pixel travel as absolute meters.

## Verified Unity prefab values (same as v0.3)

| Setting | Saved value |
| --- | --- |
| Rigidbody mass | 1.5 |
| Linear drag | 1 |
| Angular drag | 5 |
| Gravity | Enabled |
| Kinematic | Disabled |
| Rigidbody interpolation | Interpolate |
| Collision detection | Discrete |
| Rigidbody constraints | None |
| Automatic center of mass | Enabled |

These come from a publicly shipped game prefab, not speculation. KartLab's
browser-side force model **approximates**, but does not execute, Unity PhysX.
The real game's acceleration, steering, camera and tire-grip formulas remain
unknown. Two serialized numbers 7 and 50 are still unlabeled.

## New replay tools

1. **REPLAY W → A** runs the original 3-second acceleration + 4-second
   steering-only controlled test.
2. **REPLAY RECORDED KEYS** (in the right Physics panel) plays **all 61.6
   seconds** of the keyboard input trace sampled from the actual recording.
3. The interface highlights W, A, S, D and SPACE during playback. SPACE
   indicates fire input but no weapon is implemented yet.
4. Optional: choose your **local** original MP4 using the Physics panel's
   file input. The video appears in the panel while the simulated kart runs
   the extracted input timeline. **The MP4 is never uploaded by KartLab** and
   is **not included in this small ZIP**.
5. **RUN TESTS** gives reproducible performance measurements and can download
   JSON. **RECORD RUN** captures KartLab's estimated movement and key inputs.

Keys W/A/S/D or arrow keys drive the kart; R resets; C changes camera.
Unverified sliders are adjustable and persist as `kartlab-physics-v6` in
localStorage. Existing v0.5/v0.4 presets migrate without losing individual tuning
changes, with older presets still supported. Use **Reset values** to try the
baseline settings.

## Deploy to GitHub and Render (existing site)

1. Download and **extract** the current KartLab release ZIP, or clone the repository.
2. Open your **existing KartLab GitHub repository**.
3. Replace/upload the source files at the **repository root**. Keep
   `reference_trace.js`, `reference_calibration.js`, and `capture_import.js` alongside `physics.js` and `main.js`. Do not
   upload the ZIP itself, and do not nest files in a new directory.
4. Commit changes. If auto-deploy is enabled, Render rebuilds the site.
5. Reload `https://kartlab.onrender.com/` and look for **V0.6**.

For a Render Static Site, the unchanged build settings are:

- Build: `npm ci && npm run build`
- Publish directory: `dist`

This still uses ordinary free static hosting, with **no multiplayer server**
and **no gameplay maps or weapons** yet.

## Develop and verify

```bash
npm ci
npm test
npm run build
npm run dev
```

Physics uses a 120 Hz fixed timestep chosen by KartLab; the original game's
actual physics timestep has **not** been independently verified.
