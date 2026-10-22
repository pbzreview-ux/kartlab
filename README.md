# KartLab Physics Lab — v0.2

An independently built kart-physics practice prototype. It is **not** the original Smash Karts physics engine. The parameters below are still estimates, not verified source-game constants.

## What's new

- A first steering/drift adjustment informed by the October 22 reference video: `steerRate` now 145°/s and `lateralGrip` 3.4/s (v0.1 used 116°/s and 8.5/s).
- **Important input correction:** releasing W and holding only A or D should turn tightly using existing momentum, lose speed quickly through steering resistance, and stop after about 4 seconds under the current tentative model. This is distinct from holding W+A continuously. New sliders: *Steering-only speed loss* and *Steering-only sharpness*.
- Both rear tires leave skid trails during significant sideways sliding, so circle size and trail shape are easier to compare.
- A prominent W/A/S/D monitor displays the keys you're holding (arrow keys appear as their W/A/S/D equivalents).
- **Record Run** resets the kart and starts logging position, angle, input, speed, slip, and turn rate at 10 samples/s. **Stop & Save Log** downloads the result as JSON; you can upload that file to the chat for measurement.
- Physics sliders still work; existing deliberate preset changes from v0.1 are carried over. Previously untouched steering/grip defaults are upgraded.
- Root-level files match the GitHub structure you used for your existing Render site.

## Update the existing GitHub/Render site

1. Download and **extract** the ZIP. Do not upload the ZIP itself as your website source.
2. Replace the matching files in the **root** of your existing `kartlab` GitHub repo. Do not put these files into a new `kartlab-physics-v02` subfolder.
3. Keep `index.html`, `main.js`, `style.css`, and `physics.js` together at the root. `index.html` already references `/main.js`.
4. Commit the files. Render should build the new version from GitHub automatically.
5. Reload your Render website. The header should display **V0.2**.

Existing user login/profile data is not part of this physics prototype. It is a solo sandbox; this update does not add shared rooms or multiplayer.

## Test the new version

1. Open the website on a desktop browser. Press **R** to reset. **W** accelerates, **S** reverses, and **A/D** turn. You can also use the arrow keys.
2. Accelerate with **W** for about 3 seconds, **release W entirely**, then hold only **A** for about 4 seconds. The kart should turn sharply at first and then stop from steering resistance. Compare the rubber circle radius and stopping time with Smash Karts.
3. Test **W+A** from rest separately; that is a *powered* turn and should behave differently from steering-only coasting.
4. Use **Record Run**, repeat the first maneuver, then press **Stop & Save Log**. Upload the downloaded `kartlab-drive-*.json` if you want the exact KartLab telemetry analyzed.
5. Record a video of the reference game while showing your key presses with a keyboard overlay, or tell us precise input start/stop times. The reference game video alone doesn't expose the hidden key inputs or physics constants.
6. Try **Reset values** in the Physics sidebar to apply the new experimental defaults. If you adjust any slider, its value is saved in this browser.

## Run locally

Install Node.js 20.19+ or 22.12+. In this folder:

```bash
npm ci
npm run dev
```

`npm test` runs movement regressions. `npm run build` produces `dist/`, the folder Render serves as a **Static Site**. For Render, use build command `npm ci && npm run build` and publish directory `dist`.

## Accuracy limitations and next work

The footage shows the original kart making tight circles with substantial visible sideslip. The user clarified the important input pattern: accelerate, release acceleration, and steer alone to spin down. It does not yet provide synchronized exact control timing, a known real-world distance scale, or speed data, so the updated values are a **working hypothesis**, not proof of identical physics.

Next steps are to quantify speed, coasting, circle time, steering reversals, and reverse turns, then work on collision, weapon behavior, maps, and eventual multiplayer. Multiplayer needs a separate authoritative real-time server; this static site works for anyone to **visit**, but everyone still drives alone.
