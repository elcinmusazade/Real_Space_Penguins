/**
 * 3D spacecraft built from the chosen parts, drawn on a canvas. View only.
 * Drag (or arrow keys) to rotate, double-click to reset. Hovering a part names it;
 * clicking it calls onPick(slot). The part that just changed pops in with a highlight.
 */

const DEFAULT_VIEW = {yaw: -0.65, pitch: 0.32};
// Shared across re-renders so the angle survives every Shipyard refresh.
const view = {...DEFAULT_VIEW, spin: true, drag: null, version: 0};
const touch = () => { view.version++; };

const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- mesh building
function mesh() { return {faces: [], lines: []}; }
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const centroid = pts => pts.reduce((s, p) => add(s, p), [0, 0, 0]).map(v => v / pts.length);

// Faces get an outward normal relative to the primitive's centre, so winding never matters.
function face(m, pts, color, slot, centre, opts = {}) {
  let n = norm(cross(sub(pts[1], pts[0]), sub(pts[2], pts[0])));
  if (centre && dot(n, sub(centroid(pts), centre)) < 0) n = n.map(v => -v);
  m.faces.push({pts, n, color, slot, double: !centre || opts.double, glow: opts.glow, alpha: opts.alpha ?? 1});
}

function box(m, [x, y, z], [w, d, h], color, slot, opts) {
  const c = [x, y, z + h / 2], X = [x - w / 2, x + w / 2], Y = [y - d / 2, y + d / 2], Z = [z, z + h];
  const v = (i, j, k) => [X[i], Y[j], Z[k]];
  [[v(0, 0, 1), v(1, 0, 1), v(1, 1, 1), v(0, 1, 1)], [v(0, 0, 0), v(1, 0, 0), v(1, 1, 0), v(0, 1, 0)],
   [v(0, 0, 0), v(1, 0, 0), v(1, 0, 1), v(0, 0, 1)], [v(0, 1, 0), v(1, 1, 0), v(1, 1, 1), v(0, 1, 1)],
   [v(0, 0, 0), v(0, 1, 0), v(0, 1, 1), v(0, 0, 1)], [v(1, 0, 0), v(1, 1, 0), v(1, 1, 1), v(1, 0, 1)]]
    .forEach(p => face(m, p, color, slot, c, opts));
}

// Cylinder or cone frustum along z. open = no caps (and double-sided, for dishes).
function cyl(m, [x, y], z0, z1, r0, r1, seg, color, slot, opts = {}) {
  const c = [x, y, (z0 + z1) / 2], ring = (r, z) => Array.from({length: seg}, (_, i) => {
    const a = i / seg * Math.PI * 2 + (opts.turn || 0); return [x + Math.cos(a) * r, y + Math.sin(a) * r, z];
  });
  const lo = ring(r0, z0), hi = ring(r1, z1), o = opts.open ? {...opts, double: true} : opts;
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg;
    face(m, [lo[i], lo[j], hi[j], hi[i]], color, slot, opts.open ? null : c, o);
  }
  if (!opts.open) {
    if (r0 > 0.01) face(m, lo, opts.capColor || color, slot, c, opts);
    if (r1 > 0.01) face(m, hi, opts.capColor || color, slot, c, opts);
  }
}

function sphere(m, [x, y, z], r, color, slot, opts) {
  const lat = 6, lon = 10, c = [x, y, z];
  const p = (i, j) => { const t = i / lat * Math.PI, f = j / lon * Math.PI * 2; return [x + r * Math.sin(t) * Math.cos(f), y + r * Math.sin(t) * Math.sin(f), z + r * Math.cos(t)]; };
  for (let i = 0; i < lat; i++) for (let j = 0; j < lon; j++) {
    const pts = [p(i, j), p(i + 1, j), p(i + 1, j + 1), p(i, j + 1)];
    face(m, i === 0 ? [pts[0], pts[1], pts[2]] : i === lat - 1 ? [pts[0], pts[1], pts[3]] : pts, color, slot, c, opts);
  }
}

function line(m, a, b, color, width, slot) { m.lines.push({a, b, color, width, slot}); }
function hoop(m, [x, y], z, r, color, width, slot) {
  const seg = 16;
  for (let i = 0; i < seg; i++) {
    const a = i / seg * Math.PI * 2, b = (i + 1) / seg * Math.PI * 2;
    line(m, [x + Math.cos(a) * r, y + Math.sin(a) * r, z], [x + Math.cos(b) * r, y + Math.sin(b) * r, z], color, width, slot);
  }
}

const C = {
  hull: [150, 172, 188], deck: [190, 206, 216], tank: [205, 214, 222], nozzle: [74, 84, 96], ion: [111, 183, 255],
  panel: [38, 72, 132], cell: [130, 180, 255], rtg: [176, 136, 82], battery: [104, 160, 122], radiator: [226, 234, 240],
  gold: [222, 176, 78], shield: [66, 80, 92], heat: [120, 70, 46], strut: [196, 210, 220], chute: [242, 232, 214],
  float: [236, 242, 246], ring: [233, 171, 123], dish: [232, 238, 244], beacon: [135, 207, 206],
};
const MODULE = {survey: [135, 207, 206], lab: [233, 171, 123], habitat: [214, 222, 160], shield: [120, 140, 160], relay: [170, 150, 220], cargo: [190, 160, 120]};

function buildShip({parts, hull, engine, payload, propellantKg}) {
  const m = mesh(), s = hull === 'freighter' ? 1.2 : hull === 'scout' ? 0.85 : 1;
  const R = 12 * s, H = 30 * s, tankH = Math.min(26, 6 + (propellantKg || 0) / 220);

  // Core: body, top deck, propellant tank, engine.
  cyl(m, [0, 0], 0, H, R, R, 8, C.hull, 'body', {turn: Math.PI / 8});
  cyl(m, [0, 0], H, H + 5, R, R * 0.6, 8, C.deck, 'body', {turn: Math.PI / 8});
  cyl(m, [0, 0], -tankH, 0, R * 0.8, R * 0.8, 10, C.tank, 'tank');
  const zE = -tankH;
  if (engine === 'ion') {
    cyl(m, [0, 0], zE - 4, zE, 7, 6, 10, C.nozzle, 'engine');
    cyl(m, [0, 0], zE - 4.6, zE - 4, 6.4, 6.4, 10, C.ion, 'engine', {glow: true});
  } else {
    const big = engine === 'high_thrust';
    cyl(m, [0, 0], zE - (big ? 15 : 12), zE, big ? 10 : 7.5, big ? 4 : 3.2, 12, C.nozzle, 'engine', {open: true});
  }

  // Payload modules around the upper body.
  (payload || []).slice(0, 4).forEach((id, i) => {
    const a = Math.PI / 4 + i * Math.PI / 2;
    box(m, [Math.cos(a) * (R + 3), Math.sin(a) * (R + 3), H * 0.5], [8, 8, 9], MODULE[id] || C.ring, 'payload');
  });

  // Power.
  const p = parts.power;
  if (p.startsWith('solar')) {
    const span = {solar_s: 26, solar_m: 42, solar_l: 62}[p] || 42;
    for (const dir of [-1, 1]) {
      const x0 = dir * (R + 6), xc = x0 + dir * span / 2;
      line(m, [dir * R, 0, H * 0.55], [x0, 0, H * 0.55], C.strut, 2, 'power');
      box(m, [xc, 0, H * 0.25], [span, 1, H * 0.6], C.panel, 'power');
      for (let k = 1; k < 4; k++) {
        const x = x0 + dir * span * k / 4;
        for (const yy of [-0.65, 0.65]) line(m, [x, yy, H * 0.25], [x, yy, H * 0.85], C.cell, 0.8, 'power');
      }
      for (const yy of [-0.65, 0.65]) line(m, [x0, yy, H * 0.55], [x0 + dir * span, yy, H * 0.55], C.cell, 0.8, 'power');
    }
  } else if (p === 'rtg') {
    line(m, [0, -R, H * 0.4], [0, -R - 14, H * 0.4], C.strut, 2, 'power');
    cyl(m, [0, -R - 16], H * 0.15, H * 0.65, 3.6, 3.6, 8, C.rtg, 'power');
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      box(m, [Math.cos(a) * 5.5, -R - 16 + Math.sin(a) * 5.5, H * 0.18], [Math.abs(Math.cos(a)) * 4 + 0.8, Math.abs(Math.sin(a)) * 4 + 0.8, H * 0.44], C.rtg, 'power');
    }
  } else {
    box(m, [0, -R - 5, H * 0.2], [12, 8, 10], C.battery, 'power');
  }

  // Thermal.
  if (parts.thermal === 'radiators') {
    for (const dir of [-1, 1]) box(m, [0, dir * (R + 12), H * 0.3], [1.2, 18, H * 0.6], C.radiator, 'thermal');
  } else if (parts.thermal === 'insulated') {
    cyl(m, [0, 0], 1, H - 1, R + 0.7, R + 0.7, 8, C.gold, 'thermal', {turn: Math.PI / 8, alpha: 0.92});
  }

  // Shielding.
  if (parts.shielding !== 'none') {
    const heavy = parts.shielding === 'heavy';
    cyl(m, [0, 0], heavy ? -1 : 2, heavy ? H * 0.75 : H * 0.5, R + (heavy ? 2 : 1.3), R + (heavy ? 2 : 1.3), 8, C.shield, 'shielding', {turn: Math.PI / 8, alpha: heavy ? 1 : 0.85});
  }

  // Structure.
  if (parts.structure === 'pressure') {
    [0.2, 0.5, 0.8].forEach(f => hoop(m, [0, 0], H * f, R + 2.6, C.ring, 3, 'structure'));
  }

  // Entry.
  const zLow = zE - 13;
  if (parts.entry === 'parachute') {
    cyl(m, [-4, -3], H + 5, H + 11, 3.6, 3, 8, C.chute, 'entry');
  } else if (parts.entry === 'rockets') {
    cyl(m, [0, 0], -1.5, 0, R + 3, R + 3, 12, C.heat, 'entry');
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + k * Math.PI / 2, foot = [Math.cos(a) * (R + 12), Math.sin(a) * (R + 12), zLow];
      line(m, [Math.cos(a) * R, Math.sin(a) * R, H * 0.15], foot, C.strut, 2.2, 'entry');
      cyl(m, [foot[0], foot[1]], zLow - 1, zLow, 3, 3, 8, C.strut, 'entry');
    }
  } else if (parts.entry === 'floats') {
    sphere(m, [0, 0, H + 30], 15, C.float, 'entry');
    for (const [x, y] of [[R * .6, R * .6], [-R * .6, R * .6], [R * .6, -R * .6], [-R * .6, -R * .6]]) {
      line(m, [x, y, H + 4], [x * 0.7, y * 0.7, H + 18], C.strut, 1, 'entry');
    }
  }

  // Comms.
  const top = H + 5, at = parts.entry === 'parachute' ? [5, 4] : [0, 0];
  if (parts.comms === 'dish') {
    line(m, [...at, top], [...at, top + 9], C.strut, 2, 'comms');
    cyl(m, at, top + 8, top + 12, 1.2, 13, 14, C.dish, 'comms', {open: true});
  } else if (parts.comms === 'relay') {
    line(m, [...at, top], [...at, top + 18], C.strut, 2, 'comms');
    sphere(m, [...at, top + 19], 2.6, C.beacon, 'comms', {glow: true});
    cyl(m, at, top + 6, top + 8, 0.8, 5, 10, C.dish, 'comms', {open: true});
  } else {
    line(m, [...at, top], [...at, top + 5], C.strut, 1.6, 'comms');
    cyl(m, at, top + 5, top + 7, 0.8, 5, 10, C.dish, 'comms', {open: true});
  }
  return m;
}

// ---------------------------------------------------------------- rendering
function rotate([x, y, z], yaw, pitch) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const x1 = x * cy - y * sy, y1 = x * sy + y * cy;
  return [x1, y1 * cp - z * sp, y1 * sp + z * cp];
}

const LIGHT = norm([-0.45, -0.75, 0.6]);
const shade = (rgb, k) => `rgb(${rgb.map(v => Math.round(Math.min(255, v * k))).join(',')})`;
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const HIGHLIGHT = [255, 196, 140];

function pointIn(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Mount on a canvas. Returns {destroy}. ship: {parts, hull, engine, payload, propellantKg, names, changed, changedAt}. */
export function mountShip3d(canvas, ship, onPick) {
  const ctx = canvas.getContext('2d');
  const model = buildShip(ship);
  const all = [...model.faces.flatMap(f => f.pts), ...model.lines.flatMap(l => [l.a, l.b])];
  const lo = [0, 1, 2].map(i => Math.min(...all.map(p => p[i]))), hi = [0, 1, 2].map(i => Math.max(...all.map(p => p[i])));
  const mid = lo.map((v, i) => (v + hi[i]) / 2);
  const radius = Math.max(...all.map(p => Math.hypot(...sub(p, mid))));
  const groups = {};
  for (const f of model.faces) (groups[f.slot] ||= []).push(...f.pts);
  const groupMid = Object.fromEntries(Object.entries(groups).map(([k, pts]) => [k, centroid(pts)]));
  const controller = new AbortController(), on = (el, ev, fn, o) => el.addEventListener(ev, fn, {signal: controller.signal, ...o});
  let frame = null, hover = null, drawn = [], size = {w: 0, h: 0}, seen = -1, animating = true;

  const resize = () => {
    const dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); size = {w, h}; draw(performance.now());
  };
  const observer = new ResizeObserver(resize); observer.observe(canvas); resize();

  function draw(now) {
    const {w, h} = size; if (!w) return;
    seen = view.version;
    const age = ship.changed ? (now - ship.changedAt) / 900 : 1, pop = Math.min(1, Math.max(0, age));
    const scale = Math.min(w, h) * 0.46 / radius, D = radius * 4.5;
    const project = q => { const k = D / (q[1] + D) * scale; return [w / 2 + q[0] * k, h / 2 - q[2] * k]; };
    const place = (p, slot) => {
      let q = sub(p, mid);
      if (slot === ship.changed && pop < 1) {
        const c = sub(groupMid[slot] || mid, mid), e = 1 + 2.2 * Math.pow(pop - 1, 3) + 1.2 * Math.pow(pop - 1, 2), k = 0.55 + 0.45 * e;
        q = add(c, sub(q, c).map(v => v * k));
      }
      return rotate(q, view.yaw, view.pitch);
    };
    ctx.clearRect(0, 0, w, h);

    // Floor rings under the ship.
    const floor = lo[2] - mid[2] - 3;
    for (const [r, a] of [[radius * 0.55, 0.35], [radius * 0.85, 0.18]]) {
      ctx.beginPath();
      for (let i = 0; i <= 48; i++) {
        const t = i / 48 * Math.PI * 2, [x, y] = project(rotate([Math.cos(t) * r, Math.sin(t) * r, floor], view.yaw, view.pitch));
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = `rgba(135,207,206,${a})`; ctx.lineWidth = 1; ctx.stroke();
    }

    const items = [];
    for (const f of model.faces) {
      const q = f.pts.map(p => place(p, f.slot)), c = centroid(q);
      let n = rotate(f.n, view.yaw, view.pitch);
      const facing = dot(n, sub(c, [0, -D, 0])) < 0;
      if (!facing) { if (!f.double) continue; n = n.map(v => -v); }
      items.push({kind: 'face', f, q, depth: c[1], n});
    }
    for (const l of model.lines) {
      const a = place(l.a, l.slot), b = place(l.b, l.slot);
      items.push({kind: 'line', l, a, b, depth: (a[1] + b[1]) / 2 - 0.5});
    }
    items.sort((a, b) => b.depth - a.depth);
    drawn = [];
    for (const it of items) {
      const slot = it.kind === 'face' ? it.f.slot : it.l.slot;
      const flash = slot === ship.changed && pop < 1 ? (1 - pop) * 0.7 : 0, lit = slot === hover && slot in (ship.names || {}) ? 1.18 : 1;
      if (it.kind === 'face') {
        const base = flash ? mix(it.f.color, HIGHLIGHT, flash) : it.f.color;
        const k = it.f.glow ? 1.1 : (0.34 + 0.72 * Math.max(0, dot(it.n, LIGHT))) * lit;
        const pts = it.q.map(project);
        ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath();
        ctx.globalAlpha = it.f.alpha; ctx.fillStyle = shade(base, k); ctx.fill();
        ctx.strokeStyle = shade(base, k * 0.8); ctx.lineWidth = 0.6; ctx.stroke(); ctx.globalAlpha = 1;
        drawn.push({slot, pts});
      } else {
        const [ax, ay] = project(it.a), [bx, by] = project(it.b);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
        ctx.strokeStyle = shade(flash ? mix(it.l.color, HIGHLIGHT, flash) : it.l.color, lit);
        ctx.lineWidth = it.l.width * scale * 0.55; ctx.lineCap = 'round'; ctx.stroke();
      }
    }
    animating = pop < 1;
  }

  function tick(now) {
    if (view.spin && !view.drag && !reduceMotion()) { view.yaw += 0.0035; touch(); }
    if (animating || seen !== view.version) draw(now);
    frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);

  const pick = event => {
    const r = canvas.getBoundingClientRect(), x = event.clientX - r.left, y = event.clientY - r.top;
    for (let i = drawn.length - 1; i >= 0; i--) if (pointIn(drawn[i].pts, x, y)) return drawn[i].slot;
    return null;
  };
  on(canvas, 'pointerdown', event => {
    if (event.button !== 0) return;
    view.drag = {x: event.clientX, y: event.clientY, yaw: view.yaw, pitch: view.pitch, moved: false};
    view.spin = false;
    canvas.setPointerCapture?.(event.pointerId);
    canvas.classList.add('is-dragging');
  });
  on(window, 'pointermove', event => {
    if (view.drag) {
      const dx = event.clientX - view.drag.x, dy = event.clientY - view.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) view.drag.moved = true;
      view.yaw = view.drag.yaw - dx * 0.01;
      view.pitch = Math.max(-1.2, Math.min(1.35, view.drag.pitch + dy * 0.008));
      touch();
      return;
    }
    if (event.target !== canvas) { if (hover) { hover = null; touch(); } return; }
    const slot = pick(event), named = slot && ship.names?.[slot];
    if (slot !== hover) { hover = slot; touch(); }
    canvas.title = named ? `${named} — click to change` : 'Drag to rotate · double-click to reset';
    canvas.style.cursor = named ? 'pointer' : '';
  });
  on(window, 'pointerup', event => {
    if (!view.drag) return;
    const clicked = !view.drag.moved;
    view.drag = null; canvas.classList.remove('is-dragging');
    if (clicked && event.target === canvas) { const slot = pick(event); if (slot && ship.names?.[slot]) onPick?.(slot); }
  });
  on(canvas, 'dblclick', () => { Object.assign(view, DEFAULT_VIEW); touch(); });
  on(canvas, 'keydown', event => {
    const step = {ArrowLeft: [0.15, 0], ArrowRight: [-0.15, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1]}[event.key];
    if (!step) return;
    event.preventDefault(); view.spin = false;
    view.yaw += step[0]; view.pitch = Math.max(-1.2, Math.min(1.35, view.pitch + step[1])); touch();
  });
  return {destroy() { cancelAnimationFrame(frame); observer.disconnect(); controller.abort(); }};
}
