/* ============================================================
   Macroplastic V1: parts view and wind tunnel.
   The model comes straight from the Fusion 360 STEP file
   (converted to rocket.glb, one mesh per part).
   ============================================================ */

import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { LIVERIES, liveryMaterials, prepareGeometry } from "./livery.js";
import { createTunnel, FIELDS, COLORMAPS } from "./tunnel.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const small = matchMedia("(max-width: 860px)").matches;
const canHover = matchMedia("(hover: hover)").matches;

/* ---------- What each part is (measured from the STEP file) ---------- */

// level = position in the stack from the bottom; pull = which way it slides out
const PARTS = [
  { name: "Nose Cone", label: "Nose cone", level: 6, size: "Ø100 × 250 mm", pull: "up",
    about: "Splits the oncoming air so it flows smoothly around the rocket. Its bottom 20 mm slides into the parachute compartment." },
  { name: "Parachute - Nose Cone Compartment", label: "Parachute compartment", level: 5, size: "Ø100 × 60 mm", pull: "side",
    about: "Holds the parachute, right under the nose cone." },
  { name: "Body Tube #3", label: "Body tube 3", level: 4, size: "Ø100 × 255 mm", pull: "side",
    about: "Top section of the body. Each body section overlaps the next by 5 mm where they join." },
  { name: "Body Tube #2", label: "Body tube 2", level: 3, size: "Ø100 × 255 mm", pull: "side",
    about: "Middle section of the body." },
  { name: "Body Tube #1", label: "Body tube 1", level: 2, size: "Ø100 × 140 mm", pull: "side",
    about: "Bottom section of the body, sitting on the quad cap." },
  { name: "Bottom Quad Cap", label: "Bottom quad cap", level: 1, size: "Ø100 × 25 mm", pull: "side",
    about: "Joins the fin can to the body tubes, with an opening through the middle." },
  { name: "Single Fin Base", label: "Single fin base", level: 0, size: "1 fin · 145 mm tall", pull: [-1, 0, 0],
    about: "One side of the fin can, carrying one fin." },
  { name: "Two Fin Base", label: "Two fin base", level: 0, size: "2 fins · 234 mm tall", pull: [0.7, 0, 0],
    about: "The other side of the fin can, carrying two fins. With the single fin base that makes three fins, 120° apart, each reaching 100 mm out from the body." },
];

// Measured nose and fin geometry (mm), used for the center of pressure
const GEOMETRY = { length: 1035, diameter: 100, noseLength: 230, fins: 3, rootChord: 145, tipChord: 65, span: 100, sweep: 80 };
const BODY_RADIUS = 0.05;
const HOVER_GAP = 0.055;
const EXPLODE_GAP = 0.085;

/* ---------- Renderer, camera, light ---------- */

const canvas = $("#scene");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.75 : 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // keeps the scientific colour maps exact
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0d0c);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
camera.position.set(2.2, 0.55, 2.6).setLength(small ? 2.9 : 3.1);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 0.5;
controls.maxDistance = 6;
controls.autoRotate = !reduceMotion;
controls.autoRotateSpeed = 0.45;

const keyLight = new THREE.DirectionalLight(0xffffff, 1.05);
keyLight.position.set(1.8, 3, 2.2);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = keyLight.shadow.camera.bottom = -1.6;
keyLight.shadow.camera.right = keyLight.shadow.camera.top = 1.6;
keyLight.shadow.bias = -0.0004;
keyLight.shadow.radius = 6;
scene.add(keyLight);
scene.add(new THREE.HemisphereLight(0xffffff, 0x101010, 0.1));
const rimLight = new THREE.DirectionalLight(0xffe2d1, 0.45);
rimLight.position.set(-2.5, 1.2, -2);
scene.add(rimLight);

/* ---------- Post-processing: outline for the selected part, soft glow ---------- */

const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType }));
composer.addPass(new RenderPass(scene, camera));
const outline = new OutlinePass(new THREE.Vector2(1, 1), scene, camera);
outline.visibleEdgeColor.set(0xff5b1f);
outline.hiddenEdgeColor.set(0x5a2410);
outline.edgeStrength = 5;
outline.edgeGlow = 0.6;
outline.edgeThickness = 1.6;
composer.addPass(outline);
// Only things brighter than white (smoke, the outline) glow; the paint never does
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.45, 1.02);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  composer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

/* ---------- Load the model ---------- */

const loading = $(".loading");
let gltf, profile;
try {
  [gltf, profile] = await Promise.all([
    new GLTFLoader().loadAsync("rocket.glb"),
    fetch("profile.json").then((res) => res.json()),
  ]);
} catch (err) {
  loading.textContent = "Couldn't load the 3D model.";
  throw err;
}

// Body radius along the rocket (no fins), from the STEP file
const radii = profile.radius_mm.map((r) => r / 1000);
const stepM = profile.step_mm / 1000;
const BASE_Y = (profile.base_mm - profile.mid_mm) / 1000;
const TOP_Y = BASE_Y + (radii.length - 1) * stepM;
function radiusAt(y) {
  if (y < BASE_Y || y > TOP_Y) return 0;
  const f = (y - BASE_Y) / stepM, i = Math.min(radii.length - 2, Math.floor(f));
  return radii[i] + (radii[i + 1] - radii[i]) * (f - i);
}

// Floor: a soft shadow plus a faint orange glow
const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.45 }));
shadowFloor.rotation.x = -Math.PI / 2;
shadowFloor.receiveShadow = true;
scene.add(shadowFloor);
const glow = new THREE.Mesh(
  new THREE.CircleGeometry(1.3, 64),
  new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false }),
);
glow.rotation.x = -Math.PI / 2;
scene.add(glow);

const rocket = new THREE.Group();
rocket.add(gltf.scene);
scene.add(rocket);

const matchKey = (text) => (text || "").toLowerCase().replace(/[^a-z0-9#]/g, "");
const pressureMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0 });
const parts = [];

gltf.scene.traverse((obj) => {
  if (!obj.isMesh) return;
  const info = PARTS.find((p) => matchKey(p.name) === matchKey(obj.userData.name || obj.name));
  if (!info) return;
  const geometry = obj.geometry;
  const hasFins = prepareGeometry(geometry, { baseY: BASE_Y, topY: TOP_Y, bodyRadius: BODY_RADIUS });
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3).fill(1), 3));
  geometry.computeBoundingBox();
  obj.castShadow = true;
  obj.receiveShadow = true;
  parts.push({
    ...info,
    hasFins,
    mesh: obj,
    box: geometry.boundingBox,
    offset: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    target: new THREE.Vector3(),
  });
});
parts.sort((a, b) => PARTS.findIndex((p) => p.name === a.name) - PARTS.findIndex((p) => p.name === b.name));
parts.forEach((part, i) => { part.number = String(i + 1).padStart(2, "0"); });

/* ---------- Paint schemes ---------- */

const liveryCache = new Map();
let livery = LIVERIES[0];
function applyMaterials() {
  const showPressure = mode === "tunnel" && tunnel.state.layers.surface;
  if (!liveryCache.has(livery.id)) liveryCache.set(livery.id, liveryMaterials(livery));
  const [body, fin] = liveryCache.get(livery.id);
  for (const part of parts) {
    part.mesh.material = showPressure
      ? (part.hasFins ? [pressureMaterial, pressureMaterial] : pressureMaterial)
      : (part.hasFins ? [body, fin] : body);
  }
}

const swatches = $(".swatches");
LIVERIES.forEach((option) => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "swatch";
  button.setAttribute("aria-pressed", String(option === livery));
  button.innerHTML = `<span class="chip" style="--a:${option.paint};--b:${option.nose};--c:${option.band}"></span><span></span>`;
  button.lastChild.textContent = option.name;
  button.addEventListener("click", () => {
    livery = option;
    $$(".swatch").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    applyMaterials();
  });
  swatches.append(button);
});

/* ---------- Wind tunnel ---------- */

let mode = "parts";
const tunnel = createTunnel({ scene, radiusAt, baseY: BASE_Y, topY: TOP_Y, small, onStats: showTunnelStats });
applyMaterials();
loading.remove();

/* ---------- Parts view: hover, pin, explode ---------- */

let exploded = false;
let explodeTime = -10;
let canvasHover = null, listHover = null, pinned = null;
const focus = () => (mode === "parts" ? listHover || canvasHover || pinned : null);

if (!canHover) $('[data-view="parts"] .hint').textContent = "Tap a part to pull it out. Drag to spin, pinch to zoom.";

const list = $(".part-list");
for (const part of parts) {
  const item = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  button.innerHTML = `<span class="num mono"></span><span class="name"></span><span class="size mono"></span>`;
  button.querySelector(".num").textContent = part.number;
  button.querySelector(".name").textContent = part.label;
  button.querySelector(".size").textContent = part.size.split(" · ")[0];
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("pointerenter", () => { listHover = part; refresh(); });
  button.addEventListener("pointerleave", () => { listHover = null; refresh(); });
  button.addEventListener("focus", () => { listHover = part; refresh(); });
  button.addEventListener("blur", () => { listHover = null; refresh(); });
  button.addEventListener("click", () => { pinned = pinned === part ? null : part; refresh(); });
  item.append(button);
  list.append(item);
  part.button = button;
}

const explodeButton = $('[data-act="explode"]');
let zoomGoal = null;
function setExploded(on) {
  if (on === exploded) return;
  exploded = on;
  explodeTime = clock.elapsedTime;
  explodeButton.textContent = exploded ? "Put it back together" : "Explode all";
  zoomGoal = camera.position.distanceTo(controls.target) * (exploded ? 1.35 : 1 / 1.35);
}
explodeButton.addEventListener("click", () => { setExploded(!exploded); stopAutoRotate(); });

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerInside = false, pointerMoved = false, downAt = null;

function setPointer(e) {
  const rect = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
}
function pick() {
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(parts.map((p) => p.mesh), false)[0];
  return hit ? parts.find((p) => p.mesh === hit.object) : null;
}

canvas.addEventListener("pointermove", (e) => {
  if (e.pointerType !== "mouse") return;
  setPointer(e);
  pointerInside = pointerMoved = true;
});
canvas.addEventListener("pointerleave", () => {
  pointerInside = false;
  if (canvasHover) { canvasHover = null; refresh(); }
});
canvas.addEventListener("pointerdown", (e) => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener("pointerup", (e) => {
  if (mode !== "parts" || !downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  setPointer(e);
  const hit = pick();
  pinned = hit && hit !== pinned ? hit : null;
  refresh();
});

function stopAutoRotate() { controls.autoRotate = false; }
controls.addEventListener("start", () => { stopAutoRotate(); zoomGoal = null; cameraTween = null; });

const callout = $(".callout");
const detail = $(".detail");
function refresh() {
  const current = focus();
  outline.selectedObjects = current ? [current.mesh] : [];
  for (const part of parts) {
    part.button.classList.toggle("active", part === current);
    part.button.setAttribute("aria-pressed", String(part === pinned));
  }
  canvas.classList.toggle("pointing", !!canvasHover);
  detail.hidden = !current;
  callout.hidden = !current || small;
  if (!current) return;
  $(".detail-size", detail).textContent = `${current.number} · ${current.size}`;
  $(".detail-about", detail).textContent = current.about;
  $(".callout-num", callout).textContent = current.number;
  $(".callout-name", callout).textContent = current.label;
  $(".callout-size", callout).textContent = current.size;
  $(".callout-about", callout).textContent = current.about;
}

// Where each part wants to be. Explode/reassemble ripples through the stack.
const toCamera = new THREE.Vector3(), cameraRight = new THREE.Vector3(), slideOut = new THREE.Vector3();
function layout(part, current, time) {
  const t = part.target.set(0, 0, 0);
  if (mode !== "parts") return t;
  const since = time - explodeTime;
  const outDelay = (6 - part.level) * 0.06, inDelay = part.level * 0.05;
  const isExploded = exploded ? since > outDelay : since <= inDelay;
  if (isExploded) {
    t.y = part.level * EXPLODE_GAP;
    if (Array.isArray(part.pull)) t.x = part.pull[0] * 0.07;
    if (part === current) pullOut(part, t, 0.45);
    return t;
  }
  if (!current) return t;
  if (part === current) pullOut(part, t, 1);
  else if (part.level > current.level) t.y = HOVER_GAP;
  else if (part.level < current.level) t.y = -HOVER_GAP * 0.6;
  return t;
}
function pullOut(part, t, amount) {
  if (part.pull === "up") t.y += 0.17 * amount;
  else if (part.pull === "side") t.addScaledVector(slideOut, 0.17 * amount);
  else { t.x += part.pull[0] * 0.14 * amount; t.y -= 0.03 * amount; }
}

/* ---------- Callouts (leader lines like a technical drawing) ---------- */

const leaders = $(".leaders");
const leaderPath = $(".leader", leaders);
const leaderDot = $(".leader-dot", leaders);
const badgeLayer = $(".badges");
const badges = parts.map((part) => {
  const el = document.createElement("span");
  el.className = "badge mono";
  el.textContent = part.number;
  badgeLayer.append(el);
  return el;
});

const corner = new THREE.Vector3();
function screenBox(part) {
  const rect = canvas.getBoundingClientRect();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? part.box.max.x : part.box.min.x, i & 2 ? part.box.max.y : part.box.min.y, i & 4 ? part.box.max.z : part.box.min.z);
    part.mesh.localToWorld(corner).project(camera);
    const x = rect.left + ((corner.x + 1) / 2) * rect.width, y = rect.top + ((1 - corner.y) / 2) * rect.height;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  return { minX, maxX, minY, maxY, rect };
}

function placeCallouts(current) {
  const showBadges = mode === "parts" && exploded && !small;
  parts.forEach((part, i) => {
    const el = badges[i];
    el.hidden = !showBadges || part === current;
    if (el.hidden) return;
    const b = screenBox(part);
    el.style.transform = `translate(${b.maxX + 10}px, ${(b.minY + b.maxY) / 2}px) translateY(-50%)`;
  });

  if (!current || small) { leaders.classList.remove("on"); return; }
  // Parts slide out to the right, so the card goes left of the whole rocket when there's room
  const b = screenBox(current);
  let rocketLeft = Infinity, rocketRight = -Infinity;
  for (const part of parts) {
    if (part === current) continue;
    const box = screenBox(part);
    rocketLeft = Math.min(rocketLeft, box.minX);
    rocketRight = Math.max(rocketRight, box.maxX);
  }
  const w = callout.offsetWidth, h = callout.offsetHeight, rect = b.rect;
  const anchorY = (b.minY + b.maxY) / 2;
  let x, onLeft;
  if (rocketLeft - 40 - w >= rect.left + 16) { x = rocketLeft - 40 - w; onLeft = true; }
  else if (Math.max(b.maxX, rocketRight) + 40 + w <= rect.right - 16) { x = Math.max(b.maxX, rocketRight) + 40; onLeft = false; }
  else { x = rect.left + 16; onLeft = true; }
  let y = Math.min(rect.bottom - h - 16, Math.max(rect.top + 140, anchorY - h / 2));
  // Last resort on narrow screens: keep the card out of the part's way vertically
  if (onLeft && x + w > b.minX - 12) y = anchorY > rect.top + rect.height / 2 ? Math.max(rect.top + 140, b.minY - h - 24) : Math.min(rect.bottom - h - 16, b.maxY + 24);
  callout.style.translate = `${x}px ${y}px`; // separate from the fade-in animation's transform
  const startX = onLeft ? b.minX - 6 : b.maxX + 6;
  const endX = onLeft ? x + w : x;
  const endY = Math.min(y + h - 16, Math.max(y + 16, anchorY));
  const elbowX = onLeft ? Math.min(startX - 18, endX + 22) : Math.max(startX + 18, endX - 22);
  leaderPath.setAttribute("d", `M${startX},${anchorY} L${elbowX},${anchorY} L${endX},${endY}`);
  leaderDot.setAttribute("cx", startX);
  leaderDot.setAttribute("cy", anchorY);
  leaders.classList.add("on");
}

/* ---------- Center of pressure and gravity ---------- */

// Barrowman center of pressure (mm from the nose tip)
function centerOfPressure(g) {
  const radius = g.diameter / 2;
  const noseCN = 2, noseX = 0.466 * g.noseLength; // ogive nose
  const midChord = Math.hypot(g.span, g.sweep + (g.tipChord - g.rootChord) / 2);
  const finCN = (1 + radius / (g.span + radius)) * (4 * g.fins * (g.span / g.diameter) ** 2)
    / (1 + Math.sqrt(1 + ((2 * midChord) / (g.rootChord + g.tipChord)) ** 2));
  const finRoot = g.length - g.rootChord;
  const finX = finRoot
    + (g.sweep * (g.rootChord + 2 * g.tipChord)) / (3 * (g.rootChord + g.tipChord))
    + (1 / 6) * (g.rootChord + g.tipChord - (g.rootChord * g.tipChord) / (g.rootChord + g.tipChord));
  return (noseCN * noseX + finCN * finX) / (noseCN + finCN);
}
const CP_MM = centerOfPressure(GEOMETRY);
$(".cp-value").innerHTML = `${Math.round(CP_MM)} mm <span>from the nose tip (${Math.round(GEOMETRY.length - CP_MM)} mm above the base)</span>`;

const ring = (color) => {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(0.066, 0.003, 12, 96), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  mesh.rotation.x = Math.PI / 2;
  mesh.visible = false;
  rocket.add(mesh);
  return mesh;
};
const cpRing = ring(0xff5b1f);
cpRing.position.y = TOP_Y - CP_MM / 1000;
const cgRing = ring(0xecebe6);
const ringLabels = { cp: $('[data-ring="cp"]'), cg: $('[data-ring="cg"]') };

const cgToggle = $('[data-input="cg"]'), cgSlider = $('[data-input="cgpos"]');
function updateCG() {
  const on = cgToggle.checked;
  $(".cg").hidden = !on;
  cgRing.visible = on && mode === "tunnel";
  if (!on) return;
  const cg = Number(cgSlider.value);
  cgRing.position.y = TOP_Y - cg / 1000;
  $('[data-out="cg"]').textContent = `${cg} mm`;
  const margin = (CP_MM - cg) / GEOMETRY.diameter;
  const stability = $(".stability");
  const verdict = margin < 0 ? "unstable: the center of gravity is behind the center of pressure"
    : margin < 1 ? "marginal: aim for at least 1"
    : margin <= 2.5 ? "stable"
    : "very stable, may turn into crosswinds";
  stability.textContent = `${margin.toFixed(2)} calibers: ${verdict}`;
  stability.className = `stability ${margin >= 1 ? "good" : "warn"}`;
}
cgToggle.addEventListener("change", updateCG);
cgSlider.addEventListener("input", updateCG);

/* ---------- Tunnel controls ---------- */

const inputs = {
  speed: $('[data-input="speed"]'),
  pitch: $('[data-input="pitch"]'),
  roll: $('[data-input="roll"]'),
};
const out = (name) => $(`[data-out="${name}"]`);
const attitude = { pitch: 0, roll: 0 };

function readTunnelInputs() {
  const speed = Number(inputs.speed.value);
  attitude.pitch = Number(inputs.pitch.value);
  attitude.roll = Number(inputs.roll.value);
  out("speed").textContent = `${speed} m/s · ${Math.round(speed * 3.6)} km/h`;
  out("pitch").textContent = `${attitude.pitch > 0 ? "+" : ""}${attitude.pitch}°`;
  out("roll").textContent = `${attitude.roll}°`;
  $(".compass-needle").style.transform = `rotate(${attitude.roll}deg)`;
  tunnel.setSpeed(speed);
  tunnel.setAttitude(attitude.pitch, attitude.roll);
  drawColorbar();
}
Object.values(inputs).forEach((input) => input.addEventListener("input", readTunnelInputs));

$$("[data-field]").forEach((button) => button.addEventListener("click", () => {
  $$("[data-field]").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
  tunnel.setField(button.dataset.field);
  drawColorbar();
}));

$$("[data-layer]").forEach((input) => input.addEventListener("change", () => {
  tunnel.setLayer(input.dataset.layer, input.checked);
  if (input.dataset.layer === "surface") applyMaterials();
}));

const pauseButton = $('[data-act="pause"]');
pauseButton.addEventListener("click", () => {
  const paused = !tunnel.state.paused;
  tunnel.setPaused(paused);
  pauseButton.textContent = paused ? "Resume" : "Pause";
});
$('[data-act="reset"]').addEventListener("click", () => tunnel.reset());

// Colour bar with real units for the field on show
const colorbar = $(".colorbar canvas");
function drawColorbar() {
  const field = FIELDS[tunnel.state.field];
  const map = COLORMAPS[field.map];
  const g = colorbar.getContext("2d");
  const w = (colorbar.width = 256), h = (colorbar.height = 1);
  const img = g.createImageData(w, h);
  for (let i = 0; i < w; i++) img.data.set([map[i * 3], map[i * 3 + 1], map[i * 3 + 2], 255], i * 4);
  g.putImageData(img, 0, 0);
  const [lo, hi] = tunnel.fieldRange();
  const fmt = (v) => (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`);
  $(".colorbar-title").textContent = `${field.label} (${field.unit})`;
  $(".colorbar-lo").textContent = fmt(lo);
  $(".colorbar-mid").textContent = fmt((lo + hi) / 2);
  $(".colorbar-hi").textContent = fmt(hi);
}

// Live force history
const chart = $(".chart canvas");
function drawChart(history) {
  const ratio = Math.min(window.devicePixelRatio, 2);
  const w = chart.clientWidth, h = chart.clientHeight;
  if (chart.width !== w * ratio) { chart.width = w * ratio; chart.height = h * ratio; }
  const g = chart.getContext("2d");
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
  g.clearRect(0, 0, w, h);
  const values = history.flat();
  const span = Math.max(1, ...values.map(Math.abs)) * 1.15;
  const yOf = (v) => h / 2 - (v / span) * (h / 2 - 6);
  g.strokeStyle = "rgba(236,235,230,0.12)";
  g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  const line = (index, color) => {
    g.strokeStyle = color;
    g.lineWidth = 1.6;
    g.beginPath();
    history.forEach((entry, i) => {
      const x = (i / 299) * w;
      i ? g.lineTo(x, yOf(entry[index])) : g.moveTo(x, yOf(entry[index]));
    });
    g.stroke();
  };
  line(0, "#ff5b1f");
  line(1, "#5aa0e6");
}

function showTunnelStats(stats) {
  out("cd").textContent = stats.cd.toFixed(2);
  out("cl").textContent = (stats.cl >= 0 ? "+" : "") + stats.cl.toFixed(2);
  out("q").textContent = stats.q >= 1000 ? `${(stats.q / 1000).toFixed(1)} kPa` : `${Math.round(stats.q)} Pa`;
  out("re").textContent = `${(stats.reFlight / 1e6).toFixed(1)} million`;
  out("resim").textContent = Math.round(stats.reSim).toLocaleString();
  out("sps").textContent = `${Math.round(stats.stepsPerSecond)} steps/s`;
}

/* ---------- Switching views ---------- */

const tabs = $$("[data-mode]");
tabs.forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));

let blend = 0;            // 0 = parts view, 1 = wind tunnel
let cameraTween = null;
const partsView = { position: camera.position.clone(), target: new THREE.Vector3() };
// Three-quarter view from the front, a little above, wide enough for the nose and the wake
const tunnelView = {
  position: new THREE.Vector3(small ? -0.75 : -0.55, small ? 1.05 : 0.8, small ? 5.4 : 3.9),
  target: new THREE.Vector3(small ? 0.3 : 0.38, -0.08, 0),
};

function setMode(next) {
  if (next === mode) return;
  if (next === "tunnel") {
    partsView.position.copy(camera.position);
    partsView.target.copy(controls.target);
    setExploded(false);
    pinned = canvasHover = listHover = null;
  }
  mode = next;
  document.body.classList.toggle("in-tunnel", mode === "tunnel");
  tabs.forEach((tab) => tab.setAttribute("aria-selected", String(tab.dataset.mode === mode)));
  $$("[data-view]").forEach((view) => { view.hidden = view.dataset.view !== mode; });
  stopAutoRotate();
  zoomGoal = null;
  const to = mode === "tunnel" ? tunnelView : partsView;
  cameraTween = { start: clock.elapsedTime, fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos: to.position.clone(), toTarget: to.target.clone() };
  tunnel.setActive(mode === "tunnel");
  cpRing.visible = mode === "tunnel";
  applyMaterials();
  updateCG();
  readTunnelInputs();
  refresh();
}

/* ---------- Loop ---------- */

const clock = new THREE.Clock();
const qParts = new THREE.Quaternion();
const qTunnel = new THREE.Quaternion();
const qPitch = new THREE.Quaternion(), qRoll = new THREE.Quaternion();
const smoothAttitude = { pitch: 0, roll: 0 };
const Z = new THREE.Vector3(0, 0, 1), Y = new THREE.Vector3(0, 1, 0);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const worldPos = new THREE.Vector3(), right = new THREE.Vector3();

function placeRingLabel(mesh, el) {
  el.hidden = !mesh.visible || blend < 0.9;
  if (el.hidden) return;
  mesh.getWorldPosition(worldPos);
  right.setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(0.09); // just above the ring on screen
  worldPos.add(right).project(camera);
  const rect = canvas.getBoundingClientRect();
  el.style.transform = `translate(${rect.left + ((worldPos.x + 1) / 2) * rect.width}px, ${rect.top + ((1 - worldPos.y) / 2) * rect.height}px) translate(-50%, -100%)`;
}

renderer.setAnimationLoop(frame);

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  // Camera move between views
  if (cameraTween) {
    const k = Math.min(1, (time - cameraTween.start) / (reduceMotion ? 0.01 : 1.4));
    const e = ease(k);
    camera.position.lerpVectors(cameraTween.fromPos, cameraTween.toPos, e);
    controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, e);
    if (k >= 1) cameraTween = null;
  }
  controls.update();

  if (mode === "parts" && pointerInside && pointerMoved) {
    pointerMoved = false;
    const hit = pick();
    if (hit !== canvasHover) { canvasHover = hit; refresh(); }
  }

  // Tip the rocket over into the tunnel, then follow the pitch/roll sliders
  blend += ((mode === "tunnel" ? 1 : 0) - blend) * Math.min(1, dt * (reduceMotion ? 60 : 2.6));
  if (Math.abs(blend - (mode === "tunnel" ? 1 : 0)) < 0.001) blend = mode === "tunnel" ? 1 : 0;
  smoothAttitude.pitch += (attitude.pitch - smoothAttitude.pitch) * Math.min(1, dt * 6);
  smoothAttitude.roll += (attitude.roll - smoothAttitude.roll) * Math.min(1, dt * 6);
  qPitch.setFromAxisAngle(Z, Math.PI / 2 - (smoothAttitude.pitch * Math.PI) / 180);
  qRoll.setFromAxisAngle(Y, (smoothAttitude.roll * Math.PI) / 180);
  qTunnel.multiplyQuaternions(qPitch, qRoll);
  rocket.quaternion.slerpQuaternions(qParts, qTunnel, ease(blend));

  const floorY = BASE_Y - 0.002 + (tunnel.floorY - (BASE_Y - 0.002)) * ease(blend);
  shadowFloor.position.y = floorY;
  glow.position.y = floorY + 0.001;
  glow.material.opacity = 1 - blend * 0.6;
  tunnel.setVisible(blend > 0.02);
  tunnel.setOpacity(Math.max(0, (blend - 0.4) / 0.6));

  // Parts spring toward their targets (slightly soft, so they settle rather than snap)
  toCamera.set(camera.position.x - controls.target.x, 0, camera.position.z - controls.target.z).normalize();
  cameraRight.setFromMatrixColumn(camera.matrixWorld, 0).setY(0).normalize();
  slideOut.copy(toCamera).multiplyScalar(0.45).addScaledVector(cameraRight, 0.9).normalize();
  const current = focus();
  const stiffness = 150, damping = 2 * Math.sqrt(stiffness) * 0.86;
  for (const part of parts) {
    layout(part, current, time);
    if (reduceMotion) part.offset.copy(part.target);
    else {
      part.velocity.addScaledVector(part.target.clone().sub(part.offset), stiffness * dt).multiplyScalar(Math.max(0, 1 - damping * dt));
      part.offset.addScaledVector(part.velocity, dt);
    }
    part.mesh.position.copy(part.offset);
  }

  // Keep the exploded stack in view
  const lift = mode === "parts" && exploded ? (6 * EXPLODE_GAP) / 2 : 0;
  if (mode === "parts" && !cameraTween) {
    const rise = (lift - controls.target.y) * Math.min(1, dt * 5);
    controls.target.y += rise;
    camera.position.y += rise;
  }
  if (zoomGoal) {
    const distance = camera.position.distanceTo(controls.target);
    const next = distance + (zoomGoal - distance) * Math.min(1, dt * 5);
    camera.position.sub(controls.target).setLength(next).add(controls.target);
    if (Math.abs(zoomGoal - next) < 0.005) zoomGoal = null;
  }

  tunnel.update(dt, rocket, parts);
  if (mode === "tunnel" && tunnel.state.history.length) drawChart(tunnel.state.history);

  placeCallouts(current);
  placeRingLabel(cpRing, ringLabels.cp);
  placeRingLabel(cgRing, ringLabels.cg);
  composer.render();
}

/* ---------- Helpers ---------- */

function glowTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255, 236, 225, 0.07)");
  gradient.addColorStop(0.5, "rgba(255, 236, 225, 0.02)");
  gradient.addColorStop(1, "rgba(255, 236, 225, 0)");
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

readTunnelInputs();
refresh();
