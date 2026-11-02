/*
 * KartLab v0.5: independent kart-physics calibration simulator.
 * Verified Rigidbody prefab properties are kept separate from unverified
 * motor, steering, camera, and grip parameters. This is not Unity PhysX.
 * Coordinates: heading 0 faces -Z; +X points right.
 */

export const STEP = 1 / 120;

export const CONFIRMED_RIGIDBODY = Object.freeze({
  mass: 1.5,
  linearDrag: 1.0,
  angularDrag: 5.0,
  useGravity: true,
  isKinematic: false,
  interpolation: 'Interpolate',
  collisionDetection: 'Discrete',
  constraints: 'None',
  automaticCenterOfMass: true,
  centerOfMassMarkerY: 0.6 // child marker; whether the game uses it is unknown
});

// These are experimental KartLab estimates, NOT recovered Smash Karts values.
export const BASELINE = Object.freeze({
  engineForce: 44,
  reverseForce: 20,
  brakeForce: 46.5,
  maxForwardSpeed: 23.5,
  maxReverseSpeed: 8.5,
  coastSteeringDrag: 0.12,
  coastLateralGrip: 0.28,
  steeringTorque: 800,
  maxYawRate: 215,
  coastTurnBoost: 1.25,
  turnFullSpeed: 10.5,
  steerResponse: 10,
  lateralGrip: 3.4,
  cameraDistance: 12.5,
  cameraHeight: 6.1,
  cameraSmoothing: 5.5
});

export const CONTROL_DEFINITIONS = [
  { title: 'DRIVE FORCE · ESTIMATED', fields: [
    ['engineForce', 'Forward drive force', 8, 100, 1, 'F'],
    ['maxForwardSpeed', 'Maximum forward speed', 7, 40, 0.5, 'm/s'],
    ['reverseForce', 'Reverse drive force', 5, 55, 1, 'F'],
    ['maxReverseSpeed', 'Maximum reverse speed', 3, 20, 0.5, 'm/s'],
    ['brakeForce', 'Direction-change braking', 12, 120, 0.5, 'F'],
    ['coastSteeringDrag', 'Extra steering-only drag', 0, 4, 0.01, '1/s'],
    ['coastLateralGrip', 'Coasting lateral grip', 0, 12, 0.01, '1/s']
  ] },
  { title: 'STEERING & GRIP · ESTIMATED', fields: [
    ['steeringTorque', 'Steering angular acceleration', 150, 1800, 25, '°/s²'],
    ['maxYawRate', 'Maximum turning speed', 55, 350, 5, '°/s'],
    ['coastTurnBoost', 'Coasting steering boost', 1, 2.8, 0.05, '×'],
    ['turnFullSpeed', 'Full-steering speed', 1, 24, 0.5, 'm/s'],
    ['steerResponse', 'Steering input response', 1, 30, 0.5, '1/s'],
    ['lateralGrip', 'Extra lateral grip', 0.5, 25, 0.1, '1/s']
  ] },
  { title: 'CAMERA · ESTIMATED', fields: [
    ['cameraDistance', 'Follow distance', 6, 21, 0.5, 'm'],
    ['cameraHeight', 'Camera height', 3, 14, 0.1, 'm'],
    ['cameraSmoothing', 'Camera follow speed', 0.5, 15, 0.5, '1/s']
  ] }
];

export const REPLAY_COAST_TURN = Object.freeze([
  { duration: 3, input: { throttle: 1, steer: 0 }, label: 'W · 3 seconds' },
  { duration: 4, input: { throttle: 0, steer: -1 }, label: 'Release W, hold A · 4 seconds' }
]);

export function createKart() {
  return { x: 0, z: 0, heading: 0, vx: 0, vz: 0, steer: 0, yawRate: 0,
    driveDirection: 1, distance: 0, elapsed: 0 };
}

export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

export function getKinematics(state) {
  const sin = Math.sin(state.heading), cos = Math.cos(state.heading);
  return {
    longitudinal: -sin * state.vx - cos * state.vz,
    lateral: cos * state.vx - sin * state.vz,
    speed: Math.hypot(state.vx, state.vz)
  };
}

/** Deterministic physics update; uses the confirmed mass and damping values. */
export function stepKart(state, input, tuning = BASELINE, dt = STEP) {
  if (!(dt > 0 && dt <= 0.05)) throw new Error('Physics requires a positive step <= 0.05s');
  const throttle = clamp(Number(input?.throttle) || 0, -1, 1);
  const steering = clamp(Number(input?.steer) || 0, -1, 1);
  const { mass, linearDrag, angularDrag } = CONFIRMED_RIGIDBODY;
  state.steer += (steering - state.steer) * (1 - Math.exp(-tuning.steerResponse * dt));

  const current = getKinematics(state);
  let forward = current.longitudinal;
  let lateral = current.lateral;

  // Force/mass acceleration. Braking does not instantly snap into reverse.
  if (throttle > 0) {
    const force = forward < -0.04 ? tuning.brakeForce : tuning.engineForce;
    const delta = force / mass * throttle * dt;
    forward = forward < -0.04 ? Math.min(0, forward + delta) : forward + delta;
  } else if (throttle < 0) {
    const force = forward > 0.04 ? tuning.brakeForce : tuning.reverseForce;
    const delta = force / mass * -throttle * dt;
    forward = forward > 0.04 ? Math.max(0, forward - delta) : forward - delta;
  }

  // Remember the last *intentional* drive direction. During an unpowered
  // drift, world-space momentum can move behind the nose as the kart turns.
  // That does not mean the player selected reverse. Using signed body-axis
  // velocity to choose steering direction made A-only/D-only turns oscillate
  // between left and right as the body crossed 90° to its slip velocity.
  if (throttle > 0 && forward > 0.05) state.driveDirection = 1;
  if (throttle < 0 && forward < -0.05) state.driveDirection = -1;

  // Stable discrete approximation of the real Rigidbody's linear drag = 1.
  // Side grip and additional steering scrub are unverified effects.
  const bodyDamping = 1 / (1 + linearDrag * dt);
  forward *= bodyDamping;
  // Reference footage shows substantial sideways momentum while A/D is held
  // without throttle. Separate coasting grip prevents immediately destroying
  // all velocity when the body spins relative to its original travel path.
  const appliedGrip = throttle === 0 ? tuning.coastLateralGrip : tuning.lateralGrip;
  lateral *= bodyDamping * Math.exp(-appliedGrip * dt);
  if (throttle === 0) {
    const steeringScrub = 1 / (1 + tuning.coastSteeringDrag * Math.abs(state.steer) * dt);
    forward *= steeringScrub;
    lateral *= steeringScrub;
  }

  forward = clamp(forward, -tuning.maxReverseSpeed, tuning.maxForwardSpeed);
  // Preserve world-space velocity after rotation; this produces true slipping
  // rather than rotating the velocity vector along with the visual kart.
  const sin = Math.sin(state.heading), cos = Math.cos(state.heading);
  state.vx = -sin * forward + cos * lateral;
  state.vz = -cos * forward - sin * lateral;
  const speedLimit = forward < -0.01 ? tuning.maxReverseSpeed : tuning.maxForwardSpeed;
  const worldSpeed = Math.hypot(state.vx, state.vz);
  if (worldSpeed > speedLimit) {
    const scale = speedLimit / worldSpeed;
    state.vx *= scale;
    state.vz *= scale;
  }

  // Unknown input torque and known angular drag = 5. Steering is applied as
  // angular acceleration and yaw has momentum; it is not set instantaneously.
  // During a coast/drift the original kart continues to steer even when its
  // longitudinal velocity becomes small: use remaining world-space momentum.
  const steeringSpeed = throttle === 0 ? Math.hypot(state.vx, state.vz) : Math.abs(forward);
  const steeringFactor = clamp(steeringSpeed / Math.max(tuning.turnFullSpeed, 0.01), 0, 1);
  const direction = state.driveDirection ?? 1;
  const boost = throttle === 0 ? tuning.coastTurnBoost : 1;
  const angularAcceleration = -state.steer * direction * steeringFactor *
    tuning.steeringTorque * boost * Math.PI / 180;
  state.yawRate += angularAcceleration * dt;
  state.yawRate /= 1 + angularDrag * dt;
  const maxRadians = tuning.maxYawRate * Math.PI / 180;
  state.yawRate = clamp(state.yawRate, -maxRadians, maxRadians);
  state.heading = Math.atan2(Math.sin(state.heading + state.yawRate * dt),
    Math.cos(state.heading + state.yawRate * dt));

  if (throttle === 0 && Math.hypot(state.vx, state.vz) < 0.06) {
    state.vx = 0;
    state.vz = 0;
  }
  state.x += state.vx * dt;
  state.z += state.vz * dt;
  state.distance += Math.hypot(state.vx, state.vz) * dt;
  state.elapsed += dt;
  return state;
}

function driveForSeconds(kart, seconds, input, tuning, onStep) {
  const ticks = Math.round(seconds / STEP);
  for (let i = 0; i < ticks; i++) {
    stepKart(kart, input, tuning);
    if (onStep) onStep(kart, i);
  }
}

function coastStopTest(tuning, steer) {
  const kart = createKart();
  driveForSeconds(kart, 3, { throttle: 1, steer: 0 }, tuning);
  const startDistance = kart.distance;
  let timeToOne = null, distanceToOne = null;
  let turnAtTwo = null, turnAccumulated = 0;
  driveForSeconds(kart, 8, { throttle: 0, steer }, tuning, (state, step) => {
    turnAccumulated += Math.abs(state.yawRate) * STEP * 180 / Math.PI;
    if (step === Math.round(2 / STEP) - 1) turnAtTwo = turnAccumulated;
    if (timeToOne === null && getKinematics(state).speed <= 1) {
      timeToOne = (step + 1) * STEP;
      distanceToOne = state.distance - startDistance;
    }
  });
  return { timeToOne, distanceToOne, turnDegreesAtTwo: turnAtTwo };
}

/** Repeatable tests for comparing recordings against the real game's behavior. */
export function runCalibrationSuite(tuning = BASELINE) {
  const straight = createKart();
  let timeTo20 = null;
  driveForSeconds(straight, 3, { throttle: 1, steer: 0 }, tuning, (state) => {
    if (timeTo20 === null && getKinematics(state).speed >= 20) timeTo20 = state.elapsed;
  });

  const powered = createKart();
  driveForSeconds(powered, 1, { throttle: 1, steer: 0 }, tuning);
  let totalTurn = 0, circleSeconds = null, slipAtFour = null;
  driveForSeconds(powered, 10, { throttle: 1, steer: -1 }, tuning, (state, step) => {
    totalTurn += Math.abs(state.yawRate) * STEP * 180 / Math.PI;
    if (circleSeconds === null && totalTurn >= 360) circleSeconds = (step + 1) * STEP;
    if (step === Math.round(4 / STEP) - 1) slipAtFour = Math.abs(getKinematics(state).lateral);
  });

  const reverse = createKart();
  driveForSeconds(reverse, 2, { throttle: -1, steer: 0 }, tuning);

  return {
    straight: { timeTo20, speedAfterThree: getKinematics(straight).speed, distanceAfterThree: straight.distance },
    coast: coastStopTest(tuning, 0),
    coastTurn: coastStopTest(tuning, -1),
    poweredTurn: { circleSeconds, slipAtFour },
    reverse: { speedAfterTwo: Math.abs(getKinematics(reverse).longitudinal) }
  };
}

export function runBenchmark(tuning = BASELINE) {
  const kart = createKart();
  let secondsTo20 = null;
  driveForSeconds(kart, 4, { throttle: 1, steer: 0 }, tuning, (state) => {
    if (secondsTo20 === null && getKinematics(state).longitudinal >= 20) secondsTo20 = state.elapsed;
  });
  const distanceAt4 = kart.distance;
  driveForSeconds(kart, 3, { throttle: 0, steer: 0 }, tuning);
  return { secondsTo20, distanceAt4, coastDistance: kart.distance - distanceAt4,
    speedAt7: getKinematics(kart).longitudinal };
}

export function validatePreset(preset) {
  const clean = { ...BASELINE };
  for (const group of CONTROL_DEFINITIONS) {
    for (const [key, , min, max] of group.fields) {
      const candidate = preset?.[key];
      if (candidate === undefined || candidate === null || candidate === '') continue;
      const value = Number(candidate);
      if (Number.isFinite(value)) clean[key] = clamp(value, min, max);
    }
  }
  return clean;
}
