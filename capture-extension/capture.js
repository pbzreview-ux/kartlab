/* KartLab Capture v0.1. No networking, telemetry, or browser-wide permissions. */
(() => {
  if (document.getElementById('kartlab-local-capture-root')) return;

  const keyBits = { KeyW: 1, ArrowUp: 1, KeyA: 2, ArrowLeft: 2,
    KeyS: 4, ArrowDown: 4, KeyD: 8, ArrowRight: 8, Space: 16 };
  const visibleKeys = [['W', 1], ['A', 2], ['S', 4], ['D', 8], ['SPACE', 16]];
  const activePhysicalCodes = new Set();
  let session = null;
  let recorder = null;
  let stream = null;
  let videoChunks = [];
  let videoBlob = null;
  let sampleTimer = null;
  let displayTimer = null;

  const host = document.createElement('div');
  host.id = 'kartlab-local-capture-root';
  host.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:2147483647;pointer-events:none';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>
      *{box-sizing:border-box} .panel{width:273px;background:#101e2cf3;border:1px solid #94e3ff;
        box-shadow:0 8px 35px #030a13a8;color:#ecf8ff;border-radius:12px;padding:12px;
        font:12px/1.35 system-ui,sans-serif;pointer-events:auto}
      .title{font-weight:900;color:#e6ff70;letter-spacing:.7px;font-size:12px}
      .sub{font-size:10px;color:#afc4d1;margin:5px 0 9px}
      .keys{display:flex;gap:4px;margin-bottom:8px}
      .key{font-size:10px;font-weight:800;background:#2c4155;border:1px solid #49637b;
        padding:4px 5px;border-radius:4px;min-width:25px;text-align:center}
      .key.active{background:#e6ff70;border-color:#e6ff70;color:#14232b}
      button{border:0;border-radius:6px;font-size:11px;font-weight:800;padding:8px 7px;cursor:pointer}
      button:disabled{opacity:.35;cursor:default}
      .row{display:flex;gap:5px;margin-top:7px}
      .primary{background:#e6ff70;color:#17202a;flex:1}
      .danger{background:#ff8585;color:#1b1620;flex:1}
      .download{background:#345b70;color:#fff;flex:1}
      .timer{font:800 15px system-ui;color:#b0f6ff;margin-top:8px}
      .note{font-size:10px;color:#a8bbc8;line-height:1.45;margin-top:9px}
      .status{font-size:11px;color:#b5edff;margin-top:7px;overflow-wrap:anywhere}
      label{font-size:11px;display:flex;align-items:center;gap:5px;margin:7px 0}
      .minimize{float:right;background:#294156;color:#e4f5fa;padding:0 5px}
      .collapsed .body{display:none} .collapsed{width:210px}
    </style>
    <section class="panel" aria-label="KartLab movement capture">
      <div><button class="minimize" id="minimize" title="Collapse capture panel">−</button>
        <span class="title">◉ KARTLAB CAPTURE</span></div>
      <div class="body">
        <div class="sub">Only records movement keys. No data leaves your computer.</div>
        <div class="keys" id="keys"></div>
        <label><input id="includeVideo" type="checkbox" checked /> Include gameplay video (30 fps)</label>
        <div class="row"><button id="start" class="primary">● START</button>
          <button id="stop" class="danger" disabled>■ STOP (F9)</button></div>
        <div class="timer" id="timer">00:00.00</div>
        <div class="status" id="status" role="status">Ready · click Start, then drive</div>
        <div class="row"><button id="downloadKeys" class="download" disabled>↓ INPUT JSON</button>
          <button id="downloadVideo" class="download" disabled>↓ VIDEO</button></div>
        <div class="note">When Chrome asks what to share, select <b>This Tab</b> (Smash Karts).
          Capture up to 3 minutes. You can press F9 while driving to stop.</div>
      </div>
    </section>`;
  (document.body || document.documentElement).append(host);
  const find = (id) => shadow.getElementById(id);
  const keysEl = find('keys');
  visibleKeys.forEach(([label, bit]) => {
    const key = document.createElement('span');
    key.className = 'key'; key.dataset.bit = String(bit); key.textContent = label;
    keysEl.append(key);
  });

  function currentMask() {
    let mask = 0;
    for (const code of activePhysicalCodes) mask |= keyBits[code] || 0;
    return mask;
  }
  function updateKeys() {
    const mask = currentMask();
    keysEl.querySelectorAll('[data-bit]').forEach((key) => {
      key.classList.toggle('active', Boolean(mask & Number(key.dataset.bit)));
    });
  }
  function stamp() { return session ? Math.max(0, performance.now() - session.originMs) : 0; }
  function logEvent(kind, code = null) {
    if (!session?.recording) return;
    session.events.push({ ms: Math.round(stamp()), mask: currentMask(), kind, code });
  }
  function updateTimer() {
    if (!session) return;
    const seconds = (session.recording ? stamp() : session.durationMs) / 1000;
    const mins = Math.floor(seconds / 60);
    find('timer').textContent = `${String(mins).padStart(2, '0')}:${(seconds % 60).toFixed(2).padStart(5, '0')}`;
  }
  function updateButtons() {
    find('start').disabled = Boolean(session?.recording);
    find('stop').disabled = !session?.recording;
    find('downloadKeys').disabled = !session || session.recording;
    find('downloadVideo').disabled = !videoBlob || Boolean(session?.recording);
  }
  function status(message) { find('status').textContent = message; }

  const isTextEntry = (target) => target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
  window.addEventListener('keydown', (event) => {
    if (event.code === 'F9' && session?.recording && !event.repeat) {
      event.preventDefault(); stopCapture(); return;
    }
    if (!(event.code in keyBits) || isTextEntry(event.target) || event.repeat) return;
    const prior = currentMask();
    activePhysicalCodes.add(event.code);
    if (currentMask() !== prior) logEvent('down', event.code);
    updateKeys();
  }, true);
  window.addEventListener('keyup', (event) => {
    if (!(event.code in keyBits)) return;
    const prior = currentMask();
    activePhysicalCodes.delete(event.code);
    if (currentMask() !== prior) logEvent('up', event.code);
    updateKeys();
  }, true);
  window.addEventListener('blur', () => {
    if (!activePhysicalCodes.size) return;
    activePhysicalCodes.clear();
    logEvent('blur'); updateKeys();
  });

  async function startCapture() {
    if (session?.recording) return;
    // Must be called directly from the Start button's user gesture.
    const includeVideo = find('includeVideo').checked;
    videoBlob = null; videoChunks = [];
    stream?.getTracks().forEach((track) => track.stop());
    stream = null; recorder = null;
    find('start').disabled = true;
    if (includeVideo) {
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30 }, audio: false });
        const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
          .find((type) => MediaRecorder.isTypeSupported(type));
        recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
        recorder.addEventListener('dataavailable', (event) => { if (event.data.size) videoChunks.push(event.data); });
        recorder.addEventListener('stop', () => {
          videoBlob = new Blob(videoChunks, { type: recorder.mimeType || 'video/webm' });
          videoChunks = []; updateButtons();
        });
        recorder.addEventListener('error', () => { status('Video recorder error · input JSON is still usable'); });
        stream.getVideoTracks()[0]?.addEventListener('ended', () => stopCapture());
      } catch (error) {
        stream?.getTracks().forEach((track) => track.stop());
        stream = null; recorder = null;
        status(`Video not started (${error.name || 'not allowed'}) · keys only`);
      }
    }

    activePhysicalCodes.clear(); updateKeys();
    session = {
      schema: 'kartlab-capture/v1', source: location.origin, createdAt: new Date().toISOString(),
      originMs: performance.now(), recording: true, durationMs: 0, includesVideo: Boolean(recorder),
      events: [], samples: []
    };
    session.events.push({ ms: 0, mask: 0, kind: 'start', code: null });
    session.samples.push({ ms: 0, mask: 0 });
    try { recorder?.start(1000); }
    catch (error) { status(`Video recorder failed (${error.name}) · keys only`); recorder = null; session.includesVideo = false; }
    sampleTimer = setInterval(() => {
      if (!session?.recording) return;
      session.samples.push({ ms: Math.round(stamp()), mask: currentMask() });
      if (stamp() >= 180000) stopCapture();
    }, 50);
    displayTimer = setInterval(updateTimer, 100);
    updateButtons();
    status(recorder ? 'Recording screen + keys · drive now' : 'Recording keys only · drive now');
  }

  function stopCapture() {
    if (!session?.recording) return;
    session.durationMs = Math.round(stamp());
    logEvent('stop');
    session.recording = false;
    clearInterval(sampleTimer); clearInterval(displayTimer);
    session.samples.push({ ms: session.durationMs, mask: currentMask() });
    if (recorder?.state === 'recording') recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
    updateTimer(); updateButtons();
    status(`Saved ${session.events.length} key events · download both files below`);
  }

  function durationSummary() {
    const heldSeconds = { W: 0, A: 0, S: 0, D: 0, SPACE: 0 };
    const events = session.events;
    for (let i = 0; i < events.length; i++) {
      const current = events[i];
      const end = (i + 1 < events.length ? events[i + 1].ms : session.durationMs);
      const span = Math.max(0, end - current.ms) / 1000;
      for (const [key, bit] of visibleKeys) if (current.mask & bit) heldSeconds[key] += span;
    }
    return Object.fromEntries(Object.entries(heldSeconds).map(([key, value]) => [key, +value.toFixed(3)]));
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = name; shadow.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  const fileStem = () => `kartlab-smashkarts-${session.createdAt.replace(/[:.]/g, '-')}`;
  find('start').addEventListener('click', startCapture);
  find('stop').addEventListener('click', stopCapture);
  find('downloadKeys').addEventListener('click', () => {
    if (!session || session.recording) return;
    const payload = {
      schema: session.schema, source: session.source, createdAt: session.createdAt,
      durationMs: session.durationMs, includesVideo: session.includesVideo,
      timerBasis: 'performance.now, relative to start of capture',
      keyMask: { W: 1, A: 2, S: 4, D: 8, SPACE: 16 },
      heldSeconds: durationSummary(), events: session.events, samples: session.samples
    };
    download(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `${fileStem()}.json`);
  });
  find('downloadVideo').addEventListener('click', () => {
    if (videoBlob && !session?.recording) download(videoBlob, `${fileStem()}.webm`);
  });
  find('minimize').addEventListener('click', () => {
    const panel = shadow.querySelector('.panel');
    panel.classList.toggle('collapsed');
    find('minimize').textContent = panel.classList.contains('collapsed') ? '+' : '−';
  });
  updateKeys(); updateButtons();
})();
