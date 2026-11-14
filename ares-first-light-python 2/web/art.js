/* Bespoke, dependency-free vector art for Ares: First Light. */

const p = (points, fill, stroke = '', width = 0.8) => `<polygon points="${points}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round"` : ''}/>`;
const line = (points, stroke, width = 1, extra = '') => `<polyline points="${points}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const box = (x, y, w, d, h, top = '#d9dcd7', left = '#8e9695', right = '#667475') => {
  const l = `${x - w / 2},${y - h}`, f = `${x},${y + d / 2 - h}`, r = `${x + w / 2},${y - h}`, b = `${x},${y - d / 2 - h}`;
  return p(`${l} ${f} ${x},${y + d / 2} ${x - w / 2},${y}`, left, '#1b292d', .6) + p(`${f} ${r} ${x + w / 2},${y} ${x},${y + d / 2}`, right, '#1b292d', .6) + p(`${b} ${r} ${f} ${l}`, top, '#243237', .6);
};
const rock = (x, y, s, tone = '#a45c43') => `<g transform="translate(${x} ${y}) scale(${s})">${p('-8,2 -5,-5 2,-8 8,-2 7,5 0,8', tone)}${p('-5,-5 2,-8 8,-2 1,1', '#bf7452')}${p('1,1 8,-2 7,5 0,8', '#754433')}${line('-5,-5 1,1 0,8', '#c8845e', .6)}</g>`;
const shadow = '<ellipse cx="3" cy="8" rx="29" ry="12" fill="#100e13" opacity=".30"/>';

/** Small details only: the caller draws the underlying diamond tile. */
export function terrainArt(terrain, seed = 0) {
  let value = (Number(seed) || 0) >>> 0;
  const random = () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296; };
  const pebbles = Array.from({ length: 6 }, () => {
    const x = (random() - .5) * 42, y = (random() - .5) * 14;
    return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(random() * 1.6 + .5).toFixed(1)}" ry=".7" fill="${random() > .45 ? '#c18465' : '#5e372e'}" opacity=".65"/>`;
  }).join('');
  switch (terrain) {
    case 'ridge': return `<g class="terrain-detail terrain-ridge">${pebbles}${rock(-9, 1, 1.1)}${rock(9, -3, .85)}${rock(14, 9, .4)}${line('-23,5 -12,11 4,10', '#d28d62', .8, 'opacity=".35"')}</g>`;
    case 'ice': return `<g class="terrain-detail terrain-ice">${p('-23,0 -12,-10 4,-12 25,-1 12,12 -6,13', '#87bec1')}${p('-23,0 -12,-10 0,-6 -5,5 -17,6', '#a4d7d0')}${p('0,-6 4,-12 25,-1 10,0 5,9 -5,5', '#5d969f')}${p('-5,5 5,9 12,12 -6,13 -17,6', '#b7d7d2')}${line('-19,2 -8,-1 -2,3 10,0 20,1', '#d9f8e5', 1.1)}${line('-8,-1 -7,-7 -2,-11', '#355c67', .8)}${line('-2,3 0,11 5,14', '#3c7686', .7)}${line('10,0 9,-6 14,-7', '#c0e8df', .9)}${pebbles}</g>`;
    case 'science': return `<g class="terrain-detail terrain-science"><ellipse cx="0" cy="6" rx="21" ry="10" fill="#d3a553" opacity=".15"/>${rock(-10, 5, .7, '#aa8051')}${p('-6,8 -7,-9 -2,-20 5,-11 6,7 0,11', '#e2af5e', '#594633', .7)}${p('-2,-20 -1,-1 0,11 6,7 5,-11', '#aa7638')}${p('-7,-9 -2,-20 -1,-1 -6,8', '#f3c884')}${p('8,8 8,-3 15,-14 20,-6 17,9 12,13', '#db9b4c', '#594633', .7)}${p('15,-14 14,2 12,13 17,9 20,-6', '#956032')}${line('-19,8 -10,12 -2,15', '#e9b86a', .6, 'opacity=".7"')}</g>`;
    case 'hazard': return `<g class="terrain-detail terrain-hazard">${p('-27,-2 -12,-4 -6,-13 0,-2 13,-4 8,3 26,8 12,9 3,6 -7,11 -6,4 -21,6', '#382425')}${line('-27,-2 -12,-1 -6,-10 -1,2 9,1 8,5 25,8', '#cf704a', 1)}${line('-1,2 -7,8 -19,7', '#e3975a', .7)}${rock(17, -5, .5)}${rock(-17, 7, .4)}<circle cx="4" cy="-1" r="20" fill="none" stroke="#e5a35f" stroke-width=".8" stroke-dasharray="2 4" opacity=".25"/></g>`;
    case 'salvage': return `<g class="terrain-detail terrain-salvage">${pebbles}<g transform="translate(-7 1) rotate(-9)">${box(0, 1, 24, 13, 9, '#bfad89', '#827d6a', '#5b625b')}${line('-9,-6 0,-2 9,-7', '#e6c99b', 1.3)}${line('0,-2 0,6', '#bc8553', 2)}</g><g transform="translate(12 5)">${box(0, 0, 16, 10, 7, '#acb6ae', '#697974', '#435c5b')}${line('-5,-6 5,-6', '#d9e5d4', 1)}</g>${line('10,-3 12,-21 18,-24', '#8e9490', 1.4)}<circle cx="18" cy="-24" r="2" fill="#d89051"/></g>`;
    case 'fog': case 'unknown': return '';
    default: return `<g class="terrain-detail terrain-plain">${pebbles}${line('-21,3 -7,8 9,6', '#bb7958', .7, 'opacity=".25"')}${random() > .5 ? rock(16, 2, .25) : ''}</g>`;
  }
}

const buildingShapes = {
  habitat: () => `${box(0, 3, 49, 27, 14, '#c7cfc9', '#899696', '#647679')}${box(-4, -7, 33, 21, 15, '#e2e4d9', '#b4bdb4', '#869a9b')}${p('-20.5,-22 -4,-31 12.5,-22 7,-19 -9.5,-28', '#d97341')}${line('-14,-17 -7,-13 -7,-6', '#445e67', 4)}${line('0,-17 7,-21', '#365660', 4)}${line('0,-7 7,-11', '#8db9bd', 1.3)}${p('-7,9 -7,0 0,-4 0,6', '#2e4851')}${p('6,6 6,-3 14,-7 14,2', '#9ac8cb')}${line('8,0 12,-2', '#d4ece6', .7)}${box(21, 4, 9, 7, 6, '#d8d6c8', '#a18d76', '#6f796f')}${line('-3,-30 -3,-45', '#b7c7c3', 1.3)}<circle cx="-3" cy="-46" r="1.8" fill="#ef9c61"/>`,
  solar: () => `${line('-16,9 -16,-2', '#8fa1a4', 2)}${line('17,10 17,-1', '#7f9197', 2)}${box(0, 9, 18, 10, 5, '#919b95', '#657776', '#445b61')}${p('-30,-10 5,-29 31,-14 -4,5', '#536b7b', '#192e3a', 1.2)}${p('-28,-10 5,-27 28,-14 -4,3', '#163c59')}${line('-19,-15 4,-2 -4,3', '#4b8093', .8)}${line('-10,-19 13,-6', '#4b8093', .8)}${line('-2,-24 22,-10', '#4b8093', .8)}${line('-20,-5 13,-23', '#5a92a4', .8)}${line('-12,0 21,-18', '#5a92a4', .8)}${line('-28,-10 5,-27', '#80b2bc', .9)}${line('-4,5 31,-14', '#7b989e', 1.2)}<circle cx="1" cy="9" r="1.7" fill="#7bd1bc"/>`,
  oxygen: () => `${box(0, 6, 43, 24, 7, '#b6c2ba', '#788d88', '#506d70')}<g transform="translate(-10 -9)"><path d="M-8 0V-19 Q0-28 8-19V0Q0 8-8 0" fill="#a3bdba" stroke="#344f59" stroke-width=".7"/><ellipse cx="0" cy="-19" rx="8" ry="4" fill="#e0e5d9"/>${line('-5,-17 -5,-1', '#d6e8d7', 1.8)}${line('3,-16 3,-2', '#648f93', 2.2)}<ellipse cx="0" cy="-8" rx="8" ry="4" fill="none" stroke="#d1a46c" stroke-width="2"/></g><g transform="translate(9 -1)"><path d="M-8 0V-23 Q0-30 8-23V0Q0 8-8 0" fill="#95b5b3" stroke="#344f59" stroke-width=".7"/><ellipse cx="0" cy="-23" rx="8" ry="4" fill="#e1e6da"/>${line('-5,-20 -5,-1', '#cfe5d5', 1.8)}${line('4,-20 4,-2', '#618b8e', 2)}<ellipse cx="0" cy="-11" rx="8" ry="4" fill="none" stroke="#d8a675" stroke-width="2"/></g>${line('-10,1 -10,9 3,15 19,6 19,-12', '#b1c8c2', 2)}<circle cx="19" cy="-12" r="2.5" fill="#6dddc2"/>`,
  water: () => `<ellipse cx="0" cy="7" rx="26" ry="14" fill="#2b7984" opacity=".45"/><ellipse cx="0" cy="7" rx="22" ry="11" fill="none" stroke="#5bb8bd" stroke-width="2"/>${box(0, 5, 33, 19, 9, '#c7d4ca', '#779b99', '#447c85')}${line('-11,3 -7,-35 0,-43 7,-35 11,3', '#c5d2c9', 2.8)}${line('-7,-35 7,-21 -9,-8 10,-1', '#789a9e', 1.8)}${line('0,-39 0,8', '#344f5b', 3)}${line('-4,-32 4,-27 -4,-22 4,-17 -4,-12 4,-7', '#81ccd0', 1.8)}${box(18, 6, 12, 9, 11, '#c9c8b4', '#8e998c', '#5b8686')}${line('12,4 23,-2', '#d28556', 2.5)}<circle cx="0" cy="6" r="3" fill="#9cd8c6"/>`,
  greenhouse: () => `${box(0, 8, 52, 28, 5, '#a4bdab', '#667f72', '#466c64')}<path d="M-25 5C-25-14-12-29 0-30C13-28 25-14 25 5Q0 25-25 5Z" fill="#3e9281" stroke="#aac9b5" stroke-width="1.1"/><path d="M0-30C13-27 25-12 25 5Q12 12 0 17Z" fill="#245c58" opacity=".8"/><path d="M-25 5Q0 18 25 5M-22-6Q0 8 22-6M-14-21Q0-11 14-21" fill="none" stroke="#8fc4ae" stroke-width=".9"/><path d="M0-30C-15-19-16 8 0 17M0-30C15-19 16 8 0 17M0-30V17" fill="none" stroke="#9dcebb" stroke-width=".9"/><path d="M-15-12Q-13-20-8-23" fill="none" stroke="#d5e7cf" stroke-width="2.5" opacity=".6"/>${line('-13,6 -7,3 -2,7 5,4 12,8', '#91c674', 3)}${p('-4,18 -4,10 3,6 3,14', '#1e4649')}`,
  lab: () => `${box(-5, 6, 40, 23, 14, '#d8dbd0', '#94a59e', '#657d80')}${box(17, 4, 18, 12, 9, '#d29b67', '#b97b50', '#7b6350')}${line('-21,-9 -7,-1 -7,10', '#d3e1d4', 1.5)}${p('0,-4 13,-11 13,-3 0,4', '#477d8a')}${line('3,-2 10,-6', '#b6e3da', 1.3)}${line('-5,-13 -5,-30', '#bac8bd', 2.5)}<g transform="translate(-5 -34) rotate(-18)"><path d="M-16-4Q0 16 16-4Q0 3-16-4Z" fill="#aabfb7" stroke="#5e7980" stroke-width=".8"/><path d="M-16-4Q0-13 16-4Q0 3-16-4" fill="#e3e4d4" stroke="#739397" stroke-width=".7"/>${line('0,0 5,-13', '#a4bcb7', 1.2)}<circle cx="5" cy="-13" r="2" fill="#e3a264"/></g>${line('21,-4 21,-17', '#c3cfc0', 1)}<circle cx="21" cy="-18" r="1.5" fill="#75d7be"/>`,
  battery: () => `${box(0, 8, 44, 25, 5, '#a8b8ae', '#6e8580', '#4c656b')}${box(-11, 0, 18, 12, 25, '#c5d3c8', '#8aa8a1', '#527c81')}${box(10, 7, 18, 12, 27, '#c9d4c6', '#86a49d', '#486f76')}${line('-16,-18 -10,-15 -10,-4', '#447b7c', 3)}${line('5,-14 10,-11 10,1', '#426e70', 3)}${line('-16,-20 -10,-17 -10,-12', '#8ce0be', 2)}${line('5,-16 10,-13 10,-6', '#8ce0be', 2)}${p('-3,-28 0,-29 3,-27 0,-25', '#e5b277')}${p('9,-25 12,-26 15,-24 12,-22', '#e5b277')}${line('-11,5 -11,11 10,17 21,11', '#b3cabe', 1.5)}`,
  shield: () => `${box(0, 7, 40, 22, 9, '#c3d1ca', '#8b9e96', '#576f78')}${line('-11,2 -8,-25 0,-30 8,-25 11,2', '#c1d1ca', 2.4)}${line('0,-30 0,6', '#627f89', 2)}<path d="M-23-22Q0-48 23-22L17-17Q0-35-17-17Z" fill="#bcd0cb" stroke="#637d87" stroke-width=".8"/><path d="M-21-22Q0-43 21-22" fill="none" stroke="#82b8bc" stroke-width="2"/><ellipse cx="0" cy="-21" rx="9" ry="4" fill="#315c71"/><circle cx="0" cy="-21" r="3" fill="#7ed5d7"/>${line('0,-21 0,-37', '#92c4ca', .8)}<path d="M-26-29Q0-59 26-29" fill="none" stroke="#78c5cd" stroke-width=".8" opacity=".30"/><path d="M-31-34Q0-70 31-34" fill="none" stroke="#78c5cd" stroke-width=".7" opacity=".15"/>`,
};

/** A complete building group, anchored to the center of an isometric tile. */
export function buildingArt(type, opts = {}) {
  const { level = 1, active = true, damage = 0 } = opts;
  const shape = buildingShapes[type] || buildingShapes.habitat;
  const offline = active === false;
  const marker = Number(level) > 1 ? `<g transform="translate(24 -19)"><circle r="5.5" fill="#173637" stroke="#7bc8b5" stroke-width=".7"/>${line('-2,1 0,-1 2,1', '#b9e4cc', 1.3)}${line('-2,-1 0,-3 2,-1', '#b9e4cc', 1.3)}</g>` : '';
  const damageMark = Number(damage) > 0 ? '<g transform="translate(-24 -25)"><path d="M0-6L6 4H-6Z" fill="#e48a57" stroke="#332b2b" stroke-width=".7"/><path d="M0-2V0M0 2V2.2" stroke="#292630" stroke-width="1.4" stroke-linecap="round"/></g>' : '';
  return `<g class="building-art building-${Object.hasOwn(buildingShapes, type) ? type : 'habitat'}${offline ? ' building-offline' : ''}">${shadow}<g opacity="${offline ? '.47' : '1'}">${shape()}</g>${marker}${damageMark}</g>`;
}

const icons = {
  energy: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
  oxygen: '<circle cx="8" cy="13" r="5"/><circle cx="18" cy="6" r="3"/><path d="M17 17h4m-2-2v4"/>',
  water: '<path d="M12 2C10 6 5 10 5 15a7 7 0 0 0 14 0c0-5-5-9-7-13Z"/><path d="M8 15a4 4 0 0 0 3 4"/>',
  food: '<path d="M12 21v-9M12 13C3 14 3 5 3 5s9-1 9 8Zm0-4C12 2 21 3 21 3s0 9-9 9"/>',
  materials: '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5M12 13v9M7 5.7l9 5V15"/>',
  science: '<path d="M9 3h6M10 3v6L4 19a1.3 1.3 0 0 0 1 2h14a1.3 1.3 0 0 0 1-2L14 9V3M8 14h8"/><path d="M10 17h.01m4 1h.01"/>',
  health: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
  scan: '<path d="M4 8V4h4m8 0h4v4M4 16v4h4m8 0h4v-4M3 12h18"/><circle cx="12" cy="12" r="4"/>',
  build: '<path d="m14 3 7 7-4 4-7-7 4-4ZM12 9 3 18l3 3 9-9M14 3l-4 4M17 14l4-4"/>',
  repair: '<path d="M14 7a6 6 0 0 0-7.8-4.7L10 6 6 10 2.3 6.2A6 6 0 0 0 10 14l7 7 4-4-7-7"/>',
  upgrade: '<path d="m7 12 5-5 5 5M12 7v13M5 3h14"/>',
  research: '<path d="M9 3h6M10 3v6L5 17a3 3 0 0 0 2.5 4h9a3 3 0 0 0 2.5-4l-5-8V3M8 14h8"/><circle cx="12" cy="17" r=".8"/>',
  arrow: '<path d="M4 12h16m-7-7 7 7-7 7"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 8.5a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4M12 16h.01"/>',
  log: '<path d="M6 3h12a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM4 17h16M8 7h8m-8 4h6"/>',
  reset: '<path d="M3 10a9 9 0 1 1 2.5 8M3 4v6h6"/>',
  volume: '<path d="m11 5-6 4H2v6h3l6 4V5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="m11 5-6 4H2v6h3l6 4V5Zm5 4 6 6m0-6-6 6"/>',
  play: '<path d="m8 4 13 8-13 8V4Z"/>',
  pause: '<path d="M7 4v16M17 4v16" stroke-width="4"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  rocket: '<path d="M14 3c4-1 7 0 7 0s1 3-1 7l-8 8-6-6 8-9ZM7 11l-4 1-1 5 5-1m6 1-1 5 5-1 1-4M5 19l-3 3"/><circle cx="16" cy="7" r="2"/>',
  map: '<path d="m9 3 6 3 6-3v17l-6 3-6-3-6 3V6l6-3Zm0 0v17m6-14v17"/>',
  shield: '<path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
  cargo: '<path d="m12 3 9 5v9l-9 5-9-5V8l9-5Zm-9 5 9 5 9-5M12 13v9M7 5.7l9 5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20.5 13.5A9 9 0 0 1 10.5 3a9 9 0 1 0 10 10.5Z"/>',
  save: '<path d="M4 3h13l4 4v14H3V3h1Zm3 0v6h9V3M7 21v-8h10v8"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/>',
  leaf: '<path d="M20 3s2 12-5 16C5 24 0 9 11 6c4-1 6-1 9-3ZM4 22l11-11"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
};

export function icon(name, size = 20) {
  const safeSize = Number.isFinite(Number(size)) ? Math.max(8, Math.min(96, Number(size))) : 20;
  const key = Object.hasOwn(icons, name) ? name : 'scan';
  return `<svg class="icon icon-${key}" xmlns="http://www.w3.org/2000/svg" width="${safeSize}" height="${safeSize}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[key]}</svg>`;
}

/** Decorative Mars illustration. Intended to occur once on the preflight screen. */
export function planetArt() {
  let s = 47;
  const rand = () => { s = Math.imul(s ^ (s >>> 13), 1274126177) >>> 0; return s / 4294967296; };
  const textures = Array.from({ length: 100 }, () => {
    const x = 100 + rand() * 300, y = 103 + rand() * 300, r = 1.5 + rand() * 12;
    return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${r.toFixed(1)}" ry="${(r * .5).toFixed(1)}" fill="${rand() > .55 ? '#e9a077' : '#4c302d'}" opacity="${(.05 + rand() * .12).toFixed(2)}" transform="rotate(-20 ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }).join('');
  const stars = Array.from({ length: 40 }, () => `<circle cx="${(rand() * 500).toFixed(1)}" cy="${(rand() * 500).toFixed(1)}" r="${(.4 + rand() * .8).toFixed(1)}" fill="#bfd1cf" opacity="${(.1 + rand() * .4).toFixed(2)}"/>`).join('');
  return `<svg class="mars-illustration" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" fill="none" role="img" aria-label="Mars and its orbital trajectories">
  <defs>
    <radialGradient id="ares-planet-glow"><stop stop-color="#c76943" stop-opacity=".17"/><stop offset=".62" stop-color="#9c573a" stop-opacity=".06"/><stop offset="1" stop-color="#9c573a" stop-opacity="0"/></radialGradient>
    <radialGradient id="ares-mars-surface" cx=".32" cy=".25" r=".8"><stop stop-color="#d9946d"/><stop offset=".3" stop-color="#b97250"/><stop offset=".65" stop-color="#844936"/><stop offset=".86" stop-color="#392a2a"/><stop offset="1" stop-color="#151b21"/></radialGradient>
    <linearGradient id="ares-mars-shadow" x1=".25" y1=".1" x2=".95" y2=".75"><stop stop-color="#10141c" stop-opacity="0"/><stop offset=".5" stop-color="#10141c" stop-opacity=".05"/><stop offset="1" stop-color="#10141c" stop-opacity=".85"/></linearGradient>
    <clipPath id="ares-planet-clip"><circle cx="250" cy="250" r="151"/></clipPath>
  </defs>
  ${stars}
  <circle cx="250" cy="250" r="248" fill="url(#ares-planet-glow)"/>
  <circle cx="250" cy="250" r="201" stroke="#b89a7c" stroke-width=".6" opacity=".15"/>
  <circle cx="250" cy="250" r="219" stroke="#b89a7c" stroke-width=".6" stroke-dasharray="1 7" opacity=".25"/>
  <ellipse cx="250" cy="250" rx="226" ry="68" transform="rotate(-29 250 250)" stroke="#9c9e95" stroke-width=".8" opacity=".28"/>
  <path d="M55 362C136 432 439 241 446 155" stroke="#de9b68" stroke-width="1.1" opacity=".5"/>
  <circle cx="250" cy="250" r="153" fill="#ba7555" opacity=".13"/>
  <circle cx="250" cy="250" r="151" fill="url(#ares-mars-surface)"/>
  <g clip-path="url(#ares-planet-clip)">
    <path d="M92 199C133 192 128 159 169 172S211 194 227 184 244 147 276 161 297 198 330 193 390 176 410 215L435 298 391 324 348 290 316 307 290 276 246 281 218 257 186 263 155 239 114 251Z" fill="#633e31" opacity=".30"/>
    <path d="M122 216C166 204 186 233 214 219S255 215 279 232 321 249 359 223" stroke="#e9b08a" stroke-width="3.5" opacity=".18"/>
    <path d="M118 264C170 240 174 291 217 272S261 285 296 293 332 326 372 313" stroke="#502f2b" stroke-width="8" opacity=".25"/>
    <path d="M129 264C167 254 184 289 214 278S257 289 291 294 333 320 363 315" stroke="#d7956d" stroke-width="1.2" opacity=".4"/>
    <path d="M175 138Q212 98 265 108L248 120 230 117 208 127 192 125Z" fill="#dbc3a2" opacity=".5"/>
    <ellipse cx="178" cy="191" rx="20" ry="13" transform="rotate(-21 178 191)" fill="#734b37" opacity=".28"/>
    <ellipse cx="176" cy="188" rx="17" ry="10" transform="rotate(-21 176 188)" stroke="#e8ad80" stroke-width="1.2" opacity=".3"/>
    <ellipse cx="235" cy="328" rx="29" ry="18" transform="rotate(-16 235 328)" fill="#663e30" opacity=".3"/>
    <ellipse cx="233" cy="325" rx="26" ry="16" transform="rotate(-16 233 325)" stroke="#cf8a61" stroke-width="1.7" opacity=".4"/>
    ${textures}
    <circle cx="250" cy="250" r="151" fill="url(#ares-mars-shadow)"/>
  </g>
  <path d="M138 151A151 151 0 0 1 304 109" stroke="#edb48b" stroke-width="1" opacity=".46"/>
  <g transform="translate(195 211)"><circle r="13" stroke="#e7cba7" stroke-width=".6" opacity=".55"/><circle r="4" fill="#ffcc96"/><circle r="2" fill="#fff3dc"/><path d="M13 0h35l26-24h38" stroke="#e9c8a0" stroke-width=".7" opacity=".7"/><circle cx="112" cy="-24" r="2" fill="#e9c8a0"/></g>
  <g transform="translate(65 354) rotate(-29)"><path d="M-9 0h18M0-7v14" stroke="#ccd5ce" stroke-width="1.4"/><path d="M-13-4h7v8h-7Zm19 0h7v8H6Z" fill="#4c6d7a" stroke="#8eacb2" stroke-width=".6"/><circle r="3" fill="#d9dac9"/></g>
  <circle cx="348" cy="78" r="2" fill="#c5d5c6"/><circle cx="348" cy="78" r="8" stroke="#aab6a7" stroke-width=".6" opacity=".3"/>
  <path d="M229 30h42M250 9v42M37 250H11m478 0h-26M250 463v26" stroke="#a7aba1" stroke-width=".7" opacity=".35"/>
  </svg>`;
}
