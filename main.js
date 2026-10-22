import * as THREE from 'three';
import './style.css';
import {
  STEP, BASELINE, CONTROL_DEFINITIONS, createKart, getKinematics,
  stepKart, runBenchmark, validatePreset
} from './physics.js';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#game');
let settings = validatePreset(loadSettings());
let kart = createKart();
let controlsEnabled = true;
let freeCamera = false;

function loadSettings() {
  try {
    const previous = JSON.parse(localStorage.getItem('kartlab-physics-v1') || '{}');
    const current = JSON.parse(localStorage.getItem('kartlab-physics-v2') || 'null');
    if (current) return current;
    // Migrate personal edits, but don't automatically keep the previous grip/turn defaults.
    if (previous.steerRate === 116) delete previous.steerRate;
    if (previous.lateralGrip === 8.5) delete previous.lateralGrip;
    return previous;
  }
  catch { return {}; }
}

function storeSettings() {
  try { localStorage.setItem('kartlab-physics-v2', JSON.stringify(settings)); }
  catch { /* playable even in browser private mode */ }
}

function sliderHTML() {
  $('#sliders').innerHTML = CONTROL_DEFINITIONS.map((section) => `
    <div class="slider-section"><h3>${section.title}</h3>
      ${section.fields.map(([key, label, min, max, step, unit]) => `
        <label class="slider-entry" for="${key}"><span>${label}</span><output id="v-${key}">${settings[key]} ${unit}</output></label>
        <input id="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${settings[key]}" aria-label="${label}" />
      `).join('')}
    </div>`).join('');
  CONTROL_DEFINITIONS.flatMap((s) => s.fields).forEach(([key, , , , , unit]) => {
    $(`#${key}`).addEventListener('input', (event) => {
      settings[key] = Number(event.currentTarget.value);
      $(`#v-${key}`).textContent = `${settings[key]} ${unit}`;
      storeSettings();
    });
  });
}

function syncSliders() {
  CONTROL_DEFINITIONS.flatMap((s) => s.fields).forEach(([key, , , , , unit]) => {
    $(`#${key}`).value = settings[key];
    $(`#v-${key}`).textContent = `${settings[key]} ${unit}`;
  });
}

sliderHTML();
$('#resetPreset').addEventListener('click', () => {
  settings = { ...BASELINE };
  syncSliders(); storeSettings(); resetKart();
  $('#copyMessage').textContent = 'Baseline restored';
});
$('#copyPreset').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
    $('#copyMessage').textContent = 'Physics preset copied!';
  } catch {
    $('#copyMessage').textContent = 'Clipboard blocked. Use your browser permissions.';
  }
});

const setPanelOpen = (open) => {
  $('#settings').classList.toggle('collapsed', !open);
  $('#settingsToggle').setAttribute('aria-expanded', String(open));
};
$('#settingsToggle').addEventListener('click', () => setPanelOpen($('#settings').classList.contains('collapsed')));
$('#settingsClose').addEventListener('click', () => setPanelOpen(false));

// --- Scene and camera -----------------------------------------------------
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch { /* Some browsers disable WebGL. The same physics still runs in 2D fallback. */ }
let fallback = null;
if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
} else {
  canvas.style.display = 'none';
  const fallbackCanvas = document.createElement('canvas');
  fallbackCanvas.id = 'fallback';
  fallbackCanvas.setAttribute('aria-label', '2D kart physics fallback view');
  canvas.after(fallbackCanvas);
  fallback = { canvas: fallbackCanvas, ctx: fallbackCanvas.getContext('2d') };
  document.querySelector('.top-status').innerHTML = '<span class="live-dot"></span> 2D FALLBACK <span class="top-version">/ WEBGL UNAVAILABLE</span>';
}

const scene = new THREE.Scene();
scene.background = new THREE.Color('#a6c8cc');
scene.fog = new THREE.Fog('#a6c8cc', 100, 350);
const camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 600);
scene.add(new THREE.HemisphereLight(0xe1f9ff, 0x607b65, 2.45));

const sun = new THREE.DirectionalLight(0xfff2d8, 2.9);
sun.position.set(-40, 80, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -65;
sun.shadow.camera.right = 65;
sun.shadow.camera.top = 65;
sun.shadow.camera.bottom = -65;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x557e72, roughness: 0.95 });
const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const grid = new THREE.GridHelper(800, 160, 0x91bbb0, 0x719c90);
grid.position.y = 0.018;
grid.material.transparent = true;
grid.material.opacity = 0.35;
scene.add(grid);

// Minimal visual reference markings only. Actual maps are out of scope.
const circleMaterial = new THREE.MeshBasicMaterial({ color: 0xcee8b4, transparent: true, opacity: 0.22, side: THREE.DoubleSide });
for (const radius of [25, 50, 100]) {
  const circle = new THREE.Mesh(new THREE.RingGeometry(radius - 0.08, radius + 0.08, 120), circleMaterial);
  circle.rotation.x = -Math.PI / 2;
  circle.position.y = 0.035;
  scene.add(circle);
}

function box(width, height, length, color, position, metalness = 0.0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, length),
    new THREE.MeshStandardMaterial({ color, metalness, roughness: 0.42 }));
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makeKart() {
  const root = new THREE.Group();
  root.add(box(2.1, 0.36, 3.15, '#192d3c', [0, 0.75, 0]));
  root.add(box(1.91, 0.51, 2.7, '#e5ff65', [0, 1.0, -0.04], 0.12));
  root.add(box(1.4, 0.17, 0.88, '#f8fff4', [0, 1.33, -0.55]));
  root.add(box(1.74, 0.2, 0.43, '#182b39', [0, 0.86, -1.56]));
  root.add(box(1.73, 0.19, 0.42, '#182b39', [0, 0.88, 1.5]));
  root.add(box(0.62, 0.14, 0.29, '#fd8433', [-0.62, 1.17, -1.04]));
  root.add(box(0.62, 0.14, 0.29, '#fd8433', [0.62, 1.17, -1.04]));
  // Direction arrow on hood, clear in bird's-eye camera mode.
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.29, 0.7, 3), new THREE.MeshStandardMaterial({ color: '#142a37' }));
  tip.rotation.x = -Math.PI / 2;
  tip.rotation.z = Math.PI / 2;
  tip.position.set(0, 1.37, -0.95);
  root.add(tip);

  // Unbranded low-poly body; no proprietary game assets or characters.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.72, 20, 12), new THREE.MeshStandardMaterial({ color: '#152d41', roughness: 0.24, metalness: 0.2 }));
  canopy.scale.set(0.88, 0.62, 0.93);
  canopy.position.set(0, 1.48, 0.39);
  canopy.castShadow = true;
  root.add(canopy);

  const wheels = [];
  for (const x of [-1.05, 1.05]) for (const z of [-1.05, 1.05]) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.34, 16),
      new THREE.MeshStandardMaterial({ color: '#18212a', roughness: 0.91 }));
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    wheel.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.36, 12),
      new THREE.MeshStandardMaterial({ color: '#87979a', metalness: 0.72, roughness: 0.34 }));
    hub.rotation.z = Math.PI / 2;
    wheel.add(hub);
    wheel.position.set(x, 0.47, z);
    root.add(wheel);
    wheels.push(wheel);
  }

  const lights = [];
  for (const x of [-0.72, 0.72]) {
    const front = box(0.39, 0.16, 0.04, '#fff7cb', [x, 1.0, -1.6]);
    const rear = box(0.39, 0.16, 0.04, '#f46a49', [x, 1.0, 1.6]);
    root.add(front, rear); lights.push(front, rear);
  }
  scene.add(root);
  return { root, wheels };
}

const model = makeKart();

// Tire traces expose the slide radius for side-by-side reference comparisons.
const MAX_SKID_SEGMENTS = 9000;
const skidVertices = new Float32Array(MAX_SKID_SEGMENTS * 6);
const skidGeometry = new THREE.BufferGeometry();
const skidAttribute = new THREE.BufferAttribute(skidVertices, 3);
skidAttribute.setUsage(THREE.DynamicDrawUsage);
skidGeometry.setAttribute('position', skidAttribute);
skidGeometry.setDrawRange(0, 0);
const skids = new THREE.LineSegments(skidGeometry,
  new THREE.LineBasicMaterial({ color: 0x1b2629, opacity: 0.42, transparent: true, depthWrite: false }));
skids.frustumCulled = false;
scene.add(skids);
let skidSegments = 0;
let skidTicks = 0;
let previousTirePositions = null;

function tirePositions() {
  const cos = Math.cos(kart.heading), sin = Math.sin(kart.heading);
  return [-0.85, 0.85].map((side) => ({
    x: kart.x + cos * side + sin * 1.08,
    z: kart.z - sin * side + cos * 1.08
  }));
}

function drawTireTrace() {
  if (++skidTicks % 3 !== 0) return;
  const k = getKinematics(kart);
  if (Math.abs(k.lateral) < 2.8 || k.speed < 5) {
    previousTirePositions = null;
    return;
  }
  const points = tirePositions();
  if (previousTirePositions) {
    if (skidSegments + 2 >= MAX_SKID_SEGMENTS) {
      skidSegments = 0;
      skidGeometry.setDrawRange(0, 0);
      previousTirePositions = null;
    } else {
      for (let side = 0; side < 2; side++) {
        const a = previousTirePositions[side], b = points[side];
        const offset = skidSegments * 6;
        skidVertices.set([a.x, 0.035, a.z, b.x, 0.035, b.z], offset);
        skidSegments++;
      }
      skidGeometry.setDrawRange(0, skidSegments * 2);
      skidAttribute.needsUpdate = true;
    }
  }
  previousTirePositions = points;
}

function updateModel(dt) {
  const velocity = getKinematics(kart);
  model.root.position.set(kart.x, 0, kart.z);
  model.root.rotation.y = kart.heading;
  model.root.rotation.z = -kart.steer * 0.038 * Math.min(1, velocity.speed / 9);
  model.root.rotation.x = Math.max(-0.07, Math.min(0.07, velocity.longitudinal / 400));
  model.wheels.forEach((wheel) => { wheel.rotation.x += velocity.longitudinal * dt / 0.47; });
}

const cameraTarget = new THREE.Vector3();
const lookTarget = new THREE.Vector3();
function updateCamera(dt, instant = false) {
  const distance = settings.cameraDistance;
  const behindX = Math.sin(kart.heading), behindZ = Math.cos(kart.heading);
  cameraTarget.set(kart.x + behindX * (freeCamera ? distance * 0.35 : distance),
    freeCamera ? settings.cameraHeight * 2.4 : settings.cameraHeight,
    kart.z + behindZ * (freeCamera ? distance * 0.35 : distance));
  lookTarget.set(kart.x - behindX * 2.2, 0.95, kart.z - behindZ * 2.2);
  const alpha = instant ? 1 : 1 - Math.exp(-settings.cameraSmoothing * dt);
  camera.position.lerp(cameraTarget, alpha);
  camera.lookAt(lookTarget);
}

function resetKart() {
  kart = createKart();
  skidSegments = 0;
  previousTirePositions = null;
  skidGeometry.setDrawRange(0, 0);
  updateModel(0);
  updateCamera(STEP, true);
}
resetKart();
$('#resetKart').addEventListener('click', resetKart);

function draw2DFallback() {
  if (!fallback) return;
  const { canvas: c, ctx } = fallback;
  const scale = window.devicePixelRatio || 1;
  const w = window.innerWidth, h = window.innerHeight;
  if (c.width !== Math.round(w * scale) || c.height !== Math.round(h * scale)) {
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
  }
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#416d65';
  ctx.fillRect(0, 0, w, h);
  const pxPerMeter = 13;
  const midX = w * 0.49, midY = h * 0.51;
  const cos = Math.cos(-kart.heading), sin = Math.sin(-kart.heading);
  function world(x, z) {
    const dx = x - kart.x, dz = z - kart.z;
    return [midX + (dx * cos - dz * sin) * pxPerMeter, midY + (dx * sin + dz * cos) * pxPerMeter];
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#bdd4c24d';
  const xStart = Math.floor((kart.x - 75) / 5) * 5;
  const zStart = Math.floor((kart.z - 75) / 5) * 5;
  for (let x = xStart; x <= kart.x + 75; x += 5) {
    const [x1,y1] = world(x,kart.z - 90), [x2,y2] = world(x,kart.z + 90);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  }
  for (let z = zStart; z <= kart.z + 75; z += 5) {
    const [x1,y1] = world(kart.x - 90,z), [x2,y2] = world(kart.x + 90,z);
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  }
  // The fallback rotates the test ground, keeping the kart facing up-screen.
  ctx.save();
  ctx.translate(midX, midY);
  ctx.fillStyle = '#172631';
  ctx.fillRect(-19,-32,38,67);
  ctx.fillStyle = '#eaff74';
  ctx.fillRect(-14,-29,28,55);
  ctx.fillStyle = '#112b3c';
  ctx.beginPath(); ctx.ellipse(0,7,11,14,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle = '#1f292b';
  for (const x of [-20,14]) for (const y of [-21,14]) ctx.fillRect(x,y,6,19);
  ctx.fillStyle = '#fff7e0'; ctx.fillRect(-11,-30,7,3); ctx.fillRect(4,-30,7,3);
  ctx.restore();
  ctx.font = '700 12px DM Sans, sans-serif';
  ctx.fillStyle = '#dce7d9bb';
  ctx.fillText('2D SOFTWARE PREVIEW — 3D REQUIRES WEBGL', 30, Math.max(220, h * .23));
}

// --- User control / simulation -------------------------------------------
const pressed = new Set();
const touchPressed = new Set();
const controls = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight']
};

let recordLog = null;
let recordSampleTicks = 0;
const recordButton = $('#recordRun');

function currentInput() {
  return controlsEnabled ? {
    throttle: Number(isDown('up')) - Number(isDown('down')),
    steer: Number(isDown('right')) - Number(isDown('left'))
  } : { throttle: 0, steer: 0 };
}

function captureDriveSample(input) {
  if (!recordLog || ++recordSampleTicks % 12 !== 0) return;
  const k = getKinematics(kart);
  recordLog.samples.push({
    t: Number(kart.elapsed.toFixed(3)),
    throttle: input.throttle, steerInput: input.steer,
    x: Number(kart.x.toFixed(3)), z: Number(kart.z.toFixed(3)),
    heading: Number(kart.heading.toFixed(4)),
    forwardSpeed: Number(k.longitudinal.toFixed(3)),
    sidewaysSpeed: Number(k.lateral.toFixed(3)),
    yawRate: Number((kart.yawRate * 180 / Math.PI).toFixed(2))
  });
}

recordButton.addEventListener('click', () => {
  if (!recordLog) {
    resetKart();
    recordLog = { version: 'kartlab-v0.2', created: new Date().toISOString(),
      note: 'Original KartLab simulation data, not Smash Karts internal telemetry',
      physics: { ...settings }, samples: [] };
    recordSampleTicks = 0;
    recordButton.classList.add('recording');
    recordButton.textContent = '■ STOP & SAVE LOG';
    return;
  }
  const finished = recordLog;
  recordLog = null;
  recordButton.classList.remove('recording');
  recordButton.textContent = '⦿ RECORD RUN';
  const blob = new Blob([JSON.stringify(finished, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const download = document.createElement('a');
  download.href = url;
  download.download = `kartlab-drive-${Date.now()}.json`;
  document.body.append(download);
  download.click();
  download.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
});

function isDown(action) {
  return touchPressed.has(action) || controls[action].some((code) => pressed.has(code));
}

document.addEventListener('keydown', (event) => {
  const code = event.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) event.preventDefault();
  if (event.target instanceof HTMLInputElement) return;
  if (!event.repeat && code === 'KeyR') resetKart();
  if (!event.repeat && code === 'KeyC') { freeCamera = !freeCamera; updateCamera(STEP, true); }
  pressed.add(code);
});
document.addEventListener('keyup', (event) => pressed.delete(event.code));
window.addEventListener('blur', () => { pressed.clear(); touchPressed.clear(); });
$('#mobileControls').querySelectorAll('button').forEach((button) => {
  const action = button.dataset.control;
  button.addEventListener('pointerdown', (e) => { e.preventDefault(); button.setPointerCapture(e.pointerId); touchPressed.add(action); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, () => touchPressed.delete(action));
});

let previousTime = performance.now();
let accumulator = 0;
let hudTimer = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const realDt = Math.min((now - previousTime) / 1000, 0.08);
  previousTime = now;
  accumulator += realDt;
  let stepCount = 0;
  while (accumulator >= STEP && stepCount < 12) {
    const input = currentInput();
    stepKart(kart, input, settings);
    drawTireTrace();
    captureDriveSample(input);
    accumulator -= STEP;
    stepCount++;
  }
  if (stepCount >= 12) accumulator = 0;
  updateModel(realDt);
  updateCamera(realDt);
  sun.position.set(kart.x - 40, 80, kart.z + 30);
  sun.target.position.set(kart.x, 0, kart.z);
  sun.target.updateMatrixWorld();

  // Prevent grid and ground edges appearing during prolonged calibration.
  if (Math.abs(kart.x) > 220 || Math.abs(kart.z) > 220) {
    ground.position.set(kart.x, 0, kart.z);
    grid.position.set(kart.x, 0.018, kart.z);
  }

  hudTimer += realDt;
  if (hudTimer > 0.07) {
    hudTimer = 0;
    const k = getKinematics(kart);
    $('#speed').textContent = String(Math.round(k.longitudinal * 3.6));
    $('#steer').textContent = String(Math.round(kart.steer * settings.steerRate * Math.min(1, Math.abs(k.longitudinal) / settings.turnFullSpeed)));
    $('#slip').textContent = Math.abs(k.lateral).toFixed(1);
    $('#distance').textContent = String(Math.floor(kart.distance));
    for (const direction of ['up', 'left', 'down', 'right']) {
      $(`#inputMonitor [data-key="${direction}"]`).classList.toggle('active', isDown(direction));
    }
    const input = currentInput();
    const vertical = input.throttle > 0 ? 'FORWARD' : input.throttle < 0 ? 'REVERSE' : 'COAST';
    const horizontal = input.steer < 0 ? 'LEFT' : input.steer > 0 ? 'RIGHT' : '';
    $('#inputReadout').textContent = recordLog ? `● REC · ${vertical} ${horizontal}` : `${vertical} ${horizontal}`;
  }
  if (renderer) renderer.render(scene, camera);
  else draw2DFallback();
}
requestAnimationFrame(frame);

function showBenchmark() {
  const result = runBenchmark(settings);
  $('#benchmark').classList.remove('hidden');
  $('#benchmarkStatus').textContent = 'Automated: 4s acceleration → 3s free coast';
  $('#benchmarkAccel').textContent = result.secondsTo20 == null ? 'Not reached' : `${result.secondsTo20.toFixed(2)}s`;
  $('#benchmarkDistance').textContent = `${result.distanceAt4.toFixed(1)}m`;
  $('#benchmarkCoast').textContent = `${result.coastDistance.toFixed(1)}m`;
}
$('#runTest').addEventListener('click', showBenchmark);
$('#dismissBenchmark').addEventListener('click', () => $('#benchmark').classList.add('hidden'));
window.addEventListener('resize', () => {
  const width = window.innerWidth, height = window.innerHeight;
  renderer?.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
});
