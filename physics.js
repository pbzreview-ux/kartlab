/*
 * Deterministic, original kart movement model, calibrated through observed behavior.
 * Coordinate system: heading 0 points along negative Z; +X is right.
 * Do not represent these values as the proprietary Smash Karts physics constants.
 */

export const STEP = 1 / 120;

export const BASELINE = Object.freeze({
  forwardAcceleration: 16.5,   // m/s²
  reverseAcceleration: 9,
  maxForwardSpeed: 23.5,       // m/s, 84.6 km/h on the illustrative HUD
  maxReverseSpeed: 8.5,
  coastDrag: 1.3,              // m/s², linear slowing
  coastTurnDrag: 4.8,          // additional m/s² while steering without throttle
  brakeAcceleration: 31,      // m/s², when changing travel direction
  steerRate: 145,             // experimental tighter turning, degrees/second
  coastTurnBoost: 1.35,       // steering yaw multiplier when throttle released
  turnFullSpeed: 10.5,        // m/s
  steerResponse: 10,          // smooth input response, 1/s
  lateralGrip: 3.4,           // experimental sliding: slower sideways-velocity decay
  cameraDistance: 12.5,       // render-only
  cameraHeight: 6.1,          // render-only
  cameraSmoothing: 5.5        // render-only
});

export const CONTROL_DEFINITIONS = [
  { title: 'ENGINE', fields: [
    ['forwardAcceleration', 'Forward acceleration', 4, 35, 0.5, 'm/s²'],
    ['maxForwardSpeed', 'Maximum speed', 7, 40, 0.5, 'm/s'],
    ['reverseAcceleration', 'Reverse acceleration', 2, 22, 0.5, 'm/s²'],
    ['maxReverseSpeed', 'Reverse speed cap', 3, 20, 0.5, 'm/s'],
    ['coastDrag', 'Coasting resistance', 0, 12, 0.1, 'm/s²'],
    ['coastTurnDrag', 'Steering-only speed loss', 0, 12, 0.2, 'm/s²'],
    ['brakeAcceleration', 'Braking strength', 8, 60, 0.5, 'm/s²']
  ]},
  { title: 'STEERING', fields: [
    ['steerRate', 'Turning speed', 40, 260, 1, '°/s'],
    ['coastTurnBoost', 'Steering-only sharpness', 1, 2.5, 0.05, '×'],
    ['turnFullSpeed', 'Full-steering threshold', 1, 24, 0.5, 'm/s'],
    ['steerResponse', 'Steering responsiveness', 1, 30, 0.5, '1/s'],
    ['lateralGrip', 'Sideways grip', 0.5, 25, 0.5, '1/s']
  ]},
  { title: 'CAMERA', fields: [
    ['cameraDistance', 'Follow distance', 6, 21, 0.5, 'm'],
    ['cameraHeight', 'Camera height', 3, 14, 0.5, 'm'],
    ['cameraSmoothing', 'Camera follow speed', 0.5, 15, 0.5, '1/s']
  ]}
];

export function createKart() {
  return { x: 0, z: 0, heading: 0, vx: 0, vz: 0, steer: 0, yawRate: 0, distance: 0, elapsed: 0 };
}

export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

function moveToward(value, target, maximumStep) {
  return value + clamp(target - value, -maximumStep, maximumStep);
}

export function getKinematics(state) {
  const sin = Math.sin(state.heading), cos = Math.cos(state.heading);
  const longitudinal = -sin * state.vx - cos * state.vz;
  const lateral = cos * state.vx - sin * state.vz;
  return { longitudinal, lateral, speed: Math.hypot(state.vx, state.vz) };
}

/** Mutates the kart state. Call with a fixed dt, ideally STEP. */
export function stepKart(state, input, physics = BASELINE, dt = STEP) {
  if (!(dt > 0 && dt <= 0.05)) throw new Error('Physics requires a bounded positive time step');
  const throttle = clamp(Number(input.throttle) || 0, -1, 1);
  const steering = clamp(Number(input.steer) || 0, -1, 1);
  const k = getKinematics(state);
  let forward = k.longitudinal;
  // Steering response is updated before coasting friction, so releasing W while
  // holding A/D immediately starts scrubbing tire speed and turning sharply.
  state.steer += (steering - state.steer) * (1 - Math.exp(-physics.steerResponse * dt));

  if (throttle > 0) {
    forward = forward < -0.03
      ? moveToward(forward, 0, physics.brakeAcceleration * throttle * dt)
      : Math.min(physics.maxForwardSpeed, forward + physics.forwardAcceleration * throttle * dt);
  } else if (throttle < 0) {
    forward = forward > 0.03
      ? moveToward(forward, 0, physics.brakeAcceleration * -throttle * dt)
      : Math.max(-physics.maxReverseSpeed, forward + physics.reverseAcceleration * throttle * dt);
  } else {
    const steeringDrag = physics.coastTurnDrag * Math.abs(state.steer);
    forward = moveToward(forward, 0, (physics.coastDrag + steeringDrag) * dt);
  }

  // Smooth steering gives weight/momentum without requiring a drift key.
  const turnFraction = clamp(Math.abs(forward) / Math.max(0.01, physics.turnFullSpeed), 0, 1);
  const travelSign = forward < -0.01 ? -1 : 1;
  const coastBoost = throttle === 0 ? physics.coastTurnBoost : 1;
  state.yawRate = -state.steer * travelSign * turnFraction * physics.steerRate * coastBoost * Math.PI / 180;
  state.heading += state.yawRate * dt;
  state.heading = Math.atan2(Math.sin(state.heading), Math.cos(state.heading));

  // As the body turns, some world-space momentum remains in the old direction.
  const newHeadingSin = Math.sin(state.heading), newHeadingCos = Math.cos(state.heading);
  const remainingLateral = (newHeadingCos * state.vx - newHeadingSin * state.vz) * Math.exp(-physics.lateralGrip * dt);
  state.vx = -newHeadingSin * forward + newHeadingCos * remainingLateral;
  state.vz = -newHeadingCos * forward - newHeadingSin * remainingLateral;

  // Turning must not introduce kinetic energy beyond the drive-mode speed cap.
  const limit = forward < -0.01 ? physics.maxReverseSpeed : physics.maxForwardSpeed;
  const speedMagnitude = Math.hypot(state.vx, state.vz);
  if (speedMagnitude > limit) {
    const scale = limit / speedMagnitude;
    state.vx *= scale;
    state.vz *= scale;
  }

  const travel = Math.hypot(state.vx, state.vz) * dt;
  state.x += state.vx * dt;
  state.z += state.vz * dt;
  state.distance += travel;
  state.elapsed += dt;
  return state;
}

export function runBenchmark(physics = BASELINE) {
  // Phase A: 4s straight; phase B: 3s coasting. Completely deterministic.
  const kart = createKart();
  let reach20 = null;
  const phaseSteps = Math.round(4 / STEP);
  for (let i = 0; i < phaseSteps; i++) {
    stepKart(kart, { throttle: 1, steer: 0 }, physics);
    if (reach20 === null && getKinematics(kart).longitudinal >= 20) reach20 = kart.elapsed;
  }
  const accelDistance = kart.distance;
  for (let i = 0; i < Math.round(3 / STEP); i++) stepKart(kart, { throttle: 0, steer: 0 }, physics);
  return {
    secondsTo20: reach20,
    distanceAt4: accelDistance,
    coastDistance: kart.distance - accelDistance,
    speedAt7: getKinematics(kart).longitudinal
  };
}

export function validatePreset(preset) {
  const clean = { ...BASELINE };
  for (const group of CONTROL_DEFINITIONS) {
    for (const [key, , min, max] of group.fields) {
      const value = Number(preset?.[key]);
      if (Number.isFinite(value)) clean[key] = clamp(value, min, max);
    }
  }
  return clean;
}
