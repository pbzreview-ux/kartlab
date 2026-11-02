// Key states derived from the user's 61.6s, 30fps Smash Karts recording.
// Sampled from visible yellow WASD/SPACE overlay at 15 Hz, not game internals.
// Letter codes are base32 bitmasks: W=1, A=2, S=4, D=8, SPACE=16.
// Small taps and overlapping frames may be off by approximately 1 sample.
export const REFERENCE_FPS = 15;
export const REFERENCE_FRAMES = 924;
export const REFERENCE_DURATION = REFERENCE_FRAMES / REFERENCE_FPS;
export const REFERENCE_TRACE = [
  '000000ggg001h33399999333199119911999911199119913311999999999',
  '99b33399993339993331333339p99999999b222222222333p999b3319993',
  '33199999999888888888a22222008800gi08802288802208883333333339',
  '9999999999933333991111999888888888888888cc6666666666cccccccc',
  'ccccccc888888888ccc44446666666666666666666666666666666cccccc',
  'cc8888cccccccsscee2233188ccc88891333333399999913991333319911',
  '999999999999993333999999333322222iijjjh333333991133311999111',
  '199911199999999999333333333333333333333333333333333333333333',
  '333333333339999999999999999999999999999999999999999999999999',
  '999999999999999999b33333333333333333333333333333333333b99999',
  '999999999999999999999999919133333333333333399119911131113331',
  '111111111999993332222223222223322322223223223222322322232222',
  '322322232332332000000222222222222222222222222222111111111111',
  '111111119888888888888888888888888888888888889999999999999999',
  '999999991111113331111111113322222222222222222222222222200000',
  '000000000000000000000000'
].join('');

export const REFERENCE_HIGHLIGHTS = Object.freeze([
  { start: 29.2, end: 32.73, label: 'Powered left — W + A' },
  { start: 32.73, end: 37.2, label: 'Powered right — W + D' },
  { start: 45.13, end: 51.2, label: 'Mostly A only — coast turn with brief W taps' },
  { start: 52.6, end: 54.93, label: 'D only — clean steering coast' }
]);

export function referenceInputAt(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0 || seconds >= REFERENCE_DURATION) {
    return { throttle: 0, steer: 0, fire: false };
  }
  const frame = Math.min(REFERENCE_FRAMES - 1, Math.floor(seconds * REFERENCE_FPS));
  const bits = parseInt(REFERENCE_TRACE.charAt(frame), 32);
  return {
    throttle: Number(Boolean(bits & 1)) - Number(Boolean(bits & 4)),
    steer: Number(Boolean(bits & 8)) - Number(Boolean(bits & 2)),
    fire: Boolean(bits & 16)
  };
}
