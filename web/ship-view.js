/**
 * Isometric spacecraft drawing built from the chosen parts. View only.
 * Every slot draws its own group; the slot that just changed gets `is-new` so it animates in.
 */

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Isometric box: x right-down, y left-down, z up. Returns three faces.
function box(x, y, z, w, d, h, tone) {
  const P = (px, py, pz) => [(px - py) * 0.866, (px + py) * 0.5 - pz];
  const pts = a => a.map(p => P(...p).map(n => n.toFixed(1)).join(',')).join(' ');
  const top = pts([[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]]);
  const left = pts([[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]]);
  const right = pts([[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]);
  return `<polygon class="f-top ${tone}" points="${top}"/><polygon class="f-left ${tone}" points="${left}"/><polygon class="f-right ${tone}" points="${right}"/>`;
}
const P = (x, y, z) => [(x - y) * 0.866, (x + y) * 0.5 - z];
const pt = (x, y, z) => P(x, y, z).map(n => n.toFixed(1)).join(',');

function panels(size) {
  const span = {solar_s: 34, solar_m: 56, solar_l: 84}[size];
  const wing = (dir) => {
    const y0 = dir < 0 ? -6 - span : 26, y1 = dir < 0 ? -6 : 26 + span;
    const cells = [];
    for (let i = 0; i < 3; i++) {
      const a = y0 + (y1 - y0) * i / 3, b = y0 + (y1 - y0) * (i + 1) / 3;
      cells.push(`<polygon class="panel" points="${pt(4, a, 46)} ${pt(24, a, 46)} ${pt(24, b, 46)} ${pt(4, b, 46)}"/>`);
    }
    return `<line class="strut" x1="${P(14, dir < 0 ? -6 : 26, 46)[0]}" y1="${P(14, dir < 0 ? -6 : 26, 46)[1]}" x2="${P(14, dir < 0 ? 0 : 20, 46)[0]}" y2="${P(14, dir < 0 ? 0 : 20, 46)[1]}"/>${cells.join('')}`;
  };
  return wing(-1) + wing(1);
}

function powerPart(choice) {
  if (choice.startsWith('solar')) return panels(choice);
  if (choice === 'rtg') return `${box(-14, 6, 26, 8, 8, 26, 'rtg')}<polygon class="fin" points="${pt(-14, 4, 30)} ${pt(-22, 2, 30)} ${pt(-22, 2, 48)} ${pt(-14, 4, 48)}"/><polygon class="fin" points="${pt(-10, 14, 30)} ${pt(-10, 22, 30)} ${pt(-10, 22, 48)} ${pt(-10, 14, 48)}"/>`;
  return box(-12, 4, 30, 10, 12, 10, 'battery');
}

function thermalPart(choice) {
  if (choice === 'radiators') return [0, 1, 2].map(i => `<polygon class="radiator" points="${pt(30, 2 + i * 6, 34)} ${pt(46, 2 + i * 6, 34)} ${pt(46, 2 + i * 6, 58)} ${pt(30, 2 + i * 6, 58)}"/>`).join('');
  if (choice === 'insulated') return `<polygon class="blanket" points="${pt(-1, -1, 30)} ${pt(29, -1, 30)} ${pt(29, 21, 30)} ${pt(29, 21, 62)} ${pt(-1, 21, 62)} ${pt(-1, -1, 62)}"/>`;
  return '';
}

function shieldPart(choice) {
  if (choice === 'none') return '';
  const t = choice === 'heavy' ? 4 : 2;
  return box(-t, -t, 34, 28 + t * 2, 20 + t * 2, 18, `shield ${choice}`);
}

function entryPart(choice) {
  if (choice === 'parachute') return `${box(9, 6, 64, 10, 8, 7, 'chute')}<path class="chute-line" d="M${pt(14, 10, 71)} L${pt(14, 10, 78)}"/>`;
  if (choice === 'rockets') {
    const leg = (x, y, fx, fy) => `<line class="leg" x1="${P(x, y, 28)[0]}" y1="${P(x, y, 28)[1]}" x2="${P(fx, fy, 6)[0]}" y2="${P(fx, fy, 6)[1]}"/><circle class="foot" cx="${P(fx, fy, 6)[0]}" cy="${P(fx, fy, 6)[1]}" r="2.6"/>`;
    return `<ellipse class="heatshield" cx="${P(14, 10, 22)[0]}" cy="${P(14, 10, 22)[1]}" rx="30" ry="12"/>${leg(0, 0, -10, -10)}${leg(28, 0, 38, -10)}${leg(28, 20, 38, 30)}${leg(0, 20, -10, 30)}`;
  }
  if (choice === 'floats') return `<ellipse class="float" cx="${P(14, 10, 96)[0]}" cy="${P(14, 10, 96)[1]}" rx="30" ry="22"/><path class="chute-line" d="M${pt(2, 2, 62)} L${pt(4, 4, 80)} M${pt(26, 18, 62)} L${pt(24, 16, 80)}"/>`;
  return '';
}

function structurePart(choice) {
  if (choice !== 'pressure') return '';
  return [36, 46, 56].map(z => `<polyline class="ring" points="${pt(-1, 21, z)} ${pt(-1, -1, z)} ${pt(29, -1, z)}"/>`).join('');
}

function commsPart(choice) {
  if (choice === 'dish') return `<line class="strut" x1="${P(14, 10, 62)[0]}" y1="${P(14, 10, 62)[1]}" x2="${P(14, 10, 72)[0]}" y2="${P(14, 10, 72)[1]}"/><ellipse class="dish" cx="${P(14, 10, 76)[0]}" cy="${P(14, 10, 76)[1]}" rx="22" ry="9"/>`;
  if (choice === 'relay') return `<line class="strut" x1="${P(22, 4, 62)[0]}" y1="${P(22, 4, 62)[1]}" x2="${P(22, 4, 80)[0]}" y2="${P(22, 4, 80)[1]}"/><circle class="beacon" cx="${P(22, 4, 82)[0]}" cy="${P(22, 4, 82)[1]}" r="3"/>`;
  return `<line class="strut" x1="${P(22, 4, 62)[0]}" y1="${P(22, 4, 62)[1]}" x2="${P(22, 4, 70)[0]}" y2="${P(22, 4, 70)[1]}"/><ellipse class="dish small" cx="${P(22, 4, 71)[0]}" cy="${P(22, 4, 71)[1]}" rx="7" ry="3"/>`;
}

function enginePart(engine, propellantKg) {
  const tank = Math.min(26, 6 + propellantKg / 220);
  const nozzle = engine === 'ion' ? `<ellipse class="ion" cx="${P(14, 10, 26 - tank)[0]}" cy="${P(14, 10, 26 - tank)[1] + 6}" rx="9" ry="4"/>`
    : `<polygon class="nozzle ${engine}" points="${pt(10, 6, 26 - tank)} ${pt(18, 14, 26 - tank)} ${pt(22, 18, 14 - tank)} ${pt(6, 2, 14 - tank)}"/>`;
  return `${box(6, 2, 26 - tank, 16, 16, tank, 'tank')}${nozzle}`;
}

function payloadPart(payload) {
  return payload.slice(0, 4).map((p, i) => box(2 + (i % 2) * 13, 22, 30 + Math.floor(i / 2) * 13, 11, 8, 11, `module m-${p}`)).join('');
}

/** parts: {power,...}; previous: last drawn parts (to animate what changed). */
export function shipSvg({parts, previous, hull, engine, payload, propellantKg, names}) {
  const changed = slot => previous && previous[slot] !== parts[slot] ? 'is-new' : '';
  const scale = hull === 'freighter' ? 1.15 : hull === 'scout' ? 0.85 : 1;
  const g = (slot, inner, key = slot) => inner ? `<g class="part p-${slot} ${changed(key)}"><title>${esc(names[key] || key)}</title>${inner}</g>` : '';
  return `<svg class="ship-iso" viewBox="-130 -125 260 210" role="img" aria-label="Spacecraft built from the chosen parts: ${esc(Object.values(names).join(', '))}">
    <g transform="translate(-12 6) scale(${scale})">
      ${g('entry', parts.entry === 'rockets' ? entryPart(parts.entry) : '')}
      <g class="part p-engine">${enginePart(engine, propellantKg)}</g>
      ${g('power', parts.power === 'rtg' || parts.power === 'battery' ? powerPart(parts.power) : '')}
      ${g('shielding', shieldPart(parts.shielding))}
      <g class="part p-body">${box(0, 0, 26, 28, 20, 36, 'body')}</g>
      ${g('structure', structurePart(parts.structure))}
      ${g('thermal', thermalPart(parts.thermal))}
      <g class="part p-payload">${payloadPart(payload)}</g>
      ${g('power-wings', parts.power.startsWith('solar') ? powerPart(parts.power) : '', 'power')}
      ${g('comms', commsPart(parts.comms))}
      ${g('entry-top', parts.entry === 'parachute' || parts.entry === 'floats' ? entryPart(parts.entry) : '', 'entry')}
    </g></svg>`;
}
