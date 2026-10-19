/* ============================================================
   Wind tunnel: test section, the live lattice Boltzmann solver
   (lbm-worker.js), a colour-mapped slice of the flow, smoke
   streaklines, surface pressure and force history.
   The rocket's centre sits at the origin; air flows along +x.
   ============================================================ */

import * as THREE from "three";

// Test section in metres
const X0 = -1.0, X1 = 2.0, Y0 = -0.55, Y1 = 0.55;
const FLOOR_Y = Y1 * -1 - 0.002;
const AIR_DENSITY = 1.225, AIR_VISCOSITY = 1.81e-5;

// Fin layout in the rocket's own frame (angle around the axis), from the STEP file
const FIN_ANGLES = [Math.PI, Math.PI / 3, -Math.PI / 3];
const FIN = { root: 0.145, tip: 0.065, span: 0.1, sweep: 0.08 };

/* ---------- Colour maps ---------- */

// Google "Turbo": the classic CFD rainbow, but perceptually smoother than jet
function turbo(t) {
  t = Math.min(1, Math.max(0, t));
  return [
    0.13572138 + t * (4.6153926 + t * (-42.66032258 + t * (132.13108234 + t * (-152.94239396 + t * 59.28637943)))),
    0.09140261 + t * (2.19418839 + t * (4.84296658 + t * (-14.18503333 + t * (4.27729857 + t * 2.82956604)))),
    0.1066733 + t * (12.64194608 + t * (-60.58204836 + t * (110.36276771 + t * (-89.90310912 + t * 27.34824973)))),
  ];
}
// Blue–dark–red for spin direction (dark in the middle so still air blends into the page)
function coolwarm(t) {
  t = Math.min(1, Math.max(0, t));
  const a = [0.35, 0.65, 1], m = [0.07, 0.07, 0.08], b = [1, 0.36, 0.2];
  const [from, to, k] = t < 0.5 ? [a, m, t * 2] : [m, b, (t - 0.5) * 2];
  return from.map((v, i) => v + (to[i] - v) * k);
}
const lut = (fn) => {
  const out = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) fn(i / 255).forEach((v, k) => { out[i * 3 + k] = Math.round(Math.min(1, Math.max(0, v)) * 255); });
  return out;
};
export const COLORMAPS = { turbo: lut(turbo), coolwarm: lut(coolwarm), turboFn: turbo, coolwarmFn: coolwarm };

export const FIELDS = {
  velocity: { label: "Air speed", unit: "m/s", map: "turbo", range: [0, 1.5] },      // × airspeed
  pressure: { label: "Pressure", unit: "Pa", map: "turbo", range: [-1.2, 1] },       // Cp × q
  vorticity: { label: "Vorticity", unit: "1/s", map: "coolwarm", range: [-4, 4] },  // × airspeed / diameter
};

/* ---------- Tunnel ---------- */

export function createTunnel({ scene, radiusAt, baseY, topY, small, onStats }) {
  const nx = small ? 300 : 420;
  const dx = (X1 - X0) / nx;
  const ny = Math.round((Y1 - Y0) / dx);
  const n = nx * ny;
  const diameterCells = 0.1 / dx;
  const tau = 0.505;

  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  const state = {
    active: false, paused: false, field: "velocity", speed: 40, pitch: 0, roll: 0,
    layers: { smoke: true, slice: true, surface: true },
    ux: new Float32Array(n), uy: new Float32Array(n), rho: new Float32Array(n).fill(1),
    solid: new Uint8Array(n), pendingSteps: 0, stepsPerSecond: 0, cd: 0, cl: 0, history: [],
  };
  const uIn = () => 0.05 + 0.07 * Math.min(1, Math.max(0, (state.speed - 10) / 110));

  /* Test section frame, floor grid, inlet arrows */
  const lineMaterial = (opacity) => new THREE.LineBasicMaterial({ color: 0xecebe6, transparent: true, opacity, depthWrite: false });
  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(X1 - X0, Y1 - Y0, 0.9)), lineMaterial(0.16));
  box.position.set((X0 + X1) / 2, 0, 0);
  group.add(box);

  const grid = [];
  for (let x = X0; x <= X1 + 1e-6; x += 0.1) grid.push(x, FLOOR_Y, -0.45, x, FLOOR_Y, 0.45);
  for (let z = -0.45; z <= 0.45 + 1e-6; z += 0.1) grid.push(X0, FLOOR_Y, z, X1, FLOOR_Y, z);
  const gridGeometry = new THREE.BufferGeometry();
  gridGeometry.setAttribute("position", new THREE.Float32BufferAttribute(grid, 3));
  group.add(new THREE.LineSegments(gridGeometry, lineMaterial(0.06)));

  const arrowMaterial = new THREE.MeshBasicMaterial({ color: 0xff5b1f, transparent: true, opacity: 0.8 });
  for (const y of [-0.36, -0.18, 0, 0.18, 0.36]) {
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 16), arrowMaterial);
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.set(X0 - 0.06, y, 0);
    group.add(arrow);
  }

  /* Sting: the rod that holds a model in a wind tunnel, from the base back to a strut */
  const metal = new THREE.MeshStandardMaterial({ color: 0x8d8c88, metalness: 0.85, roughness: 0.35 });
  const sting = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.42, 20), metal);
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 16), metal);
  const strutFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.012, 24), metal);
  sting.castShadow = strut.castShadow = true;
  group.add(strut, strutFoot);

  /* Slice of the flow through the rocket's centre */
  const pixels = new Uint8Array(n * 4);
  const fieldTexture = new THREE.DataTexture(pixels, nx, ny, THREE.RGBAFormat);
  fieldTexture.colorSpace = THREE.SRGBColorSpace;
  fieldTexture.magFilter = THREE.LinearFilter;
  fieldTexture.minFilter = THREE.LinearFilter;
  const slice = new THREE.Mesh(
    new THREE.PlaneGeometry(X1 - X0, Y1 - Y0),
    new THREE.MeshBasicMaterial({ map: fieldTexture, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
  );
  slice.position.set((X0 + X1) / 2, 0, 0);
  slice.renderOrder = 1;
  group.add(slice);

  // Soft edges so the slice fades out instead of ending in a hard rectangle
  const edgeFade = new Float32Array(n);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const fx = Math.min(1, i / (nx * 0.05), (nx - 1 - i) / (nx * 0.08));
    const fy = Math.min(1, j / (ny * 0.1), (ny - 1 - j) / (ny * 0.1));
    edgeFade[j * nx + i] = Math.max(0, fx) * Math.max(0, fy);
  }

  /* Smoke streaklines: a rake of nozzles upstream puffs a continuous thread each */
  const SEEDS = small ? 34 : 52, MAX_PER_SEED = small ? 220 : 300, EMIT_EVERY = 2.2; // cells of travel
  const seeds = Array.from({ length: SEEDS }, (_, k) => {
    const t = (k / (SEEDS - 1)) * 2 - 1;
    return { y: Math.sign(t) * Math.abs(t) ** 1.35 * 0.44, xs: [], ys: [], travel: 0 };
  });
  const maxSegments = SEEDS * MAX_PER_SEED;
  const smokePositions = new Float32Array(maxSegments * 6);
  const smokeColors = new Float32Array(maxSegments * 6);
  const smokeGeometry = new THREE.BufferGeometry();
  smokeGeometry.setAttribute("position", new THREE.BufferAttribute(smokePositions, 3).setUsage(THREE.DynamicDrawUsage));
  smokeGeometry.setAttribute("color", new THREE.BufferAttribute(smokeColors, 3).setUsage(THREE.DynamicDrawUsage));
  const smoke = new THREE.LineSegments(smokeGeometry, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  smoke.frustumCulled = false;
  smoke.renderOrder = 2;
  group.add(smoke);

  /* Solver */
  let worker = null;
  let maskTimer = 0;

  function cellOf(x, y) {
    const i = Math.floor((x - X0) / dx), j = Math.floor((y - Y0) / dx);
    return i < 0 || j < 0 || i >= nx || j >= ny ? -1 : j * nx + i;
  }

  // The rocket's outline in the slice, for the current pitch and roll
  function buildMask() {
    const solid = new Uint8Array(n);
    const pitch = (state.pitch * Math.PI) / 180, roll = (state.roll * Math.PI) / 180;
    const ax = -Math.cos(pitch), ay = Math.sin(pitch);   // along the axis, toward the nose
    const px = Math.sin(pitch), py = Math.cos(pitch);    // across, "up" side of the rocket
    // Fins seen from the side: a fin turned away from the slice looks shorter
    const fins = FIN_ANGLES.map((angle) => {
      const c = Math.cos(angle - roll);
      return { side: Math.sign(c), squash: Math.abs(c) };
    }).filter((fin) => fin.squash > 0.08);
    const r0 = radiusAt(baseY + 0.01);
    for (let j = 0; j < ny; j++) {
      const y = Y0 + (j + 0.5) * dx;
      for (let i = 0; i < nx; i++) {
        const x = X0 + (i + 0.5) * dx;
        const s = x * ax + y * ay, across = x * px + y * py;
        if (s < baseY - dx || s > topY + dx) continue;
        let hit = Math.abs(across) <= radiusAt(Math.min(topY, Math.max(baseY, s)));
        if (!hit && s >= baseY && s <= baseY + FIN.root) {
          for (const fin of fins) {
            const out = (across * fin.side - r0) / fin.squash; // true distance out along the fin
            if (out >= -dx && out <= FIN.span && s <= baseY + FIN.root - FIN.sweep * (out / FIN.span)) { hit = true; break; }
          }
        }
        if (hit) solid[j * nx + i] = 1;
      }
    }
    return solid;
  }

  // Only runs the solver once the tunnel has been opened
  function sendMask() {
    if (!worker && !state.active) return;
    state.solid = buildMask();
    if (worker) worker.postMessage({ type: "solid", solid: state.solid });
    else startWorker();
  }

  function startWorker() {
    worker = new Worker(new URL("./lbm-worker.js", import.meta.url));
    worker.onmessage = ({ data }) => {
      if (data.type !== "frame") return;
      state.ux = data.ux; state.uy = data.uy; state.rho = data.rho;
      state.pendingSteps += data.steps;
      // Force coefficients per unit span, referenced to the rocket's length (like an airfoil's chord)
      const q = 0.5 * uIn() ** 2 * ((topY - baseY) / dx);
      const blend = 0.06;
      state.cd += (data.fx / q - state.cd) * blend;
      state.cl += (data.fy / q - state.cl) * blend;
      state.history.push([state.cd, state.cl]);
      if (state.history.length > 300) state.history.shift();
      state.stepsTotal = data.total;
      if (state.layers.slice) paintSlice();
    };
    worker.postMessage({ type: "init", nx, ny, solid: state.solid, uIn: uIn(), tau });
    if (state.paused) worker.postMessage({ type: "pause", paused: true });
  }

  /* Field sampling */
  function sampleVelocity(x, y, out) {
    const fx = (x - X0) / dx - 0.5, fy = (y - Y0) / dx - 0.5;
    const i = Math.floor(fx), j = Math.floor(fy);
    if (i < 0 || j < 0 || i >= nx - 1 || j >= ny - 1) { out[0] = uIn(); out[1] = 0; return false; }
    const tx = fx - i, ty = fy - j, c = j * nx + i;
    const { ux, uy } = state;
    out[0] = (ux[c] * (1 - tx) + ux[c + 1] * tx) * (1 - ty) + (ux[c + nx] * (1 - tx) + ux[c + nx + 1] * tx) * ty;
    out[1] = (uy[c] * (1 - tx) + uy[c + 1] * tx) * (1 - ty) + (uy[c + nx] * (1 - tx) + uy[c + nx + 1] * tx) * ty;
    return !state.solid[c];
  }

  function fieldValue(c) {
    const { ux, uy, rho } = state, u0 = uIn();
    if (state.field === "velocity") return Math.hypot(ux[c], uy[c]) / u0;
    if (state.field === "pressure") return ((rho[c] - 1) / 3) / (0.5 * u0 * u0);
    const i = c % nx;
    if (i < 1 || i >= nx - 1 || c < nx || c >= n - nx) return 0;
    const curl = (uy[c + 1] - uy[c - 1]) * 0.5 - (ux[c + nx] - ux[c - nx]) * 0.5;
    return (curl * diameterCells) / u0;
  }

  function paintSlice() {
    const field = FIELDS[state.field];
    const map = COLORMAPS[field.map];
    const [lo, hi] = field.range;
    const scale = 255 / (hi - lo);
    const solid = state.solid;
    // With smoke on, the slice is muted so the white threads stand out against it
    const light = state.layers.smoke ? 0.5 : 1, alpha = state.layers.smoke ? 200 : 230;
    for (let c = 0; c < n; c++) {
      const o = c * 4;
      if (solid[c]) { pixels[o + 3] = 0; continue; }
      const k = Math.max(0, Math.min(255, ((fieldValue(c) - lo) * scale) | 0)) * 3;
      pixels[o] = map[k] * light; pixels[o + 1] = map[k + 1] * light; pixels[o + 2] = map[k + 2] * light;
      pixels[o + 3] = alpha * edgeFade[c];
    }
    fieldTexture.needsUpdate = true;
  }

  /* Smoke */
  const velocity = [0, 0], mid = [0, 0];
  function advanceSmoke(steps) {
    const u0 = uIn();
    let segment = 0;
    for (const seed of seeds) {
      // Each step moves air u cells; integrate with a midpoint step for curls
      if (steps > 0) {
        // New puffs leave the nozzle evenly spaced, even if several are due in one frame
        const before = seed.xs.length;
        seed.travel += u0 * steps;
        while (seed.travel >= EMIT_EVERY) {
          seed.travel -= EMIT_EVERY;
          seed.xs.push(X0 + 2 * dx + seed.travel * dx);
          seed.ys.push(seed.y);
        }
        const { xs, ys } = seed;
        for (let p = before - 1; p >= 0; p--) {
          let remaining = steps;
          while (remaining > 0) {
            const h = Math.min(remaining, 6);
            sampleVelocity(xs[p], ys[p], velocity);
            sampleVelocity(xs[p] + velocity[0] * h * dx * 0.5, ys[p] + velocity[1] * h * dx * 0.5, mid);
            xs[p] += mid[0] * h * dx;
            ys[p] += mid[1] * h * dx;
            remaining -= h;
          }
          const c = cellOf(xs[p], ys[p]);
          if (c < 0 || state.solid[c] || xs[p] > X1 - 2 * dx) { xs.splice(p, 1); ys.splice(p, 1); }
        }
        if (xs.length > MAX_PER_SEED) { xs.splice(0, xs.length - MAX_PER_SEED); ys.splice(0, ys.length - MAX_PER_SEED); }
      }
      // Join neighbouring puffs into a thread; skip gaps where the thread tore apart
      const { xs, ys } = seed;
      for (let p = 0; p < xs.length - 1 && segment < maxSegments; p++) {
        const gap = Math.hypot(xs[p + 1] - xs[p], ys[p + 1] - ys[p]);
        if (gap > 0.06) continue;
        const o = segment * 6;
        smokePositions[o] = xs[p]; smokePositions[o + 1] = ys[p]; smokePositions[o + 2] = 0.004;
        smokePositions[o + 3] = xs[p + 1]; smokePositions[o + 4] = ys[p + 1]; smokePositions[o + 5] = 0.004;
        // Fade near the inlet and the outlet
        // Slightly brighter than white so the threads catch the glow pass
        const fade = Math.min(1, (xs[p] - X0) / 0.15, (X1 - xs[p]) / 0.5) * 1.25;
        for (let k = 0; k < 6; k += 3) { smokeColors[o + k] = fade * 0.95; smokeColors[o + k + 1] = fade * 0.97; smokeColors[o + k + 2] = fade; }
        segment++;
      }
    }
    smokeGeometry.setDrawRange(0, segment * 2);
    smokePositions.fill(0, segment * 6);
    smokeGeometry.attributes.position.needsUpdate = true;
    smokeGeometry.attributes.color.needsUpdate = true;
  }

  // Start with straight threads already running the length of the tunnel, so there's smoke straight away
  function prefillSmoke() {
    for (const seed of seeds) {
      seed.xs.length = 0;
      seed.ys.length = 0;
      for (let x = X0 + 2 * dx; x < X1 - 2 * dx && seed.xs.length < MAX_PER_SEED; x += EMIT_EVERY * dx) {
        const c = cellOf(x, seed.y);
        if (c >= 0 && state.solid[c]) continue;
        seed.xs.push(x);
        seed.ys.push(seed.y);
      }
      seed.xs.reverse();
      seed.ys.reverse();
    }
  }

  /* Surface pressure: read the pressure just outside the outline in the slice */
  function pressureAt(s, across) {
    const pitch = (state.pitch * Math.PI) / 180;
    const ax = -Math.cos(pitch), ay = Math.sin(pitch), px = Math.sin(pitch), py = Math.cos(pitch);
    const dir = Math.sign(across) || 1;
    for (let k = 0; k < 8; k++) {
      const a = across + dir * k * dx;
      const c = cellOf(s * ax + a * px, s * ay + a * py);
      if (c >= 0 && !state.solid[c]) {
        const u0 = uIn();
        return ((state.rho[c] - 1) / 3) / (0.5 * u0 * u0);
      }
    }
    return 0;
  }

  function paintSurface(parts) {
    const roll = (state.roll * Math.PI) / 180;
    const map = COLORMAPS.turbo;
    const [lo, hi] = FIELDS.pressure.range;
    for (const part of parts) {
      const geometry = part.mesh.geometry;
      const pos = geometry.attributes.position, color = geometry.attributes.color;
      for (let v = 0; v < pos.count; v++) {
        const x = pos.getX(v), s = pos.getY(v), z = pos.getZ(v);
        const r = Math.hypot(x, z), angle = Math.atan2(z, x);
        const toward = Math.cos(angle - roll); // +1 = facing the slice's "up" side
        const R = Math.max(radiusAt(Math.min(topY, Math.max(baseY, s))), 0.004);
        const reach = r > R + 0.0005 ? R + (r - R) * Math.abs(toward) : R;
        const up = pressureAt(s, reach + dx), down = pressureAt(s, -(reach + dx));
        const cp = up * (1 + toward) * 0.5 + down * (1 - toward) * 0.5;
        const k = Math.max(0, Math.min(255, (((cp - lo) / (hi - lo)) * 255) | 0)) * 3;
        color.setXYZ(v, (map[k] / 255) ** 2.2, (map[k + 1] / 255) ** 2.2, (map[k + 2] / 255) ** 2.2);
      }
      color.needsUpdate = true;
    }
  }

  /* Per frame */
  const stingEnd = new THREE.Vector3();
  let statTimer = 0, surfaceTimer = 0, stepsWindow = 0;
  function update(dt, rocketGroup, parts) {
    if (!state.active && !group.visible) return;

    // Strut runs from the end of the sting straight down to the floor
    if (!sting.parent) rocketGroup.add(sting);
    sting.position.set(0, baseY - 0.21, 0);
    sting.visible = group.visible;
    stingEnd.set(0, baseY - 0.36, 0);
    rocketGroup.localToWorld(stingEnd);
    const height = stingEnd.y - FLOOR_Y;
    strut.position.set(stingEnd.x, FLOOR_Y + height / 2, stingEnd.z);
    strut.scale.y = Math.max(0.01, height);
    strutFoot.position.set(stingEnd.x, FLOOR_Y + 0.006, stingEnd.z);

    if (!state.active) return;
    const steps = state.paused ? 0 : state.pendingSteps;
    state.pendingSteps = 0;
    stepsWindow += steps;
    if (state.layers.smoke) advanceSmoke(steps);

    statTimer += dt;
    if (statTimer > 0.5) {
      state.stepsPerSecond = stepsWindow / statTimer;
      stepsWindow = 0;
      statTimer = 0;
      onStats?.(stats());
    }
    surfaceTimer += dt;
    if (state.layers.surface && surfaceTimer > 0.25) {
      surfaceTimer = 0;
      paintSurface(parts);
    }
  }

  function stats() {
    const nu = (tau - 0.5) / 3;
    return {
      cd: state.cd, cl: state.cl, history: state.history,
      q: 0.5 * AIR_DENSITY * state.speed ** 2,
      reFlight: (AIR_DENSITY * state.speed * (topY - baseY)) / AIR_VISCOSITY,
      reSim: (uIn() * (topY - baseY)) / dx / nu,
      stepsPerSecond: state.stepsPerSecond,
    };
  }

  return {
    group,
    floorY: FLOOR_Y,
    center: new THREE.Vector3((X0 + X1) / 2 - 0.1, 0, 0),
    get state() { return state; },
    setActive(on) {
      state.active = on;
      if (on && !worker) {
        sendMask();
        prefillSmoke();
      }
      worker?.postMessage({ type: "pause", paused: !on || state.paused });
    },
    setVisible(on) { group.visible = on; sting.visible = on; },
    setOpacity(alpha) {
      box.material.opacity = 0.16 * alpha;
      slice.material.opacity = alpha;
      smoke.material.opacity = alpha;
      arrowMaterial.opacity = 0.8 * alpha;
    },
    setAttitude(pitch, roll) {
      state.pitch = pitch;
      state.roll = roll;
      clearTimeout(maskTimer);
      maskTimer = setTimeout(sendMask, 60);
    },
    setSpeed(speed) {
      state.speed = speed;
      worker?.postMessage({ type: "speed", uIn: uIn() });
    },
    setField(name) {
      state.field = name;
      if (state.layers.slice) paintSlice();
    },
    setLayer(name, on) {
      state.layers[name] = on;
      if (name === "slice") slice.visible = on;
      if (name === "smoke") smoke.visible = on;
      if (state.layers.slice) paintSlice();
    },
    setPaused(on) {
      state.paused = on;
      worker?.postMessage({ type: "pause", paused: on || !state.active });
    },
    reset() {
      worker?.postMessage({ type: "reset" });
      seeds.forEach((seed) => { seed.xs.length = 0; seed.ys.length = 0; });
      state.history.length = 0;
    },
    paintSurface,
    update,
    stats,
    fieldRange(name = state.field) {
      const field = FIELDS[name];
      const [lo, hi] = field.range;
      const q = 0.5 * AIR_DENSITY * state.speed ** 2;
      if (name === "velocity") return [lo * state.speed, hi * state.speed];
      if (name === "pressure") return [lo * q, hi * q];
      return [(lo * state.speed) / 0.1, (hi * state.speed) / 0.1];
    },
  };
}
