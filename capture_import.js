/** Import exact event timestamps from the optional local KartLab Capture extension. */
const MAX_CAPTURE_MS = 180_500;
const MAX_EVENTS = 15_000;

export function normalizeCaptureSession(payload) {
  if (!payload || payload.schema !== 'kartlab-capture/v1') {
    throw new Error('Not a KartLab Capture v1 JSON file');
  }
  if (!['https://smashkarts.io', 'https://www.smashkarts.io'].includes(payload.source)) {
    throw new Error('Expected a capture from smashkarts.io');
  }
  const durationMs = Number(payload.durationMs);
  if (!Number.isFinite(durationMs) || durationMs <= 0 || durationMs > MAX_CAPTURE_MS) {
    throw new Error('Capture duration must be between 0 and 180 seconds');
  }
  if (!Array.isArray(payload.events) || !payload.events.length || payload.events.length > MAX_EVENTS) {
    throw new Error('Missing or oversized input timeline');
  }
  let lastMs = -1;
  const events = payload.events.map(({ ms, mask }) => {
    if (!Number.isFinite(ms) || ms < 0 || ms > durationMs || ms < lastMs) {
      throw new Error('Input events must have ordered nonnegative timestamps');
    }
    if (!Number.isInteger(mask) || mask < 0 || mask > 31) {
      throw new Error('Invalid key mask in capture');
    }
    lastMs = ms;
    return { ms, mask };
  });
  if (events[0].ms !== 0) throw new Error('Capture must start at 0 milliseconds');
  return Object.freeze({ durationMs, durationSeconds: durationMs / 1000,
    events: Object.freeze(events), createdAt: String(payload.createdAt || '') });
}

export function captureInputAt(capture, seconds) {
  if (!capture || !Number.isFinite(seconds) || seconds < 0 || seconds >= capture.durationSeconds) {
    return { throttle: 0, steer: 0, fire: false };
  }
  const timeMs = seconds * 1000;
  const { events } = capture;
  let low = 0, high = events.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (events[mid].ms <= timeMs) low = mid + 1;
    else high = mid;
  }
  const mask = events[Math.max(0, low - 1)].mask;
  return {
    throttle: Number(Boolean(mask & 1)) - Number(Boolean(mask & 4)),
    steer: Number(Boolean(mask & 8)) - Number(Boolean(mask & 2)),
    fire: Boolean(mask & 16)
  };
}
