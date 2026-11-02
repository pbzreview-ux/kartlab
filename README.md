# KartLab Physics Lab — v0.4 (video-guided)

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
Unverified sliders are adjustable and persist as `kartlab-physics-v4` in
localStorage. An unchanged v0.3 preset is migrated to the new coasting
defaults; manual tuning changes are preserved where compatible. Use **Reset
values** to try the exact new v0.4 defaults.

## Deploy to GitHub and Render (existing site)

1. Download and **extract** `kartlab-physics-v0.4.zip`.
2. Open your **existing KartLab GitHub repository**.
3. Replace/upload **all 11 files** at the **repository root**. Keep
   `reference_trace.js` alongside `physics.js` and `main.js`. Do not
   upload the ZIP itself, and do not nest files in a new directory.
4. Commit changes. If auto-deploy is enabled, Render rebuilds the site.
5. Reload `https://kartlab.onrender.com/` and look for **V0.4**.

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
