// ---------------------------------------------------------------------------
// app: renderer, camera, interaction, interface
// ---------------------------------------------------------------------------
const Q = new URLSearchParams(location.search), $ = id => document.getElementById(id);
const MANUAL = Q.has('manual'), PERF = Q.has('perf');
const canvas = $('gl');
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: MANUAL });
const lab = (window.__lab = { ready: false, errors: glErr, frames: [], marks: [] });

function fallback() {
  document.body.classList.add('nogl'); $('ld').remove();
  $('fb').hidden = false;
  $('fb').innerHTML = '<h1>Ayman Abou-Alfa</h1><p>Physics &amp; Biophysics · Cornell University</p>' +
    ['education', 'honors', 'barstow', 'mason', 'wolchok', 'skills', 'teaching', 'publications', 'contact', 'ack'].map(id => {
      const s = SEC[id]; return `<section><h4>${s.h || s.t}</h4>${s.html || s.left + s.right}</section>`;
    }).join('');
}

async function init() {
  if (!gl || !gl.getExtension('EXT_color_buffer_float')) return fallback();
  gl.getExtension('OES_texture_float_linear');
  const yieldUI = () => new Promise(r => setTimeout(r, 0));
  const progress = p => { $('ldb').style.transform = `scaleX(${p})`; $('ldt').textContent = Math.round(p * 100) + '%'; };
  progress(0.08); await yieldUI();

  // ---- scene data -------------------------------------------------------------
  const atlas = new Atlas(4096), S = buildScene(atlas);
  lab.atlas = { used: +(atlas.used / (4096 * 4096)).toFixed(3), top: atlas.top };
  progress(0.5); await yieldUI();
  const mO = mkMesh(gl, S.GO), mG = mkMesh(gl, S.GG), mL = mkMesh(gl, S.GL), mF = mkMesh(gl, S.GF), mP = mkMesh(gl, buildPages(S, [0, 0, 0]), true);
  lab.tris = { opaque: mO.n / 3, glass: mG.n / 3, liquid: mL.n / 3 };
  const moteVao = gl.createVertexArray(), moteBuf = gl.createBuffer();
  gl.bindVertexArray(moteVao); gl.bindBuffer(gl.ARRAY_BUFFER, moteBuf); gl.bufferData(gl.ARRAY_BUFFER, S.motes, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0); gl.enableVertexAttribArray(5); gl.vertexAttribPointer(5, 2, gl.FLOAT, false, 20, 12); gl.bindVertexArray(null);

  const atlasTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, atlasTex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, atlas.cv); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const aniso = gl.getExtension('EXT_texture_filter_anisotropic'); if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, 8);
  atlas.cv.width = atlas.cv.height = 1;
  const nz = new Uint8Array(256 * 256 * 4), nr = rng(7); for (let i = 0; i < nz.length; i++) nz[i] = nr() * 256;
  const noiseTex = mkTex(gl, 256, 256, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR_MIPMAP_LINEAR, gl.REPEAT, nz); gl.generateMipmap(gl.TEXTURE_2D);
  const dummy = mkTex(gl, 1, 1, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.NEAREST, 0, new Uint8Array([255, 255, 255, 255]));
  progress(0.7); await yieldUI();

  // ---- programs ---------------------------------------------------------------
  const lit = (fs, low) => mkProg(gl, VS_SCENE, G_HEAD + (low ? '\n#define LOWQ\n' : '') + G_LIGHT + fs, 'lit');
  const pOpaque = lit(FS_OPAQUE), pOpaqueLo = lit(FS_OPAQUE, 1), pLiquid = lit(FS_LIQUID), pLiquidLo = lit(FS_LIQUID, 1), pGlass = lit(FS_GLASS, 1), pGlassLo = pGlass;
  const pDepth = mkProg(gl, VS_SCENE, FS_DEPTH, 'depth'), pMask = mkProg(gl, VS_SCENE, FS_MASK, 'mask'), pFx = mkProg(gl, VS_FX, FS_FX, 'fx'), pMote = mkProg(gl, VS_MOTE, FS_MOTE, 'mote');
  const post = fs => mkProg(gl, VS_POST, fs, 'post');
  const pBg = post(FS_BG), pSsao = post(FS_SSAO), pAoBlur = post(FS_AOBLUR), pDown = post(FS_DOWN), pUp = post(FS_UP), pMBlur = post(FS_MBLUR), pComp = post(FS_COMP);
  for (const p of [pOpaque, pOpaqueLo, pLiquid, pLiquidLo, pGlass]) { gl.useProgram(p.p); const m = { uAtlas: 0, uNoise: 1, uSh0: 2, uSh1: 3, uAO: 4, uRefl: 5, uScene: 6 }; for (const k in m) if (p.u[k]) gl.uniform1i(p.u[k], m[k]); }
  gl.useProgram(pSsao.p); gl.uniform1i(pSsao.u.uDepth, 0); gl.uniform1i(pSsao.u.uSh0, 2); gl.uniform1i(pSsao.u.uSh1, 3);
  if (glErr.length) { console.error(glErr.join('\n')); return fallback(); }
  progress(0.9); await yieldUI();

  // ---- render targets -----------------------------------------------------------
  const SAMPLES = Math.min(+(Q.get('msaa') || 4), gl.getParameter(gl.MAX_SAMPLES)), HDR = Q.get('fmt') === '11' ? gl.R11F_G11F_B10F : gl.RGBA16F, HDRF = HDR === gl.RGBA16F ? gl.RGBA : gl.RGB, BUDGET = 2560 * 1440;
  let W = 0, H = 0, hw = 0, hh = 0, aw = 0, ah = 0, T = null;
  const tex = (w, h, ifmt, fmt, type, filt) => mkTex(gl, w, h, ifmt, fmt, type, filt);
  function alloc() {
    if (T) { T.tex.forEach(t => gl.deleteTexture(t)); T.fbo.forEach(f => gl.deleteFramebuffer(f)); T.rb.forEach(r => gl.deleteRenderbuffer(r)); }
    T = { tex: [], fbo: [], rb: [], bloom: [] }; hw = Math.max(W >> 1, 1); hh = Math.max(H >> 1, 1); aw = Math.max(Math.round(W / 3), 1); ah = Math.max(Math.round(H / 3), 1);
    const tx = (...a) => { const t = tex(...a); T.tex.push(t); return t; }, fb = (c, d) => { const f = mkFbo(gl, c, d); T.fbo.push(f); return f; };
    const rb = (fmt, w, h, s) => { const r = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, r); if (s) gl.renderbufferStorageMultisample(gl.RENDERBUFFER, s, fmt, w, h); else gl.renderbufferStorage(gl.RENDERBUFFER, fmt, w, h); T.rb.push(r); return r; };
    if (SAMPLES > 1) {
      const c = rb(HDR, W, H, SAMPLES), d = rb(gl.DEPTH_COMPONENT24, W, H, SAMPLES);
      T.msF = gl.createFramebuffer(); T.fbo.push(T.msF); gl.bindFramebuffer(gl.FRAMEBUFFER, T.msF);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, c); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
      T.scene = tx(W, H, HDR, HDRF, gl.HALF_FLOAT, gl.LINEAR); T.sceneF = fb(T.scene);
    } else {
      T.scene = tx(W, H, HDR, HDRF, gl.HALF_FLOAT, gl.LINEAR); T.sceneF = T.msF = gl.createFramebuffer(); T.fbo.push(T.msF); gl.bindFramebuffer(gl.FRAMEBUFFER, T.msF);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, T.scene, 0); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb(gl.DEPTH_COMPONENT24, W, H, 0));
    }
    T.pre = tx(aw, ah, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR); T.preD = tx(aw, ah, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST); T.preF = fb(T.pre, T.preD);
    T.aoA = tx(aw, ah, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR); T.aoAF = fb(T.aoA); T.aoB = tx(aw, ah, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, gl.LINEAR); T.aoBF = fb(T.aoB);
    T.refl = tx(hw, hh, HDR, HDRF, gl.HALF_FLOAT, gl.LINEAR_MIPMAP_LINEAR); gl.generateMipmap(gl.TEXTURE_2D);
    T.reflF = fb(T.refl); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rb(gl.DEPTH_COMPONENT24, hw, hh, 0));
    let bw = Math.max(W >> 2, 1), bh = Math.max(H >> 2, 1);
    for (let i = 0; i < 4; i++) { const t = tx(bw, bh, gl.R11F_G11F_B10F, gl.RGB, gl.HALF_FLOAT, gl.LINEAR); T.bloom.push({ t, f: fb(t), w: bw, h: bh }); bw = Math.max(bw >> 1, 1); bh = Math.max(bh >> 1, 1); }
    T.mask = tx(hw, hh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR); T.maskF = fb(T.mask); T.maskT = tx(hw, hh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR); T.maskTF = fb(T.maskT);
    T.maskB = tx(hw, hh, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, gl.LINEAR); T.maskBF = fb(T.maskB);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  function resize() {
    let w, h; const forced = Q.get('res');
    if (forced) { [w, h] = forced.split('x').map(Number); canvas.style.width = w / devicePixelRatio + 'px'; canvas.style.height = h / devicePixelRatio + 'px'; }
    else { let s = Math.min(devicePixelRatio || 1, 2); const cw = innerWidth, ch = innerHeight; if (cw * ch * s * s > BUDGET) s = Math.sqrt(BUDGET / (cw * ch)); w = Math.max(Math.round(cw * s), 2); h = Math.max(Math.round(ch * s), 2); }
    if (w === W && h === H) return;
    W = w; H = h; canvas.width = W; canvas.height = H; alloc();
  }
  const shTex = (w, h) => { const t = mkTex(gl, w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL); return t; };
  const SH0 = 2048, SH1W = 2048, SH1H = 1024, sh0 = shTex(SH0, SH0), sh0F = mkFbo(gl, null, sh0), sh1 = shTex(SH1W, SH1H), sh1F = mkFbo(gl, null, sh1);
  // static casters are rendered once into these; each animated frame copies them and adds only the moving objects
  const sh0S = shTex(SH0, SH0), sh0SF = mkFbo(gl, null, sh0S), sh1S = shTex(SH1W, SH1H), sh1SF = mkFbo(gl, null, sh1S);

  // ---- lights (static part of the frame block) --------------------------------------
  const UB = new Float32Array(88 + NB * 16), bones = UB.subarray(88), ubo = gl.createBuffer();
  for (let i = 0; i < NB; i++) bones.set(m4.I(), i * 16);
  const keyDir = vnorm([-0.34, 1, 0.52]);
  const orthoFit = (view, pts, pad) => { let a = [1e9, 1e9, 1e9], b = [-1e9, -1e9, -1e9]; for (const p of pts) { const q = m4.pt(view, p); for (let i = 0; i < 3; i++) { a[i] = Math.min(a[i], q[i]); b[i] = Math.max(b[i], q[i]); } } return m4.ortho(a[0] - pad, b[0] + pad, a[1] - pad, b[1] + pad, -b[2] - pad, -a[2] + pad); };
  const corners = (x0, y0, z0, x1, y1, z1) => { const o = []; for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) o.push([x, y, z]); return o; };
  const v0 = m4.look(vadd([0, 1.1, 0.9], vmul(keyDir, 8)), [0, 1.1, 0.9], [0, 1, 0]), shM0 = m4.mul(orthoFit(v0, corners(-2.0, -0.05, -0.05, 2.0, 2.25, 1.7), 0.03), v0);
  const sd = vnorm([0, -1, 0.42]), se = [0, SH0_Y - 0.05, 0.245], v1 = m4.look(se, vadd(se, sd), [0, 0, 1]);
  const o1 = orthoFit(v1, corners(-1.6, 0.9, 0, 1.6, SH0_Y - 0.05, 1.0), 0.02), n1 = 0.27, f1 = 0.75;
  o1[10] = -2 / (f1 - n1); o1[14] = -(f1 + n1) / (f1 - n1);
  const shM1 = m4.mul(o1, v1);
  UB.set(shM0, 0); UB.set(shM1, 16); UB.set([...keyDir, 0], 32); UB.set([0.56, 0.64, 0.76, 0], 36);
  S.strips.forEach((s, i) => { UB.set([...s[0], 0], 40 + i * 4); UB.set([...s[1], 0], 48 + i * 4); UB.set(i ? [1.1, 0.84, 0.56, 0] : [2.1, 1.55, 0.98, 0], 56 + i * 4); });
  UB.set([...S.flame, 1], 64); UB.set([0.1, 0.16, 0.34, 0], 68); UB.set([0.085, 0.1, 0.13, 0], 72); UB.set([0.04, 0.036, 0.034, 0], 76);
  UB.set([S.digitW, 0, 1 / SH0, 1 / SH1W], 84);
  gl.bindBuffer(gl.UNIFORM_BUFFER, ubo); gl.bufferData(gl.UNIFORM_BUFFER, UB, gl.DYNAMIC_DRAW); gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, ubo);

  // ---- camera poses ------------------------------------------------------------------
  const HOME = { e: [0.05, 1.7, 3.02], t: [0, 1.15, 0.3], f: 44 }, INTRO = { e: [3.7, 4.0, 7.8], t: [0.1, 1.05, 0.6], f: 30 };
  const focus = (o, d, sh) => ({ o, d, sh, f: 44 });
  const POSE = {
    education: focus([-0.52, 1.51, 0.17], [0.02, 0.06, 0.69], 0.25), honors: focus([-0.02, 1.5, 0.17], [-0.02, 0.06, 0.69], 0.25),
    research: focus([-0.07, 0.93, 0.565], [0, 0.31, 0.37], 0), barstow: focus([-0.2, 0.935, 0.55], [0, 0.23, 0.27], 0.135), mason: focus([-0.07, 0.935, 0.55], [0, 0.23, 0.27], 0.135), wolchok: focus([0.06, 0.935, 0.55], [0, 0.23, 0.27], 0.135),
    skills: focus([0.19, 0.985, 0.22], [0, 0.25, 0.68], 0.21), teaching: focus([0.918, 0.935, 0.512], [0, 0.535, 0.085], 0),
    publications: focus([-0.625, 0.88, 0.78], [0, 0.74, 0.77], 0.27), contact: focus([0.625, 0.88, 0.78], [0, 0.74, 0.77], -0.2), ack: focus([1.175, 0.88, 0.78], [0, 0.74, 0.77], -0.2),
  };
  const portrait = () => innerWidth / innerHeight < 1.15;
  const poseOf = id => {
    if (id === 'home' || id === 'intro') return HOME;
    const p = POSE[id], sh = portrait() ? 0 : p.sh, dy = portrait() && p.sh ? -0.09 : 0;
    return { e: [p.o[0] + p.d[0] + sh, p.o[1] + p.d[1] + dy, p.o[2] + p.d[2]], t: [p.o[0] + sh, p.o[1] + dy, p.o[2]], f: p.f };
  };
  const cam = { e: INTRO.e.slice(), t: INTRO.t.slice(), f: INTRO.f };
  let tr = null;
  const flyTo = (p, dur, soft) => { tr = { fe: cam.e.slice(), ft: cam.t.slice(), ff: cam.f, p, k: 0, dur: Math.max(dur, 0.001), soft }; };

  // ---- state ---------------------------------------------------------------------------
  const st = { view: 'intro', t: 0, hover: null, mx: 0, my: 0, px: 0, py: 0, hl: 0, fade: 0.9, pageT: 0, drawer: { publications: 0, contact: 0, ack: 0 }, lid: [0, 0, 0], pull: { education: 0, honors: 0 }, stir: 0, sig: -1 };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clickables = () => (st.view === 'home' ? HOME_IDS : SEC[st.view] && SEC[st.view].group ? SEC[st.view].group : []);
  const timers = [];
  const after = (sec, fn) => timers.push({ at: st.t + sec, fn });

  // ---- interface ------------------------------------------------------------------------
  const tagEl = {}, TAGOFF = { publications: 1, contact: 1, ack: 1, research: 1 }, TAGLEN = { education: 0.5, honors: 0.5, skills: 2.5, research: 1.9, teaching: 3.3, publications: 1.5, contact: 1.5, ack: 1.5 };
  for (const id in SEC) if (S.anchor[id]) {
    const b = document.createElement('button'); b.className = 'tag' + (TAGOFF[id] ? ' dn' : ''); b.style.setProperty('--c', SEC[id].c); b.style.setProperty('--len', (TAGLEN[id] || 1.2) + 'rem');
    b.innerHTML = `<i></i><span>${SEC[id].t}</span>`; b.setAttribute('aria-label', 'Open ' + SEC[id].t);
    b.onclick = () => go(id); b.onmouseenter = () => { st.hover = id; }; b.onmouseleave = () => { if (st.hover === id) st.hover = null; };
    $('tags').appendChild(b); tagEl[id] = b;
  }
  $('pgl').innerHTML = SEC.teaching.left; $('pgr').innerHTML = SEC.teaching.right;
  function refreshUI() {
    const v = st.view, s = SEC[v], list = clickables();
    for (const id in tagEl) { tagEl[id].classList.remove('on'); tagEl[id].tabIndex = -1; }
    $('panel').classList.remove('on'); $('nb').classList.remove('on'); $('hint').classList.remove('on');
    $('back').classList.toggle('on', v !== 'home' && v !== 'intro');
    $('back').textContent = s && s.parent ? '← Back to ' + SEC[s.parent].t.toLowerCase() : '← Back to the bench';
    document.body.dataset.view = v;
    const settle = v === 'home' ? 0.75 : 0.8;
    after(settle, () => {
      if (st.view !== v) return;
      list.forEach(id => { tagEl[id].classList.add('on'); tagEl[id].tabIndex = 0; });
      if (v === 'home' || (s && s.group)) { $('hint').textContent = v === 'home' ? 'Click a labelled item on the bench' : s.hint; $('hint').classList.add('on'); }
      if (s && s.html) {
        const p = $('panel'); p.className = 'on ' + (s.side === 'l' ? 'l' : 'r'); p.style.setProperty('--c', s.c);
        $('ptitle').textContent = s.h || s.t; $('pbody').innerHTML = s.html; p.scrollTop = 0;
      }
    });
    if (s && s.notebook) after(1.75, () => { if (st.view === v) $('nb').classList.add('on'); });
  }
  function go(id) { if (!SEC[id] || st.view === id || st.view === 'intro') return; st.view = id; st.hover = null; flyTo(poseOf(id), reduce ? 0 : 1.35); refreshUI(); if (PERF) lab.marks.push({ t: performance.now(), view: id }); }
  function back() { if (st.view === 'home' || st.view === 'intro') return; const p = SEC[st.view] && SEC[st.view].parent; st.view = p || 'home'; st.hover = null; flyTo(poseOf(st.view), reduce ? 0 : 1.25); refreshUI(); if (PERF) lab.marks.push({ t: performance.now(), view: st.view }); }
  function start() {
    if (st.view !== 'intro') return;
    $('ld').classList.add('gone'); st.view = 'home'; flyTo(HOME, reduce ? 0 : 3.8, true); document.body.dataset.view = 'home';
    after(reduce ? 0.1 : 3.3, () => { if (st.view === 'home') refreshUI(); });
    if (PERF) lab.marks.push({ t: performance.now(), view: 'intro-zoom' });
  }
  $('back').onclick = back; $('start').onclick = start; $('ftack').onclick = () => go('ack');
  addEventListener('keydown', e => { if (e.key === 'Escape') back(); });
  addEventListener('resize', () => { resize(); if (!tr && st.view !== 'intro') flyTo(poseOf(st.view), 0.3); });

  // ---- picking ---------------------------------------------------------------------------
  const vp = new Float32Array(16), ivp = new Float32Array(16), view = new Float32Array(16), proj = new Float32Array(16), eye = [0, 0, 0];
  function pickAt(cx, cy) {
    const r = canvas.getBoundingClientRect(), nx = ((cx - r.left) / r.width) * 2 - 1, ny = 1 - ((cy - r.top) / r.height) * 2;
    const a = m4.proj(ivp, [nx, ny, -1]), b = m4.proj(ivp, [nx, ny, 1]), d = vnorm(vsub(b, a));
    let best = null, bt = 1e9;
    for (const id of clickables()) {
      const bx = S.pick[id]; let t0 = 0, t1 = 1e9, off = [0, 0, 0];
      if (st.drawer[id] !== undefined) off = [0, 0, st.drawer[id] * 0.36];
      for (let i = 0; i < 3; i++) { const inv = 1 / (d[i] || 1e-9), u = (bx[0][i] + off[i] - 0.012 - a[i]) * inv, w = (bx[1][i] + off[i] + 0.012 - a[i]) * inv; t0 = Math.max(t0, Math.min(u, w)); t1 = Math.min(t1, Math.max(u, w)); }
      if (t0 <= t1 && t0 < bt) { bt = t0; best = id; }
    }
    return best;
  }
  canvas.addEventListener('pointermove', e => { st.mx = (e.clientX / innerWidth) * 2 - 1; st.my = (e.clientY / innerHeight) * 2 - 1; st.hover = pickAt(e.clientX, e.clientY); canvas.style.cursor = st.hover ? 'pointer' : ''; });
  canvas.addEventListener('pointerleave', () => { st.hover = null; });
  canvas.addEventListener('click', e => { if (e.button !== 0) return; const id = pickAt(e.clientX, e.clientY); if (id) go(id); else if (st.view !== 'home' && st.view !== 'intro') back(); });

  // ---- per-frame simulation ------------------------------------------------------------
  const tmpA = new Float32Array(16), tmpB = new Float32Array(16), right = [1, 0, 0], upv = [0, 1, 0];
  const setBone = (i, m) => bones.set(m, i * 16);
  const approach = (v, target, dt, rate) => v + (target - v) * (1 - Math.exp(-dt * rate));
  function update(dt) {
    st.t += dt;
    for (let i = timers.length - 1; i >= 0; i--) if (st.t >= timers[i].at) { const f = timers[i].fn; timers.splice(i, 1); f(); }
    if (tr) {
      tr.k = Math.min(tr.k + dt / tr.dur, 1); const k = tr.soft ? sstep(0, 1, tr.k) : easeIO(tr.k), p = tr.p;
      for (let i = 0; i < 3; i++) { cam.e[i] = lerp(tr.fe[i], p.e[i], k); cam.t[i] = lerp(tr.ft[i], p.t[i], k); }
      cam.f = lerp(tr.ff, p.f, k); if (tr.k >= 1) tr = null;
    }
    const v = st.view, moving = tr ? 1 : 0;
    st.fade = approach(st.fade, v === 'intro' ? 0.9 : 1, dt, 3);
    st.hl = approach(st.hl, moving || v === 'intro' ? 0 : 1, dt, moving ? 9 : 3.5);
    st.px = approach(st.px, st.mx + (v === 'home' ? Math.sin(st.t * 0.23) * 0.22 : 0), dt, 3); st.py = approach(st.py, st.my, dt, 3);
    for (const id in st.drawer) st.drawer[id] = approach(st.drawer[id], v === id ? 1 : 0, dt, 5.5);
    for (const id in st.pull) st.pull[id] = approach(st.pull[id], v === id ? 1 : 0, dt, 5);
    ['barstow', 'mason', 'wolchok'].forEach((id, i) => { st.lid[i] = approach(st.lid[i], v === id ? 1 : 0, dt, 4.2); });
    st.pageT = clamp(st.pageT + (v === 'teaching' ? dt : -dt * 1.3), 0, 1.5);
    st.stir += dt * 21;
    // bones
    setBone(BONE.PUB, m4.T(0, 0, st.drawer.publications * 0.36)); setBone(BONE.CONTACT, m4.T(0, 0, st.drawer.contact * 0.36)); setBone(BONE.ACK, m4.T(0, 0, st.drawer.ack * 0.36));
    setBone(BONE.EDU, m4.T(0, 0, st.pull.education * 0.065)); setBone(BONE.HON, m4.T(0, 0, st.pull.honors * 0.06));
    for (let i = 0; i < 3; i++) {
      const k = st.lid[i], x = S.plateX[i], y = BENCH_Y + 0.012, z = 0.575;
      setBone(BONE.LID0 + i, m4.X(m4.T(x, y + Math.sin(PI * k) * 0.05 - k * 0.0072, z - easeIO(k) * 0.118), m4.RX(-Math.sin(PI * k) * 0.55), m4.T(-x, -y, -z)));
    }
    setBone(BONE.STIR, m4.X(m4.T(S.stir[0], 0, S.stir[2]), m4.RY(st.stir), m4.T(-S.stir[0], 0, -S.stir[2])));
    const d = new Date(), sec = d.getSeconds() + (MANUAL ? 0 : d.getMilliseconds() / 1000), mn = d.getMinutes() + sec / 60, hr = (d.getHours() % 12) + mn / 60;
    [[BONE.HOUR, hr / 12], [BONE.MIN, mn / 60], [BONE.SEC, sec / 60]].forEach(([b, f]) => setBone(b, m4.X(m4.T(S.clock[0], S.clock[1], 0), m4.RZ(-f * TAU), m4.T(-S.clock[0], -S.clock[1], 0))));
    const left = Math.max(0, 899 - Math.floor(st.t)), mm = Math.floor(left / 60), ss = left % 60;
    UB[80] = Math.floor(mm / 10); UB[81] = mm % 10; UB[82] = Math.floor(ss / 10); UB[83] = ss % 10; UB[85] = st.t;
    UB[67] = 0.85 + 0.15 * Math.sin(st.t * 23) * Math.sin(st.t * 7.3);
  }

  // ---- rendering ----------------------------------------------------------------------------
  const useScene = (p, m, vw, e, tw, th, mir) => { gl.useProgram(p.p); gl.uniformMatrix4fv(p.u.uVP, false, m); if (p.u.uView) gl.uniformMatrix4fv(p.u.uView, false, vw); if (p.u.uCam) gl.uniform3fv(p.u.uCam, e); if (p.u.uRes) gl.uniform4f(p.u.uRes, 1 / tw, 1 / th, BENCH_Y + 0.0025, mir); };
  const draw = m => { gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_INT, 0); };
  const bind = (u, t) => { gl.activeTexture(gl.TEXTURE0 + u); gl.bindTexture(gl.TEXTURE_2D, t); };
  const fsPass = (p, fbo, w, h, t0, u4) => { gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.viewport(0, 0, w, h); gl.useProgram(p.p); bind(0, t0); if (u4) for (const k in u4) gl.uniform4fv(p.u[k], u4[k]); gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3); };
  const mirM = m4.X(m4.T(0, 2 * BENCH_Y, 0), m4.S(1, -1, 1)), viewR = new Float32Array(16), vpR = new Float32Array(16);
  const TQ = PERF ? gl.getExtension('EXT_disjoint_timer_query_webgl2') || gl.getExtension('EXT_disjoint_timer_query') : null, tq2 = TQ && !TQ.createQueryEXT, pending = [];
  lab.timer = TQ ? (tq2 ? 'EXT_disjoint_timer_query_webgl2' : 'EXT_disjoint_timer_query') : null;
  if (TQ) lab.timerBits = { elapsed: tq2 ? gl.getQuery(0x88BF, 0x8864) : TQ.getQueryEXT(0x88BF, 0x8864), timestamp: tq2 ? gl.getQuery(0x8E28, 0x8864) : TQ.getQueryEXT(0x8E28, 0x8864) };
  let pagesSig = -1, frameNo = 0, staticDone = false;
  const invView = new Float32Array(16);
  // ?prof: one timer query per render stage instead of one per frame
  const PROF = TQ && Q.has('prof'), profOpen = [], prof = (lab.prof = {});
  let stageQ = null;
  const stage = name => { if (!PROF) return; if (stageQ) { tq2 ? gl.endQuery(0x88BF) : TQ.endQueryEXT(0x88BF); profOpen.push(stageQ); stageQ = null; }
    if (name) { const q = tq2 ? gl.createQuery() : TQ.createQueryEXT(); tq2 ? gl.beginQuery(0x88BF, q) : TQ.beginQueryEXT(0x88BF, q); stageQ = { q, name }; } };
  const profPoll = () => { for (let i = profOpen.length - 1; i >= 0; i--) { const p = profOpen[i]; if (!(tq2 ? gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE) : TQ.getQueryObjectEXT(p.q, 0x8867))) continue;
    (prof[p.name] = prof[p.name] || []).push((tq2 ? gl.getQueryParameter(p.q, gl.QUERY_RESULT) : TQ.getQueryObjectEXT(p.q, 0x8866)) / 1e6); tq2 ? gl.deleteQuery(p.q) : TQ.deleteQueryEXT(p.q); profOpen.splice(i, 1); } };

  function render() {
    // camera
    const asp = W / H, fov = Math.min(2 * Math.atan(Math.tan(cam.f * DEG / 2) * Math.max(1, (16 / 9) / asp)), 1.75);
    const fw = vnorm(vsub(cam.t, cam.e)), rt = vnorm(vcross(fw, [0, 1, 0])), up2 = vcross(rt, fw);
    const amp = st.view === 'home' || st.view === 'intro' ? 0.075 : st.view === 'teaching' ? 0 : 0.022, k = reduce ? 0 : amp * (tr ? 1 - Math.sin(tr.k * PI) * 0.6 : 1);
    for (let i = 0; i < 3; i++) eye[i] = cam.e[i] + rt[i] * st.px * k - up2[i] * st.py * k * 0.5;
    m4.look(eye, cam.t, [0, 1, 0], view); m4.persp(fov, asp, 0.08, 60, proj); m4.mul(proj, view, vp); m4.inv(vp, ivp);
    m4.mul(view, mirM, viewR); m4.mul(proj, viewR, vpR);
    const eyeR = [eye[0], 2 * BENCH_Y - eye[1], eye[2]];
    // flipping pages
    const pf = [0, 1, 2].map(i => easeIO(clamp((st.pageT - i * 0.2) / 0.9)));
    const ps = Math.round((pf[0] + pf[1] * 3 + pf[2] * 7) * 4000);
    if (ps !== pagesSig) { pagesSig = ps; gl.bindBuffer(gl.ARRAY_BUFFER, mP.vb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, buildPages(S, pf).pack().buf); }
    gl.bindBuffer(gl.UNIFORM_BUFFER, ubo); gl.bufferSubData(gl.UNIFORM_BUFFER, 0, UB);
    let q = null;
    if (TQ && !PROF) { q = tq2 ? gl.createQuery() : TQ.createQueryEXT(); tq2 ? gl.beginQuery(0x88BF, q) : TQ.beginQueryEXT(0x88BF, q); }
    stage('shadow');
    bind(0, atlasTex); bind(1, noiseTex); bind(2, sh0); bind(3, sh1); bind(4, dummy); bind(5, dummy); bind(6, dummy);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.frontFace(gl.CCW);

    // 1. shadow maps (only when something that casts a shadow has moved)
    const sig = Math.round((st.drawer.publications + st.drawer.contact * 3 + st.drawer.ack * 5 + st.pull.education * 7 + st.pull.honors * 11 + st.lid[0] * 13 + st.lid[1] * 17 + st.lid[2] * 19) * 3000) + ps * 31;
    if (sig !== st.sig) {
      st.sig = sig; gl.disable(gl.CULL_FACE); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5, 3); gl.useProgram(pDepth.p);
      bind(2, dummy); bind(3, dummy);
      for (const [fbo, sfbo, w, h, m] of [[sh0F, sh0SF, SH0, SH0, shM0], [sh1F, sh1SF, SH1W, SH1H, shM1]]) {
        gl.viewport(0, 0, w, h); gl.uniformMatrix4fv(pDepth.u.uVP, false, m);
        if (!staticDone) { gl.bindFramebuffer(gl.FRAMEBUFFER, sfbo); gl.clear(gl.DEPTH_BUFFER_BIT); gl.uniform1f(pDepth.u.uBoneSel, 1); gl.uniform1f(pDepth.u.uDither, 0); draw(mO); draw(mL); gl.uniform1f(pDepth.u.uDither, 1); draw(mG); }
        gl.bindFramebuffer(gl.READ_FRAMEBUFFER, sfbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, fbo); gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo); gl.uniform1f(pDepth.u.uBoneSel, 2); gl.uniform1f(pDepth.u.uDither, 0); draw(mO); draw(mL); gl.uniform1f(pDepth.u.uDither, 1); draw(mG);
        gl.uniform1f(pDepth.u.uBoneSel, 0); gl.uniform1f(pDepth.u.uDither, 0); draw(mP);
      }
      staticDone = true;
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.enable(gl.CULL_FACE); bind(2, sh0); bind(3, sh1);
    }
    stage('prepass');
    // 2. half-res opaque pre-pass: depth for AO, colour for refraction
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.preF); gl.viewport(0, 0, aw, ah); gl.clearColor(0.012, 0.02, 0.03, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    useScene(pOpaqueLo, vp, view, eye, aw, ah, 2); draw(mO); draw(mP);
    stage('ssao');
    // 3. ambient occlusion
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    const ty = Math.tan(fov / 2);
    m4.inv(view, invView); gl.useProgram(pSsao.p); gl.uniformMatrix4fv(pSsao.u.uInvView, false, invView);
    fsPass(pSsao, T.aoAF, aw, ah, T.preD, { uProj: [ty * asp, ty, 0.08, 60], uTex: [1 / aw, 1 / ah, 0, 0] });
    fsPass(pAoBlur, T.aoBF, aw, ah, T.aoA, { uDir: [1 / aw, 0, 0, 0] }); fsPass(pAoBlur, T.aoAF, aw, ah, T.aoB, { uDir: [0, 1 / ah, 0, 0] });
    stage('reflection');
    // 4. mirrored half-res pass for the bench-top reflection
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.frontFace(gl.CW); bind(0, atlasTex);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.reflF); gl.viewport(0, 0, hw, hh); gl.clearColor(0.006, 0.01, 0.015, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    useScene(pOpaqueLo, vpR, viewR, eyeR, hw, hh, 1); draw(mO); draw(mP);
    useScene(pLiquidLo, vpR, viewR, eyeR, hw, hh, 1); draw(mL);
    gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.SRC_ALPHA, gl.ZERO, gl.ONE); gl.depthMask(false);
    useScene(pGlassLo, vpR, viewR, eyeR, hw, hh, 1); draw(mG);
    gl.blendFunc(gl.ONE, gl.ONE); gl.useProgram(pFx.p); gl.uniformMatrix4fv(pFx.u.uVP, false, vpR); gl.uniform3fv(pFx.u.uCam, eyeR); draw(mF);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.enable(gl.CULL_FACE); gl.frontFace(gl.CCW);
    bind(5, T.refl); gl.generateMipmap(gl.TEXTURE_2D);
    stage('main-opaque');
    // 5. main pass (multisampled, HDR)
    bind(4, T.aoA); bind(6, T.pre);
    gl.bindFramebuffer(gl.FRAMEBUFFER, T.msF); gl.viewport(0, 0, W, H); gl.clear(gl.DEPTH_BUFFER_BIT);
    useScene(pOpaque, vp, view, eye, W, H, 0); draw(mO); draw(mP);
    gl.depthRange(1, 1); gl.depthMask(false); gl.useProgram(pBg.p); gl.uniform4f(pBg.u.uP, asp, 0, 0, 0); gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.depthRange(0, 1); gl.depthMask(true);
    stage('main-transparent');
    useScene(pLiquid, vp, view, eye, W, H, 0); draw(mL);
    gl.disable(gl.CULL_FACE); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.SRC_ALPHA, gl.ZERO, gl.ONE); gl.depthMask(false);
    useScene(pGlass, vp, view, eye, W, H, 0); draw(mG);
    gl.blendFunc(gl.ONE, gl.ONE); gl.useProgram(pFx.p); gl.uniformMatrix4fv(pFx.u.uVP, false, vp); gl.uniform3fv(pFx.u.uCam, eye); draw(mF);
    gl.useProgram(pMote.p); gl.uniformMatrix4fv(pMote.u.uVP, false, vp); gl.uniform4f(pMote.u.uRes, 1 / W, 1 / H, 0, 0); gl.bindVertexArray(moteVao); gl.drawArrays(gl.POINTS, 0, S.motes.length / 5);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.disable(gl.DEPTH_TEST);
    stage('resolve');
    if (SAMPLES > 1) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, T.msF); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, T.sceneF); gl.blitFramebuffer(0, 0, W, H, 0, 0, W, H, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.invalidateFramebuffer(gl.READ_FRAMEBUFFER, [gl.COLOR_ATTACHMENT0, gl.DEPTH_ATTACHMENT]);
    }
    stage('mask');
    // 6. highlight mask for clickable objects
    const list = st.hl > 0.01 ? clickables() : [];
    if (list.length) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.maskF); gl.viewport(0, 0, hw, hh); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(pMask.p); gl.uniformMatrix4fv(pMask.u.uVP, false, vp);
      for (const id of list) {
        const c = hex(SEC[id].c), a = st.hl * (st.hover === id ? 1 : 0.64 + 0.2 * Math.sin(st.t * 2.2 + id.length));
        gl.uniform4f(pMask.u.uMaskCol, Math.pow(c[0], 2.2) * a, Math.pow(c[1], 2.2) * a, Math.pow(c[2], 2.2) * a, a);
        for (const part of S.objs[id].parts || [id]) { const o = S.objs[part];
          for (const [m, r] of [[mO, o.o], [mG, o.g], [mL, o.l]]) if (r[1]) { gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, r[1], gl.UNSIGNED_INT, r[0] * 4); } }
      }
      fsPass(pMBlur, T.maskTF, hw, hh, T.mask, { uDir: [1 / hw, 0, 0, 0] }); fsPass(pMBlur, T.maskBF, hw, hh, T.maskT, { uDir: [0, 1 / hh, 0, 0] });
    }
    stage('bloom');
    // 7. bloom
    const B = T.bloom;
    fsPass(pDown, B[0].f, B[0].w, B[0].h, T.scene, { uDir: [2 / W, 2 / H, 1.05, 0] });
    for (let i = 1; i < B.length; i++) fsPass(pDown, B[i].f, B[i].w, B[i].h, B[i - 1].t, { uDir: [1 / B[i - 1].w, 1 / B[i - 1].h, 0, 0] });
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = B.length - 2; i >= 0; i--) fsPass(pUp, B[i].f, B[i].w, B[i].h, B[i + 1].t, { uDir: [1 / B[i + 1].w, 1 / B[i + 1].h, 0.9, 0] });
    gl.disable(gl.BLEND);
    stage('composite');
    // 8. composite to the canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.useProgram(pComp.p);
    bind(0, T.scene); bind(1, B[0].t); bind(2, list.length ? T.mask : dummy); bind(3, list.length ? T.maskB : dummy);
    gl.uniform1i(pComp.u.uScene, 0); gl.uniform1i(pComp.u.uBloom, 1); gl.uniform1i(pComp.u.uMask, 2); gl.uniform1i(pComp.u.uMaskB, 3);
    gl.uniform4f(pComp.u.uP, 1.0, 0.055, list.length ? 1.25 : 0, MANUAL ? 0 : (frameNo % 97) * 1.7); gl.uniform4f(pComp.u.uQ, st.fade, 1.05, 0, 0);
    gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (list.length === 0) { bind(2, dummy); bind(3, dummy); }
    stage(null);
    if (TQ && !PROF) { tq2 ? gl.endQuery(0x88BF) : TQ.endQueryEXT(0x88BF); pending.push({ q, i: frameNo }); }
    if (PROF) profPoll();
    frameNo++;
  }
  function pollQueries() {
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i], ok = tq2 ? gl.getQueryParameter(p.q, gl.QUERY_RESULT_AVAILABLE) : TQ.getQueryObjectEXT(p.q, 0x8867);
      if (!ok) continue;
      const ns = tq2 ? gl.getQueryParameter(p.q, gl.QUERY_RESULT) : TQ.getQueryObjectEXT(p.q, 0x8866), dis = gl.getParameter(0x8FBB);
      const f = lab.frames[p.i]; if (f) f.gpu = dis ? null : ns / 1e6;
      tq2 ? gl.deleteQuery(p.q) : TQ.deleteQueryEXT(p.q); pending.splice(i, 1);
    }
  }

  // ---- overlays that follow the 3D scene ------------------------------------------------------
  const nbEl = $('nb'), NW = 1060, NH = 698;
  function homography(src, dst) { // 4 point pairs -> css matrix3d
    const A = [], b = [];
    for (let i = 0; i < 4; i++) { const [x, y] = src[i], [u, v] = dst[i]; A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u); A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v); }
    for (let c = 0; c < 8; c++) { let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r; [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; } }
    const h = b.map((v, i) => v / A[i][i]);
    return `matrix3d(${h[0]},${h[3]},0,${h[6]},${h[1]},${h[4]},0,${h[7]},0,0,1,0,${h[2]},${h[5]},0,1)`;
  }
  function overlays() {
    const cw = innerWidth, ch = innerHeight, list = clickables();
    for (const id of list) {
      const a = S.anchor[id], off = st.drawer[id] !== undefined ? st.drawer[id] * 0.36 : 0, p = m4.proj(vp, [a[0], a[1], a[2] + off]);
      tagEl[id].style.transform = p[3] > 0 ? `translate3d(${((p[0] + 1) / 2 * cw).toFixed(1)}px,${((1 - p[1]) / 2 * ch).toFixed(1)}px,0)` : 'translate3d(-999px,0,0)';
      tagEl[id].classList.toggle('hv', st.hover === id);
    }
    if (st.view === 'teaching') {
      const NB = NOTEBOOK, y = 0.0125, c = [[-NB.W, y, -NB.D / 2], [NB.W, y, -NB.D / 2], [NB.W, y, NB.D / 2], [-NB.W, y, NB.D / 2]].map(q => { const p = m4.proj(vp, m4.pt(S.NM, q)); return [(p[0] + 1) / 2 * cw, (1 - p[1]) / 2 * ch]; });
      nbEl.style.transform = homography([[0, 0], [NW, 0], [NW, NH], [0, NH]], c);
    }
  }

  // ---- main loop ----------------------------------------------------------------------------------
  let last = 0;
  function tick(dt, now, raw) {
    const c0 = performance.now(); update(dt); render(); overlays();
    if (PERF) { lab.frames.push({ t: now, raf: raw, cpu: performance.now() - c0, gpu: undefined, view: st.view, moving: tr ? 1 : 0 }); pollQueries(); }
  }
  function loop(now) { requestAnimationFrame(loop); const raw = now - last; last = now; tick(Math.min(raw / 1000, 0.05), now, raw); }
  resize(); refreshUI(); document.body.dataset.view = 'intro';
  if (MANUAL) document.body.classList.add('manual');
  tick(0, 0, 0);
  progress(1); await yieldUI();
  $('ld').classList.add('ready');
  Object.assign(lab, { ready: true, go, back, start, st, cam, step: ms => tick(ms / 1000, performance.now(), ms), size: () => [W, H, SAMPLES], pose: (e, t, f) => { tr = null; cam.e = e; cam.t = t; cam.f = f; } });
  if (!MANUAL) { last = performance.now(); requestAnimationFrame(loop); }
  if (Q.has('autostart')) start();
}
init().catch(e => { lab.errors.push(String(e) + ' | ' + String(e && e.stack || '')); console.error(e); if (!lab.ready) fallback(); });
