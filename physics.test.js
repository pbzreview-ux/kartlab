import test from 'node:test';
import assert from 'node:assert/strict';
import { BASELINE, STEP, createKart, stepKart, getKinematics, runBenchmark, validatePreset } from './physics.js';

test('holding accelerate gains speed up to cap', () => {
  const kart = createKart();
  for (let i = 0; i < 1200; i++) stepKart(kart, { throttle: 1, steer: 0 });
  assert.ok(getKinematics(kart).longitudinal <= BASELINE.maxForwardSpeed + 0.00001);
  assert.ok(getKinematics(kart).longitudinal > BASELINE.maxForwardSpeed - 0.1);
  assert.ok(kart.z < -100);
});

test('releasing input slows down without reversing itself', () => {
  const kart = createKart();
  for (let i = 0; i < 300; i++) stepKart(kart, { throttle: 1, steer: 0 });
  for (let i = 0; i < 3000; i++) stepKart(kart, { throttle: 0, steer: 0 });
  assert.equal(getKinematics(kart).longitudinal, 0);
});

test('reverse has a cap and turns in the opposite world direction', () => {
  const kart = createKart();
  for (let i = 0; i < 600; i++) stepKart(kart, { throttle: -1, steer: -1 });
  assert.ok(getKinematics(kart).speed <= BASELINE.maxReverseSpeed + 0.001);
  assert.ok(kart.heading !== 0);
});

test('left and right inputs result in opposite yaw', () => {
  const left = createKart(), right = createKart();
  for (let i = 0; i < 200; i++) {
    stepKart(left, { throttle: 1, steer: -1 });
    stepKart(right, { throttle: 1, steer: 1 });
  }
  // Wrapped headings may cross ±180° during tight turns; use instantaneous yaw.
  assert.ok(left.yawRate > 0);
  assert.ok(right.yawRate < 0);
  assert.ok(Math.abs(left.heading + right.heading) < 1e-8);
});

test('simulation is repeatable and compatible with fixed timestep', () => {
  const a = createKart(), b = createKart();
  for (let i = 0; i < 400; i++) {
    const input = { throttle: i < 200 ? 1 : 0, steer: i > 70 && i < 310 ? -1 : 0 };
    stepKart(a, input, BASELINE, STEP);
    stepKart(b, input, BASELINE, STEP);
  }
  assert.deepEqual(a, b);
});

test('benchmark and preset validation return finite bounded outputs', () => {
  const results = runBenchmark();
  assert.ok(results.distanceAt4 > 0);
  assert.ok(results.coastDistance > 0);
  assert.ok(results.secondsTo20 > 0);
  const config = validatePreset({ maxForwardSpeed: 9999, lateralGrip: -40, steerRate: '140' });
  assert.equal(config.maxForwardSpeed, 40);
  assert.equal(config.lateralGrip, 0.5);
  assert.equal(config.steerRate, 140);
});

test('new sliding baseline maintains measurable sideways velocity during sustained turn', () => {
  const kart = createKart();
  for (let i = 0; i < 5 / STEP; i++) stepKart(kart, { throttle: 1, steer: -1 });
  const k = getKinematics(kart);
  const slipAngle = Math.abs(Math.atan2(k.lateral, k.longitudinal) * 180 / Math.PI);
  assert.ok(slipAngle > 20, `Expected a visible slide, measured ${slipAngle.toFixed(1)}°`);
  assert.ok(slipAngle < 60);
  assert.ok(k.speed <= BASELINE.maxForwardSpeed + 1e-6);
});

test('steering recovers smoothly after a turn', () => {
  const kart = createKart();
  for (let i = 0; i < 3 / STEP; i++) stepKart(kart, { throttle: 1, steer: -1 });
  const atTurn = kart.steer;
  for (let i = 0; i < 1 / STEP; i++) stepKart(kart, { throttle: 1, steer: 0 });
  assert.ok(Math.abs(kart.steer) < Math.abs(atTurn) * 0.01);
  assert.ok(getKinematics(kart).speed > 0);
});

test('holding steering only after accelerating makes a sharp coast turn and stops in a few seconds', () => {
  const accelerating = createKart();
  for (let i = 0; i < 3 / STEP; i++) stepKart(accelerating, { throttle: 1, steer: 0 });
  const sharpCoast = structuredClone(accelerating);
  const straightCoast = structuredClone(accelerating);
  for (let i = 0; i < 4 / STEP; i++) {
    stepKart(sharpCoast, { throttle: 0, steer: -1 });
    stepKart(straightCoast, { throttle: 0, steer: 0 });
  }
  assert.ok(getKinematics(sharpCoast).speed < 1, 'Steering coast should nearly stop by 4s');
  assert.ok(getKinematics(straightCoast).speed > 15, 'Straight coasting should retain momentum');
  assert.ok(Math.abs(sharpCoast.heading) > 0.5, 'Steering only must visibly turn');
});
