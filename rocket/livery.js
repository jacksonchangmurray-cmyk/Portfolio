/* ============================================================
   Surface finish for the 3D-printed rocket. Drawn in code, in
   millimetres, so joints and markings land on the real part
   joints from the STEP file: dark filament with print layer
   lines, an orange parachute compartment, and vinyl decals.
   ============================================================ */

import * as THREE from "three";

const HEIGHT_MM = 1035;
const CIRCUMFERENCE_MM = Math.PI * 100;
// Where the parts meet (mm from the base), from the STEP file
const JOINTS = [100, 112, 247.5, 497.5, 747.5, 805];
const NOSE_START = 805;
const BAY_TOP = 112; // top of the avionics bay
const LAYER_MM = 0.5; // print layer lines (slightly exaggerated so they read on screen)

// Filament colours per part, decal colours on top
const PAINT = {
  body: "#1d1e21", nose: "#18191c", bay: "#131416", roll: "#2b2c30",
  band: "#ff5b1f", accent: "#ff5b1f", letters: "#d6d4ce", stencil: "#8d8b85",
};

/* ---------- Drawing helpers ---------- */

function sheet(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  // Draw in millimetres: x around the body, y down from the nose tip
  g.scale(width / CIRCUMFERENCE_MM, height / HEIGHT_MM);
  return { canvas, g };
}
const yOf = (zFromBase) => HEIGHT_MM - zFromBase;
const C = CIRCUMFERENCE_MM;

/* ---------- Colour ---------- */

function colorSheet(width, height) {
  const { canvas, g } = sheet(width, height);

  g.fillStyle = PAINT.body;
  g.fillRect(0, 0, C, HEIGHT_MM);

  // Nose cone
  g.fillStyle = PAINT.nose;
  g.fillRect(0, 0, C, yOf(NOSE_START));

  // Parachute compartment, printed in orange
  g.fillStyle = PAINT.band;
  g.fillRect(0, yOf(NOSE_START), C, NOSE_START - 747.5);

  // Avionics bay
  g.fillStyle = PAINT.bay;
  g.fillRect(0, yOf(BAY_TOP), C, BAY_TOP);

  // Tone-on-tone roll pattern decal: alternating quarters, so spin shows up on video
  const mid = 630;
  g.fillStyle = PAINT.roll;
  for (let q = 0; q < 4; q++) {
    const lower = q % 2 === 0;
    g.fillRect((q * C) / 4, yOf(lower ? mid : 700), C / 4, lower ? mid - 560 : 700 - mid);
  }

  // Name down the body on two opposite sides
  g.textBaseline = "middle";
  for (const x of [C * 0.25, C * 0.75]) {
    g.save();
    g.translate(x, yOf(478));
    g.rotate(Math.PI / 2);
    g.font = "600 20px 'Inter Tight', 'Segoe UI', sans-serif";
    g.fillStyle = PAINT.letters;
    g.fillText("MACROPLASTIC", 0, 0);
    g.fillStyle = PAINT.accent;
    g.fillText("V1", g.measureText("MACROPLASTIC ").width, 0);
    g.restore();
  }

  // Small stencils
  g.font = "500 5.5px 'JetBrains Mono', Consolas, monospace";
  g.fillStyle = PAINT.stencil;
  const stencil = (text, u, z) => g.fillText(text, u * C - g.measureText(text).width / 2, yOf(z));
  stencil("AVIONICS BAY", 0.5, 60);
  stencil("JCM · 01", 0.5, 46);
  g.fillStyle = "#1a1a1a";
  stencil("RECOVERY", 0.25, 776);
  stencil("RECOVERY", 0.75, 776);

  // Ruler down the back: a tick every 10 mm, numbered every 100 mm
  g.fillStyle = PAINT.stencil;
  const rulerU = 0.5 * C;
  for (let z = 120; z <= 740; z += 10) {
    const long = z % 100 === 0, half = z % 50 === 0;
    g.fillRect(rulerU - (long ? 4 : half ? 2.6 : 1.6), yOf(z) - 0.15, long ? 8 : half ? 5.2 : 3.2, 0.3);
    if (long) g.fillText(String(z), rulerU + 5, yOf(z));
  }

  // Thin accent pinstripes
  g.fillStyle = PAINT.accent;
  g.fillRect(0, yOf(BAY_TOP + 6), C, 0.9);
  g.fillRect(0, yOf(258), C, 0.9);

  // Joints between printed parts: dark gap with a lit lip
  for (const z of JOINTS) {
    g.fillStyle = "rgba(0, 0, 0, 0.75)";
    g.fillRect(0, yOf(z) - 0.45, C, 0.9);
    g.fillStyle = "rgba(255, 255, 255, 0.1)";
    g.fillRect(0, yOf(z) + 0.45, C, 0.5);
  }

  // Faint scuffing around the fins and the base
  const grime = g.createLinearGradient(0, yOf(0), 0, yOf(140));
  grime.addColorStop(0, "rgba(0, 0, 0, 0.35)");
  grime.addColorStop(1, "rgba(0, 0, 0, 0)");
  g.fillStyle = grime;
  g.fillRect(0, yOf(140), C, 140);

  return canvas;
}

/* ---------- Surface relief (bump) and shine (roughness) ---------- */

// Height map: print layer lines, the gaps at the joints, and a little filament noise
function reliefSheet(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  const img = g.createImageData(width, height);
  const data = img.data;
  const rowsPerLayer = (height / HEIGHT_MM) * LAYER_MM;
  for (let y = 0; y < height; y++) {
    // Each layer is a rounded bead: bright in the middle, dipping where layers meet
    const layer = Math.cos(((y / rowsPerLayer) % 1) * Math.PI * 2) * 0.5 + 0.5;
    // Layers wander slightly, as real prints do
    const wobble = Math.sin(y * 0.013) * 6;
    for (let x = 0; x < width; x++) {
      const v = 112 + layer * 60 + wobble + (Math.random() - 0.5) * 10;
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  g.scale(width / CIRCUMFERENCE_MM, height / HEIGHT_MM);
  g.fillStyle = "rgb(10, 10, 10)";
  for (const z of JOINTS) g.fillRect(0, yOf(z) - 0.5, C, 1);
  return canvas;
}

// Small tile of layer lines for the fins (they're printed as part of the avionics bay)
function layerTile() {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 8;
  const g = canvas.getContext("2d");
  for (let y = 0; y < 8; y++) {
    const v = 112 + (Math.cos((y / 8) * Math.PI * 2) * 0.5 + 0.5) * 60;
    g.fillStyle = `rgb(${v}, ${v}, ${v})`;
    g.fillRect(0, y, 4, 1);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function shineSheet(width, height) {
  const { canvas, g } = sheet(width, height);
  // Roughness: matte filament, a touch smoother on the nose and band, scuffed near the base
  g.fillStyle = "rgb(160, 160, 160)";
  g.fillRect(0, 0, C, HEIGHT_MM);
  g.fillStyle = "rgb(135, 135, 135)";
  g.fillRect(0, 0, C, yOf(747.5));
  const scuff = g.createLinearGradient(0, yOf(0), 0, yOf(160));
  scuff.addColorStop(0, "rgb(205, 205, 205)");
  scuff.addColorStop(1, "rgb(160, 160, 160)");
  g.fillStyle = scuff;
  g.fillRect(0, yOf(160), C, 160);
  // Decals are smooth vinyl
  g.fillStyle = "rgb(70, 70, 70)";
  g.textBaseline = "middle";
  for (const x of [C * 0.25, C * 0.75]) {
    g.save();
    g.translate(x, yOf(478));
    g.rotate(Math.PI / 2);
    g.font = "600 20px 'Inter Tight', 'Segoe UI', sans-serif";
    g.fillText("MACROPLASTIC V1", 0, 0);
    g.restore();
  }
  return canvas;
}

// 2×2 twill carbon fibre weave
function carbonTexture() {
  const size = 512, cell = 16;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  g.fillStyle = "#0b0b0c";
  g.fillRect(0, 0, size, size);
  for (let y = 0; y < size / cell; y++) {
    for (let x = 0; x < size / cell; x++) {
      const across = Math.floor((x + y) / 2) % 2 === 0;
      const grad = across
        ? g.createLinearGradient(x * cell, 0, (x + 1) * cell, 0)
        : g.createLinearGradient(0, y * cell, 0, (y + 1) * cell);
      grad.addColorStop(0, "#121213");
      grad.addColorStop(0.5, "#34353a");
      grad.addColorStop(1, "#121213");
      g.fillStyle = grad;
      g.fillRect(x * cell + 0.6, y * cell + 0.6, cell - 1.2, cell - 1.2);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2, 2);
  texture.anisotropy = 16;
  return texture;
}

/* ---------- Geometry prep ---------- */

/* Gets a part ready for painting:
   - fin triangles go in their own material group (any triangle reaching out past the body;
     fins are a few big triangles that all touch the body at the root)
   - one vertex per triangle corner, so the wrap-around seam can be stitched cleanly
   - UVs: around-the-body mapping for tubes, flat mapping for fins (STEP files carry no UVs)
   Returns the new geometry and whether it has fins. */
export function prepareGeometry(source, { baseY, topY, bodyRadius }) {
  const pos = source.attributes.position, index = source.index.array;
  const radius = (v) => Math.hypot(pos.getX(v), pos.getZ(v));
  const body = [], fins = [];
  for (let t = 0; t < index.length; t += 3) {
    const tri = [index[t], index[t + 1], index[t + 2]];
    (tri.some((v) => radius(v) > bodyRadius + 0.002) ? fins : body).push(...tri);
  }
  source.setIndex([...body, ...fins]);
  const geometry = source.toNonIndexed();
  geometry.clearGroups();
  geometry.addGroup(0, body.length, 0);
  if (fins.length) geometry.addGroup(body.length, fins.length, 1);

  const p = geometry.attributes.position;
  const uv = new Float32Array(p.count * 2);
  for (let t = 0; t < p.count; t += 3) {
    const isFin = t >= body.length;
    const us = [];
    for (let k = 0; k < 3; k++) {
      const i = t + k, x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const v = (y - baseY) / (topY - baseY);
      if (isFin) {
        uv[i * 2] = ((Math.hypot(x, z) - bodyRadius) / 0.1) * 2; // across the span
        uv[i * 2 + 1] = v * 12;                                   // and up the root
      } else {
        us.push(Math.atan2(-z, x) / (Math.PI * 2) + 0.5);
        uv[i * 2 + 1] = v;
      }
    }
    if (isFin) continue;
    // A triangle straddling the seam gets its low side pushed past 1 (the texture repeats)
    if (Math.max(...us) - Math.min(...us) > 0.5) for (let k = 0; k < 3; k++) if (us[k] < 0.5) us[k] += 1;
    for (let k = 0; k < 3; k++) uv[(t + k) * 2] = us[k];
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return { geometry, hasFins: fins.length > 0 };
}

/* ---------- Materials ---------- */

// [body, fins]. High detail on big screens, half size on phones.
export function paintMaterials({ high = true } = {}) {
  const width = high ? 2048 : 1024, height = high ? 4096 : 2048;
  const texture = (canvas, srgb) => {
    const t = new THREE.CanvasTexture(canvas);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = 16;
    return t;
  };
  const body = new THREE.MeshPhysicalMaterial({
    map: texture(colorSheet(width, height), true),
    roughness: 1,
    roughnessMap: texture(shineSheet(width / 2, height / 2), false),
    metalness: 0,
    bumpMap: texture(reliefSheet(width, height), false),
    bumpScale: 0.6,
    clearcoat: 0.35,
    clearcoatRoughness: 0.35,
    envMapIntensity: 0.7,
  });
  const fin = new THREE.MeshPhysicalMaterial({
    map: carbonTexture(), roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 0.8,
  });
  return [body, fin];
}
