// ---------------------------------------------------------------------------
// scene: everything on, under and above the bench, modelled in code
// ---------------------------------------------------------------------------
const HAND = '"Marker Felt","Bradley Hand","Segoe Print","Comic Sans MS",cursive';
const NOTE = '"Noteworthy","Bradley Hand","Segoe Print","Comic Sans MS",cursive';
const SANS = '"Avenir Next","Helvetica Neue","Segoe UI",Roboto,Arial,sans-serif';
const BENCH_Y = 0.925;
const BONE = { PUB: 1, CONTACT: 2, ACK: 3, LID0: 5, LID1: 6, LID2: 7, STIR: 8, HOUR: 9, MIN: 10, SEC: 11, EDU: 12, HON: 13 };
const NOTEBOOK = { x: 0.95, z: 0.5, ry: -0.09, W: 0.205, D: 0.27, yL: 0.0105, yR: 0.0165 };

function buildScene(atlas) {
  const GO = new Geo(), GG = new Geo(), GL = new Geo(), GF = new Geo(), all = [GO, GG, GL];
  const R = rng(20261116), T = m4.T, X = m4.X, g2 = atlas.g;
  const objs = {}, pick = {}, anchor = {};
  let cur = null;
  const bone = b => all.forEach(g => { g.bone = b; });
  const begin = id => { cur = { id, o: GO.I.length, g: GG.I.length, l: GL.I.length }; };
  const end = () => { objs[cur.id] = { o: [cur.o, GO.I.length - cur.o], g: [cur.g, GG.I.length - cur.g], l: [cur.l, GL.I.length - cur.l] }; };
  const box = (G, x0, y0, z0, x1, y1, z1, mt, bev = 0, M) => { const t = T((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); G.add(boxPrim(x1 - x0, y1 - y0, z1 - z0, bev), M ? m4.mul(M, t) : t, mt); };
  const lat = (G, prof, M, mt, seg = 32, o) => G.add(lathePrim(prof, seg, o), M, mt);
  const hq = (G, x, y, z, w, d, ry, mt, uv, M) => { const t = X(T(x, y, z), m4.RY(ry), m4.RX(-PI / 2)); G.add(quadPrim(w, d), M ? m4.mul(M, t) : t, mt, uv); };
  const vq = (G, x, y, z, w, h, mt, uv, M) => { const t = T(x, y, z); G.add(quadPrim(w, h), M ? m4.mul(M, t) : t, mt, uv); };
  const tube = (G, pts, r, mt, seg = 8, M) => G.add(tubePrim(pts, r, seg), M, mt);

  // ---- materials -----------------------------------------------------------
  const mWall = Mat('#a9b2b5', 0.92, { k: K.WALL }), mFloor = Mat('#8e897f', 0.5, { k: K.FLOOR }), mBench = Mat('#2a2d30', 0.3, { k: K.BENCH });
  const mCab = Mat('#cbcfce', 0.5), mCabIn = Mat('#0e0f10', 0.85), mKick = Mat('#2b2d2f', 0.7), mTray = Mat('#dedbd2', 0.6);
  const mSteel = Mat('#c3c6c9', 0.32, { m: 1, k: K.BRUSH }), mChrome = Mat('#e2e5e7', 0.12, { m: 1 }), mDarkMetal = Mat('#3a3e43', 0.45, { m: 1 });
  const mShelf = Mat('#e8e5dc', 0.5), mBlk = Mat('#17181a', 0.45), mWht = Mat('#ecebe6', 0.42), mGray = Mat('#8d9296', 0.5), mRubber = Mat('#151515', 0.85);
  const mTex = Mat('#ffffff', 0.72, { k: K.TEX }), mPaper = Mat('#ffffff', 0.85, { k: K.PAPER });
  const gClear = Mat('#ffffff', 0.03), gPlastic = Mat('#eef1f1', 0.22, { a: 0.42 }), gFrost = Mat('#f1f3f2', 0.4, { a: 0.75 }), gInk = Mat('#ffffff', 0.5, { k: K.INK });
  const liq = (c, turb, dens) => Mat(c, 0.1, { a: turb, b: dens / 4 });
  const LB = liq('#e2a727', 0.16, 2.2), YPM = liq('#c9861c', 0.2, 2.8), EP = liq('#e9e3b4', 0.08, 1.2), CULT = liq('#d9c98a', 0.78, 2), WATER = liq('#dfeef2', 0.03, 0.5);

  // ---- atlas drawing helpers -----------------------------------------------
  const txt = (g, s, x, y, font, color, align = 'left') => { g.font = font; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x, y); };
  const fit = (g, s, px, fam, maxW) => { g.font = `${px}px ${fam}`; const w = g.measureText(s).width; return w > maxW ? px * maxW / w : px; };
  const grain = (g, w, h, n, a) => { g.globalAlpha = a; for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? '#000' : '#fff'; g.fillRect(0, R() * h, w, 1 + R() * 2); } g.globalAlpha = 1; };
  const tapeLbl = (title, sub, bg, w = 512, h = 200, ink = '#1a1a1f') => atlas.draw(w, h, g => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h); grain(g, w, h, 50, 0.05);
    const fs = fit(g, title, sub ? h * 0.47 : h * 0.6, HAND, w * 0.88);
    txt(g, title, w / 2, sub ? h * 0.5 : h * 0.68, `${fs}px ${HAND}`, ink, 'center');
    if (sub) txt(g, sub, w / 2, h * 0.86, `${fit(g, sub, h * 0.21, HAND, w * 0.9)}px ${HAND}`, ink, 'center');
  });
  const printLbl = (lines, bg, fg, w = 384, h = 256, band) => atlas.draw(w, h, g => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    if (band) { g.fillStyle = band; g.fillRect(0, 0, w, h * 0.2); }
    let y = h * 0.42;
    lines.forEach((l, i) => { const px = fit(g, l, i ? h * 0.13 : h * 0.2, SANS, w * 0.86); txt(g, l, w / 2, y, `${i ? 500 : 700} ${px}px ${SANS}`, fg, 'center'); y += h * (i ? 0.17 : 0.2); });
  });
  const autoclaveTape = atlas.draw(256, 48, (g, w, h) => {
    g.fillStyle = '#d9cfae'; g.fillRect(0, 0, w, h); g.strokeStyle = '#3a2c1c'; g.lineWidth = 7;
    for (let i = -2; i < 12; i++) { g.beginPath(); g.moveTo(i * 28, h + 4); g.lineTo(i * 28 + 30, -4); g.stroke(); }
  });
  const gradInk = atlas.draw(128, 320, (g, w, h) => {
    g.fillStyle = '#fff'; g.strokeStyle = '#fff';
    for (let i = 0; i <= 8; i++) { const y = h - 20 - i * 34; g.fillRect(8, y, i % 2 ? 26 : 46, 4); if (i % 2 === 0 && i) txt(g, String(i * 125), 60, y + 9, `600 22px ${SANS}`, '#fff'); }
    txt(g, 'ml', 62, 28, `600 20px ${SANS}`, '#fff');
  });
  const colony = (g, x, y, r, c, rim) => {
    const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); gr.addColorStop(0, '#fffdf2'); gr.addColorStop(0.45, c); gr.addColorStop(1, rim);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  };
  const plateTex = kind => atlas.draw(512, 512, (g, w) => {
    const c = w / 2, base = ['#d6bd6f', '#6a4c9c', '#e6dcbb', '#d8c076', '#d2b866'][kind], edge = ['#b99a48', '#4b3378', '#cdbf93', '#bb9f4e', '#b3963f'][kind];
    const gr = g.createRadialGradient(c, c, 20, c, c, c); gr.addColorStop(0, base); gr.addColorStop(0.8, base); gr.addColorStop(1, edge);
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
    const P = rng(77 + kind * 13);
    if (kind === 0) { // quadrant streak
      for (let q = 0; q < 4; q++) {
        const a0 = q * (PI / 2) + 0.5, dens = [1, 0.6, 0.3, 0.14][q];
        for (let l = 0; l < 7; l++) for (let s = 0; s < 46; s++) {
          if (P() > dens) continue;
          const t = s / 46, rr = 70 + l * 19 + Math.sin(t * 9) * 3, a = a0 + t * 1.15 * (l % 2 ? 1 : -1) + (l % 2 ? 0 : 1.15);
          colony(g, c + Math.cos(a) * rr, c + Math.sin(a) * rr, q < 2 ? 5 + P() * 3 : 6 + P() * 5, '#f1e7bd', '#b7a25e');
        }
      }
    } else if (kind === 1) { // acid-halo screen on indicator agar
      for (let i = 0; i < 26; i++) {
        const a = P() * TAU, rr = Math.sqrt(P()) * 190, x = c + Math.cos(a) * rr, y = c + Math.sin(a) * rr, hr = 22 + P() * 30;
        const h2 = g.createRadialGradient(x, y, 4, x, y, hr); h2.addColorStop(0, 'rgba(244,214,74,0.95)'); h2.addColorStop(0.6, 'rgba(236,196,70,0.55)'); h2.addColorStop(1, 'rgba(236,196,70,0)');
        g.fillStyle = h2; g.beginPath(); g.arc(x, y, hr, 0, TAU); g.fill(); colony(g, x, y, 6 + P() * 4, '#f4eccb', '#bfae74');
      }
    } else if (kind === 2) { // chromogenic agar: coloured colonies
      const cols = [['#d8478f', '#8f2459'], ['#2ea7a0', '#17625e'], ['#4a6bd0', '#28408f'], ['#e7dfc4', '#b5a878']];
      for (let i = 0; i < 70; i++) { const a = P() * TAU, rr = Math.sqrt(P()) * 200, k = cols[Math.floor(P() * 4)]; colony(g, c + Math.cos(a) * rr, c + Math.sin(a) * rr, 5 + P() * 7, k[0], k[1]); }
    } else if (kind === 3) { // spread plate
      for (let i = 0; i < 95; i++) { const a = P() * TAU, rr = Math.sqrt(P()) * 205; colony(g, c + Math.cos(a) * rr, c + Math.sin(a) * rr, 3.5 + P() * 4.5, '#f0e6bf', '#b6a05a'); }
    } else { // spot dilution assay
      for (let r = 0; r < 4; r++) for (let q = 0; q < 6; q++) {
        const x = c - 150 + q * 60, y = c - 100 + r * 66, n = Math.round(60 / Math.pow(2.6, q));
        if (q < 2) colony(g, x, y, 21 - q * 2, '#efe5bb', '#b9a45f'); else for (let i = 0; i < n; i++) { const a = P() * TAU, rr = Math.sqrt(P()) * 19; colony(g, x + Math.cos(a) * rr, y + Math.sin(a) * rr, 2.6 + P() * 1.6, '#f0e6bf', '#b6a05a'); }
      }
    }
  });
  const lidInk = (s, col = '#141c3a') => atlas.draw(384, 384, (g, w) => {
    g.font = `${w * 0.086}px ${HAND}`; g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    const rr = w * 0.383; let a = PI * 0.5 + (g.measureText(s).width / rr) / 2;
    for (const ch of s) { const cw = g.measureText(ch).width; a -= cw / rr / 2; g.save(); g.translate(w / 2 + Math.cos(a) * rr, w / 2 + Math.sin(a) * rr); g.rotate(a - PI / 2); g.fillText(ch, 0, 0); g.restore(); a -= cw / rr / 2; }
  });
  const pageTex = (type, w = 448, h = 590) => atlas.draw(w, h, g => {
    g.fillStyle = '#f4efdf'; g.fillRect(0, 0, w, h);
    const st = h / 34; g.strokeStyle = 'rgba(96,140,190,0.28)'; g.lineWidth = Math.max(1, w / 620);
    for (let y = st * 2; y < h - st; y += st) { g.beginPath(); g.moveTo(w * 0.05, y); g.lineTo(w * 0.95, y); g.stroke(); }
    for (let x = w * 0.05; x <= w * 0.951; x += st) { g.beginPath(); g.moveTo(x, st * 2); g.lineTo(x, h - st * 1.2); g.stroke(); }
    const ink = '#1c2a55', f = px => `${px * w / 620}px ${NOTE}`, L = (s, row, x = 0.08, px = 21, c = ink) => txt(g, s, w * x, st * (row + 0.82), f(px), c);
    txt(g, type.n, w * 0.93, st * 1.4, f(15), '#667', 'right');
    if (type.k === 'A') {
      L('11/16/26', 2, 0.08, 19, '#555'); L('Competition assay, day 3', 3.3, 0.08, 27);
      L('- thaw strains, streak to single colonies', 5.5); L('- O/N cultures: 5 mL, 30 C, 200 rpm', 7); L('- normalise to OD600 = 0.05', 8.5); L('- mix 1:1, sample at t = 0, 24, 48 h', 10);
      L('- spot 10-fold dilutions, 5 uL each', 11.5); L('Plates:', 14, 0.08, 23);
      for (let i = 0; i < 3; i++) { g.strokeStyle = ink; g.lineWidth = 2; g.beginPath(); g.arc(w * (0.2 + i * 0.26), st * 19.3, st * 2.6, 0, TAU); g.stroke(); for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(w * (0.2 + i * 0.26) + (R() - 0.5) * st * 3.4, st * 19.3 + (R() - 0.5) * st * 3.4, 2.5, 0, TAU); g.fill(); } L(['t0', '24 h', '48 h'][i], 22.6, 0.17 + i * 0.26, 18); }
      L('count tomorrow AM!', 25.5, 0.08, 23, '#a8242a'); L('label everything. date + initials.', 28, 0.08, 19, '#555');
    } else if (type.k === 'B') {
      L('Growth curves', 2.6, 0.08, 27); g.strokeStyle = ink; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(w * 0.14, st * 5); g.lineTo(w * 0.14, st * 15); g.lineTo(w * 0.9, st * 15); g.stroke();
      for (const [k, c] of [[1, '#1c2a55'], [0.72, '#a8242a']]) { g.strokeStyle = c; g.beginPath(); for (let i = 0; i <= 40; i++) { const t = i / 40, y = k / (1 + Math.exp(-(t - 0.45) * 11)); g.lineTo(w * (0.14 + t * 0.74), st * (15 - y * 9)); } g.stroke(); }
      L('OD600', 4.2, 0.03, 16); L('time (h)', 15.4, 0.74, 16); L('WT', 6, 0.82, 18); L('KO', 8.6, 0.82, 18, '#a8242a');
      L('lag ~2 h, doubling ~55 min (WT)', 17.5); L('KO slower in exponential phase', 19); L('repeat in triplicate', 20.5); L('to do:', 23, 0.08, 23);
      L('[x] pour plates', 24.6); L('[x] autoclave tips', 26.1); L('[ ] glycerol stocks', 27.6); L('[ ] order LB', 29.1);
    } else if (type.k === 'C') {
      L('PCR check', 2.6, 0.08, 27); L('25 uL rxns, 30 cycles', 4.6); L('anneal 58 C, ext 45 s', 6.1); L('gel: 1% agarose, 110 V, 35 min', 7.6);
      g.strokeStyle = ink; g.lineWidth = 2; g.strokeRect(w * 0.12, st * 10, w * 0.7, st * 9);
      for (let i = 0; i < 8; i++) { g.fillStyle = 'rgba(28,42,85,0.75)'; if (i === 0) for (let k = 0; k < 7; k++) g.fillRect(w * 0.16, st * (11 + k * 1.05), w * 0.05, 3); else g.fillRect(w * (0.16 + i * 0.08), st * (13 + (i % 3) * 1.4), w * 0.05, 5); }
      L('L  1  2  3  4  5  6  7', 19.4, 0.16, 17); L('bands at expected size in 1-5', 21.5); L('6, 7: re-run', 23, 0.08, 21, '#a8242a');
    } else if (type.k === 'D') {
      L('Media prep', 2.6, 0.08, 27); L('LB: 10 g tryptone, 5 g YE, 10 g NaCl / L', 4.6, 0.08, 19); L('agar plates: + 15 g/L agar', 6.1, 0.08, 19); L('autoclave 121 C, 20 min', 7.6, 0.08, 19);
      L('pour at ~55 C, 25 mL / plate', 9.1, 0.08, 19); L('date + initial every bottle', 11.5, 0.08, 21, '#a8242a');
      for (let r = 0; r < 5; r++) { g.strokeStyle = ink; g.lineWidth = 1.6; g.strokeRect(w * 0.1, st * (14 + r * 2), w * 0.8, st * 2); g.beginPath(); g.moveTo(w * 0.4, st * (14 + r * 2)); g.lineTo(w * 0.4, st * (16 + r * 2)); g.stroke(); }
      [['medium', 'made'], ['LB', '11/09'], ['YPM', '11/12'], ['EP', '10/30'], ['LB agar', '11/14']].forEach((r, i) => { L(r[0], 14.35 + i * 2, 0.13, 19); L(r[1], 14.35 + i * 2, 0.45, 19); });
    } else if (type.k === 'TL') {
      txt(g, 'Teaching Experience', w * 0.08, st * 3.6, f(40), ink);
      g.strokeStyle = '#a8242a'; g.lineWidth = 3 * w / 620; g.beginPath(); g.moveTo(w * 0.08, st * 4.25); g.bezierCurveTo(w * 0.3, st * 4.5, w * 0.55, st * 4.0, w * 0.8, st * 4.3); g.stroke();
    }
  });
  // large textures are allocated first so the packer can still fit them
  const pg = { A: pageTex({ k: 'A', n: '46' }), B: pageTex({ k: 'B', n: '47' }), C: pageTex({ k: 'C', n: '48' }), D: pageTex({ k: 'D', n: '49' }), E: pageTex({ k: 'B', n: '51' }), F: pageTex({ k: 'D', n: '50' }), TL: pageTex({ k: 'TL', n: '52' }, 1024, 1348), TR: pageTex({ k: 'TR', n: '53' }, 620, 816) };
  const cardTex = s => atlas.draw(600, 220, (g, w, h) => {
    g.fillStyle = '#f6f3ea'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b9b3a2'; g.lineWidth = 3; g.strokeRect(6, 6, w - 12, h - 12);
    txt(g, s, w / 2, h * 0.64, `700 ${fit(g, s, h * 0.42, SANS, w * 0.84)}px ${SANS}`, '#22252b', 'center');
  });
  const sticky = (lines, bg) => atlas.draw(256, 256, (g, w) => { g.fillStyle = bg; g.fillRect(0, 0, w, w); g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, 0, w, 34); lines.forEach((l, i) => txt(g, l, 20, 84 + i * 50, `${fit(g, l, 38, HAND, 216)}px ${HAND}`, '#20222a')); });
  const sheetTex = title => atlas.draw(440, 580, (g, w, h) => {
    g.fillStyle = '#f7f6f1'; g.fillRect(0, 0, w, h); txt(g, title, 34, 62, `700 ${fit(g, title, 30, SANS, w - 68)}px ${SANS}`, '#1e2126');
    g.fillStyle = '#9a9ea6'; for (let i = 0; i < 20; i++) { const y = 100 + i * 22; if (i % 6 === 5) continue; g.fillRect(34, y, (0.55 + R() * 0.4) * (w - 68), 6); }
  });
  const biohaz = (bg = '#f0832a', fg = '#141414') => atlas.draw(256, 256, (g, w) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, w); const c = w / 2; g.strokeStyle = fg; g.lineWidth = 17;
    for (let i = 0; i < 3; i++) { const a = -PI / 2 + i * TAU / 3; g.beginPath(); g.arc(c + Math.cos(a) * 44, c + Math.sin(a) * 44, 46, a - 2.25, a + 2.25); g.stroke(); }
    g.lineWidth = 12; g.beginPath(); g.arc(c, c, 26, 0, TAU); g.stroke(); g.fillStyle = bg; g.beginPath(); g.arc(c, c, 13, 0, TAU); g.fill();
  });

  // ---- room ------------------------------------------------------------------
  box(GO, -2.6, -0.16, -0.16, 2.6, 0, 2.5, mFloor);
  box(GO, -2.6, 0, -0.16, 2.6, 2.62, 0, mWall);
  box(GO, -2.6, 0, 0, 2.6, 0.1, 0.014, Mat('#3b3e42', 0.6), 0.004);

  // ---- casework --------------------------------------------------------------
  const mods = [[-1.45, -0.9, 0], [-0.9, -0.35, BONE.PUB], [0.35, 0.9, BONE.CONTACT], [0.9, 1.45, BONE.ACK]];
  const cards = { [BONE.PUB]: 'PUBLICATIONS', [BONE.CONTACT]: 'CONTACT', [BONE.ACK]: 'ACKNOWLEDGMENTS', 0: '' };
  const ids = { [BONE.PUB]: 'publications', [BONE.CONTACT]: 'contact', [BONE.ACK]: 'ack' };
  box(GO, -1.45, 0.1, 0.02, 1.45, 0.895, 0.06, mCab);                       // back panel (seen through the kneehole)
  for (const [x0, x1, bn] of mods) {
    const cx = (x0 + x1) / 2;
    box(GO, x0 + 0.02, 0, 0.06, x1 - 0.02, 0.1, 0.66, mKick);
    box(GO, x0, 0.1, 0.02, x1, 0.895, 0.715, mCab, 0.003);
    box(GO, x0 + 0.012, 0.112, 0.7155, x1 - 0.012, 0.884, 0.7165, mCabIn);
    box(GO, x0 + 0.004, 0.105, 0.718, x1 - 0.004, 0.698, 0.738, mCab, 0.004);       // door
    tube(GO, [[x1 - 0.06, 0.52, 0.739], [x1 - 0.06, 0.52, 0.765], [x1 - 0.06, 0.64, 0.765], [x1 - 0.06, 0.64, 0.739]], 0.0055, mSteel, 10);
    bone(bn);
    if (bn) begin(ids[bn]);
    box(GO, x0 + 0.004, 0.705, 0.718, x1 - 0.004, 0.862, 0.738, mCab, 0.004);       // drawer front
    tube(GO, [[cx - 0.075, 0.745, 0.739], [cx - 0.075, 0.745, 0.764], [cx + 0.075, 0.745, 0.764], [cx + 0.075, 0.745, 0.739]], 0.0055, mSteel, 10);
    box(GO, cx - 0.083, 0.786, 0.738, cx + 0.083, 0.848, 0.7412, mChrome, 0.001);
    if (bn) { vq(GO, cx, 0.817, 0.7417, 0.154, 0.05, mTex, cardTex(cards[bn])); end(); pick[ids[bn]] = [[x0, 0.7, 0.71], [x1, 0.87, 0.78]]; anchor[ids[bn]] = [cx, 0.86, 0.75]; }
    else vq(GO, cx, 0.817, 0.7417, 0.154, 0.05, Mat('#f1eee4', 0.8));
    if (bn) {                                                               // tray + contents
      const a = x0 + 0.03, b = x1 - 0.03, y0 = 0.72, y1 = 0.845;
      box(GO, a, y0, 0.31, b, y0 + 0.008, 0.718, mTray); box(GO, a, y0, 0.31, a + 0.012, y1, 0.718, mTray); box(GO, b - 0.012, y0, 0.31, b, y1, 0.718, mTray); box(GO, a, y0, 0.31, b, y1, 0.322, mTray);
      const fy = y0 + 0.0085;
      if (bn === BONE.PUB) {
        const pub = atlas.draw(520, 680, (g, w, h) => {
          g.fillStyle = '#fbfaf6'; g.fillRect(0, 0, w, h); g.fillStyle = '#27496d'; g.fillRect(0, 0, w, 44);
          txt(g, 'Cancer Treatment and Research Communications', 22, 30, `600 19px ${SANS}`, '#fff');
          const t = ['Comprehensive clinical characteristics', 'and outcomes of stage IV EGFR-mutant', 'NSCLC based on PD-L1 expression'];
          t.forEach((l, i) => txt(g, l, 30, 98 + i * 36, `700 26px ${SANS}`, '#1b1d22'));
          txt(g, 'Lee JW, Jin X, Bogdan S, Abou-Alfa A, Chang J, et al.', 30, 222, `500 16px ${SANS}`, '#444');
          g.fillStyle = '#a3a7ae'; for (let c = 0; c < 2; c++) for (let i = 0; i < 26; i++) g.fillRect(30 + c * 240, 262 + i * 15, (i % 9 === 8 ? 0.5 : 0.92 + R() * 0.08) * 220, 5);
        });
        for (let i = 0; i < 4; i++) box(GO, cx - 0.115 + i * 0.004, fy + i * 0.0012, 0.42 - i * 0.003, cx + 0.085 + i * 0.004, fy + (i + 1) * 0.0012, 0.69 - i * 0.003, mWht);
        hq(GO, cx - 0.003, fy + 0.0052, 0.5505, 0.2, 0.262, 0.012, mPaper, pub);
        box(GO, cx + 0.115, fy, 0.44, cx + 0.2, fy + 0.03, 0.56, Mat('#31506f', 0.6), 0.004);
        lat(GO, [[0, 0], [0.007, 0], [0.007, 0.12], [0, 0.12]], X(T(cx + 0.16, fy + 0.007, 0.68), m4.RZ(-PI / 2)), Mat('#f2d21c', 0.35), 12);
      } else if (bn === BONE.CONTACT) {
        const env = atlas.draw(440, 300, (g, w, h) => {
          g.fillStyle = '#efe7d3'; g.fillRect(0, 0, w, h); g.strokeStyle = '#cdbf9c'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(w / 2, h * 0.55); g.lineTo(w, 0); g.stroke();
          g.fillStyle = '#b8473d'; g.fillRect(w - 86, 22, 60, 72); txt(g, '@', w / 2, h * 0.84, `700 78px ${SANS}`, '#31405f', 'center');
        });
        box(GO, cx - 0.12, fy, 0.5, cx + 0.1, fy + 0.004, 0.65, Mat('#efe7d3', 0.8)); hq(GO, cx - 0.01, fy + 0.0045, 0.575, 0.218, 0.148, 0, mPaper, env);
        box(GO, cx - 0.1, fy, 0.36, cx - 0.01, fy + 0.012, 0.42, mWht, 0.002);
        hq(GO, cx - 0.055, fy + 0.0125, 0.39, 0.088, 0.055, 0, mTex, printLbl(['Ayman Abou-Alfa', 'Physics & Biophysics', 'Cornell University'], '#fbfaf5', '#20242c', 352, 220));
        box(GO, cx + 0.13, fy, 0.38, cx + 0.2, fy + 0.009, 0.52, mBlk, 0.004);
      } else {
        const cup = [[0, 0], [0.034, 0], [0.047, 0.1], [0.049, 0.104], [0.044, 0.104], [0, 0.104]];
        lat(GO, cup, T(cx + 0.11, fy, 0.5), Mat('#f4f1e8', 0.6), 28);
        GO.add(arcPrim(0.0455, 0.0375, 0.055, 0.06, PI / 2, 2.2, 14), T(cx + 0.11, fy, 0.5), mTex, atlas.draw(380, 170, (g, w, h) => { g.fillStyle = '#c93a2b'; g.fillRect(0, 0, w, h); txt(g, 'RAMEN', w / 2, h * 0.7, `800 90px ${SANS}`, '#fff3d6', 'center'); }));
        const card = atlas.draw(420, 300, (g, w, h) => { g.fillStyle = '#fbf6e9'; g.fillRect(0, 0, w, h); txt(g, 'thank you!', w / 2, h * 0.52, `92px ${HAND}`, '#a8242a', 'center'); txt(g, 'jesse-zhou.com', w / 2, h * 0.78, `40px ${HAND}`, '#31405f', 'center'); });
        box(GO, cx - 0.15, fy, 0.44, cx - 0.01, fy + 0.002, 0.54, mWht); hq(GO, cx - 0.08, fy + 0.0025, 0.49, 0.138, 0.098, 0.05, mPaper, card);
        for (const dz of [0, 0.012]) lat(GO, [[0, 0], [0.003, 0], [0.0022, 0.22], [0, 0.22]], X(T(cx - 0.16, fy + 0.004, 0.62 + dz), m4.RZ(-PI / 2), m4.RX(0.04)), Mat('#b98a4e', 0.6), 8);
      }
    }
    bone(0);
  }
  box(GO, -1.48, 0.895, 0.0, 1.48, BENCH_Y, 0.78, mBench, 0.006);
  // stool in the kneehole
  { const M = T(0.02, 0, 0.84); lat(GO, [[0, 0.56], [0.165, 0.56], [0.175, 0.575], [0.175, 0.6], [0.16, 0.615], [0, 0.615]], M, Mat('#1c1d20', 0.55), 36);
    lat(GO, [[0, 0.06], [0.022, 0.06], [0.022, 0.56], [0, 0.56]], M, mChrome, 16); lat(GO, [[0.03, 0.04], [0.045, 0.04], [0.045, 0.09], [0.03, 0.09]], M, mBlk, 16);
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + 0.3, c = Math.cos(a), s = Math.sin(a); tube(GO, [[0.02 * c, 0.065, 0.02 * s], [0.26 * c, 0.05, 0.26 * s]], 0.014, mChrome, 8, M); GO.add(spherePrim(0.024, 12, 8), X(M, T(0.26 * c, 0.024, 0.26 * s)), mBlk); }
    const ring = []; for (let i = 0; i <= 28; i++) { const a = i / 28 * TAU; ring.push([0.2 * Math.cos(a), 0.25, 0.2 * Math.sin(a)]); } tube(GO, ring, 0.009, mChrome, 8, M);
    for (let i = 0; i < 3; i++) { const a = i * TAU / 3; tube(GO, [[0.022 * Math.cos(a), 0.25, 0.022 * Math.sin(a)], [0.2 * Math.cos(a), 0.25, 0.2 * Math.sin(a)]], 0.005, mChrome, 6, M); } }

  // ---- wall services ----------------------------------------------------------
  box(GO, -1.46, 1.03, 0, 1.46, 1.13, 0.032, Mat('#d7d9d7', 0.5), 0.004);
  const outlet = atlas.draw(128, 200, (g, w, h) => { g.fillStyle = '#eeece4'; g.fillRect(0, 0, w, h); g.fillStyle = '#d9d6cb'; for (const y of [30, 110]) { g.beginPath(); g.roundRect(22, y, 84, 62, 14); g.fill(); g.fillStyle = '#26282b'; g.fillRect(44, y + 14, 6, 20); g.fillRect(78, y + 14, 6, 20); g.beginPath(); g.arc(64, y + 46, 5, 0, TAU); g.fill(); g.fillStyle = '#d9d6cb'; } });
  for (const x of [-0.75, -0.15, 0.45, 1.05]) vq(GO, x, 1.08, 0.0328, 0.052, 0.082, mTex, outlet);
  { const M = T(-1.2, 1.08, 0.032); lat(GO, [[0, 0], [0.016, 0], [0.016, 0.03], [0.011, 0.04], [0, 0.04]], X(M, m4.RX(PI / 2)), mChrome, 16);
    box(GO, -0.006, -0.004, 0.036, 0.006, 0.05, 0.05, Mat('#e6c62a', 0.4), 0.002, M); lat(GO, [[0, 0], [0.005, 0], [0.004, 0.03], [0, 0.03]], X(M, T(0, -0.012, 0.022), m4.RX(PI)), mChrome, 10); }
  vq(GO, -0.46, 1.25, 0.002, 0.2, 0.264, mPaper, sheetTex('PROTOCOL: Spot dilution assay'));
  [['streak', 'plates Fri', '#f7e06a', -0.2, 1.23, 0.06], ['order', 'P200 tips!', '#f59bb7', -0.085, 1.26, -0.05], ['lab mtg', '10 am Tue', '#9be08f', 0.2, 1.24, 0.04]].forEach(n => {
    const M = X(T(n[3], n[4], 0.0025), m4.RZ(n[5])); GO.add(quadPrim(0.076, 0.076), M, mPaper, sticky([n[0], n[1]], n[2]));
  });

  // ---- shelves, lights, pipette rack ---------------------------------------------
  for (const x of [-1.3, 0, 1.3]) { box(GO, x - 0.014, 0.96, 0, x + 0.014, 2.16, 0.022, mDarkMetal); for (const y of [1.372, 1.772]) box(GO, x - 0.012, y - 0.05, 0.022, x + 0.012, y, 0.29, mDarkMetal, 0.002); }
  for (const y of [SH0_Y, SH1_Y]) {
    box(GO, -1.44, y - 0.028, 0, 1.44, y, 0.31, mShelf, 0.004);
    box(GO, -1.38, y - 0.044, 0.222, 1.38, y - 0.028, 0.268, Mat('#b9bcc0', 0.35, { m: 1 }), 0.002);
    hq(GO, 0, y - 0.0445, 0.245, 2.74, 0.03, 0, Mat('#fff1d6', 0.5, { k: K.STRIP, e: 7.5 }), null, X(T(0, 2 * (y - 0.0445), 0), m4.S(1, -1, 1)));
  }
  const strips = [[[-1.37, SH0_Y - 0.047, 0.245], [1.37, SH0_Y - 0.047, 0.245]], [[-1.37, SH1_Y - 0.047, 0.245], [1.37, SH1_Y - 0.047, 0.245]]];
  hq(GO, -1.02, SH0_Y - 0.014, 0.3105, 0.21, 0.024, 0, mTex, tapeLbl('AYMAN A.  BENCH 4', null, '#8fd0f2', 512, 60), X(T(0, SH0_Y - 0.014, 0.3105), m4.RX(PI / 2), T(0, -(SH0_Y - 0.014), -0.3105)));
  box(GO, 0.42, SH0_Y - 0.05, 0.31, 1.0, SH0_Y - 0.004, 0.336, Mat('#2e3238', 0.35), 0.003);
  const pipette = (x, s, col) => {
    const M = X(T(x, SH0_Y - 0.004 - 0.236 * s, 0.353), m4.S(s)), body = Mat('#dfe1e2', 0.4), c = Mat(col, 0.4);
    lat(GO, [[0, 0], [0.0016, 0], [0.003, 0.03], [0.0045, 0.032], [0.006, 0.13], [0.0105, 0.134], [0.0135, 0.17], [0.014, 0.245], [0.012, 0.262], [0, 0.262]], M, body, 18);
    lat(GO, [[0.0142, 0.2], [0.0146, 0.2], [0.0146, 0.214], [0.0142, 0.214]], M, c, 18);
    lat(GO, [[0, 0.262], [0.004, 0.262], [0.004, 0.284], [0.0088, 0.285], [0.0088, 0.296], [0.007, 0.298], [0, 0.298]], M, c, 16);
    box(GO, -0.006, 0.236, -0.036, 0.006, 0.247, -0.008, body, 0.002, M); box(GO, -0.005, 0.222, -0.036, 0.005, 0.24, -0.029, body, 0.002, M);
    box(GO, 0.008, 0.25, -0.006, 0.019, 0.27, 0.006, body, 0.003, M); box(GO, -0.005, 0.176, 0.0125, 0.005, 0.196, 0.0145, mBlk, 0, M);
  };
  [[0.48, 1.06, '#2f6fd0'], [0.6, 0.98, '#e8c12b'], [0.72, 0.94, '#e8c12b'], [0.84, 0.9, '#d94a3a'], [0.94, 0.88, '#8a8f96']].forEach(p => pipette(p[0], p[1], p[2]));

  // ---- glassware builders ----------------------------------------------------------
  const bottle = (x, y, z, Rr, H, lq, fill, lab, o = {}) => {
    const M = X(T(x, y, z), m4.RY(o.ry || 0)), t = 0.0035, rn = Math.max(Rr * 0.46, 0.019), hs = H * 0.64, hn = H * 0.82, seg = o.seg || 36, out = [[0, 0], [Rr - 0.006, 0], [Rr, 0.006]], inn = [];
    for (let i = 0; i <= 6; i++) { const a = i / 6 * PI / 2; out.push([rn + (Rr - rn) * Math.cos(a), hs + (hn - hs) * Math.sin(a)]); }
    out.push([rn, H - 0.003], [rn + 0.002, H]); inn.push([rn - t + 0.002, H], [rn - t, H - 0.004]);
    for (let i = 6; i >= 0; i--) { const a = i / 6 * PI / 2; inn.push([rn - t + (Rr - rn) * Math.cos(a), hs + (hn - hs) * Math.sin(a) - t * 0.4]); }
    inn.push([Rr - t, 0.009], [Rr - t - 0.006, t], [0, t]);
    lat(GG, out.concat(inn), M, gClear, seg);
    if (lq) { const ri = Rr - t - 0.0005, hf = Math.min(H * fill, hs - 0.004); lat(GL, [[0, t + 0.0004], [ri - 0.006, t + 0.0004], [ri, 0.0095], [ri, hf + 0.0016], [ri - 0.004, hf], [0, hf]], M, lq, seg); }
    const rc = rn + 0.0075, cap = Mat(o.cap || '#1f5fc4', 0.42);
    lat(GO, [[rn + 0.001, H - 0.027], [rc, H - 0.027], [rc, H + 0.002], [rc - 0.003, H + 0.005], [0, H + 0.005]], M, cap, 28);
    lat(GO, [[rn + 0.0005, H - 0.036], [rn + 0.0055, H - 0.036], [rn + 0.0055, H - 0.03], [rn + 0.0005, H - 0.03]], M, Mat(o.cap || '#3f7fe0', 0.4), 28);
    if (lab) { const lh = o.lh || 0.05, aw = (o.lw || 0.085) / Rr; GO.add(arcPrim(Rr + 0.0007, Rr + 0.0007, hs * 0.52, lh, PI / 2 + (o.la || 0), aw, 18), M, mTex, lab); }
    if (o.tape) GO.add(arcPrim(Rr + 0.0007, Rr + 0.0007, hs * 0.9, 0.012, PI / 2 + (o.la || 0) + 0.25, 0.06 / Rr, 10), M, mTex, autoclaveTape);
    if (Rr > 0.04) GG.add(arcPrim(Rr + 0.0004, Rr + 0.0004, hs * 0.5, hs * 0.8, PI / 2 - 1.25 + (o.la || 0), 0.03 / Rr, 6), M, gInk, gradInk);
  };
  const flask = (x, y, z, Rb, H, rn, lq, fill, o = {}) => {
    const M = X(T(x, y, z), m4.RY(o.ry || 0)), t = 0.003, hc = H * 0.76, seg = o.seg || 36, rAt = h => Rb + (rn - Rb) * clamp((h - 0.012) / (hc - 0.012));
    lat(GG, [[0, 0], [Rb - 0.01, 0], [Rb, 0.008], [Rb, 0.014], [rn, hc], [rn, H - 0.006], [rn + 0.004, H], [rn + 0.004 - t, H], [rn - t, H - 0.006], [rn - t, hc], [Rb - t, 0.015], [Rb - t - 0.008, t], [0, t]], M, gClear, seg);
    if (lq) {
      const hf = H * fill, ri = rAt(hf) - t - 0.0006, pr = [[0, t + 0.0004], [Rb - t - 0.009, t + 0.0004], [Rb - t - 0.0006, 0.015], [ri, hf + 0.0012]];
      if (o.vortex) pr.push([ri - 0.004, hf - 0.001], [ri * 0.55, hf - 0.006], [ri * 0.22, hf - 0.022], [0.002, hf - 0.04], [0, hf - 0.04]); else pr.push([ri - 0.004, hf], [0, hf]);
      lat(GL, pr, M, lq, seg);
    }
    if (o.foil) lat(GO, [[rn + 0.016, H - 0.05], [rn + 0.009, H - 0.02], [rn + 0.007, H + 0.003], [rn * 0.5, H + 0.008], [0, H + 0.006]], M, Mat('#c9ccd0', 0.3, { m: 1, k: K.FOIL }), 22);
    if (o.lab) { const yc = hc * 0.42, hh = o.lh || 0.05; GO.add(arcPrim(rAt(yc + hh / 2) + 0.0008, rAt(yc - hh / 2) + 0.0008, yc, hh, PI / 2 + (o.la || 0), (o.lw || 0.1) / rAt(yc), 18), M, mTex, o.lab); }
    GG.add(arcPrim(rAt(hc * 0.62) + 0.0005, rAt(hc * 0.2) + 0.0005, hc * 0.41, hc * 0.42, PI / 2 - 1.2 + (o.la || 0), 0.5, 6), M, gInk, gradInk);
  };
  const beaker = (x, y, z, Rr, H, lq, fill) => {
    const M = T(x, y, z), t = 0.0028;
    lat(GG, [[0, 0], [Rr - 0.004, 0], [Rr, 0.004], [Rr, H - 0.004], [Rr + 0.003, H], [Rr + 0.003 - t, H], [Rr - t, H - 0.004], [Rr - t, 0.006], [Rr - t - 0.004, t], [0, t]], M, gClear, 32);
    if (lq) lat(GL, [[0, t + 0.0004], [Rr - t - 0.005, t + 0.0004], [Rr - t - 0.0006, 0.007], [Rr - t - 0.0006, H * fill + 0.001], [Rr - t - 0.004, H * fill], [0, H * fill]], M, lq, 32);
    GG.add(arcPrim(Rr + 0.0004, Rr + 0.0004, H * 0.5, H * 0.7, PI / 2 + 0.5, 0.03 / Rr, 6), M, gInk, gradInk);
  };
  const ctube = (x, y, z, lq, hf, capc, M0) => {
    const Rr = 0.008, H = 0.125, t = 0.001, M = M0 ? m4.mul(M0, T(x, y, z)) : T(x, y, z), o = [], n = [], l = [];
    for (let i = 0; i <= 5; i++) { const a = i / 5 * PI / 2; o.push([Rr * Math.sin(a), Rr - Rr * Math.cos(a)]); l.push([(Rr - t - 0.0003) * Math.sin(a), Rr - (Rr - t - 0.0003) * Math.cos(a)]); }
    for (let i = 5; i >= 0; i--) { const a = i / 5 * PI / 2; n.push([(Rr - t) * Math.sin(a), Rr - (Rr - t) * Math.cos(a)]); }
    lat(GG, o.concat([[Rr, H]], [[Rr - t, H]], n), M, gClear, 14);
    if (lq) lat(GL, l.concat([[Rr - t - 0.0003, hf], [0, hf]]), M, lq, 14);
    lat(GO, [[Rr + 0.0005, H - 0.024], [Rr + 0.0028, H - 0.024], [Rr + 0.0028, H + 0.006], [Rr + 0.001, H + 0.008], [0, H + 0.008]], M, Mat(capc, 0.45), 14);
  };
  const falcon = (x, y, z, lq, hf) => {
    const M = T(x, y, z), Rr = 0.0145;
    lat(GG, [[0, 0], [0.003, 0], [Rr, 0.024], [Rr, 0.112], [Rr - 0.0012, 0.112], [Rr - 0.0012, 0.025], [0.002, 0.0015], [0, 0.0015]], M, gPlastic, 16);
    if (lq) lat(GL, [[0, 0.002], [0.002, 0.002], [Rr - 0.0016, 0.0255], [Rr - 0.0016, hf], [0, hf]], M, lq, 16);
    lat(GO, [[Rr + 0.0004, 0.1], [Rr + 0.0032, 0.1], [Rr + 0.0032, 0.115], [Rr + 0.0015, 0.117], [0, 0.117]], M, Mat('#1d5dc0', 0.5), 18);
  };
  const petri = (x, y, z, tex, ink, lidBone, inverted, ry = 0) => {
    const Rr = 0.0445, M0 = X(T(x, y, z), m4.RY(ry)), M = inverted ? X(M0, T(0, 0.0168, 0), m4.S(1, -1, 1)) : M0;
    lat(GG, [[0, 0], [Rr, 0], [Rr, 0.0135], [Rr - 0.0012, 0.0135], [Rr - 0.0012, 0.0012], [0, 0.0012]], M, gClear, 40);
    lat(GO, [[Rr - 0.0016, 0.0012], [Rr - 0.0016, 0.0056]], M, Mat('#c9b468', 0.3), 40);
    GO.add(discPrim(Rr - 0.0016, 40), X(M, T(0, 0.0056, 0)), Mat('#ffffff', 0.2, { k: K.AGAR }), tex);
    if (inverted) GO.add(discPrim(Rr - 0.0016, 40), X(M, T(0, 0.0012, 0), m4.S(1, -1, 1)), Mat('#e8dcae', 0.25, { k: K.AGAR }), tex);
    bone(lidBone || 0);
    lat(GG, [[Rr + 0.0024, 0.0072], [Rr + 0.0024, 0.0168, 1], [0, 0.0168]], M, gClear, 40);
    lat(GG, [[0, 0.0156], [Rr + 0.0012, 0.0156, 1], [Rr + 0.0012, 0.0072, 1], [Rr + 0.0024, 0.0072]], M, gClear, 40);
    if (ink) GG.add(discPrim(Rr, 24), X(M, T(0, inverted ? -0.0003 : 0.0171, 0), inverted ? m4.S(1, -1, 1) : m4.I()), gInk, ink);
    bone(0);
  };

  // ---- lower shelf --------------------------------------------------------------------
  const s0 = SH0_Y, s1 = SH1_Y, zs = 0.15;
  { const b = atlas.draw(300, 300, (g, w) => { g.fillStyle = '#f2f4f0'; g.fillRect(0, 0, w, w); g.fillStyle = '#2f9a61'; g.fillRect(0, 0, w, 96); txt(g, 'LAB WIPES', w / 2, 66, `800 44px ${SANS}`, '#fff', 'center'); txt(g, 'low-lint  ·  280 ct', w / 2, 170, `500 26px ${SANS}`, '#2a2d31', 'center'); });
    box(GO, -1.36, s0, zs - 0.058, -1.245, s0 + 0.118, zs + 0.058, Mat('#f2f4f0', 0.75), 0.003); vq(GO, -1.3025, s0 + 0.059, zs + 0.0585, 0.113, 0.116, mTex, b);
    box(GO, -1.335, s0 + 0.118, zs - 0.012, -1.27, s0 + 0.1186, zs + 0.012, mCabIn); box(GO, -1.32, s0 + 0.118, zs - 0.004, -1.285, s0 + 0.15, zs + 0.004, Mat('#ffffff', 0.9), 0.002); }
  bottle(-1.1, s0, zs, 0.0505, 0.225, LB, 0.6, tapeLbl('LB', '11/09/26   AA', '#f3ead2'), { tape: 1, la: 0.1 });
  bottle(-0.965, s0, zs + 0.01, 0.0505, 0.225, YPM, 0.42, tapeLbl('YPM', '11/12/26   AA', '#f3ead2'), { tape: 1, la: -0.12 });
  bottle(-0.84, s0, zs - 0.01, 0.043, 0.176, EP, 0.5, tapeLbl('EP', '10/30/26   AA', '#f3ead2'), { la: 0.2, lw: 0.07, lh: 0.042 });
  bone(BONE.EDU); begin('education');
  bottle(-0.52, s0, zs + 0.02, 0.0505, 0.225, LB, 0.55, tapeLbl('EDUCATION', 'Cornell A&S   exp. 05/27', '#f6d55c'), { seg: 56, lw: 0.1, lh: 0.056, tape: 1 });
  end(); bone(0); pick.education = [[-0.58, s0, zs - 0.04], [-0.46, s0 + 0.235, zs + 0.08]]; anchor.education = [-0.52, s0 + 0.24, zs + 0.02];
  { const M = T(-0.27, s0, zs - 0.01), t = 0.0028; lat(GG, [[0, 0], [0.036, 0], [0.04, 0.006], [0.04, 0.012], [0.0165, 0.016], [0.0165, 0.29], [0.019, 0.295], [0.019 - t, 0.295], [0.0165 - t, 0.29], [0.0165 - t, 0.018], [0, 0.018]], M, gClear, 28);
    lat(GL, [[0, 0.0185], [0.0132, 0.0185], [0.0132, 0.151], [0.011, 0.15], [0, 0.15]], M, WATER, 20); GG.add(arcPrim(0.0168, 0.0168, 0.16, 0.24, PI / 2 + 0.3, 1.2, 6), M, gInk, gradInk); }
  beaker(-0.18, s0, zs + 0.03, 0.034, 0.085, null, 0);
  bone(BONE.HON); begin('honors');
  flask(-0.02, s0, zs + 0.02, 0.066, 0.215, 0.019, YPM, 0.3, { foil: 1, seg: 56, lab: tapeLbl('HONORS & AWARDS', null, '#f79d65', 512, 190), lw: 0.1, lh: 0.04 });
  end(); bone(0); pick.honors = [[-0.09, s0, zs - 0.05], [0.05, s0 + 0.225, zs + 0.09]]; anchor.honors = [-0.02, s0 + 0.23, zs + 0.02];
  for (let i = 0; i < 4; i++) { const x = 0.2 + i * 0.075, M = T(x, s0, zs - 0.02 + (i % 2) * 0.02), am = liq('#7a3d10', 0.12, 3.2);
    lat(GL, [[0, 0], [0.027, 0], [0.03, 0.004], [0.03, 0.062], [0.024, 0.078], [0.012, 0.084], [0.012, 0.094], [0, 0.094]], M, am, 24);
    lat(GO, [[0.0125, 0.088], [0.016, 0.088], [0.016, 0.108], [0, 0.109]], M, mBlk, 18);
    GO.add(arcPrim(0.0305, 0.0305, 0.036, 0.036, PI / 2 + (i - 1.5) * 0.15, 1.9, 12), M, mTex, printLbl([['Tris-HCl', 'NaCl 5 M', 'EDTA 0.5 M', 'MgCl2 1 M'][i], ['1 M  pH 8.0', '', 'pH 8.0', ''][i], 'AA  10/21/26'], '#f7f5ee', '#1d2026', 300, 200, ['#2f6fd0', '#d94a3a', '#2f9a61', '#8a5fd0'][i])); }
  { const rackM = T(0.62, s0, zs); box(GO, -0.09, 0, -0.035, 0.09, 0.012, 0.035, Mat('#2f6fd0', 0.5), 0.003, rackM); box(GO, -0.09, 0.05, -0.035, 0.09, 0.058, 0.035, Mat('#2f6fd0', 0.5), 0.002, rackM);
    for (const sx of [-0.086, 0.082]) for (const sz of [-0.031, 0.027]) box(GO, sx, 0.012, sz, sx + 0.004, 0.05, sz + 0.004, Mat('#2f6fd0', 0.5), 0, rackM);
    for (let i = 0; i < 5; i++) for (let r = 0; r < 2; r++) if ((i + r) % 4 !== 3) falcon(0.62 - 0.068 + i * 0.034, s0 + 0.012, zs - 0.016 + r * 0.032, [LB, WATER, CULT, EP][(i + r) % 4], 0.03 + R() * 0.06); }
  { let y = s0; for (const [c, h] of [['#f6d55c', 0.019], ['#f291b2', 0.019], ['#7bd389', 0.025], ['#6ec6f0', 0.019]]) { lat(GO, [[0.02, y], [0.037, y], [0.037, y + h], [0.02, y + h, 1], [0.02, y]], T(0.82, 0, zs + 0.02), Mat(c, 0.55), 30); y += h + 0.0005; } }
  box(GO, 0.9, s0, zs - 0.05, 1.02, s0 + 0.052, zs + 0.06, Mat('#e9e7df', 0.7), 0.003); vq(GO, 0.96, s0 + 0.026, zs + 0.0605, 0.116, 0.05, mTex, printLbl(['SEALING FILM', '4 in × 125 ft'], '#e9e7df', '#1e3a6e', 380, 164, '#1e3a6e'));
  bottle(1.14, s0, zs, 0.043, 0.176, WATER, 0.7, tapeLbl('DI H2O', 'sterile  11/10/26', '#f3ead2'), { lw: 0.07, lh: 0.042, la: -0.15 });
  beaker(1.28, s0, zs + 0.02, 0.043, 0.11, null, 0);

  // ---- upper shelf --------------------------------------------------------------------
  { const gb = atlas.draw(480, 150, (g, w, h) => { g.fillStyle = '#6548b3'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(0, h - 26, w, 26); txt(g, 'NITRILE EXAM GLOVES', 24, 62, `800 34px ${SANS}`, '#fff'); txt(g, 'powder-free  ·  MEDIUM  ·  100 ct', 24, 104, `500 22px ${SANS}`, '#e5dcff'); });
    for (let i = 0; i < 2; i++) { const y = s1 + i * 0.068, dx = i * 0.012; box(GO, -1.34 + dx, y, zs - 0.06, -1.1 + dx, y + 0.067, zs + 0.065, Mat('#6548b3', 0.7), 0.003); vq(GO, -1.22 + dx, y + 0.0335, zs + 0.0655, 0.236, 0.065, mTex, gb); } }
  flask(-0.96, s1, zs, 0.082, 0.27, 0.024, null, 0, { foil: 1 });
  bottle(-0.74, s1, zs + 0.01, 0.068, 0.262, LB, 0.58, tapeLbl('LB  2 L', '11/02/26   AA', '#f3ead2'), { tape: 1, lw: 0.1, lh: 0.058, la: 0.08 });
  flask(-0.53, s1, zs - 0.01, 0.066, 0.215, 0.019, null, 0, { foil: 1 });
  { let x = -0.33; const sp = [['PROTOCOLS', '#b9442f', 0.062], ['SAFETY + SDS', '#e0b030', 0.07], ['NOTEBOOK 01', '#2c3e50', 0.034], ['NOTEBOOK 02', '#2c3e50', 0.034], ['ORDERS', '#2e7d5b', 0.05]];
    for (const [s, c, w] of sp) { const lean = s === 'ORDERS' ? -0.09 : 0, M = X(T(x, s1, zs - 0.11), m4.RZ(lean)); box(GO, 0, 0, 0, w, 0.3, 0.23, Mat(c, 0.6), 0.003, M);
      const uv = atlas.draw(64, 300, (g, ww, h) => { g.fillStyle = '#f4f1e6'; g.fillRect(0, 0, ww, h); g.save(); g.translate(ww / 2, h / 2); g.rotate(PI / 2); txt(g, s, 0, 13, `700 ${fit(g, s, 36, SANS, h * 0.86)}px ${SANS}`, '#22252b', 'center'); g.restore(); });
      vq(GO, w / 2, 0.17, 0.2305, Math.min(w * 0.6, 0.03), 0.15, mTex, uv, M); x += w + 0.004 + (lean ? 0.03 : 0); } }
  bottle(0.12, s1, zs + 0.01, 0.0505, 0.225, YPM, 0.5, tapeLbl('YPM', '11/05/26   AA', '#f3ead2'), { tape: 1, la: -0.1 });
  flask(0.28, s1, zs, 0.052, 0.176, 0.017, null, 0, { foil: 1 });
  const tipCache = {}, tipTop = c => tipCache[c] || (tipCache[c] = atlas.draw(288, 198, (g, w, h) => { g.fillStyle = c; g.fillRect(0, 0, w, h); for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) { const x = 18 + i * 22.9, y = 19 + j * 22.9; g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.arc(x, y, 8, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(x, y, 5.6, 0, TAU); g.fill(); g.fillStyle = 'rgba(20,20,30,0.75)'; g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.fill(); } }));
  const tipBox = (x, y, z, col, h, open, ry = 0) => {
    const M = X(T(x, y, z), m4.RY(ry)), w = 0.122, d = 0.084;
    box(GO, -w / 2, 0, -d / 2, w / 2, h, d / 2, Mat(col, 0.38), 0.004, M); hq(GO, 0, h + 0.0004, 0, w - 0.012, d - 0.012, 0, mTex, tipTop(col), M);
    const L = open ? X(M, T(0, h, -d / 2), m4.RX(-1.9), T(0, 0, d / 2)) : X(M, T(0, h, 0));
    box(GG, -w / 2 - 0.001, 0, -d / 2 - 0.001, w / 2 + 0.001, 0.03, d / 2 + 0.001, gPlastic, 0.003, L);
  };
  tipBox(0.47, s1, zs, '#2f6fd0', 0.095, false); tipBox(0.47, s1 + 0.126, zs, '#2f6fd0', 0.095, false); tipBox(0.61, s1, zs, '#e8c12b', 0.062, false); tipBox(0.61, s1 + 0.093, zs, '#e8c12b', 0.062, false); tipBox(0.61, s1 + 0.186, zs, '#9aa0a6', 0.062, false);
  beaker(0.8, s1, zs, 0.052, 0.14, null, 0);
  { const wb = (x, z, cap, lab, lq) => { const M = T(x, s1, z); lat(GG, [[0, 0], [0.034, 0], [0.037, 0.005], [0.037, 0.115], [0.03, 0.14], [0.014, 0.152], [0.014, 0.16], [0, 0.16]], M, gFrost, 26); lat(GL, [[0, 0.002], [0.035, 0.004], [0.035, 0.085], [0, 0.085]], M, lq, 22);
      lat(GO, [[0.0145, 0.156], [0.019, 0.156], [0.019, 0.178], [0.008, 0.184], [0, 0.184]], M, Mat(cap, 0.4), 18); tube(GO, spline([[0, 0.184, 0], [0, 0.215, 0.002], [0.006, 0.232, 0.014], [0.03, 0.228, 0.05]], 10), 0.0026, Mat('#f1f1ec', 0.5), 6, M);
      GO.add(arcPrim(0.0376, 0.0376, 0.07, 0.05, PI / 2, 1.9, 12), M, mTex, lab); };
    wb(0.96, zs + 0.01, '#d23b30', printLbl(['70% EtOH', 'flammable'], '#fbfaf4', '#b3261e', 320, 190, '#d23b30'), WATER); wb(1.06, zs - 0.02, '#2f6fd0', printLbl(['DI WATER', ''], '#fbfaf4', '#1e3a6e', 320, 190, '#2f6fd0'), WATER); }
  box(GO, 1.16, s1, zs - 0.09, 1.4, s1 + 0.17, zs + 0.1, Mat('#b08a5a', 0.85), 0.004); vq(GO, 1.28, s1 + 0.09, zs + 0.1005, 0.15, 0.08, mTex, printLbl(['PIPETTE TIPS', '200 µL  ·  10 × 96', 'LOT 2611-A'], '#f4f1e8', '#22252b', 380, 210));

  // ---- bench top ------------------------------------------------------------------------
  const by = BENCH_Y;
  box(GO, -0.5, by, 0.31, 0.42, by + 0.0016, 0.735, Mat('#f0f1ee', 0.9, { k: K.PAD }), 0.0007);
  box(GO, -0.503, by, 0.307, 0.423, by + 0.0008, 0.738, Mat('#4f86c6', 0.6));
  // vortex mixer
  { const M = T(-1.28, by, 0.2); lat(GO, [[0, 0], [0.066, 0], [0.07, 0.008], [0.062, 0.085], [0.05, 0.1], [0.03, 0.105], [0.033, 0.12], [0.027, 0.126], [0.012, 0.114], [0, 0.112]], M, Mat('#263347', 0.45), 36);
    lat(GO, [[0, 0], [0.012, 0], [0.012, 0.012], [0.009, 0.015], [0, 0.015]], X(M, T(0, 0.04, 0.064), m4.RX(PI / 2 - 0.09)), mBlk, 16); box(GO, -0.003, 0.068, 0.0605, 0.003, 0.074, 0.0625, Mat('#39d98a', 0.4, { e: 3 }), 0, M); }
  // falcon rack on the bench
  { const M = T(-0.99, by, 0.16); box(GO, -0.09, 0, -0.035, 0.09, 0.012, 0.035, Mat('#e9e9e4', 0.5), 0.003, M); box(GO, -0.09, 0.05, -0.035, 0.09, 0.058, 0.035, Mat('#e9e9e4', 0.5), 0.002, M);
    for (const sx of [-0.086, 0.082]) for (const sz of [-0.031, 0.027]) box(GO, sx, 0.012, sz, sx + 0.004, 0.05, sz + 0.004, Mat('#e9e9e4', 0.5), 0, M);
    for (let i = 0; i < 5; i++) for (let r = 0; r < 2; r++) if ((i * 3 + r) % 5 !== 1) falcon(-0.99 - 0.068 + i * 0.034, by + 0.012, 0.16 - 0.016 + r * 0.032, [CULT, LB, YPM][(i + r) % 3], 0.035 + R() * 0.055); }
  // bunsen burner + hose
  const BX = -0.86, BZ = 0.42;
  { const M = T(BX, by, BZ), en = Mat('#2c4a66', 0.4), brass = Mat('#b89243', 0.35, { m: 1 });
    lat(GO, [[0, 0], [0.042, 0], [0.045, 0.004], [0.04, 0.012], [0.014, 0.02], [0.0075, 0.03], [0, 0.03]], M, en, 32);
    lat(GO, [[0.0066, 0.03], [0.0066, 0.14], [0.0054, 0.14, 1], [0.0054, 0.128]], M, mSteel, 18); lat(GO, [[0.0068, 0.034], [0.0098, 0.036], [0.0098, 0.052], [0.0068, 0.054]], M, brass, 18);
    tube(GO, [[0, 0.018, 0], [-0.05, 0.018, -0.01]], 0.0045, brass, 8, M);
    tube(GO, spline([[BX - 0.05, by + 0.018, BZ - 0.01], [BX - 0.12, by + 0.008, BZ - 0.05], [BX - 0.22, by + 0.006, BZ - 0.2], [-1.17, by + 0.012, 0.12], [-1.2, by + 0.07, 0.06], [-1.2, 1.045, 0.054]], 28), 0.0052, Mat('#c8742c', 0.6), 8);
    const fl = (pr, c, solid, fk) => GF.add(lathePrim(pr, 16), M, Mat(c, solid, { a: fk }));
    fl([[0.0056, 0.14], [0.0084, 0.158], [0.0078, 0.186], [0.0044, 0.212], [0, 0.232]], '#4f6dff', 0, 1); fl([[0.0044, 0.14], [0.005, 0.153], [0.0027, 0.172], [0, 0.185]], '#a5dcff', 1, 0.35); }
  // ethanol wash bottle, tip boxes, plates stack
  { const M = T(-0.62, by, 0.16); lat(GG, [[0, 0], [0.034, 0], [0.037, 0.005], [0.037, 0.115], [0.03, 0.14], [0.014, 0.152], [0.014, 0.16], [0, 0.16]], M, gFrost, 26); lat(GL, [[0, 0.002], [0.035, 0.004], [0.035, 0.07], [0, 0.07]], M, WATER, 22);
    lat(GO, [[0.0145, 0.156], [0.019, 0.156], [0.019, 0.178], [0.008, 0.184], [0, 0.184]], M, Mat('#d23b30', 0.4), 18); tube(GO, spline([[0, 0.184, 0], [0, 0.215, 0.002], [0.006, 0.232, 0.014], [0.03, 0.228, 0.05]], 10), 0.0026, Mat('#f1f1ec', 0.5), 6, M);
    GO.add(arcPrim(0.0376, 0.0376, 0.07, 0.05, PI / 2 + 0.2, 1.9, 12), M, mTex, printLbl(['70% EtOH', 'flammable'], '#fbfaf4', '#b3261e', 320, 190, '#d23b30')); }
  tipBox(-0.42, by, 0.17, '#2f6fd0', 0.095, false, 0.05); tipBox(-0.27, by, 0.16, '#e8c12b', 0.062, false, -0.04); tipBox(-0.27, by + 0.093, 0.16, '#e8c12b', 0.062, false, 0.06);
  tipBox(-0.66, by, 0.55, '#e8c12b', 0.062, true, 0.3);
  const texSpread = plateTex(3), texSpot = plateTex(4);
  for (let i = 0; i < 5; i++) petri(-0.1 + (R() - 0.5) * 0.006, by + i * 0.0172, 0.185 + (R() - 0.5) * 0.006, i % 2 ? texSpot : texSpread, i === 4 ? lidInk('G. oxy  KO lib.  11/14  AA') : null, 0, true, R() * 6);
  // the three clickable plates
  const plates = [['barstow', -0.2, plateTex(1), 'BARSTOW LAB', BONE.LID0], ['mason', -0.07, plateTex(0), 'MASON LAB', BONE.LID1], ['wolchok', 0.06, plateTex(2), 'WOLCHOK + MERGHOUB', BONE.LID2]];
  for (const [id, x, tx, s, bn] of plates) { begin(id); petri(x, by + 0.0016, 0.575, tx, lidInk(s), bn, false, 0); end(); pick[id] = [[x - 0.05, by, 0.525], [x + 0.05, by + 0.03, 0.625]]; anchor[id] = [x, by + 0.02, 0.575]; }
  objs.research = { parts: ['barstow', 'mason', 'wolchok'] }; pick.research = [[-0.25, by, 0.525], [0.11, by + 0.03, 0.625]]; anchor.research = [-0.07, by + 0.025, 0.575];
  // inoculating loop + marker on the pad
  { const M = X(T(-0.36, by + 0.006, 0.47), m4.RY(0.5), m4.RZ(-PI / 2)); lat(GO, [[0, 0], [0.0045, 0], [0.0045, 0.11], [0.002, 0.118], [0, 0.118]], M, Mat('#2a2c30', 0.5), 12); lat(GO, [[0, 0.118], [0.0006, 0.118], [0.0006, 0.2], [0, 0.2]], M, mChrome, 6);
    const lp = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * TAU; lp.push([0.0025 * Math.sin(a), 0.2025 - 0.0025 * Math.cos(a), 0]); } tube(GO, lp, 0.0005, mChrome, 5, M); }
  const pen = (x, z, ry, body, cap, r = 0.0058, L = 0.125, y = by) => { const M = X(T(x, y + r, z), m4.RY(ry), m4.RZ(-PI / 2));
    lat(GO, [[0, 0], [r * 0.5, 0], [r, 0.012], [r, L * 0.68], [r * 0.9, L * 0.68], [0, L * 0.68]], M, Mat(body, 0.4), 14); lat(GO, [[r * 1.08, L * 0.66], [r * 1.08, L], [r * 0.7, L + 0.003], [0, L + 0.003]], M, Mat(cap, 0.4), 14); box(GO, -0.0012, L * 0.74, r * 1.05, 0.0012, L * 0.98, r * 1.3, Mat(cap, 0.4), 0, M); };
  pen(0.17, 0.66, 0.35, '#202226', '#202226', 0.0058, 0.125, by + 0.0016); pen(0.33, 0.51, -0.6, '#c9302c', '#c9302c', 0.005, 0.13, by + 0.0016);
  // microtube rack, 96-well plate
  { const M = X(T(0.27, by + 0.0016, 0.62), m4.RY(0.12)); box(GO, -0.065, 0, -0.03, 0.065, 0.028, 0.03, Mat('#18a79b', 0.45), 0.004, M);
    const cc = ['#f4f4ef', '#f6d55c', '#f291b2', '#6ec6f0', '#f4f4ef', '#7bd389'];
    for (let i = 0; i < 6; i++) for (let r = 0; r < 2; r++) if ((i + r * 2) % 5) lat(GO, [[0.0048, 0.028], [0.0048, 0.036], [0.0062, 0.036], [0.0062, 0.039], [0, 0.039]], X(M, T(-0.05 + i * 0.02, 0, -0.012 + r * 0.024)), Mat(cc[(i * 2 + r) % 6], 0.5), 10); }
  { const M = X(T(0.31, by + 0.0016, 0.395), m4.RY(-0.1)), wp = atlas.draw(384, 256, (g, w, h) => { g.fillStyle = '#e7ebec'; g.fillRect(0, 0, w, h); for (let i = 0; i < 12; i++) for (let j = 0; j < 8; j++) { const t = clamp(1 - i / 9 - j * 0.03 + (R() - 0.5) * 0.12); g.fillStyle = `rgb(${236 - t * 18},${228 - t * 62},${214 - t * 170})`; g.beginPath(); g.arc(26 + i * 30.2, 24 + j * 29.8, 11.5, 0, TAU); g.fill(); g.strokeStyle = 'rgba(90,100,110,0.5)'; g.lineWidth = 1.5; g.stroke(); } });
    box(GG, -0.064, 0, -0.043, 0.064, 0.0145, 0.043, gPlastic, 0.002, M); hq(GO, 0, 0.0105, 0, 0.122, 0.08, 0, Mat('#ffffff', 0.35, { k: K.TEX }), wp, M); }
  // culture tubes (skills)
  { const cx = 0.19, cz = 0.22, M = T(cx, by, cz), rk = Mat('#f1f0ea', 0.5); begin('skills');
    box(GO, -0.1, 0, -0.03, 0.1, 0.01, 0.03, rk, 0.003, M); box(GO, -0.1, 0.06, -0.03, 0.1, 0.067, 0.03, rk, 0.002, M);
    for (const sx of [-0.097, 0.092]) for (const sz of [-0.027, 0.022]) box(GO, sx, 0.01, sz, sx + 0.005, 0.06, sz + 0.005, rk, 0, M);
    const caps = ['#2f6fd0', '#2f6fd0', '#2f9a61', '#2f9a61', '#e2752b', '#e2752b'];
    for (let i = 0; i < 6; i++) ctube(-0.08 + i * 0.032, 0.01, 0, CULT, 0.04 + (i % 2) * 0.008 + R() * 0.006, caps[i], M);
    vq(GO, 0, 0.035, 0.0305, 0.15, 0.03, mTex, tapeLbl('O/N cultures   11/15   AA', null, '#7bd389', 600, 120), M);
    end(); pick.skills = [[cx - 0.11, by, cz - 0.04], [cx + 0.11, by + 0.14, cz + 0.04]]; anchor.skills = [cx, by + 0.14, cz]; }
  // timer
  const digits = atlas.draw(640, 96, (g, w, h) => {
    g.fillStyle = '#04100d'; g.fillRect(0, 0, w, h); const seg = { a: [14, 10, 36, 9], b: [46, 14, 9, 30], c: [46, 52, 9, 30], d: [14, 77, 36, 9], e: [9, 52, 9, 30], f: [9, 14, 9, 30], g: [14, 43, 36, 9] };
    const map = ['abcdef', 'bc', 'abged', 'abgcd', 'fgbc', 'afgcd', 'afgedc', 'abc', 'abcdefg', 'abcdfg'];
    for (let d = 0; d < 10; d++) for (const k in seg) { const s = seg[k]; g.fillStyle = map[d].includes(k) ? '#7dffd0' : '#0b2a22'; g.fillRect(d * 64 + s[0], s[1], s[2], s[3]); }
  });
  const digitW = 64 / atlas.S;
  { const M = X(T(0.6, by, 0.19), m4.RY(-0.25), m4.RX(-0.32)); box(GO, -0.036, 0, -0.009, 0.036, 0.082, 0.009, Mat('#e6e6e1', 0.45), 0.004, M); box(GO, -0.031, 0.044, 0.009, 0.031, 0.075, 0.0095, Mat('#04100d', 0.3), 0, M);
    for (let i = 0; i < 4; i++) { const x = -0.0215 + i * 0.0127 + (i > 1 ? 0.0048 : 0); GO.add(quadPrim(0.0118, 0.024), X(M, T(x, 0.0595, 0.0098)), Mat('#ffffff', 0.4, { k: K.DIGIT, e: 2.4, a: i / 255 }), [digits[0], digits[1], digits[0] + digitW, digits[3]]); }
    for (const dy of [-0.005, 0.005]) box(GO, -0.0012, 0.0583 + dy, 0.0097, 0.0012, 0.0607 + dy, 0.0099, Mat('#7dffd0', 0.4, { e: 2.4 }), 0, M);
    for (let i = 0; i < 3; i++) box(GO, -0.027 + i * 0.02, 0.012, 0.009, -0.013 + i * 0.02, 0.03, 0.0115, Mat(['#3a3d42', '#3a3d42', '#d23b30'][i], 0.5), 0.002, M); }
  // stir plate with a stirring flask
  const SX = 1.2, SZ = 0.2;
  { const M = T(SX, by, SZ); box(GO, -0.1, 0, -0.12, 0.1, 0.075, 0.12, Mat('#e4e4de', 0.45), 0.008, M); box(GO, -0.085, 0.075, -0.1, 0.085, 0.081, 0.085, Mat('#f4f4f0', 0.25), 0.002, M);
    vq(GO, 0, 0.036, 0.1205, 0.18, 0.05, mTex, atlas.draw(360, 100, (g, w, h) => { g.fillStyle = '#23272c'; g.fillRect(0, 0, w, h); txt(g, 'STIR', 76, 88, `600 18px ${SANS}`, '#cfd3d8', 'center'); txt(g, 'HEAT', 284, 88, `600 18px ${SANS}`, '#cfd3d8', 'center'); }), M);
    for (const dx of [-0.052, 0.052]) lat(GO, [[0, 0], [0.014, 0], [0.014, 0.012], [0.011, 0.016], [0, 0.016]], X(M, T(dx, 0.042, 0.1205), m4.RX(PI / 2)), mBlk, 20);
    box(GO, -0.004, 0.04, 0.1205, 0.004, 0.046, 0.1225, Mat('#49e08a', 0.4, { e: 4 }), 0, M);
    flask(SX, by + 0.081, SZ - 0.008, 0.052, 0.176, 0.017, LB, 0.34, { vortex: 1, foil: 1 });
    bone(BONE.STIR); tube(GO, [[-0.014, by + 0.0885, SZ - 0.008], [0.014, by + 0.0885, SZ - 0.008]].map(p => [p[0] + SX, p[1], p[2]]), 0.0038, Mat('#f6f6f2', 0.35), 8); bone(0); }
  // red tip-waste box
  { const M = T(-1.22, by, 0.52); box(GL, -0.055, 0, -0.055, 0.055, 0.13, 0.055, liq('#c8261f', 0.55, 2.5), 0.006, M); box(GO, -0.058, 0.13, -0.058, 0.058, 0.142, 0.058, Mat('#e8e6df', 0.5), 0.004, M); box(GO, -0.025, 0.142, -0.025, 0.025, 0.1425, 0.025, mCabIn, 0, M); vq(GO, 0, 0.07, 0.0558, 0.07, 0.07, mTex, biohaz(), M); }
  // notebook (static parts) + pens
  const NB = NOTEBOOK, NM = X(T(NB.x, by, NB.z), m4.RY(NB.ry));
  begin('teaching');
  box(GO, -NB.W - 0.009, 0, -NB.D / 2 - 0.006, NB.W + 0.009, 0.004, NB.D / 2 + 0.006, Mat('#1d3a2e', 0.6), 0.002, NM);
  box(GO, -NB.W, 0.004, -NB.D / 2, -0.003, NB.yL, NB.D / 2, Mat('#efe9d6', 0.8), 0.001, NM); box(GO, 0.003, 0.004, -NB.D / 2, NB.W, NB.yR, NB.D / 2, Mat('#efe9d6', 0.8), 0.001, NM);
  hq(GO, -NB.W / 2 - 0.0015, NB.yL + 0.0003, 0, NB.W - 0.003, NB.D, 0, mPaper, pg.A, NM); hq(GO, NB.W / 2 + 0.0015, NB.yR + 0.0003, 0, NB.W - 0.003, NB.D, 0, mPaper, pg.TR, NM);
  tube(GO, [[0, 0.012, -NB.D / 2 + 0.01], [-0.004, 0.0125, 0], [0.002, 0.012, NB.D / 2 + 0.03]], 0.0022, Mat('#b3261e', 0.7), 5, NM);
  end(); pick.teaching = [[NB.x - 0.23, by, NB.z - 0.16], [NB.x + 0.23, by + 0.04, NB.z + 0.16]]; anchor.teaching = [NB.x, by + 0.03, NB.z];
  pen(NB.x + 0.26, NB.z + 0.1, 1.2, '#1f4fa8', '#1f4fa8', 0.0046, 0.14); pen(0.6, 0.66, -0.25, '#202226', '#8d9296'); pen(NB.x - 0.13, NB.z + 0.19, 0.12, '#f2d21c', '#f2d21c', 0.0066, 0.11);

  // ---- floor-standing items ------------------------------------------------------------------
  { const x0 = 1.62, x1 = 2.3; box(GO, x0, 0.02, 0.03, x1, 1.82, 0.7, Mat('#eceeed', 0.4), 0.02); box(GO, x0 + 0.01, 1.243, 0.7, x1 - 0.01, 1.25, 0.704, mCabIn);
    box(GO, x0 + 0.006, 0.03, 0.7, x1 - 0.006, 1.24, 0.725, Mat('#f1f2f1', 0.38), 0.012); box(GO, x0 + 0.006, 1.253, 0.7, x1 - 0.006, 1.812, 0.725, Mat('#f1f2f1', 0.38), 0.012);
    for (const [ya, yb] of [[0.86, 1.18], [1.32, 1.62]]) tube(GO, [[x0 + 0.06, ya, 0.726], [x0 + 0.06, ya, 0.76], [x0 + 0.06, yb, 0.76], [x0 + 0.06, yb, 0.726]], 0.008, mSteel, 10);
    vq(GO, x1 - 0.16, 1.62, 0.7256, 0.1, 0.1, mTex, biohaz()); vq(GO, x1 - 0.2, 1.42, 0.7256, 0.2, 0.09, mTex, printLbl(['NO FOOD OR DRINK', 'lab reagents only'], '#f7f0d8', '#a8242a', 420, 190));
    vq(GO, x1 - 0.3, 0.95, 0.7256, 0.2, 0.264, mPaper, sheetTex('-20 °C  INVENTORY')); vq(GO, x0 + 0.22, 1.72, 0.7256, 0.12, 0.05, mTex, tapeLbl('-20 °C', null, '#8fd0f2', 300, 120)); }
  { const M = T(-1.78, 0, 0.2); lat(GO, [[0, 0], [0.105, 0], [0.115, 0.012], [0.115, 1.22], [0.105, 1.3], [0.07, 1.37], [0.036, 1.4], [0.036, 1.43], [0.05, 1.435], [0.05, 1.5], [0.03, 1.54], [0, 1.54]], M, Mat('#3c4a44', 0.42, { m: 0.6 }), 40);
    box(GO, -0.14, 0.95, -0.2, 0.14, 0.98, -0.17, mDarkMetal, 0, M); const ch = [[-0.13, 0.965, -0.18]]; for (let i = 0; i <= 20; i++) { const a = PI - i / 20 * PI; ch.push([0.122 * Math.cos(a), 0.965, 0.122 * Math.sin(a)]); } ch.push([0.13, 0.965, -0.18]); tube(GO, ch, 0.006, mSteel, 6, M);
    GO.add(arcPrim(0.1156, 0.1156, 0.8, 0.2, PI / 2 + 0.2, 1.4, 16), M, mTex, printLbl(['NITROGEN', 'compressed gas', 'N2'], '#f4f1e8', '#1f2d27', 380, 250, '#2f9a61')); }
  { const M = T(-2.2, 0, 0.38); box(GO, -0.19, 0, -0.16, 0.19, 0.56, 0.16, Mat('#c8261f', 0.5), 0.012, M); box(GO, -0.2, 0.56, -0.17, 0.2, 0.6, 0.17, Mat('#ecebe6', 0.5), 0.01, M); vq(GO, 0, 0.3, 0.1605, 0.2, 0.2, mTex, biohaz('#c8261f', '#161616'), M); }
  // wall clock
  const CLOCK = [-1.8, 2.0, 0.0];
  { const M = X(T(CLOCK[0], CLOCK[1], 0), m4.RX(PI / 2)), face = atlas.draw(512, 512, (g, w) => { g.fillStyle = '#f6f5ef'; g.fillRect(0, 0, w, w); const c = w / 2; for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, r0 = i % 5 ? 222 : 204; g.strokeStyle = '#22252b'; g.lineWidth = i % 5 ? 3 : 8; g.beginPath(); g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0); g.lineTo(c + Math.cos(a) * 236, c + Math.sin(a) * 236); g.stroke(); } for (let i = 1; i <= 12; i++) { const a = i / 12 * TAU - PI / 2; txt(g, String(i), c + Math.cos(a) * 168, c + Math.sin(a) * 168 + 18, `600 50px ${SANS}`, '#22252b', 'center'); } });
    lat(GO, [[0, 0], [0.15, 0], [0.15, 0.03], [0.14, 0.036], [0.136, 0.03], [0.136, 0.012], [0, 0.012]], M, Mat('#1d1f22', 0.4), 48);
    GO.add(discPrim(0.136, 48), X(T(CLOCK[0], CLOCK[1], 0.0125), m4.RX(PI / 2)), mTex, face);
    const hand = (bn, len, w, z, c) => { bone(bn); box(GO, CLOCK[0] - w, CLOCK[1] - len * 0.18, z, CLOCK[0] + w, CLOCK[1] + len, z + 0.0015, Mat(c, 0.5)); bone(0); };
    hand(BONE.HOUR, 0.07, 0.005, 0.016, '#1d1f22'); hand(BONE.MIN, 0.105, 0.0035, 0.019, '#1d1f22'); hand(BONE.SEC, 0.115, 0.0012, 0.022, '#c8261f');
    lat(GO, [[0, 0], [0.008, 0], [0.008, 0.004], [0, 0.005]], X(T(CLOCK[0], CLOCK[1], 0.022), m4.RX(PI / 2)), mBlk, 14);
    GG.add(discPrim(0.137, 40), X(T(CLOCK[0], CLOCK[1], 0.031), m4.RX(PI / 2)), gClear); }

  // dust motes (drawn as points; uv carries per-mote phase and size)
  const motes = new Float32Array(170 * 5);
  for (let i = 0; i < 170; i++) { motes[i * 5] = (R() - 0.5) * 9; motes[i * 5 + 1] = -0.6 + R() * 4.2; motes[i * 5 + 2] = -2.5 + R() * 7.5; motes[i * 5 + 3] = R(); motes[i * 5 + 4] = 0.25 + R() * 0.75; }

  return { GO, GG, GL, GF, objs, pick, anchor, strips, pg, NM, digitW, motes, flame: [BX, by + 0.19, BZ], clock: CLOCK, stir: [SX, by + 0.0885, SZ - 0.008],
    plateX: plates.map(p => p[1]), drawerX: { publications: -0.625, contact: 0.625, ack: 1.175 } };
}

// the three flipping notebook pages, rebuilt whenever a flip is in progress (f[i] in 0..1: 0 = lying right, 1 = lying left)
function buildPages(S, f) {
  const G = new Geo(), NB = NOTEBOOK, n = 16, fr = ['B', 'D', 'F'], bk = ['C', 'E', 'TL'], mt = Mat('#ffffff', 0.85, { k: K.PAPER }), W = NB.W - 0.003, ds = W / n, e = 0.00012;
  for (let i = 0; i < 3; i++) {
    const t = f[i], front = { p: [], n: [], u: [], i: [] }, back = { p: [], n: [], u: [], i: [] };
    let x = 0.0015 * (1 - 2 * t), y = lerp(NB.yR + 0.0009 + (2 - i) * 0.0007, NB.yL + 0.0009 + i * 0.0007, t);
    for (let s = 0; s <= n; s++) {
      const ph = PI * t - 1.05 * Math.sin(PI * t) * Math.pow(s / n, 1.3), cx = Math.cos(ph), sy = Math.sin(ph);
      for (const zz of [-1, 1]) {
        front.p.push(x - sy * e, y + cx * e, zz * NB.D / 2); front.n.push(-sy, cx, 0); front.u.push(s / n, zz < 0 ? 0 : 1);
        back.p.push(x + sy * e, y - cx * e, zz * NB.D / 2); back.n.push(sy, -cx, 0); back.u.push(1 - s / n, zz < 0 ? 0 : 1);
      }
      x += cx * ds; y += sy * ds;
    }
    for (let s = 0; s < n; s++) { const a = s * 2, b = a + 2; front.i.push(a, a + 1, b + 1, a, b + 1, b); back.i.push(a, b + 1, a + 1, a, b, b + 1); }
    G.add(front, S.NM, mt, S.pg[fr[i]]); G.add(back, S.NM, mt, S.pg[bk[i]]);
  }
  return G;
}
