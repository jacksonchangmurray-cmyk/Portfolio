/* ============================================================
   Paint schemes. Textures are drawn in code, in millimetres,
   so panel lines and markings land on the real part joints.
   ============================================================ */

import * as THREE from "three";

const HEIGHT_MM = 1035;
const CIRCUMFERENCE_MM = Math.PI * 100;
// Where the parts meet (mm from the base), from the STEP file
const JOINTS = [100, 112, 247.5, 497.5, 747.5, 805];
const NOSE_START = 805;

export const LIVERIES = [
  {
    id: "signal", name: "Signal",
    paint: "#f1efe9", nose: "#ff5b1f", band: "#1c1c1a", roll: "#1c1c1a", letters: "#1c1c1a", accent: "#ff5b1f",
    finCan: "#1c1c1a", fin: "carbon", gloss: 0.55,
  },
  {
    id: "stealth", name: "Stealth",
    paint: "#1a1a19", nose: "#121212", band: "#ff5b1f", roll: "#2c2c2a", letters: "#ff5b1f", accent: "#ff5b1f",
    finCan: "#111110", fin: "carbon", gloss: 0.35,
  },
  {
    id: "classic", name: "Classic",
    paint: "#f4f2ec", nose: "#c8261d", band: "#f4f2ec", roll: "#151515", letters: "#151515", accent: "#c8261d",
    finCan: "#f4f2ec", fin: "#151515", gloss: 0.6, rollTwice: true,
  },
];

// Big canvas mapped around the body (u) and up its height (v)
function bodyTexture(livery) {
  const width = 1024, height = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext("2d");
  // Draw in millimetres: x around the body, y down from the nose tip
  g.scale(width / CIRCUMFERENCE_MM, height / HEIGHT_MM);
  const C = CIRCUMFERENCE_MM;
  const yOf = (zFromBase) => HEIGHT_MM - zFromBase;

  g.fillStyle = livery.paint;
  g.fillRect(0, 0, C, HEIGHT_MM);

  // Nose cone and parachute band
  g.fillStyle = livery.nose;
  g.fillRect(0, 0, C, yOf(NOSE_START));
  g.fillStyle = livery.band;
  g.fillRect(0, yOf(NOSE_START), C, NOSE_START - 747.5);
  // Fin can
  g.fillStyle = livery.finCan;
  g.fillRect(0, yOf(112), C, 112);

  // Roll pattern: alternating quarters, so you can see the rocket spin in video
  const roll = (from, to) => {
    const mid = (from + to) / 2;
    g.fillStyle = livery.roll;
    for (let q = 0; q < 4; q++) {
      const lower = q % 2 === 0;
      g.fillRect((q * C) / 4, yOf(lower ? mid : to), C / 4, lower ? mid - from : to - mid);
    }
  };
  roll(560, 700);
  if (livery.rollTwice) roll(130, 230);

  // Name running down the body on opposite sides
  g.fillStyle = livery.letters;
  g.font = "600 21px 'Inter Tight', 'Segoe UI', sans-serif";
  g.textBaseline = "middle";
  for (const x of [C * 0.25, C * 0.75]) {
    g.save();
    g.translate(x, yOf(470));
    g.rotate(Math.PI / 2);
    g.fillText("MACROPLASTIC", 0, 0);
    g.fillStyle = livery.accent;
    g.fillText("V1", g.measureText("MACROPLASTIC ").width, 0);
    g.restore();
    g.fillStyle = livery.letters;
  }

  // Small markings near the base
  g.font = "500 7px 'JetBrains Mono', Consolas, monospace";
  g.fillStyle = livery.finCan === livery.paint ? livery.letters : livery.paint;
  g.globalAlpha = 0.75;
  g.fillText("JCM · 01", C * 0.5 - 12, yOf(60));
  g.globalAlpha = 1;

  // Thin accent stripe and panel lines at every joint
  g.fillStyle = livery.accent;
  g.fillRect(0, yOf(258), C, 1.6);
  g.fillStyle = "rgba(0, 0, 0, 0.55)";
  for (const z of JOINTS) g.fillRect(0, yOf(z) - 0.35, C, 0.7);
  g.fillStyle = "rgba(255, 255, 255, 0.18)";
  for (const z of JOINTS) g.fillRect(0, yOf(z) + 0.35, C, 0.5);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

// Fine bumpy "orange peel" paint finish, tiled
function paintBump() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  const img = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = 128 + (Math.random() - 0.5) * 34;
    img.data.set([v, v, v, 255], i * 4);
  }
  g.putImageData(img, 0, 0);
  g.filter = "blur(1.2px)";
  g.drawImage(canvas, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(6, 20);
  return texture;
}

// 2×2 twill carbon fibre weave
function carbonTexture() {
  const size = 256, cell = 16;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  g.fillStyle = "#0e0e0e";
  g.fillRect(0, 0, size, size);
  for (let y = 0; y < size / cell; y++) {
    for (let x = 0; x < size / cell; x++) {
      const across = Math.floor((x + y) / 2) % 2 === 0;
      const grad = across
        ? g.createLinearGradient(x * cell, 0, (x + 1) * cell, 0)
        : g.createLinearGradient(0, y * cell, 0, (y + 1) * cell);
      grad.addColorStop(0, "#151515");
      grad.addColorStop(0.5, "#3a3a3a");
      grad.addColorStop(1, "#151515");
      g.fillStyle = grad;
      g.fillRect(x * cell + 0.5, y * cell + 0.5, cell - 1, cell - 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.anisotropy = 8;
  return texture;
}

/* Gets a part ready for painting:
   - fin triangles go in their own material group (any triangle reaching out past the body is a fin;
     fins are a few big triangles that all touch the body at the root)
   - UVs: around-the-body mapping for tubes, flat mapping for fins (STEP files carry no UVs)
   Returns true if the part has fins. */
export function prepareGeometry(geometry, { baseY, topY, bodyRadius }) {
  const pos = geometry.attributes.position, index = geometry.index.array;
  const radius = (v) => Math.hypot(pos.getX(v), pos.getZ(v));
  const body = [], fins = [], finVertex = new Uint8Array(pos.count);
  for (let t = 0; t < index.length; t += 3) {
    const tri = [index[t], index[t + 1], index[t + 2]];
    if (tri.some((v) => radius(v) > bodyRadius + 0.002)) {
      fins.push(...tri);
      tri.forEach((v) => { finVertex[v] = 1; });
    } else body.push(...tri);
  }

  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const v = (y - baseY) / (topY - baseY);
    if (finVertex[i]) {
      uv[i * 2] = (Math.hypot(x, z) - bodyRadius) / 0.1 * 2; // across the span
      uv[i * 2 + 1] = v * 12;                                 // and up the root
    } else {
      uv[i * 2] = Math.atan2(-z, x) / (Math.PI * 2) + 0.5;   // seam hides behind the single fin
      uv[i * 2 + 1] = v;
    }
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));

  if (!fins.length) return false;
  geometry.setIndex([...body, ...fins]);
  geometry.clearGroups();
  geometry.addGroup(0, body.length, 0);
  geometry.addGroup(body.length, fins.length, 1);
  return true;
}

// Materials for one scheme: [body, fins]
const shared = {};
export function liveryMaterials(livery) {
  shared.bump ??= paintBump();
  shared.carbon ??= carbonTexture();
  const body = new THREE.MeshPhysicalMaterial({
    map: bodyTexture(livery),
    roughness: 0.5 - livery.gloss * 0.25,
    metalness: 0,
    clearcoat: livery.gloss,
    clearcoatRoughness: 0.28,
    bumpMap: shared.bump,
    bumpScale: 0.25,
    envMapIntensity: 0.55,
  });
  const fin = livery.fin === "carbon"
    ? new THREE.MeshPhysicalMaterial({ map: shared.carbon, roughness: 0.38, clearcoat: 0.8, clearcoatRoughness: 0.15 })
    : new THREE.MeshPhysicalMaterial({ color: livery.fin, roughness: 0.45, clearcoat: 0.4 });
  return [body, fin];
}
