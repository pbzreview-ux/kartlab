import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASELINE, CONFIRMED_RIGIDBODY, CONTROL_DEFINITIONS, REPLAY_COAST_TURN, STEP,
  createKart, stepKart, getKinematics, runBenchmark, runCalibrationSuite, validatePreset
} from './physics.js';
import {
  REFERENCE_FPS, REFERENCE_FRAMES, REFERENCE_DURATION,
  REFERENCE_HIGHLIGHTS, REFERENCE_TRACE, referenceInputAt
} from './reference_trace.js';
import { VIDEO_OBSERVATIONS, runRecordedInputComparison } from './reference_calibration.js';

function drive(kart, seconds, input, tuning = BASELINE) {
  for (let i = 0; i < Math.round(seconds / STEP); i++) stepKart(kart, input, tuning);
  return kart;
}

test('every baseline value is selectable exactly by its visible tuning slider', () => {
  for (const section of CONTROL_DEFINITIONS) for (const [key, , min, max, step] of section.fields) {
    const baseline = BASELINE[key];
    assert.ok(baseline >= min && baseline <= max, `${key} is outside slider range`);
    const stepsFromMin = (baseline - min) / step;
    assert.ok(Math.abs(stepsFromMin - Math.round(stepsFromMin)) < 1e-8,
      `${key} default ${baseline} would be rounded by its ${step} slider step`);
  }
});

test('verified Rigidbody values are fixed and never editable through presets', () => {
  assert.equal(CONFIRMED_RIGIDBODY.mass, 1.5);
  assert.equal(CONFIRMED_RIGIDBODY.linearDrag, 1.0);
  assert.equal(CONFIRMED_RIGIDBODY.angularDrag, 5.0);
  assert.equal(CONFIRMED_RIGIDBODY.interpolation, 'Interpolate');
  assert.ok(Object.isFrozen(CONFIRMED_RIGIDBODY));
  const preset = validatePreset({ mass: 500, linearDrag: 0, angularDrag: 0 });
  assert.equal('mass' in preset, false);
  assert.equal('angularDrag' in preset, false);
});

test('holding accelerator produces forward movement subject to a tunable speed cap', () => {
  const kart = drive(createKart(), 7, { throttle: 1, steer: 0 });
  assert.ok(Math.abs(getKinematics(kart).longitudinal - BASELINE.maxForwardSpeed) < 1e-7);
  assert.ok(kart.z < -60);
});

test('Rigidbody linear drag applies even without steering', () => {
  const kart = drive(createKart(), 3, { throttle: 1, steer: 0 });
  const start = getKinematics(kart).speed;
  drive(kart, 1, { throttle: 0, steer: 0 });
  const expected = start * Math.pow(1 / (1 + CONFIRMED_RIGIDBODY.linearDrag * STEP), 1 / STEP);
  assert.ok(Math.abs(getKinematics(kart).speed - expected) < 1e-5);
});

test('kart stops without self-reversing after release', () => {
  const kart = drive(createKart(), 3, { throttle: 1, steer: 0 });
  drive(kart, 10, { throttle: 0, steer: 0 });
  assert.equal(getKinematics(kart).speed, 0);
});

test('reverse is slower than forward and pressing S brakes before changing direction', () => {
  const kart = drive(createKart(), 2, { throttle: 1, steer: 0 });
  const before = getKinematics(kart).longitudinal;
  drive(kart, 0.1, { throttle: -1, steer: 0 });
  const duringBrake = getKinematics(kart).longitudinal;
  assert.ok(duringBrake >= 0 && duringBrake < before);
  drive(kart, 3, { throttle: -1, steer: 0 });
  assert.ok(getKinematics(kart).longitudinal < 0);
  assert.ok(getKinematics(kart).speed <= BASELINE.maxReverseSpeed + 1e-6);
});

test('left and right give symmetric opposite angular velocities', () => {
  const left = drive(createKart(), 2, { throttle: 1, steer: -1 });
  const right = drive(createKart(), 2, { throttle: 1, steer: 1 });
  assert.ok(left.yawRate > 0);
  assert.ok(right.yawRate < 0);
  assert.ok(Math.abs(left.yawRate + right.yawRate) < 1e-8);
});

test('angular drag brings down spin after steering is released', () => {
  const kart = drive(createKart(), 2, { throttle: 1, steer: -1 });
  const before = Math.abs(kart.yawRate);
  drive(kart, 1.5, { throttle: 0, steer: 0 });
  assert.ok(Math.abs(kart.yawRate) < before * 0.1);
});

test('W then A only sharply turns while scrubbing speed', () => {
  const straight = drive(createKart(), 3, { throttle: 1, steer: 0 });
  const turning = structuredClone(straight);
  drive(straight, 2, { throttle: 0, steer: 0 });
  drive(turning, 2, { throttle: 0, steer: -1 });
  assert.ok(Math.abs(turning.heading) > 0.5, 'Kart should rotate sharply');
  assert.ok(getKinematics(turning).speed < getKinematics(straight).speed);
  drive(turning, 4, { throttle: 0, steer: -1 });
  assert.ok(getKinematics(turning).speed < 0.4, 'Should stop within a few seconds');
});

test('A-only drift never reverses steering when the kart slides sideways', () => {
  const kart = drive(createKart(), 3, { throttle: 1, steer: 0 });
  for (let tick = 0; tick < Math.round(4 / STEP); tick++) {
    stepKart(kart, { throttle: 0, steer: -1 });
    assert.ok(kart.yawRate >= 0, `A-only unexpectedly turned right after ${tick * STEP}s`);
    assert.equal(kart.driveDirection, 1);
  }
});

test('D-only drift keeps steering right; S then release preserves reverse steering', () => {
  const coast = drive(createKart(), 1.3, { throttle: 1, steer: 0 });
  for (let i = 0; i < Math.round(3 / STEP); i++) {
    stepKart(coast, { throttle: 0, steer: 1 });
    assert.ok(coast.yawRate <= 0, `D-only unexpectedly turned left at ${i * STEP}s`);
  }
  const reversing = drive(createKart(), 2, { throttle: -1, steer: 0 });
  assert.equal(reversing.driveDirection, -1);
  drive(reversing, 0.6, { throttle: 0, steer: -1 });
  assert.ok(reversing.yawRate < 0, 'Reverse + left should steer in the opposite direction');
  assert.equal(reversing.driveDirection, -1);
});

test('video-guided coasting remains controllable for roughly two seconds', () => {
  const result = runCalibrationSuite();
  assert.ok(result.coastTurn.timeToOne >= 1.8, 'Steering-only coast should not stop immediately');
  assert.ok(result.coastTurn.timeToOne <= 3.5, 'Steering-only coast must still slow to a stop');
  assert.ok(result.coastTurn.turnDegreesAtTwo >= 90, 'Coasting steering should stay sharp');
});

test('61.6-second user-video key trace includes powered circles, reverse and coast turns', () => {
  assert.equal(REFERENCE_FPS, 15);
  assert.equal(REFERENCE_FRAMES, 924);
  assert.equal(REFERENCE_TRACE.length, REFERENCE_FRAMES);
  assert.ok(Math.abs(REFERENCE_DURATION - 61.6) < 0.01);
  assert.deepEqual(referenceInputAt(30), { throttle: 1, steer: -1, fire: false });
  assert.deepEqual(referenceInputAt(34), { throttle: 1, steer: 1, fire: false });
  assert.deepEqual(referenceInputAt(50), { throttle: 0, steer: -1, fire: false });
  assert.deepEqual(referenceInputAt(53), { throttle: 0, steer: 1, fire: false });
  assert.ok(referenceInputAt(15).throttle < 0, 'Recording contains reverse driving');
  assert.ok(referenceInputAt(26.3).fire, 'Recording contains a Space input');
  assert.equal(referenceInputAt(REFERENCE_DURATION).throttle, 0);
  assert.equal(REFERENCE_HIGHLIGHTS.length, 4);
});

test('full recorded WASD/SPACE playback stays finite and within the speed cap', () => {
  const kart = createKart();
  for (let frame = 0; frame < REFERENCE_FRAMES; frame++) {
    const input = referenceInputAt(frame / REFERENCE_FPS);
    for (let substep = 0; substep < 8; substep++) stepKart(kart, input);
    const k = getKinematics(kart);
    assert.ok(Number.isFinite(kart.x) && Number.isFinite(kart.z) && Number.isFinite(kart.heading));
    assert.ok(k.speed <= BASELINE.maxForwardSpeed + 1e-6);
  }
  assert.ok(kart.distance > 100);
  assert.ok(Math.abs(kart.elapsed - REFERENCE_DURATION) < 0.001);
});

test('the exact video key sequence matches observed left/right camera orbit timing', () => {
  const result = runRecordedInputComparison();
  assert.equal(result.totalSimulatedSeconds.toFixed(1), '61.6');
  assert.equal(VIDEO_OBSERVATIONS.left.cameraRepeatSeconds, 2.33);
  assert.equal(VIDEO_OBSERVATIONS.right.cameraRepeatSeconds, 2.27);
  // These are rough screen-space repeat periods measured from landmarks, not
  // internal Smash Karts physics numbers. A 0.25s band reflects uncertainty.
  assert.ok(Math.abs(result.leftOrbit.differenceSeconds) < 0.25);
  assert.ok(Math.abs(result.rightOrbit.differenceSeconds) < 0.25);
  assert.ok(result.leftOrbit.signedDegrees > 0);
  assert.ok(result.rightOrbit.signedDegrees < 0);
});

test('the recorded D-only coast turns right continuously then slows without W', () => {
  const result = runRecordedInputComparison();
  assert.equal(result.steeringOnlyRight.wrongDirectionTicks, 0);
  assert.ok(result.steeringOnlyRight.turnDegrees < -175);
  assert.ok(result.steeringOnlyRight.startSpeed > 10);
  assert.ok(result.steeringOnlyRight.endSpeed < 2);
  assert.ok(result.finalRelease.endSpeed < result.finalRelease.startSpeed);
});

test('powered turning creates measurable lateral sliding', () => {
  const kart = drive(createKart(), 5, { throttle: 1, steer: -1 });
  assert.ok(Math.abs(getKinematics(kart).lateral) > 0.5);
  assert.ok(getKinematics(kart).speed <= BASELINE.maxForwardSpeed + 1e-6);
});

test('same input sequence produces bit-for-bit repeatable results', () => {
  const a = createKart(), b = createKart();
  for (let i = 0; i < 850; i++) {
    const input = { throttle: i < 400 ? 1 : 0, steer: i > 350 ? -1 : 0 };
    stepKart(a, input, BASELINE, STEP);
    stepKart(b, input, BASELINE, STEP);
  }
  assert.deepEqual(a, b);
});

test('controlled tests have meaningful and reproducible comparisons', () => {
  const suite = runCalibrationSuite();
  assert.deepEqual(suite, runCalibrationSuite());
  assert.ok(suite.straight.timeTo20 > 0);
  assert.ok(suite.straight.distanceAfterThree > 20);
  assert.ok(suite.coast.timeToOne > suite.coastTurn.timeToOne);
  assert.ok(suite.coastTurn.turnDegreesAtTwo > 70);
  assert.ok(suite.poweredTurn.circleSeconds > 1);
  assert.ok(suite.poweredTurn.slipAtFour > 0);
  assert.ok(suite.reverse.speedAfterTwo > 0);
  assert.ok(runBenchmark().coastDistance > 0);
});

test('replay is W for 3 seconds then A only for 4 seconds', () => {
  assert.equal(REPLAY_COAST_TURN.length, 2);
  assert.deepEqual(REPLAY_COAST_TURN[0].input, { throttle: 1, steer: 0 });
  assert.deepEqual(REPLAY_COAST_TURN[1].input, { throttle: 0, steer: -1 });
  assert.equal(REPLAY_COAST_TURN.reduce((sum, segment) => sum + segment.duration, 0), 7);
});

test('v0.2 presets migrate safe settings without importing old movement units', () => {
  const migrated = validatePreset({ maxForwardSpeed: 999, lateralGrip: -40, steerRate: 145, coastDrag: 1.3 });
  assert.equal(migrated.maxForwardSpeed, 40);
  assert.equal(migrated.lateralGrip, 0.5);
  assert.equal(migrated.steeringTorque, BASELINE.steeringTorque);
  assert.equal('steerRate' in migrated, false);
});
