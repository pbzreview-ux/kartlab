/*
 * KartLab input-matched reference audit.
 * The 15 Hz key states come from the user's 61.6 s recording. The reference
 * periods were estimated by comparing background landmarks in the recording
 * at different lags; they are approximate VIEW repeat times, not telemetry.
 * No absolute m/s, turning-force, or crash/terrain measurements are claimed.
 */
import { BASELINE, STEP, createKart, getKinematics, stepKart } from './physics.js';
import { REFERENCE_FPS, REFERENCE_FRAMES, referenceInputAt } from './reference_trace.js';

export const VIDEO_OBSERVATIONS = Object.freeze({
  left: Object.freeze({ start: 29.9, end: 32.5, cameraRepeatSeconds: 2.33 }),
  right: Object.freeze({ start: 33.6, end: 37.0, cameraRepeatSeconds: 2.27 }),
  coastRight: Object.freeze({ start: 52.6, end: 54.93 }),
  finalRelease: Object.freeze({ start: 59.67, end: 61.6 })
});

/** Execute exactly the sampled WASD+SPACE inputs, 8 physics ticks per frame. */
export function runRecordedInputComparison(tuning = BASELINE) {
  const state = createKart();
  const turnWindows = Object.fromEntries(['left', 'right'].map((name) => [name, {
    seconds: 0, absoluteYawDegrees: 0, signedYawDegrees: 0
  }]));
  let coastStartSpeed = null, coastEndSpeed = null;
  let coastRightDegrees = 0;
  let coastWrongWaySteps = 0;
  let finalReleaseStartSpeed = null;

  for (let frame = 0; frame < REFERENCE_FRAMES; frame++) {
    const input = referenceInputAt(frame / REFERENCE_FPS);
    for (let substep = 0; substep < 8; substep++) {
      const time = (frame * 8 + substep) * STEP;
      stepKart(state, input, tuning);
      const yawDegrees = state.yawRate * STEP * 180 / Math.PI;
      for (const [name, observation] of Object.entries(VIDEO_OBSERVATIONS)) {
        if (!(name in turnWindows)) continue;
        if (time >= observation.start && time < observation.end) {
          turnWindows[name].seconds += STEP;
          turnWindows[name].absoluteYawDegrees += Math.abs(yawDegrees);
          turnWindows[name].signedYawDegrees += yawDegrees;
        }
      }
      const { coastRight, finalRelease } = VIDEO_OBSERVATIONS;
      if (time >= coastRight.start && coastStartSpeed === null) coastStartSpeed = getKinematics(state).speed;
      if (time >= coastRight.start && time < coastRight.end) {
        coastRightDegrees += yawDegrees;
        // Allow a 0.3s steering transition. In this recorded section D is held,
        // so negative yaw should not flip merely because the kart is drifting.
        if (time > coastRight.start + 0.3 && yawDegrees > 0.00001) coastWrongWaySteps++;
      }
      if (time >= coastRight.end && coastEndSpeed === null) coastEndSpeed = getKinematics(state).speed;
      if (time >= finalRelease.start && finalReleaseStartSpeed === null) {
        finalReleaseStartSpeed = getKinematics(state).speed;
      }
    }
  }

  const orbit = (name) => {
    const actual = turnWindows[name], observation = VIDEO_OBSERVATIONS[name];
    const predicted = 360 * actual.seconds / actual.absoluteYawDegrees;
    return {
      videoCameraRepeatSeconds: observation.cameraRepeatSeconds,
      predictedTurnPeriodSeconds: predicted,
      signedDegrees: actual.signedYawDegrees,
      differenceSeconds: predicted - observation.cameraRepeatSeconds
    };
  };
  return {
    method: 'Exact 15 Hz recorded key states, 120 Hz fixed-step KartLab physics',
    leftOrbit: orbit('left'),
    rightOrbit: orbit('right'),
    steeringOnlyRight: {
      startSpeed: coastStartSpeed, endSpeed: coastEndSpeed,
      turnDegrees: coastRightDegrees, wrongDirectionTicks: coastWrongWaySteps
    },
    finalRelease: {
      startSpeed: finalReleaseStartSpeed,
      endSpeed: getKinematics(state).speed
    },
    totalSimulatedSeconds: state.elapsed,
    totalSimulatedDistance: state.distance
  };
}
