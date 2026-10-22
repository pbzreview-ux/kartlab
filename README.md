# KartLab Physics Lab

An original, tunable 3D kart physics test environment. Designed as the first stage of a browser multiplayer training game **inspired by** Smash Karts. This is *not* the proprietary Smash Karts physics engine and does not include its assets, map data, or source code.

## Current scope

- Playable 3D kart with WASD/arrow controls; **R** reset, **C** alternate camera.
- Deterministic fixed-step driving physics at 120 Hz.
- Throttle, reverse, brake, coast, turning, lateral grip and steering response.
- Physics sliders, persistent browser preset, copyable JSON values.
- Automated, repeatable acceleration/coasting benchmark.
- Minimal flat grid environment; **no maps or multiplayer yet**.

## Run on your computer

Requires Node.js 20.19+ or 22.12+.

```bash
npm ci
npm run dev
```

Open the address Vite prints, usually http://localhost:5173.

## Deploy for free to Render (static site)

1. Push this entire folder to a **new GitHub repository**.
2. In Render, create a new **Static Site** from that repository (or import `render.yaml`).
3. Build command: `npm ci && npm run build`.
4. Publish directory: `dist`.

The game runs locally in each player's browser. This initial release has no realtime multiplayer server, so multiple visitors do not share a room. The later multiplayer game will need a Render **Web Service** with WebSocket server and authoritative room logic.

## How to match real Smash Karts behavior

The current baseline numbers are **experimental**, not known source-game constants. An exact match cannot honestly be certified without original engine values or independently measured reference data.

Capture reference tests from Smash Karts at a fixed camera angle and known frame rate:

1. From rest, press W for 4 seconds. Measure distance traveled (using two repeatable landmarks) and approximate acceleration curve.
2. From top speed, release W for 3 seconds. Measure coasting distance and remaining speed.
3. From rest, press S for 3 seconds. Measure reverse acceleration/top speed.
4. At established top speed, hold A for exactly 2 seconds. Measure total heading rotation and curve radius.
5. Drive forward, then hold S to brake. Record time to stop and time until reverse motion.
6. Repeat each test three times; average the measurements.

Tune settings in the physics sidebar to match the reference tests. Use **Run Benchmark** to maintain consistent before/after results. Copy and preserve the final preset. The eventual game client and authoritative server should consume **the same constants and stepKart() rules**.

## Implementation notes

- `src/physics.js`: reusable, deterministic physics kernel. It is deliberately independent of Three.js and browser APIs.
- `src/main.js`: Three.js test renderer, input and camera.
- `tests/physics.test.js`: numerical constraints and deterministic regression tests.

Run tests with `npm test`. Tests verify this implementation works; they do **not** establish parity with the original game.

## Roadmap

1. Reference footage and measurement-based calibration.
2. Controller parity and mobile steering feel.
3. Authoritative WebSocket multiplayer simulation and prediction/reconciliation.
4. Weapon physics and combat mechanics.
5. Custom training maps and practice modes.
