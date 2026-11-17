// ---------------------------------------------------------------------------
// core: math, procedural geometry, texture atlas, WebGL helpers
// ---------------------------------------------------------------------------
const PI = Math.PI, TAU = PI * 2, DEG = PI / 180;
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { x = clamp((x - a) / (b - a)); return x * x * (3 - 2 * x); };
const easeIO = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = t => 1 - Math.pow(1 - t, 3);
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vmul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const vlen = a => Math.hypot(a[0], a[1], a[2]);
const vnorm = a => { const l = vlen(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const vlerp = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

// column-major 4x4 matrices
const m4 = {
  I() { const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  mul(a, b, o) { // o = a * b ; o must not alias a or b
    o = o || new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
      o[c * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
      o[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
      o[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      o[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
    return o;
  },
  T(x, y, z) { const m = m4.I(); m[12] = x; m[13] = y; m[14] = z; return m; },
  S(x, y = x, z = x) { const m = m4.I(); m[0] = x; m[5] = y; m[10] = z; return m; },
  RX(a) { const m = m4.I(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
  RY(a) { const m = m4.I(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  RZ(a) { const m = m4.I(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
  X(...ms) { let r = ms[0]; for (let i = 1; i < ms.length; i++) r = m4.mul(r, ms[i]); return r; },
  persp(fy, asp, n, f, o) {
    const m = o || new Float32Array(16), t = 1 / Math.tan(fy / 2);
    m.fill(0); m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = (2 * f * n) / (n - f);
    return m;
  },
  ortho(l, r, b, t, n, f) {
    const m = new Float32Array(16);
    m[0] = 2 / (r - l); m[5] = 2 / (t - b); m[10] = -2 / (f - n);
    m[12] = -(r + l) / (r - l); m[13] = -(t + b) / (t - b); m[14] = -(f + n) / (f - n); m[15] = 1;
    return m;
  },
  look(e, c, u, o) {
    const m = o || new Float32Array(16);
    const z = vnorm(vsub(e, c)), x = vnorm(vcross(u, z)), y = vcross(z, x);
    m[0] = x[0]; m[1] = y[0]; m[2] = z[0]; m[3] = 0;
    m[4] = x[1]; m[5] = y[1]; m[6] = z[1]; m[7] = 0;
    m[8] = x[2]; m[9] = y[2]; m[10] = z[2]; m[11] = 0;
    m[12] = -vdot(x, e); m[13] = -vdot(y, e); m[14] = -vdot(z, e); m[15] = 1;
    return m;
  },
  inv(m, o) {
    o = o || new Float32Array(16);
    const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
      a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10,
      b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30,
      b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let d = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    d = 1 / (d || 1e-20);
    o[0] = (a11 * b11 - a12 * b10 + a13 * b09) * d; o[1] = (a02 * b10 - a01 * b11 - a03 * b09) * d;
    o[2] = (a31 * b05 - a32 * b04 + a33 * b03) * d; o[3] = (a22 * b04 - a21 * b05 - a23 * b03) * d;
    o[4] = (a12 * b08 - a10 * b11 - a13 * b07) * d; o[5] = (a00 * b11 - a02 * b08 + a03 * b07) * d;
    o[6] = (a32 * b02 - a30 * b05 - a33 * b01) * d; o[7] = (a20 * b05 - a22 * b02 + a23 * b01) * d;
    o[8] = (a10 * b10 - a11 * b08 + a13 * b06) * d; o[9] = (a01 * b08 - a00 * b10 - a03 * b06) * d;
    o[10] = (a30 * b04 - a31 * b02 + a33 * b00) * d; o[11] = (a21 * b02 - a20 * b04 - a23 * b00) * d;
    o[12] = (a11 * b07 - a10 * b09 - a12 * b06) * d; o[13] = (a00 * b09 - a01 * b07 + a02 * b06) * d;
    o[14] = (a31 * b01 - a30 * b03 - a32 * b00) * d; o[15] = (a20 * b03 - a21 * b01 + a22 * b00) * d;
    return o;
  },
  pt(m, p) {
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  },
  proj(m, p) { // clip-space divide: returns [ndcX, ndcY, ndcZ, w]
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return [(m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w, (m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w,
      (m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]) / w, w];
  },
};

// ---------------------------------------------------------------------------
// materials + geometry accumulation
// ---------------------------------------------------------------------------
const hex = h => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const EMAX = 12; // emissive is stored /EMAX in a byte
// c: sRGB colour, r: roughness, m: metallic, e: emissive radiance, k: shader kind, a/b: kind-specific params
function Mat(c, r = 0.6, o) { return Object.assign({ c: typeof c === 'string' ? hex(c) : c, r, m: 0, e: 0, k: 0, a: 0, b: 0 }, o); }

class Geo {
  constructor() { this.P = []; this.N = []; this.C = []; this.M = []; this.X = []; this.U = []; this.I = []; this.nv = 0; this.bone = 0; this.obj = 0; }
  add(pr, M, mt, uv) {
    const P = pr.p, N = pr.n, U = pr.u, n = P.length / 3, base = this.nv;
    let flip = false, n00 = 1, n01 = 0, n02 = 0, n10 = 0, n11 = 1, n12 = 0, n20 = 0, n21 = 0, n22 = 1;
    if (M) { // inverse-transpose of the upper 3x3 for normals
      const a = M[0], b = M[4], c = M[8], d = M[1], e = M[5], f = M[9], g = M[2], h = M[6], i = M[10];
      const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g), s = det < 0 ? -1 : 1;
      flip = det < 0;
      n00 = (e * i - f * h) * s; n01 = (f * g - d * i) * s; n02 = (d * h - e * g) * s;
      n10 = (c * h - b * i) * s; n11 = (a * i - c * g) * s; n12 = (b * g - a * h) * s;
      n20 = (b * f - c * e) * s; n21 = (c * d - a * f) * s; n22 = (a * e - b * d) * s;
    }
    const cr = mt.c[0], cg = mt.c[1], cb = mt.c[2];
    for (let j = 0; j < n; j++) {
      let x = P[j * 3], y = P[j * 3 + 1], z = P[j * 3 + 2], nx = N[j * 3], ny = N[j * 3 + 1], nz = N[j * 3 + 2];
      if (M) {
        const tx = M[0] * x + M[4] * y + M[8] * z + M[12], ty = M[1] * x + M[5] * y + M[9] * z + M[13], tz = M[2] * x + M[6] * y + M[10] * z + M[14];
        x = tx; y = ty; z = tz;
        const mx = n00 * nx + n01 * ny + n02 * nz, my = n10 * nx + n11 * ny + n12 * nz, mz = n20 * nx + n21 * ny + n22 * nz, l = Math.hypot(mx, my, mz) || 1;
        nx = mx / l; ny = my / l; nz = mz / l;
      }
      this.P.push(x, y, z); this.N.push(nx, ny, nz);
      this.C.push(cr, cg, cb, mt.r); this.M.push(mt.m, mt.e / EMAX, mt.a, mt.b); this.X.push(this.bone, mt.k, this.obj);
      let u = U[j * 2], v = U[j * 2 + 1];
      if (uv) { u = uv[0] + u * (uv[2] - uv[0]); v = uv[1] + v * (uv[3] - uv[1]); }
      this.U.push(u, v);
    }
    const ix = pr.i;
    for (let j = 0; j < ix.length; j += 3) {
      if (flip) this.I.push(base + ix[j], base + ix[j + 2], base + ix[j + 1]);
      else this.I.push(base + ix[j], base + ix[j + 1], base + ix[j + 2]);
    }
    this.nv += n;
    return this;
  }
  // interleaved 36-byte vertex: pos f32x3 | nrm i8x4 | col u8x4 (rgb, rough) | mat u8x4 | idx u8x4 (bone, kind, obj) | uv f32x2
  pack() {
    const n = this.nv, buf = new ArrayBuffer(n * 36), f = new Float32Array(buf), u8 = new Uint8Array(buf), i8 = new Int8Array(buf);
    const { P, N, C, M, X, U } = this, q = v => clamp(Math.round(v * 255), 0, 255);
    for (let i = 0; i < n; i++) {
      const o = i * 36, w = i * 9;
      f[w] = P[i * 3]; f[w + 1] = P[i * 3 + 1]; f[w + 2] = P[i * 3 + 2];
      i8[o + 12] = Math.round(N[i * 3] * 127); i8[o + 13] = Math.round(N[i * 3 + 1] * 127); i8[o + 14] = Math.round(N[i * 3 + 2] * 127);
      u8[o + 16] = q(C[i * 4]); u8[o + 17] = q(C[i * 4 + 1]); u8[o + 18] = q(C[i * 4 + 2]); u8[o + 19] = q(C[i * 4 + 3]);
      u8[o + 20] = q(M[i * 4]); u8[o + 21] = q(M[i * 4 + 1]); u8[o + 22] = q(M[i * 4 + 2]); u8[o + 23] = q(M[i * 4 + 3]);
      u8[o + 24] = X[i * 3]; u8[o + 25] = X[i * 3 + 1]; u8[o + 26] = X[i * 3 + 2];
      f[w + 7] = U[i * 2]; f[w + 8] = U[i * 2 + 1];
    }
    return { buf, idx: new Uint32Array(this.I), n };
  }
}

// ---------------------------------------------------------------------------
// primitives: each returns {p, n, u, i} in local space
// ---------------------------------------------------------------------------
function boxPrim(sx, sy, sz, b = 0) {
  const h = [sx / 2, sy / 2, sz / 2], p = [], n = [], u = [], ix = [];
  b = Math.min(b, h[0] * 0.98, h[1] * 0.98, h[2] * 0.98);
  const V = (pos, nr) => { p.push(pos[0], pos[1], pos[2]); n.push(nr[0], nr[1], nr[2]); u.push(0, 0); return p.length / 3 - 1; };
  const P3 = i => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]];
  const tri = (a, c, d, out) => {
    const g = vcross(vsub(P3(c), P3(a)), vsub(P3(d), P3(a)));
    if (vdot(g, out) < 0) ix.push(a, d, c); else ix.push(a, c, d);
  };
  for (let a = 0; a < 3; a++) {
    const ua = (a + 1) % 3, va = (a + 2) % 3;
    for (const s of [-1, 1]) {
      const nr = [0, 0, 0]; nr[a] = s; const q = [];
      for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const pos = [0, 0, 0]; pos[a] = s * h[a]; pos[ua] = su * (h[ua] - b); pos[va] = sv * (h[va] - b); q.push(V(pos, nr));
      }
      tri(q[0], q[1], q[2], nr); tri(q[0], q[2], q[3], nr);
    }
  }
  if (b > 0) {
    for (let a = 0; a < 3; a++) { // rounded edges: strip between face a and face ua, running along va
      const ua = (a + 1) % 3, va = (a + 2) % 3;
      for (const sa of [-1, 1]) for (const su of [-1, 1]) {
        const na = [0, 0, 0]; na[a] = sa; const nu = [0, 0, 0]; nu[ua] = su; const q = [];
        for (const sv of [-1, 1]) {
          const pa = [0, 0, 0]; pa[a] = sa * h[a]; pa[ua] = su * (h[ua] - b); pa[va] = sv * (h[va] - b); q.push(V(pa, na));
          const pu = [0, 0, 0]; pu[a] = sa * (h[a] - b); pu[ua] = su * h[ua]; pu[va] = sv * (h[va] - b); q.push(V(pu, nu));
        }
        const out = vadd(na, nu); tri(q[0], q[1], q[3], out); tri(q[0], q[3], q[2], out);
      }
    }
    for (const cx of [-1, 1]) for (const cy of [-1, 1]) for (const cz of [-1, 1]) { // corners
      const a = V([cx * h[0], cy * (h[1] - b), cz * (h[2] - b)], [cx, 0, 0]);
      const c = V([cx * (h[0] - b), cy * h[1], cz * (h[2] - b)], [0, cy, 0]);
      const d = V([cx * (h[0] - b), cy * (h[1] - b), cz * h[2]], [0, 0, cz]);
      tri(a, c, d, [cx, cy, cz]);
    }
  }
  return { p, n, u, i: ix };
}

// surface of revolution about +y. prof: [[r, y, sharp?], ...] listed so the outside is on the right-hand side
// (bottom centre -> out -> up -> top centre gives a closed solid).
function lathePrim(prof, seg = 32, o = {}) {
  const a0 = o.a0 || 0, a1 = o.a1 === undefined ? TAU : o.a1, fl = o.flip ? -1 : 1, p = [], n = [], u = [], ix = [], m = prof.length;
  const sn = [], L = [0];
  for (let j = 0; j < m - 1; j++) {
    const dr = prof[j + 1][0] - prof[j][0], dy = prof[j + 1][1] - prof[j][1], l = Math.hypot(dr, dy) || 1e-9;
    sn.push([dy / l, -dr / l]); L.push(L[j] + l);
  }
  const tot = L[m - 1] || 1;
  const nrmAt = (j, s) => {
    const pt = prof[j];
    if (pt[2] || j === 0 || j === m - 1) {
      if (pt[0] < 1e-7 && !pt[2]) return [0, Math.sign(sn[s][1]) || 1];
      return sn[s];
    }
    const A = sn[j - 1], B = sn[j], x = A[0] + B[0], y = A[1] + B[1], l = Math.hypot(x, y) || 1;
    return [x / l, y / l];
  };
  for (let j = 0; j < m - 1; j++) {
    const A = prof[j], B = prof[j + 1];
    if (A[0] < 1e-7 && B[0] < 1e-7) continue;
    const nA = nrmAt(j, j), nB = nrmAt(j + 1, j), base = p.length / 3;
    for (let k = 0; k <= seg; k++) {
      const t = k / seg, an = a0 + (a1 - a0) * t, c = Math.cos(an), s = Math.sin(an);
      p.push(A[0] * c, A[1], A[0] * s); n.push(nA[0] * c * fl, nA[1] * fl, nA[0] * s * fl); u.push(t, L[j] / tot);
      p.push(B[0] * c, B[1], B[0] * s); n.push(nB[0] * c * fl, nB[1] * fl, nB[0] * s * fl); u.push(t, L[j + 1] / tot);
    }
    for (let k = 0; k < seg; k++) {
      const a = base + k * 2, d = a + 1, b = a + 2, c = a + 3;
      if (fl > 0) { if (B[0] > 1e-7) ix.push(a, d, c); if (A[0] > 1e-7) ix.push(a, c, b); }
      else { if (B[0] > 1e-7) ix.push(a, c, d); if (A[0] > 1e-7) ix.push(a, b, c); }
    }
  }
  return { p, n, u, i: ix };
}

// circle swept along a polyline (parallel-transport frames). rad may be a function of t in [0,1].
function tubePrim(pts, rad, seg = 8, caps = true) {
  const p = [], n = [], u = [], ix = [], m = pts.length, T = [];
  for (let i = 0; i < m; i++) T.push(vnorm(vsub(pts[Math.min(i + 1, m - 1)], pts[Math.max(i - 1, 0)])));
  let nr = Math.abs(T[0][1]) < 0.9 ? vnorm(vcross(T[0], [0, 1, 0])) : vnorm(vcross(T[0], [1, 0, 0]));
  for (let i = 0; i < m; i++) {
    nr = vnorm(vsub(nr, vmul(T[i], vdot(nr, T[i]))));
    const bn = vcross(T[i], nr), r = typeof rad === 'function' ? rad(i / (m - 1)) : rad;
    for (let k = 0; k <= seg; k++) {
      const an = (k / seg) * TAU, c = Math.cos(an), s = Math.sin(an), d = [nr[0] * c + bn[0] * s, nr[1] * c + bn[1] * s, nr[2] * c + bn[2] * s];
      p.push(pts[i][0] + d[0] * r, pts[i][1] + d[1] * r, pts[i][2] + d[2] * r); n.push(d[0], d[1], d[2]); u.push(k / seg, i / (m - 1));
    }
  }
  for (let i = 0; i < m - 1; i++) for (let k = 0; k < seg; k++) {
    const a = i * (seg + 1) + k, b = a + 1, c = a + seg + 1, d = c + 1;
    ix.push(a, b, d, a, d, c);
  }
  if (caps) for (const e of [0, m - 1]) {
    const sgn = e ? 1 : -1, nrm = vmul(T[e], sgn), ci = p.length / 3;
    p.push(pts[e][0], pts[e][1], pts[e][2]); n.push(nrm[0], nrm[1], nrm[2]); u.push(0.5, e ? 1 : 0);
    const r0 = p.length / 3;
    for (let k = 0; k <= seg; k++) { const s = (e * (seg + 1) + k) * 3; p.push(p[s], p[s + 1], p[s + 2]); n.push(nrm[0], nrm[1], nrm[2]); u.push(0.5, e ? 1 : 0); }
    for (let k = 0; k < seg; k++) { if (e) ix.push(ci, r0 + k, r0 + k + 1); else ix.push(ci, r0 + k + 1, r0 + k); }
  }
  return { p, n, u, i: ix };
}

// Catmull-Rom resample of a control polyline
function spline(c, n) {
  const out = [], m = c.length, g = i => c[clamp(i, 0, m - 1)];
  for (let i = 0; i <= n; i++) {
    const f = (i / n) * (m - 1), k = Math.min(Math.floor(f), m - 2), t = f - k, p0 = g(k - 1), p1 = g(k), p2 = g(k + 1), p3 = g(k + 2), q = [];
    for (let a = 0; a < 3; a++) {
      q.push(0.5 * (2 * p1[a] + (-p0[a] + p2[a]) * t + (2 * p0[a] - 5 * p1[a] + 4 * p2[a] - p3[a]) * t * t + (-p0[a] + 3 * p1[a] - 3 * p2[a] + p3[a]) * t * t * t));
    }
    out.push(q);
  }
  return out;
}

function spherePrim(r, seg = 16, rings = 10) {
  const pr = [];
  for (let i = 0; i <= rings; i++) { const a = (i / rings) * PI; pr.push([Math.max(r * Math.sin(a), 0), -r * Math.cos(a)]); }
  pr[0][0] = 0; pr[rings][0] = 0;
  return lathePrim(pr, seg);
}

// flat quad in the XY plane facing +z; uv (0,0) is the top-left corner so canvas-drawn text reads upright
function quadPrim(w, h) {
  const x = w / 2, y = h / 2;
  return { p: [-x, y, 0, x, y, 0, x, -y, 0, -x, -y, 0], n: [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], u: [0, 0, 1, 0, 1, 1, 0, 1], i: [0, 3, 2, 0, 2, 1] };
}

// label wrapped round a cylinder or cone, centred at angle ac (PI/2 faces +z); u runs left->right for an outside viewer
function arcPrim(rTop, rBot, yc, h, ac, aw, seg = 16) {
  const p = [], n = [], u = [], ix = [], sl = (rBot - rTop) / h, nl = Math.hypot(1, sl);
  for (let k = 0; k <= seg; k++) {
    const t = k / seg, an = ac + aw / 2 - aw * t, c = Math.cos(an), s = Math.sin(an);
    p.push(rTop * c, yc + h / 2, rTop * s, rBot * c, yc - h / 2, rBot * s);
    n.push(c / nl, sl / nl, s / nl, c / nl, sl / nl, s / nl); u.push(t, 0, t, 1);
  }
  for (let k = 0; k < seg; k++) { const a = k * 2, b = a + 1, c = a + 2, d = a + 3; ix.push(a, b, d, a, d, c); }
  return { p, n, u, i: ix };
}

// flat disc facing +y with uv covering the unit square (for circular textures)
function discPrim(r, seg = 40) {
  const p = [0, 0, 0], n = [0, 1, 0], u = [0.5, 0.5], ix = [];
  for (let k = 0; k <= seg; k++) { const a = (k / seg) * TAU, c = Math.cos(a), s = Math.sin(a); p.push(r * c, 0, r * s); n.push(0, 1, 0); u.push(0.5 + c * 0.5, 0.5 + s * 0.5); }
  for (let k = 0; k < seg; k++) ix.push(0, k + 2, k + 1);
  return { p, n, u, i: ix };
}

// ---------------------------------------------------------------------------
// texture atlas drawn with the 2D canvas API (labels, pages, plates, dials ...)
// ---------------------------------------------------------------------------
class Atlas {
  constructor(size) {
    this.S = size; this.cv = document.createElement('canvas'); this.cv.width = this.cv.height = size;
    this.g = this.cv.getContext('2d'); this.used = 0; this.top = 0;
    this.sky = [{ x: 0, y: 22, w: 22 }, { x: 22, y: 0, w: size - 22 }];   // texel (0..8, 0..8) stays solid white: the default uv
    this.g.fillStyle = '#fff'; this.g.fillRect(0, 0, 8, 8);
  }
  // skyline bottom-left packing: place each rectangle at the lowest position where it fits
  draw(w, h, fn) {
    w = Math.ceil(w); h = Math.ceil(h);
    const pad = 6, S = this.S, W = w + pad, Hh = h + pad, sk = this.sky;
    let bi = -1, bx = 0, by = 1e9;
    for (let i = 0; i < sk.length; i++) {
      const x = sk[i].x; if (x + W > S) break;
      let y = 0, rem = W, j = i;
      while (rem > 0 && j < sk.length) { y = Math.max(y, sk[j].y); rem -= sk[j].w; j++; }
      if (rem <= 0 && y + Hh <= S && y < by) { by = y; bx = x; bi = i; }
    }
    if (bi < 0) throw new Error('atlas full: ' + w + 'x' + h);
    const end = bx + W; let j = bi;
    while (j < sk.length && sk[j].x + sk[j].w <= end) j++;
    if (j < sk.length && sk[j].x < end) { sk[j].w = sk[j].x + sk[j].w - end; sk[j].x = end; }
    sk.splice(bi, j - bi, { x: bx, y: by + Hh, w: W });
    this.used += w * h; this.top = Math.max(this.top, by + Hh);
    const g = this.g;
    g.save(); g.translate(bx, by); g.beginPath(); g.rect(0, 0, w, h); g.clip(); fn(g, w, h); g.restore();
    return [bx / S, by / S, (bx + w) / S, (by + h) / S];
  }
}

// ---------------------------------------------------------------------------
// WebGL helpers
// ---------------------------------------------------------------------------
const glErr = [];
function mkProg(gl, vs, fs, name) {
  const p = gl.createProgram();
  for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) glErr.push(name + (t === gl.VERTEX_SHADER ? ' VS: ' : ' FS: ') + gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) glErr.push(name + ' link: ' + gl.getProgramInfoLog(p));
  const u = {}, nu = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) || 0;
  for (let i = 0; i < nu; i++) { const inf = gl.getActiveUniform(p, i); if (inf) { const nm = inf.name.endsWith('[0]') ? inf.name.slice(0, -3) : inf.name; u[nm] = gl.getUniformLocation(p, nm); } }
  const bi = gl.getUniformBlockIndex(p, 'Frame');
  if (bi !== gl.INVALID_INDEX && bi !== -1) gl.uniformBlockBinding(p, bi, 0);
  return { p, u };
}
function mkTex(gl, w, h, ifmt, fmt, type, filt, wrap, data) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, data || null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filt); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filt === gl.NEAREST ? gl.NEAREST : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap || gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap || gl.CLAMP_TO_EDGE);
  return t;
}
function mkFbo(gl, color, depth) {
  const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f);
  if (color) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, color, 0);
  else { gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE); }
  if (depth) gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0);
  return f;
}
function mkMesh(gl, geo, dynamic) {
  const pk = geo.pack(), vao = gl.createVertexArray(), vb = gl.createBuffer(), ib = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, pk.buf, dynamic ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, pk.idx, gl.STATIC_DRAW);
  const st = 36;
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0);
  gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.BYTE, true, st, 12);
  gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, st, 16);
  gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, st, 20);
  gl.enableVertexAttribArray(4); gl.vertexAttribIPointer(4, 4, gl.UNSIGNED_BYTE, st, 24);
  gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 2, gl.FLOAT, false, st, 28);
  gl.bindVertexArray(null);
  return { vao, vb, n: pk.idx.length, nv: pk.n };
}
