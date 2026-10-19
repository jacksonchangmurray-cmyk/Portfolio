/* ============================================================
   Wind tunnel solver: lattice Boltzmann method (D2Q9) with a
   Smagorinsky turbulence model, on a 2D slice through the rocket.
   Runs in a worker so the page stays smooth.

   Messages in:  init { nx, ny, solid, uIn, tau } · solid { solid }
                 speed { uIn } · pause { paused } · reset
   Messages out: frame { ux, uy, rho, steps, fx, fy, total }
   ============================================================ */

const EX = [0, 1, 0, -1, 0, 1, -1, -1, 1];
const EY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
const W = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
const SMAGORINSKY = 0.12;
const FRAME_BUDGET_MS = 22;

let nx = 0, ny = 0, n = 0;
let srcArr, dstArr, solidArr, uxArr, uyArr, rhoArr;
let uIn = 0.08, tau0 = 0.505, paused = false, total = 0;
let forceX = 0, forceY = 0;

function feq(i, r, u, v) {
  const eu = EX[i] * u + EY[i] * v;
  return W[i] * r * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * (u * u + v * v));
}

function fillFreestream(c) {
  for (let i = 0; i < 9; i++) srcArr[i * n + c] = dstArr[i * n + c] = feq(i, 1, uIn, 0);
}

function reset() {
  for (let c = 0; c < n; c++) {
    if (solidArr[c]) for (let i = 0; i < 9; i++) srcArr[i * n + c] = dstArr[i * n + c] = W[i];
    else fillFreestream(c);
  }
  total = 0;
}

function step() {
  // Local copies: the hot loop runs much faster without reaching for outer variables
  const N = n, NX = nx, NY = ny, src = srcArr, dst = dstArr, solid = solidArr, rho = rhoArr, ux = uxArr, uy = uyArr;
  const omega0 = 1 / tau0, tau2 = tau0 * tau0, smag = 18 * Math.SQRT2 * SMAGORINSKY * SMAGORINSKY;
  const sqrt = Math.sqrt;
  const N2 = 2 * N, N3 = 3 * N, N4 = 4 * N, N5 = 5 * N, N6 = 6 * N, N7 = 7 * N, N8 = 8 * N;
  let fxSum = 0, fySum = 0;

  for (let y = 1; y < NY - 1; y++) {
    let c = y * NX;
    for (let x = 1; x < NX - 1; x++) {
      c++;
      if (solid[c]) continue;

      // Stream: pull each population from the neighbour it came from.
      // If that neighbour is solid, the population bounced back off the model,
      // and the bounce pushes on the model (momentum exchange).
      let s, f1, f2, f3, f4, f5, f6, f7, f8;
      const f0 = src[c];
      s = c - 1;      if (solid[s]) { f1 = src[N3 + c]; fxSum -= 2 * f1; } else f1 = src[N + s];
      s = c - NX;     if (solid[s]) { f2 = src[N4 + c]; fySum -= 2 * f2; } else f2 = src[N2 + s];
      s = c + 1;      if (solid[s]) { f3 = src[N + c]; fxSum += 2 * f3; } else f3 = src[N3 + s];
      s = c + NX;     if (solid[s]) { f4 = src[N2 + c]; fySum += 2 * f4; } else f4 = src[N4 + s];
      s = c - 1 - NX; if (solid[s]) { f5 = src[N7 + c]; fxSum -= 2 * f5; fySum -= 2 * f5; } else f5 = src[N5 + s];
      s = c + 1 - NX; if (solid[s]) { f6 = src[N8 + c]; fxSum += 2 * f6; fySum -= 2 * f6; } else f6 = src[N6 + s];
      s = c + 1 + NX; if (solid[s]) { f7 = src[N5 + c]; fxSum += 2 * f7; fySum += 2 * f7; } else f7 = src[N7 + s];
      s = c - 1 + NX; if (solid[s]) { f8 = src[N6 + c]; fxSum -= 2 * f8; fySum += 2 * f8; } else f8 = src[N8 + s];

      const r = f0 + f1 + f2 + f3 + f4 + f5 + f6 + f7 + f8;
      const ir = 1 / r;
      let u = (f1 - f3 + f5 - f6 - f7 + f8) * ir;
      let v = (f2 - f4 + f5 + f6 - f7 - f8) * ir;
      const speed2 = u * u + v * v;
      if (speed2 > 0.09) { const k = 0.3 / sqrt(speed2); u *= k; v *= k; } // keep violent spots stable
      rho[c] = r; ux[c] = u; uy[c] = v;

      // Equilibrium
      const uu = 1.5 * (u * u + v * v);
      const r9 = r / 9, r36 = r / 36;
      const u3 = 3 * u, v3 = 3 * v, uu45 = 4.5 * u * u, vv45 = 4.5 * v * v;
      const a = u + v, b = v - u, a3 = 3 * a, b3 = 3 * b, aa45 = 4.5 * a * a, bb45 = 4.5 * b * b;
      const e0 = 4 * r9 * (1 - uu);
      const e1 = r9 * (1 + u3 + uu45 - uu);
      const e2 = r9 * (1 + v3 + vv45 - uu);
      const e3 = r9 * (1 - u3 + uu45 - uu);
      const e4 = r9 * (1 - v3 + vv45 - uu);
      const e5 = r36 * (1 + a3 + aa45 - uu);
      const e6 = r36 * (1 + b3 + bb45 - uu);
      const e7 = r36 * (1 - a3 + aa45 - uu);
      const e8 = r36 * (1 - b3 + bb45 - uu);

      // Smagorinsky: extra viscosity where the flow shears hard (keeps the turbulent wake stable)
      const d5 = f5 - e5, d6 = f6 - e6, d7 = f7 - e7, d8 = f8 - e8, diag = d5 + d6 + d7 + d8;
      const pxx = f1 - e1 + f3 - e3 + diag;
      const pyy = f2 - e2 + f4 - e4 + diag;
      const pxy = d5 - d6 + d7 - d8;
      const q = sqrt(pxx * pxx + pyy * pyy + 2 * pxy * pxy);
      const omega = q > 1e-12 ? 2 / (tau0 + sqrt(tau2 + smag * q * ir)) : omega0;

      // Collide
      dst[c] = f0 + omega * (e0 - f0);
      dst[N + c] = f1 + omega * (e1 - f1);
      dst[N2 + c] = f2 + omega * (e2 - f2);
      dst[N3 + c] = f3 + omega * (e3 - f3);
      dst[N4 + c] = f4 + omega * (e4 - f4);
      dst[N5 + c] = f5 + omega * (e5 - f5);
      dst[N6 + c] = f6 + omega * (e6 - f6);
      dst[N7 + c] = f7 + omega * (e7 - f7);
      dst[N8 + c] = f8 + omega * (e8 - f8);
    }
  }

  // Inlet, top and bottom: steady oncoming air. Outlet: let the flow leave freely.
  const free = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => feq(i, 1, uIn, 0));
  for (let y = 0; y < NY; y++) {
    const inlet = y * NX, outlet = inlet + NX - 1;
    for (let i = 0; i < 9; i++) {
      dst[i * N + inlet] = free[i];
      dst[i * N + outlet] = dst[i * N + outlet - 1];
    }
  }
  const topRow = (NY - 1) * NX;
  for (let x = 0; x < NX; x++) {
    for (let i = 0; i < 9; i++) dst[i * N + x] = dst[i * N + topRow + x] = free[i];
  }

  srcArr = dst;
  dstArr = src;
  forceX = fxSum;
  forceY = fySum;
  total++;
}

function healthy() {
  const probe = rhoArr[((ny / 2) | 0) * nx + nx - 3];
  return Number.isFinite(probe) && probe > 0.5 && probe < 1.5;
}

function run() {
  if (paused || !n) { setTimeout(run, 60); return; }
  const start = performance.now();
  let steps = 0, fx = 0, fy = 0;
  while (performance.now() - start < FRAME_BUDGET_MS) {
    step();
    steps++;
    fx += forceX;
    fy += forceY;
  }
  if (!healthy()) reset();
  const out = { type: "frame", ux: uxArr.slice(), uy: uyArr.slice(), rho: rhoArr.slice(), steps, fx: fx / steps, fy: fy / steps, total };
  self.postMessage(out, [out.ux.buffer, out.uy.buffer, out.rho.buffer]);
  setTimeout(run, 0);
}

self.onmessage = ({ data }) => {
  if (data.type === "init") {
    nx = data.nx; ny = data.ny; n = nx * ny;
    srcArr = new Float32Array(9 * n); dstArr = new Float32Array(9 * n);
    uxArr = new Float32Array(n); uyArr = new Float32Array(n); rhoArr = new Float32Array(n).fill(1);
    solidArr = data.solid; uIn = data.uIn; tau0 = data.tau;
    reset();
    run();
  } else if (data.type === "solid") {
    const old = solidArr;
    solidArr = data.solid;
    for (let c = 0; c < n; c++) {
      if (old[c] && !solidArr[c]) fillFreestream(c); // uncovered cells start as plain oncoming air
      if (solidArr[c]) { uxArr[c] = uyArr[c] = 0; rhoArr[c] = 1; }
    }
  } else if (data.type === "speed") {
    uIn = data.uIn;
  } else if (data.type === "pause") {
    paused = data.paused;
  } else if (data.type === "reset") {
    reset();
  }
};
