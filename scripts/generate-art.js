/* eslint-env node */
/**
 * Generates every illustration used by the game as SVG, plus a manifest that
 * says what size each one should be rasterised to. Run with:
 *   node scripts/generate-art.js
 * then rasterise art/svg/*.svg into src/assets/images/*.png (see art/README.md).
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'art', 'svg');
fs.mkdirSync(OUT, { recursive: true });
const manifest = [];

// ---------------------------------------------------------------- helpers --

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map(c =>
    Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt),
  );
  return '#' + ch.map(v => v.toString(16).padStart(2, '0')).join('');
}

function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

class Defs {
  constructor(prefix) {
    this.prefix = prefix;
    this.items = [];
    this.n = 0;
    /** Base colour of each gradient, used to derive line-art colours. */
    this.base = {};
    this.shades = {};
  }
  id() {
    return `${this.prefix}${this.n++}`;
  }
  linear(top, bottom, horizontal = false) {
    const id = this.id();
    const dir = horizontal ? 'x1="0" y1="0" x2="1" y2="0"' : 'x1="0" y1="0" x2="0" y2="1"';
    this.items.push(
      `<linearGradient id="${id}" ${dir}><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>`,
    );
    this.base[id] = bottom;
    return `url(#${id})`;
  }
  /** Soft shading lit from the top-left, shared by every illustrated sprite. */
  shade(color) {
    if (!this.shades[color]) {
      const id = this.id();
      this.items.push(
        `<linearGradient id="${id}" x1="0.1" y1="0" x2="0.9" y2="1">` +
          `<stop offset="0" stop-color="${shade(color, 0.18)}"/><stop offset="0.5" stop-color="${color}"/>` +
          `<stop offset="1" stop-color="${shade(color, -0.18)}"/></linearGradient>`,
      );
      this.base[id] = color;
      this.shades[color] = `url(#${id})`;
    }
    return this.shades[color];
  }
  radial(inner, outer, cx = 0.5, cy = 0.5, r = 0.5, innerOpacity = 1, outerOpacity = 1) {
    const id = this.id();
    this.items.push(
      `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${inner}" stop-opacity="${innerOpacity}"/><stop offset="1" stop-color="${outer}" stop-opacity="${outerOpacity}"/></radialGradient>`,
    );
    return `url(#${id})`;
  }
  raw(s) {
    this.items.push(s);
  }
  toString() {
    return `<defs>${this.items.join('')}</defs>`;
  }
}

const OUTLINE_FILTER = (radius = 2.4, color = '#2b2433') =>
  `<filter id="outline" x="-10%" y="-10%" width="120%" height="120%">` +
  `<feMorphology in="SourceAlpha" operator="dilate" radius="${radius}" result="d"/>` +
  `<feFlood flood-color="${color}"/><feComposite in2="d" operator="in" result="o"/>` +
  `<feMerge><feMergeNode in="o"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;

function save(name, w, h, body, outW, outH) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
  fs.writeFileSync(path.join(OUT, `${name}.svg`), svg);
  manifest.push({ name, width: outW ?? w, height: outH ?? h });
}

/**
 * Adds a coloured ink line (a darker tone of each shape's own fill) to every
 * filled shape. Shapes that already have a stroke, are translucent, are
 * marked class="hl" (highlights) or are tiny are left alone.
 */
function lineArt(content, defs) {
  return content.replace(/<(path|ellipse|circle|rect|polygon)\b([^>]*?)(\/?)>/g, (tag, el, attrs, close) => {
    if (/\bstroke(-[a-z]+)?=|\bopacity=|class="hl"/.test(attrs)) {
      return tag;
    }
    const r = attrs.match(/\br="([\d.]+)"/);
    if (r && Number(r[1]) < 3.5) {
      return tag;
    }
    const fill = attrs.match(/\bfill="([^"]+)"/)?.[1];
    if (!fill || fill === 'none') {
      return tag;
    }
    const ref = fill.match(/url\(#([^)]+)\)/);
    const base = ref ? defs.base[ref[1]] : fill;
    if (!base || !/^#[0-9a-f]{6}$/i.test(base)) {
      return tag;
    }
    return `<${el}${attrs} stroke="${shade(base, -0.45)}" stroke-width="2.2" stroke-linejoin="round"${close}>`;
  });
}

function sprite(name, w, h, defs, content, scale = 1.2) {
  defs.raw(OUTLINE_FILTER());
  save(name, w, h, `${defs}<g filter="url(#outline)">${lineArt(content, defs)}</g>`, Math.round(w * scale), Math.round(h * scale));
}

// ------------------------------------------------------------- characters --

const SKIN = { light: '#ffd7b5', tan: '#efb98c', brown: '#c68657', dark: '#8a5636', ogre: '#9bc65a' };
const DARK = '#2b2433';

// Head is centred on x=100. Face spans x 64..136, y 22..104.

function eyes(o) {
  const iris = o.eyeColor ?? '#6b4226';
  const narrow = o.mood === 'sly' || o.mood === 'grumpy';
  let s = '';
  for (const x of [86, 114]) {
    const out = x < 100 ? -1 : 1;
    s += `<ellipse cx="${x}" cy="62" rx="6.6" ry="${narrow ? 5.5 : 7.6}" fill="#ffffff"/>`;
    s += `<circle cx="${x + 0.8}" cy="63" r="4.7" fill="${iris}"/>`;
    s += `<circle cx="${x + 0.8}" cy="63" r="2.4" fill="#1b1416" class="hl"/>`;
    s += `<circle cx="${x + 2.4}" cy="60.6" r="1.6" fill="#ffffff" class="hl"/>`;
    s += `<circle cx="${x - 1}" cy="65" r="0.8" fill="#ffffff" class="hl"/>`;
    if (narrow) {
      s += `<path d="M${x - 8} 58 L${x + 8} ${x < 100 ? 61 : 61} L${x + 8} 56 L${x - 8} 55 Z" fill="${o.skin}" class="hl"/>`;
      s += `<path d="M${x - 8} ${x < 100 ? 57.5 : 61} L${x + 8} ${x < 100 ? 61 : 57.5}" stroke="${DARK}" stroke-width="2.6" stroke-linecap="round"/>`;
    } else {
      s += `<path d="M${x - 7.4} 60.5 Q${x} 52.5 ${x + 7.4} 60.5" stroke="${DARK}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    }
    if (o.lashes) {
      s += `<path d="M${x + out * 7} 59.5 l${out * 3.6} -2.8 M${x + out * 4.5} 56 l${out * 2.2} -3" stroke="${DARK}" stroke-width="2" stroke-linecap="round"/>`;
    }
  }
  const brow = o.browColor ?? shade(o.hair, -0.15);
  if (o.mood === 'grumpy' || o.mood === 'sly') {
    s += `<path d="M76 46 L95 52 L94 55 L76 50 Z M124 46 L105 52 L106 55 L124 50 Z" fill="${brow}" class="hl"/>`;
  } else {
    s += `<path d="M77 51 Q85 44 95 48 Q85 47.5 77 54 Z M123 51 Q115 44 105 48 Q115 47.5 123 54 Z" fill="${brow}" class="hl"/>`;
  }
  return s;
}

function mouth(o) {
  const y = o.mustache ? 4 : 0;
  switch (o.mood) {
    case 'sly':
      return `<path d="M89 ${88 + y} Q101 ${93 + y} 112 ${82 + y}" stroke="#7d2e28" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M112 ${82 + y} l2.5 -1" stroke="#7d2e28" stroke-width="2" stroke-linecap="round"/>`;
    case 'grin':
      return (
        `<path d="M80 ${84 + y} Q100 ${104 + y} 120 ${84 + y} Z" fill="#6d1f1a"/>` +
        `<path d="M85 ${85 + y} L115 ${85 + y} L113 ${89 + y} L87 ${89 + y} Z" fill="#fffbea" class="hl"/>` +
        `<path d="M83 ${86 + y} L86 ${73 + y} L91 ${87 + y} Z M117 ${86 + y} L114 ${73 + y} L109 ${87 + y} Z" fill="#fff6dc"/>`
      );
    case 'open':
      return (
        `<path d="M89 ${84 + y} Q100 ${98 + y} 111 ${84 + y} Z" fill="#7d2620"/>` +
        `<path d="M91 ${85 + y} L109 ${85 + y} L108 ${88.5 + y} L92 ${88.5 + y} Z" fill="#ffffff" class="hl"/>` +
        `<path d="M95 ${93 + y} Q100 ${90 + y} 105 ${93 + y} Q100 ${95.5 + y} 95 ${93 + y} Z" fill="#ff8a80" class="hl"/>`
      );
    default:
      return (
        `<path d="M90 ${85 + y} Q100 ${94 + y} 110 ${85 + y}" stroke="#7d2e28" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
        `<path d="M88.5 ${84 + y} l2 1.6 M111.5 ${84 + y} l-2 1.6" stroke="#7d2e28" stroke-width="2" stroke-linecap="round"/>`
      );
  }
}

const shine = c => `<path d="M80 31 Q92 25 106 27" stroke="${shade(c, 0.4)}" stroke-width="3.2" fill="none" stroke-linecap="round" opacity="0.75"/>`;

const HAIR_BACK = {
  long: (d, c) => `<path d="M60 62 Q54 16 100 15 Q146 16 140 62 L147 134 Q124 146 100 140 Q76 146 53 134 Z" fill="${d.shade(shade(c, -0.12))}"/>`,
  bun: (d, c) => `<circle cx="100" cy="16" r="16" fill="${d.shade(c)}"/><path d="M90 10 Q100 4 110 10" stroke="${shade(c, 0.4)}" stroke-width="2.5" fill="none" opacity="0.7"/>`,
  pigtails: (d, c) =>
    `<ellipse cx="52" cy="72" rx="14" ry="18" fill="${d.shade(c)}"/><ellipse cx="148" cy="72" rx="14" ry="18" fill="${d.shade(c)}"/>` +
    `<circle cx="62" cy="58" r="6" fill="${d.shade('#ff4f86')}"/><circle cx="138" cy="58" r="6" fill="${d.shade('#ff4f86')}"/>`,
  wild: (d, c) =>
    [[58, 50], [64, 30], [80, 16], [100, 12], [120, 16], [136, 30], [142, 50], [54, 72], [146, 72]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="18" fill="${d.shade(c)}"/>`)
      .join(''),
};

const HAIR_FRONT = {
  short: (d, c) => `<path d="M62 62 Q57 18 100 17 Q143 18 138 62 Q135 42 120 37 Q108 46 92 39 Q76 46 66 44 Q63 51 62 62 Z" fill="${d.shade(c)}"/>${shine(c)}`,
  spiky: (d, c) => `<path d="M64 60 L55 40 L71 42 L67 22 L86 33 L92 12 L104 30 L118 13 L121 34 L137 25 L133 45 L147 45 L137 61 Q125 42 100 42 Q76 42 64 60 Z" fill="${d.shade(c)}"/>${shine(c)}`,
  long: (d, c) => `<path d="M62 64 Q59 19 100 18 Q141 19 138 64 Q131 44 114 37 Q100 50 73 43 Q65 51 62 64 Z" fill="${d.shade(c)}"/>${shine(c)}`,
  bun: (d, c) => `<path d="M62 60 Q62 22 100 21 Q138 22 138 60 Q122 33 100 33 Q78 33 62 60 Z" fill="${d.shade(c)}"/>${shine(c)}`,
  pigtails: (d, c) => `<path d="M62 64 Q59 19 100 18 Q141 19 138 64 Q128 40 100 41 Q72 40 62 64 Z" fill="${d.shade(c)}"/>${shine(c)}`,
  monk: (d, c) =>
    `<ellipse cx="65" cy="56" rx="6" ry="15" fill="${d.shade(c)}"/><ellipse cx="135" cy="56" rx="6" ry="15" fill="${d.shade(c)}"/>` +
    `<ellipse cx="88" cy="32" rx="12" ry="6" fill="#ffffff" opacity="0.4"/>`,
  wild: (d, c) => `<path d="M62 58 Q64 26 100 24 Q136 26 138 58 Q124 40 112 44 Q100 34 88 44 Q74 40 62 58 Z" fill="${d.shade(c)}"/>`,
};

const TORSO = {
  shirt: 'M66 120 Q66 104 84 101 L116 101 Q134 104 134 120 L131 172 Q100 179 69 172 Z',
  dress: 'M68 120 Q68 104 85 101 L115 101 Q132 104 132 120 L130 150 L148 210 Q100 222 52 210 L70 150 Z',
  robe: 'M66 120 Q66 104 84 101 L116 101 Q134 104 134 120 L146 238 Q100 247 54 238 Z',
};

function hat(type, d) {
  switch (type) {
    case 'straw':
      return (
        `<path d="M70 38 Q70 5 100 5 Q130 5 130 38 Z" fill="${d.shade('#ecc66a')}"/>` +
        `<rect x="70" y="27" width="60" height="9" fill="${d.shade('#c0392b')}"/>` +
        `<ellipse cx="100" cy="40" rx="64" ry="13" fill="${d.shade('#e2b552')}"/>` +
        `<path d="M48 40 Q100 50 152 40 M78 14 L80 26 M100 9 L100 26 M122 14 L120 26" stroke="#b5862c" stroke-width="1.6" fill="none" opacity="0.7"/>`
      );
    case 'police':
      return (
        `<path d="M62 46 Q62 9 100 7 Q138 9 138 46 Z" fill="${d.shade('#2f4c8c')}"/>` +
        `<rect x="62" y="37" width="76" height="9" fill="${d.shade('#1b2a52')}"/>` +
        `<path d="M64 46 Q100 64 136 46 Q100 53 64 46 Z" fill="${d.shade('#151b2c')}"/>` +
        `<path d="M100 18 l4 7 l8 1 l-6 5 l2 8 l-8 -4 l-8 4 l2 -8 l-6 -5 l8 -1 z" fill="${d.shade('#f2c230')}"/>`
      );
    case 'helmet':
      return (
        `<path d="M58 50 Q58 7 100 5 Q142 7 142 50 Z" fill="${d.shade('#5f6f3c')}"/>` +
        `<path d="M52 48 L148 48 L145 58 L55 58 Z" fill="${d.shade('#4c5a2f')}"/>` +
        `<path d="M74 24 Q86 16 100 16" stroke="#8a9a5b" stroke-width="3" fill="none" opacity="0.7"/>` +
        `<path d="M66 58 Q70 86 86 96 M134 58 Q130 86 114 96" stroke="#3b4524" stroke-width="2.4" fill="none"/>`
      );
    case 'beanie':
      return (
        `<path d="M62 54 Q62 13 100 11 Q138 13 138 54 Z" fill="${d.shade('#3f4450')}"/>` +
        `<rect x="60" y="43" width="80" height="13" rx="6" fill="${d.shade('#2c3039')}"/>` +
        `<path d="M76 22 L76 42 M88 16 L88 42 M100 14 L100 42 M112 16 L112 42 M124 22 L124 42" stroke="#2c3039" stroke-width="1.6" opacity="0.6"/>`
      );
    default:
      return '';
  }
}

function person(name, o) {
  const d = new Defs(name);
  const skin = d.shade(o.skin);
  const skinDark = shade(o.skin, -0.25);
  const shirtC = o.shirt;
  const shirt = d.shade(shirtC);
  const pantsC = o.pants ?? '#3b4a6b';
  const outfit = o.outfit ?? 'shirt';
  const torso = TORSO[outfit === 'dress' || outfit === 'robe' ? outfit : 'shirt'];
  const fold = c => `stroke="${shade(c, -0.3)}" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.55"`;
  let s = '';

  if (HAIR_BACK[o.hairStyle]) {
    s += HAIR_BACK[o.hairStyle](d, o.hair);
  }

  // legs
  if (outfit !== 'robe') {
    const legC = outfit === 'dress' || outfit === 'tribal' ? o.skin : outfit === 'overalls' ? '#3d6fb6' : pantsC;
    s += `<path d="M76 166 L99 166 L98 232 L80 232 Z" fill="${d.shade(legC)}"/>`;
    s += `<path d="M101 166 L124 166 L120 232 L102 232 Z" fill="${d.shade(legC)}"/>`;
    if (legC !== o.skin) {
      s += `<path d="M89 182 L89 228 M111 182 L111 228" ${fold(legC)}/>`;
    }
  }
  // shoes
  const shoeC = o.shoes ?? '#4e342e';
  s += `<path d="M79 229 Q67 245 83 246 L99 246 Q101 236 98 229 Z" fill="${d.shade(shoeC)}"/>`;
  s += `<path d="M121 229 Q133 245 117 246 L101 246 Q99 236 102 229 Z" fill="${d.shade(shoeC)}"/>`;
  s += `<path d="M73 243 L99 243 M101 243 L127 243" stroke="${shade(shoeC, 0.35)}" stroke-width="2" opacity="0.7"/>`;

  // arms (sleeve + hand), mirrored for the right side
  const sleeve = outfit === 'tribal' ? skin : shirt;
  const arm =
    `<path d="M72 106 Q56 108 52 128 L48 158 Q48 166 56 166 Q63 166 63 158 L66 132 Q68 120 76 116 Z" fill="${sleeve}"/>` +
    (outfit === 'tribal' ? '' : `<path d="M48.5 152 Q56 156 63.5 153" ${fold(shirtC)}/>`) +
    `<path d="M47 159 Q43 175 55 178 Q67 176 64 160 Q56 163 47 159 Z" fill="${skin}"/>`;
  s += arm + `<g transform="translate(200 0) scale(-1 1)">${arm}</g>`;

  // torso
  s += `<path d="${torso}" fill="${outfit === 'tribal' ? skin : shirt}"/>`;

  switch (outfit) {
    case 'overalls':
      s += `<path d="M86 101 L100 113 L94 117 Z M114 101 L100 113 L106 117 Z" fill="${d.shade(shade(shirtC, 0.25))}"/>`;
      s += `<path d="M75 130 L125 130 L127 172 Q100 179 73 172 Z" fill="${d.shade('#3d6fb6')}"/>`;
      s += `<path d="M78 132 L73 104 M122 132 L127 104" stroke="#2c5490" stroke-width="7" stroke-linecap="round"/>`;
      s += `<circle cx="79" cy="136" r="4" fill="${d.shade('#f6c945')}"/><circle cx="121" cy="136" r="4" fill="${d.shade('#f6c945')}"/>`;
      s += `<rect x="89" y="142" width="22" height="14" rx="3" fill="none" stroke="#2c5490" stroke-width="2"/>`;
      s += `<path d="M76 158 Q100 162 124 158" stroke="#2c5490" stroke-width="1.6" stroke-dasharray="3 3" fill="none"/>`;
      break;
    case 'stripes': {
      d.raw(`<clipPath id="${name}torso"><path d="${torso}"/></clipPath>`);
      let stripes = '';
      for (let y = 110; y < 182; y += 14) {
        stripes += `<rect x="60" y="${y}" width="80" height="7" fill="#eceef2" class="hl"/>`;
      }
      s += `<g clip-path="url(#${name}torso)">${stripes}</g>`;
      s += `<path d="${torso}" fill="none" stroke="${shade(shirtC, -0.45)}" stroke-width="2.2"/>`;
      // loot sack hanging from the right hand
      s += `<path d="M146 176 Q170 182 168 206 Q166 226 148 226 Q130 226 129 206 Q128 184 146 176 Z" fill="${d.shade('#a07c58')}"/>`;
      s += `<path d="M139 179 Q147 173 155 179" stroke="#6d5038" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
      s += `<path d="M143 200 Q149 196 153 202 Q147 206 149 212" stroke="#6d5038" stroke-width="2.4" fill="none" opacity="0.7"/>`;
      break;
    }
    case 'uniform':
      s += `<path d="M86 101 L100 114 L114 101 L110 97 L100 106 L90 97 Z" fill="${d.shade(shade(shirtC, -0.15))}"/>`;
      s += `<rect x="72" y="120" width="20" height="16" rx="2" fill="${d.shade(shade(shirtC, -0.08))}"/><rect x="108" y="120" width="20" height="16" rx="2" fill="${d.shade(shade(shirtC, -0.08))}"/>`;
      s += `<path d="M72 125 L92 125 M108 125 L128 125" stroke="${shade(shirtC, -0.35)}" stroke-width="2"/>`;
      s += `<path d="M68 106 L82 104 M132 106 L118 104" stroke="${shade(shirtC, -0.35)}" stroke-width="5" stroke-linecap="round"/>`;
      s += `<rect x="68" y="160" width="64" height="10" rx="3" fill="${d.shade('#4a3b26')}"/><rect x="93" y="158.5" width="14" height="13" rx="2" fill="${d.shade('#c9a227')}"/>`;
      break;
    case 'police':
      s += `<path d="M86 101 L100 117 L114 101 L110 97 L100 108 L90 97 Z" fill="${d.shade('#e8eef8')}"/>`;
      s += `<path d="M100 111 L105 119 L100 150 L95 119 Z" fill="${d.shade('#1b2a52')}"/>`;
      s += `<path d="M120 122 l3 6.5 l7 1 l-5 5 l1.4 7 l-6.4 -3.4 l-6.4 3.4 l1.4 -7 l-5 -5 l7 -1 z" fill="${d.shade('#f2c230')}"/>`;
      s += `<path d="M73 124 L89 124 L89 136 L73 136 Z" fill="none" stroke="${shade(shirtC, -0.35)}" stroke-width="2"/>`;
      s += `<rect x="68" y="161" width="64" height="9" rx="3" fill="${d.shade('#1b2a52')}"/><rect x="94" y="160" width="12" height="11" rx="2" fill="${d.shade('#f2c230')}"/>`;
      break;
    case 'robe':
      s += `<path d="M80 102 Q100 124 120 102 L126 110 Q100 138 74 110 Z" fill="${d.shade(shade(shirtC, -0.25))}"/>`;
      s += `<path d="M60 168 Q100 178 140 168" stroke="#e3c271" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      s += `<path d="M88 173 L84 206 M94 174 L94 200" stroke="#e3c271" stroke-width="3.5" stroke-linecap="round"/>`;
      s += `<path d="M100 122 L100 148 M91 130 L109 130" stroke="#f3e3b0" stroke-width="4" stroke-linecap="round"/>`;
      s += `<path d="M74 186 L66 234 M100 184 L100 240 M126 186 L134 234" ${fold(shirtC)}/>`;
      break;
    case 'tribal':
      s += `<path d="M66 160 L134 160 L140 198 L130 187 L122 200 L112 187 L100 202 L88 187 L78 200 L70 187 L60 198 Z" fill="${d.shade('#6fa63a')}"/>`;
      s += `<path d="M64 160 L136 160" stroke="#5d4037" stroke-width="5" stroke-linecap="round"/>`;
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.15 + (0.7 * i) / 6);
        const x = (100 - Math.cos(a) * 28).toFixed(1);
        const y = (106 + Math.sin(a) * 16).toFixed(1);
        s += `<ellipse cx="${x}" cy="${y}" rx="5" ry="3" fill="#fff8e6" transform="rotate(${(90 - (a * 180) / Math.PI).toFixed(0)} ${x} ${y})"/>`;
      }
      s += `<path d="M84 132 Q90 140 86 150 M116 132 Q110 140 114 150" ${fold(o.skin)}/>`;
      break;
    case 'dress':
      s += `<path d="M86 101 Q100 115 114 101" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      s += `<path d="M70 150 L130 150" stroke="${shade(shirtC, -0.25)}" stroke-width="6" stroke-linecap="round"/>`;
      s += `<circle cx="100" cy="150" r="6" fill="${d.shade(shade(shirtC, 0.4))}"/>`;
      s += `<path d="M82 160 L72 206 M100 158 L100 214 M118 160 L128 206" ${fold(shirtC)}/>`;
      break;
    default:
      s += `<path d="M86 101 L100 114 L114 101 L110 97 L100 106 L90 97 Z" fill="${d.shade(shade(shirtC, 0.3))}"/>`;
      s += `<path d="M100 114 L100 172" ${fold(shirtC)}/>`;
      s += `<circle cx="100" cy="128" r="2.4" fill="${shade(shirtC, 0.55)}"/><circle cx="100" cy="146" r="2.4" fill="${shade(shirtC, 0.55)}"/><circle cx="100" cy="162" r="2.4" fill="${shade(shirtC, 0.55)}"/>`;
      s += `<path d="M76 140 Q80 152 76 166 M124 140 Q120 152 124 166" ${fold(shirtC)}/>`;
  }

  if (o.cane) {
    s += `<path d="M146 176 L150 246" stroke="#5d4037" stroke-width="6" stroke-linecap="round"/><path d="M134 174 Q140 162 148 170 L146 178" stroke="#5d4037" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  }
  // neck + head
  s += `<rect x="90" y="88" width="20" height="18" rx="5" fill="${skin}"/>`;
  s += `<path d="M90 93 Q100 101 110 93 L110 99 Q100 105 90 99 Z" fill="${skinDark}" opacity="0.6"/>`;
  s += `<ellipse cx="64.5" cy="63" rx="7" ry="10" fill="${skin}"/><ellipse cx="135.5" cy="63" rx="7" ry="10" fill="${skin}"/>`;
  s += `<path d="M65 57 Q61 63 65 69 M135 57 Q139 63 135 69" stroke="${skinDark}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M64 58 Q64 22 100 22 Q136 22 136 58 Q136 84 120 96 Q100 106 80 96 Q64 84 64 58 Z" fill="${skin}"/>`;
  if (o.mask) {
    s += `<path d="M65 52 Q100 45 135 52 L135 71 Q100 65 65 71 Z" fill="${d.shade('#22252c')}"/>`;
  }
  s += eyes(o);
  if (o.glasses) {
    s += `<circle cx="86" cy="62" r="10.5" fill="#ffffff" opacity="0.15"/><circle cx="114" cy="62" r="10.5" fill="#ffffff" opacity="0.15"/>`;
    s += `<path d="M75.5 62 a10.5 10.5 0 1 0 21 0 a10.5 10.5 0 1 0 -21 0 M103.5 62 a10.5 10.5 0 1 0 21 0 a10.5 10.5 0 1 0 -21 0 M96.5 61 Q100 58 103.5 61 M75.5 60 L66 57 M124.5 60 L134 57" stroke="#3d3a40" stroke-width="2.6" fill="none"/>`;
  }
  s += `<path d="M99 67 Q95.5 76 100 78.5 Q103 78.5 104.5 76.5" stroke="${skinDark}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  s += `<ellipse cx="77" cy="77" rx="6.5" ry="3.6" fill="#ff6b6b" opacity="0.25"/><ellipse cx="123" cy="77" rx="6.5" ry="3.6" fill="#ff6b6b" opacity="0.25"/>`;
  if (o.mustache) {
    s += `<path d="M85 84 Q93 77 100 82 Q107 77 115 84 Q107 89 100 85.5 Q93 89 85 84 Z" fill="${d.shade(o.hair)}"/>`;
  }
  s += mouth(o);
  if (HAIR_FRONT[o.hairStyle]) {
    s += HAIR_FRONT[o.hairStyle](d, o.hair);
  }
  s += hat(o.hat, d);

  const body = o.kid ? `<g transform="translate(17 42) scale(0.83)">${s}</g>` : s;
  sprite(name, 200, 250, d, body);
}

/** Shrinks an animal towards its feet so small creatures read as small. */
const small = (s, k) => `<g transform="translate(${100 * (1 - k)} ${246 * (1 - k)}) scale(${k})">${s}</g>`;

function dog() {
  const d = new Defs('dog');
  const fur = '#c88a4e';
  const dark = '#7a4b26';
  const cream = '#f4e3c8';
  let s = '';
  s += `<path d="M138 204 Q178 190 172 154 Q162 178 136 188 Z" fill="${d.shade(fur)}"/>`;
  s += `<path d="M56 240 Q50 156 100 146 Q150 156 144 240 Z" fill="${d.shade(fur)}"/>`;
  s += `<path d="M80 240 Q76 170 100 160 Q124 170 120 240 Z" fill="${d.shade(cream)}"/>`;
  s += `<rect x="77" y="188" width="19" height="50" rx="9.5" fill="${d.shade(shade(fur, -0.08))}"/><rect x="104" y="188" width="19" height="50" rx="9.5" fill="${d.shade(shade(fur, -0.08))}"/>`;
  s += `<ellipse cx="86" cy="238" rx="13" ry="7" fill="${d.shade(cream)}"/><ellipse cx="114" cy="238" rx="13" ry="7" fill="${d.shade(cream)}"/>`;
  s += `<rect x="74" y="134" width="52" height="10" rx="5" fill="${d.shade('#e53935')}"/><circle cx="100" cy="148" r="7" fill="${d.shade('#f2c230')}"/>`;
  s += `<ellipse cx="100" cy="94" rx="45" ry="41" fill="${d.shade(fur)}"/>`;
  s += `<ellipse cx="118" cy="86" rx="14" ry="12" fill="${d.shade(dark)}"/>`;
  s += `<path d="M60 70 Q38 78 42 124 Q52 136 64 118 Q68 96 72 80 Z" fill="${d.shade(dark)}"/>`;
  s += `<path d="M140 70 Q162 78 158 124 Q148 136 136 118 Q132 96 128 80 Z" fill="${d.shade(dark)}"/>`;
  s += `<ellipse cx="100" cy="114" rx="23" ry="17" fill="${d.shade(cream)}"/>`;
  s += `<ellipse cx="100" cy="104" rx="10" ry="7" fill="${d.shade('#2b2433')}"/><ellipse cx="97" cy="102" rx="3" ry="1.6" fill="#ffffff" opacity="0.7"/>`;
  s += `<path d="M95 120 Q100 138 105 120 Z" fill="${d.shade('#ff7b8a')}"/>`;
  s += `<path d="M100 111 L100 118 M88 117 Q100 127 112 117" stroke="${DARK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  for (const x of [84, 116]) {
    s += `<ellipse cx="${x}" cy="88" rx="6.5" ry="7.5" fill="#2b2433"/><circle cx="${x + 2.2}" cy="85.5" r="2.2" fill="#ffffff" class="hl"/>`;
  }
  s += `<path d="M76 74 Q84 69 92 73 M108 73 Q116 69 124 74" stroke="${DARK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  sprite('dog', 200, 250, d, small(s, 0.9));
}

function cat() {
  const d = new Defs('cat');
  const fur = '#f4a340';
  const stripe = '#c96f16';
  const cream = '#fde7c8';
  let s = '';
  s += `<path d="M138 232 Q188 228 178 178 Q172 150 156 156 Q172 182 162 208 Q152 222 132 220 Z" fill="${d.shade(fur)}"/>`;
  s += `<path d="M60 240 Q54 146 100 128 Q146 146 140 240 Z" fill="${d.shade(fur)}"/>`;
  s += `<path d="M68 180 Q76 184 72 194 M132 180 Q124 184 128 194 M64 206 Q74 210 70 220 M136 206 Q126 210 130 220" stroke="${stripe}" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.8"/>`;
  s += `<path d="M84 240 Q80 160 100 148 Q120 160 116 240 Z" fill="${d.shade(cream)}"/>`;
  s += `<rect x="80" y="198" width="16" height="42" rx="8" fill="${d.shade(fur)}"/><rect x="104" y="198" width="16" height="42" rx="8" fill="${d.shade(fur)}"/>`;
  s += `<ellipse cx="88" cy="239" rx="11" ry="6" fill="${d.shade(cream)}"/><ellipse cx="112" cy="239" rx="11" ry="6" fill="${d.shade(cream)}"/>`;
  s += `<path d="M62 82 L60 30 L98 58 Z" fill="${d.shade(fur)}"/><path d="M67 72 L66 42 L88 60 Z" fill="${d.shade('#f7b8c4')}"/>`;
  s += `<path d="M138 82 L140 30 L102 58 Z" fill="${d.shade(fur)}"/><path d="M133 72 L134 42 L112 60 Z" fill="${d.shade('#f7b8c4')}"/>`;
  s += `<path d="M56 94 Q56 50 100 50 Q144 50 144 94 Q144 130 100 136 Q56 130 56 94 Z" fill="${d.shade(fur)}"/>`;
  s += `<path d="M100 52 L100 68 M88 54 L91 66 M112 54 L109 66" stroke="${stripe}" stroke-width="4" stroke-linecap="round" opacity="0.85"/>`;
  s += `<ellipse cx="91" cy="112" rx="13" ry="10" fill="${d.shade(cream)}"/><ellipse cx="109" cy="112" rx="13" ry="10" fill="${d.shade(cream)}"/>`;
  s += `<path d="M94 102 L106 102 L100 109 Z" fill="${d.shade('#f06d8a')}"/>`;
  s += `<path d="M100 109 Q97 117 90 114 M100 109 Q103 117 110 114" stroke="${DARK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M78 110 L52 104 M78 116 L52 118 M122 110 L148 104 M122 116 L148 118" stroke="${DARK}" stroke-width="1.6" opacity="0.6"/>`;
  for (const x of [80, 120]) {
    s += `<ellipse cx="${x}" cy="88" rx="10" ry="9" fill="${d.shade('#9ccc65')}"/><ellipse cx="${x}" cy="88" rx="2.8" ry="7.5" fill="#1b1416" class="hl"/><circle cx="${x + 3}" cy="85" r="2" fill="#ffffff" class="hl"/>`;
  }
  sprite('cat', 200, 250, d, small(s, 0.86));
}

function mouse() {
  const d = new Defs('mouse');
  const fur = '#a9b3bd';
  const pink = '#f4a7b5';
  let s = '';
  s += `<path d="M122 224 Q172 232 178 198 Q182 176 166 170" stroke="${pink}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
  s += `<ellipse cx="100" cy="190" rx="44" ry="50" fill="${d.shade(fur)}"/>`;
  s += `<ellipse cx="100" cy="202" rx="27" ry="35" fill="${d.shade('#e6ebef')}"/>`;
  s += `<ellipse cx="84" cy="240" rx="15" ry="7" fill="${d.shade(pink)}"/><ellipse cx="116" cy="240" rx="15" ry="7" fill="${d.shade(pink)}"/>`;
  s += `<ellipse cx="68" cy="184" rx="9" ry="15" fill="${d.shade(fur)}"/><ellipse cx="132" cy="184" rx="9" ry="15" fill="${d.shade(fur)}"/>`;
  s += `<circle cx="60" cy="70" r="30" fill="${d.shade(fur)}"/><circle cx="60" cy="70" r="19" fill="${d.shade(pink)}"/>`;
  s += `<circle cx="140" cy="70" r="30" fill="${d.shade(fur)}"/><circle cx="140" cy="70" r="19" fill="${d.shade(pink)}"/>`;
  s += `<circle cx="100" cy="110" r="42" fill="${d.shade(fur)}"/>`;
  s += `<ellipse cx="100" cy="126" rx="21" ry="15" fill="${d.shade('#c7cfd6')}"/>`;
  s += `<circle cx="100" cy="118" r="7" fill="${d.shade('#e2647f')}"/>`;
  s += `<rect x="95" y="130" width="5" height="7" rx="1.5" fill="#ffffff"/><rect x="100.5" y="130" width="5" height="7" rx="1.5" fill="#ffffff"/>`;
  s += `<path d="M84 122 L60 116 M84 128 L60 132 M116 122 L140 116 M116 128 L140 132" stroke="${DARK}" stroke-width="1.6" opacity="0.6"/>`;
  for (const x of [85, 115]) {
    s += `<ellipse cx="${x}" cy="100" rx="7" ry="8.5" fill="#2b2433"/><circle cx="${x + 2.4}" cy="97" r="2.4" fill="#ffffff" class="hl"/>`;
  }
  s += `<ellipse cx="74" cy="118" rx="6" ry="3.5" fill="#ff7b8a" opacity="0.35"/><ellipse cx="126" cy="118" rx="6" ry="3.5" fill="#ff7b8a" opacity="0.35"/>`;
  sprite('mouse', 200, 250, d, small(s, 0.72));
}

// Night-time gorge with a rope bridge. Uses the same proportions as scene():
// banks end at 24% / 76% of the width and the walkway sits at 70.5% height.
function sceneNight() {
  const W = 2200;
  const H = 1000;
  const L = W * 0.24;
  const R = W * 0.76;
  const deck = H * 0.705;
  const d = new Defs('night');
  const r = rng(11);
  let s = '';
  // sky, stars, moon
  s += `<rect width="${W}" height="${H * 0.55}" fill="${d.linear('#081530', '#2b3f78')}"/>`;
  for (let i = 0; i < 140; i++) {
    const x = r() * W;
    const y = r() * H * 0.36;
    const rad = 0.8 + r() * 2.2;
    s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad.toFixed(1)}" fill="#ffffff" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
  }
  s += `<circle cx="${W * 0.22}" cy="130" r="190" fill="${d.radial('#fff6d8', '#fff6d8', 0.5, 0.5, 0.5, 0.35, 0)}"/>`;
  s += `<circle cx="${W * 0.22}" cy="130" r="56" fill="#f6f0d4"/>`;
  s += `<circle cx="${W * 0.22 - 18}" cy="118" r="10" fill="#e3dcbc"/><circle cx="${W * 0.22 + 16}" cy="146" r="7" fill="#e3dcbc"/><circle cx="${W * 0.22 + 10}" cy="112" r="5" fill="#e3dcbc"/>`;
  // mountains and hills
  const peaks = [[-50, 340], [180, 190], [420, 300], [640, 170], [900, 300], [1140, 200], [1380, 320], [1600, 180], [1850, 300], [2060, 210], [2260, 320]];
  let m = 'M-50 430 ';
  peaks.forEach(([x, y]) => (m += `L${x} ${y} `));
  m += 'L2260 430 Z';
  s += `<path d="${m}" fill="${d.linear('#22346a', '#1a2a55')}"/>`;
  s += `<path d="M0 390 Q200 320 420 370 Q640 310 860 368 Q1100 318 1320 366 Q1560 312 1780 364 Q2000 318 2200 360 L2200 470 L0 470 Z" fill="${d.linear('#1f4a45', '#173a37')}"/>`;
  for (let x = -20; x < W + 40; x += 36 + r() * 18) {
    s += `<circle cx="${x.toFixed(0)}" cy="${(392 + r() * 20).toFixed(0)}" r="${(22 + r() * 14).toFixed(0)}" fill="${r() > 0.5 ? '#173b33' : '#1c4339'}"/>`;
  }
  // the gorge: dark depths with a river glinting far below
  s += `<rect y="${H * 0.4}" width="${W}" height="${H * 0.6}" fill="${d.linear('#0e1a33', '#050a18')}"/>`;
  s += `<path d="M${L + 30} ${H * 0.9} Q${W / 2} ${H * 0.85} ${R - 30} ${H * 0.9} L${R - 30} ${H} L${L + 30} ${H} Z" fill="${d.linear('#2c5c8f', '#173a63')}" opacity="0.7"/>`;
  for (let i = 0; i < 18; i++) {
    const x = W / 2 - 200 + r() * 400;
    const y = H * 0.86 + r() * H * 0.12;
    s += `<path d="M${x.toFixed(0)} ${y.toFixed(0)} q12 -4 24 0" stroke="#9cc7f0" stroke-width="3" fill="none" opacity="0.35"/>`;
  }
  // cliffs: grassy tops seen from above, rocky faces dropping into the gorge
  const cliff = (side) => {
    const sign = side === 'left' ? 1 : -1;
    const edge = side === 'left' ? L : R;
    const outer = side === 'left' ? -20 : W + 20;
    let face = `M${outer} ${H * 0.4} L${edge - sign * 40} ${H * 0.4} `;
    for (let y = H * 0.4; y <= H + 20; y += 50) {
      const jitter = (r() - 0.5) * 30;
      face += `L${edge + sign * 6 + jitter} ${y} `;
    }
    face += `L${outer} ${H + 20} Z`;
    let out = `<path d="${face}" fill="${d.linear('#4a4560', '#2e2a40')}"/>`;
    let top = `M${outer} ${H * 0.4} L${edge - sign * 40} ${H * 0.4} `;
    for (let y = H * 0.4; y <= H + 20; y += 50) {
      top += `L${edge - sign * (34 + r() * 16)} ${y} `;
    }
    top += `L${outer} ${H + 20} Z`;
    out += `<path d="${top}" fill="${d.linear('#3f7a4c', '#24503a')}"/>`;
    // rock ledges on the cliff face
    for (let y = H * 0.45; y < H; y += 70 + r() * 40) {
      out += `<path d="M${edge - sign * 34} ${y.toFixed(0)} l${sign * 34} ${(8 + r() * 10).toFixed(0)}" stroke="#211d31" stroke-width="4" opacity="0.6"/>`;
    }
    return out;
  };
  s += cliff('left') + cliff('right');
  // grass tufts and a few glowing fireflies
  for (let i = 0; i < 90; i++) {
    const left = r() < 0.5;
    const x = left ? r() * (L - 80) : R + 80 + r() * (W - R - 80);
    const y = H * 0.44 + r() * H * 0.54;
    s += `<path d="M${x - 7} ${y} L${x - 3} ${y - 14} L${x} ${y} L${x + 4} ${y - 18} L${x + 7} ${y}" fill="none" stroke="#2f6b3c" stroke-width="3" stroke-linejoin="round" opacity="0.8"/>`;
  }
  for (let i = 0; i < 26; i++) {
    const x = r() * W;
    const y = H * 0.38 + r() * H * 0.55;
    s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="9" fill="${d.radial('#fff59d', '#fff59d', 0.5, 0.5, 0.5, 0.8, 0)}"/><circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="2.4" fill="#fffde7"/>`;
  }
  // rope bridge
  const x0 = L - 70;
  const x1 = R + 70;
  const sag = x => 10 * Math.sin((Math.PI * (x - x0)) / (x1 - x0));
  const rope = (yOff, depth) => {
    let p = `M${x0} ${deck + yOff}`;
    for (let x = x0; x <= x1; x += 40) {
      p += ` L${x} ${(deck + yOff + sag(x) * depth).toFixed(1)}`;
    }
    return p;
  };
  s += `<path d="${rope(14, 1)}" stroke="#5b4027" stroke-width="7" fill="none"/>`;
  for (let x = x0; x < x1; x += 26) {
    const y = deck + sag(x) - 4;
    s += `<rect x="${x}" y="${y.toFixed(1)}" width="22" height="16" rx="3" fill="${(x / 26) % 2 < 1 ? '#8a5a32' : '#7a4e2b'}" stroke="#4a2f19" stroke-width="2"/>`;
  }
  s += `<path d="${rope(-70, 3)}" stroke="#a0784e" stroke-width="6" fill="none"/>`;
  for (let x = x0 + 26; x < x1; x += 52) {
    s += `<path d="M${x} ${(deck - 70 + sag(x) * 3).toFixed(1)} L${x} ${(deck + sag(x) - 4).toFixed(1)}" stroke="#a0784e" stroke-width="3" opacity="0.85"/>`;
  }
  for (const px of [x0 - 6, x1 - 10]) {
    s += `<rect x="${px}" y="${deck - 92}" width="16" height="118" rx="5" fill="${d.linear('#7a4e2b', '#4a2f19')}" stroke="#2e1d0f" stroke-width="2"/>`;
  }
  save('scene_night', W, H, `${d}${s}`, W, H);
}

function torch() {
  const d = new Defs('torch');
  let s = '';
  s += `<path d="M24 70 L36 70 L33 158 Q30 162 27 158 Z" fill="${d.shade('#8d5a2b')}"/>`;
  s += `<rect x="20" y="62" width="20" height="14" rx="4" fill="${d.shade('#5d4037')}"/>`;
  s += `<path d="M30 6 Q52 34 46 52 Q42 66 30 66 Q18 66 14 52 Q8 34 30 6 Z" fill="${d.linear('#ffd54f', '#ff6d00')}"/>`;
  s += `<path d="M30 28 Q42 44 38 54 Q35 62 30 62 Q25 62 22 54 Q18 44 30 28 Z" fill="${d.linear('#fffde7', '#ffca28')}" class="hl"/>`;
  sprite('torch', 60, 164, d, s, 2);
}

function glow() {
  const d = new Defs('glow');
  // build the shape first so its gradient is registered before the defs are written
  const circle = `<circle cx="150" cy="150" r="150" fill="${d.radial('#ffcc66', '#ff9900', 0.5, 0.5, 0.5, 0.55, 0)}"/>`;
  save('glow', 300, 300, `${d}${circle}`, 300, 300);
}

function wolf() {
  const d = new Defs('wolf');
  const grey = d.linear('#9aa6b2', '#5e6a77');
  const light = '#e9eef2';
  let s = '';
  s += `<path d="M62 214 Q12 206 20 148 Q40 180 74 188 Z" fill="${grey}"/><path d="M20 148 Q22 168 34 176 Q26 156 20 148 Z" fill="${light}"/>`;
  s += `<path d="M52 238 Q46 150 100 140 Q154 150 148 238 Z" fill="${grey}"/>`;
  s += `<path d="M78 238 Q74 160 100 150 Q126 160 122 238 Z" fill="${light}"/>`;
  s += `<rect x="77" y="186" width="19" height="50" rx="9.5" fill="#7d8996"/><rect x="104" y="186" width="19" height="50" rx="9.5" fill="#7d8996"/>`;
  s += `<ellipse cx="86" cy="236" rx="14" ry="7" fill="${light}"/><ellipse cx="114" cy="236" rx="14" ry="7" fill="${light}"/>`;
  s += `<path d="M60 112 L70 142 L80 128 L90 150 L100 132 L110 150 L120 128 L130 142 L140 112 Z" fill="${light}"/>`;
  s += `<path d="M62 86 L56 20 L98 58 Z" fill="#7d8996"/><path d="M67 76 L64 36 L89 60 Z" fill="#f5b8c8"/>`;
  s += `<path d="M138 86 L144 20 L102 58 Z" fill="#7d8996"/><path d="M133 76 L136 36 L111 60 Z" fill="#f5b8c8"/>`;
  s += `<path d="M54 94 Q54 50 100 48 Q146 50 146 94 Q146 126 100 134 Q54 126 54 94 Z" fill="${grey}"/>`;
  s += `<path d="M58 98 L40 106 L58 112 L44 124 L66 120 Z" fill="#7d8996"/><path d="M142 98 L160 106 L142 112 L156 124 L134 120 Z" fill="#7d8996"/>`;
  s += `<path d="M76 92 Q100 80 124 92 L120 122 Q100 138 80 122 Z" fill="${light}"/>`;
  s += `<ellipse cx="100" cy="114" rx="21" ry="15" fill="#f7f9fb"/>`;
  s += `<path d="M89 102 Q100 95 111 102 Q107 111 100 112 Q93 111 89 102 Z" fill="${DARK}"/><ellipse cx="96" cy="101" rx="3" ry="1.6" fill="#fff" opacity="0.7"/>`;
  s += `<path d="M100 112 L100 117 M88 118 Q100 126 112 118" stroke="${DARK}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M91 120 L94 129 L97 121 Z M109 120 L106 129 L103 121 Z" fill="#fff"/>`;
  for (const x of [80, 120]) {
    s += `<ellipse cx="${x}" cy="84" rx="10" ry="8" fill="#ffc94a"/><ellipse cx="${x}" cy="84" rx="3.2" ry="7" fill="#1f2328"/><circle cx="${x + 3}" cy="81" r="2" fill="#fff"/>`;
  }
  s += `<path d="M66 70 L92 78 M134 70 L108 78" stroke="${DARK}" stroke-width="5" stroke-linecap="round"/>`;
  sprite('wolf', 200, 250, d, s);
}

function goat() {
  const d = new Defs('goat');
  const fur = d.linear('#ffffff', '#ded6c8');
  let s = '';
  s += `<ellipse cx="100" cy="186" rx="52" ry="40" fill="${fur}"/>`;
  for (const x of [66, 84, 106, 124]) {
    s += `<rect x="${x}" y="196" width="13" height="42" rx="6" fill="#ece5d9"/><rect x="${x}" y="230" width="13" height="9" rx="3" fill="#5d4037"/>`;
  }
  s += `<path d="M82 150 Q100 170 118 150 L114 120 L86 120 Z" fill="#f4efe6"/>`;
  s += `<rect x="80" y="140" width="40" height="9" rx="4.5" fill="#e53935"/>`;
  s += `<circle cx="100" cy="156" r="8" fill="${d.linear('#ffe17a', '#e0a419')}"/><rect x="98" y="158" width="4" height="5" rx="2" fill="#8d6e00"/>`;
  s += `<path d="M84 58 Q72 18 46 28" stroke="#9c7b5b" stroke-width="11" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M116 58 Q128 18 154 28" stroke="#9c7b5b" stroke-width="11" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M76 40 L84 44 M70 32 L78 36 M124 40 L116 44 M130 32 L122 36" stroke="#7a5c40" stroke-width="2.5"/>`;
  s += `<ellipse cx="52" cy="82" rx="24" ry="10" fill="#ece5d9" transform="rotate(18 52 82)"/><ellipse cx="54" cy="83" rx="15" ry="5" fill="#f6bfc8" transform="rotate(18 54 83)"/>`;
  s += `<ellipse cx="148" cy="82" rx="24" ry="10" fill="#ece5d9" transform="rotate(-18 148 82)"/><ellipse cx="146" cy="83" rx="15" ry="5" fill="#f6bfc8" transform="rotate(-18 146 83)"/>`;
  s += `<path d="M68 74 Q68 46 100 46 Q132 46 132 74 L126 118 Q100 138 74 118 Z" fill="${fur}"/>`;
  s += `<path d="M86 52 Q92 40 100 50 Q108 40 114 52 Q100 58 86 52 Z" fill="#ece5d9"/>`;
  s += `<path d="M92 128 Q100 164 108 128 Z" fill="#e7dfd0"/>`;
  s += `<ellipse cx="100" cy="118" rx="19" ry="14" fill="#f6d2c8"/>`;
  s += `<ellipse cx="93" cy="115" rx="3" ry="2" fill="#8d5a4b"/><ellipse cx="107" cy="115" rx="3" ry="2" fill="#8d5a4b"/>`;
  s += `<path d="M93 123 Q100 128 107 123" stroke="#8d5a4b" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  for (const x of [84, 116]) {
    s += `<ellipse cx="${x}" cy="84" rx="9" ry="9" fill="#fff8e1"/><rect x="${x - 6}" y="81.5" width="12" height="5" rx="2.5" fill="#3e2723"/><circle cx="${x + 3}" cy="80" r="1.8" fill="#fff"/>`;
  }
  s += `<ellipse cx="78" cy="102" rx="6" ry="4" fill="#ff8a8a" opacity="0.35"/><ellipse cx="122" cy="102" rx="6" ry="4" fill="#ff8a8a" opacity="0.35"/>`;
  sprite('goat', 200, 250, d, s);
}

function cabbage() {
  const d = new Defs('cabbage');
  let s = '';
  const outer = d.linear('#4caf50', '#2e7d32');
  s += `<path d="M100 238 Q14 236 22 154 Q52 176 100 206 Z" fill="${outer}"/>`;
  s += `<path d="M100 238 Q186 236 178 154 Q148 176 100 206 Z" fill="${outer}"/>`;
  s += `<path d="M100 240 Q60 230 52 196 Q80 206 100 222 Q120 206 148 196 Q140 230 100 240 Z" fill="#388e3c"/>`;
  s += `<circle cx="100" cy="152" r="68" fill="${d.radial('#d4f29a', '#6dbb45', 0.42, 0.36, 0.7)}"/>`;
  s += `<path d="M36 156 Q52 92 122 86 Q88 124 92 216 Q50 200 36 156 Z" fill="#8fd05a" opacity="0.92"/>`;
  s += `<path d="M164 156 Q152 96 92 92 Q130 132 110 218 Q154 200 164 156 Z" fill="#7cc24c" opacity="0.92"/>`;
  s += `<path d="M58 150 Q76 120 106 104 M68 186 Q78 150 100 128 M142 150 Q128 124 104 108 M134 186 Q124 152 108 130" stroke="#e3f6c4" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/>`;
  s += `<ellipse cx="76" cy="112" rx="14" ry="8" fill="#fff" opacity="0.35" transform="rotate(-30 76 112)"/>`;
  for (const x of [86, 114]) {
    s += `<ellipse cx="${x}" cy="158" rx="6" ry="8" fill="${DARK}"/><circle cx="${x + 2}" cy="155" r="2.2" fill="#fff"/>`;
  }
  s += `<ellipse cx="74" cy="172" rx="7" ry="4" fill="#ff8a8a" opacity="0.45"/><ellipse cx="126" cy="172" rx="7" ry="4" fill="#ff8a8a" opacity="0.45"/>`;
  s += `<path d="M90 174 Q100 184 110 174" stroke="${DARK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
  sprite('cabbage', 200, 250, d, s);
}

// ------------------------------------------------------------ boat + oars --

function boat() {
  const d = new Defs('boat');
  const wood = d.linear('#c88a4a', '#7b4a22');
  let back = `<path d="M18 46 Q180 6 342 46 Z" fill="#5a3518"/>`;
  back += `<path d="M30 46 Q180 18 330 46 Z" fill="#6d4321"/>`;
  save('boat_back', 360, 130, `${d}${back}`, 720, 260);

  const d2 = new Defs('hull');
  let s = '';
  s += `<path d="M8 44 L352 44 Q344 102 290 122 L70 122 Q16 102 8 44 Z" fill="${d2.linear('#c88a4a', '#6f3f1b')}"/>`;
  s += `<path d="M18 70 Q180 80 342 70 M30 96 Q180 106 330 96" stroke="#5a3518" stroke-width="3" fill="none" opacity="0.55"/>`;
  s += `<path d="M14 54 Q180 62 346 54" stroke="#e2a96a" stroke-width="3" fill="none" opacity="0.5"/>`;
  for (const x of [60, 120, 180, 240, 300]) {
    s += `<circle cx="${x}" cy="${x === 60 || x === 300 ? 76 : 80}" r="2.6" fill="#4a2b12"/>`;
  }
  s += `<rect x="2" y="36" width="356" height="14" rx="7" fill="${d2.linear('#8b5a2b', '#5a3518')}"/>`;
  s += `<rect x="10" y="38" width="340" height="4" rx="2" fill="#d79a5c" opacity="0.7"/>`;
  s += `<path d="M150 78 h60 v22 h-60 z" fill="#f6efe2" opacity="0.92" rx="4"/>`;
  s += `<path d="M160 89 h40" stroke="#c88a4a" stroke-width="3"/>`;
  void wood;
  d2.raw(OUTLINE_FILTER(3));
  save('boat_front', 360, 130, `${d2}<g filter="url(#outline)">${s}</g>`, 720, 260);
}

function oar() {
  const d = new Defs('oar');
  let s = '';
  s += `<rect x="26" y="6" width="9" height="170" rx="4.5" fill="${d.linear('#d39a5e', '#9a6232', true)}"/>`;
  s += `<rect x="24" y="4" width="13" height="26" rx="6" fill="#5a3518"/>`;
  s += `<path d="M30 164 Q8 172 10 210 Q14 236 30 238 Q46 236 50 210 Q52 172 30 164 Z" fill="${d.linear('#e0a96d', '#a86a35')}"/>`;
  s += `<path d="M30 176 L30 228" stroke="#8b5a2b" stroke-width="3" stroke-linecap="round"/>`;
  sprite('oar', 60, 242, d, s, 2);
}

// -------------------------------------------------------------- scenery --

function scene() {
  const W = 2200;
  const H = 1000;
  const d = new Defs('scene');
  const r = rng(42);
  let s = '';
  // sky
  s += `<rect width="${W}" height="${H * 0.5}" fill="${d.linear('#3a8fe0', '#bfe8ff')}"/>`;
  s += `<circle cx="${W * 0.78}" cy="120" r="260" fill="${d.radial('#fff7c2', '#fff7c2', 0.5, 0.5, 0.5, 0.75, 0)}"/>`;
  s += `<circle cx="${W * 0.78}" cy="120" r="62" fill="#fff8d6"/>`;
  // far mountains
  const peaks = [[-50, 360], [140, 170], [330, 300], [520, 140], [760, 290], [960, 180], [1180, 310], [1380, 150], [1620, 290], [1820, 190], [2040, 300], [2260, 200]];
  let m = `M-50 420 `;
  peaks.forEach(([x, y]) => (m += `L${x} ${y} `));
  m += `L2260 420 Z`;
  s += `<path d="${m}" fill="${d.linear('#a9c8ec', '#d6e9fa')}"/>`;
  peaks.slice(1, -1).forEach(([x, y]) => {
    s += `<path d="M${x - 34} ${y + 44} L${x} ${y} L${x + 34} ${y + 44} L${x + 16} ${y + 34} L${x} ${y + 48} L${x - 14} ${y + 34} Z" fill="#ffffff" opacity="0.9"/>`;
  });
  // mid hills
  s += `<path d="M0 380 Q180 300 380 350 Q560 290 760 350 Q960 300 1100 352 Q1260 296 1460 344 Q1660 290 1860 346 Q2040 300 2200 340 L2200 460 L0 460 Z" fill="${d.linear('#86c97a', '#5ea85a')}"/>`;
  // tree line
  for (let x = -20; x < W + 40; x += 34 + r() * 18) {
    const y = 380 + r() * 22;
    const rad = 22 + r() * 16;
    s += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${rad.toFixed(0)}" fill="${r() > 0.5 ? '#3f8b4a' : '#4b9a52'}"/>`;
  }
  // ground
  s += `<rect y="${H * 0.4}" width="${W}" height="${H * 0.6}" fill="${d.linear('#8fd36a', '#4f9e3e')}"/>`;
  // river (flows from the hills towards the viewer)
  const L = W * 0.24;
  const R = W * 0.76;
  const top = H * 0.4;
  const riverPath = (pad = 0) =>
    `M${W / 2 - 40 - pad} ${top} Q${W / 2 - 120 - pad} ${H * 0.47} ${L - pad} ${H * 0.54} ` +
    `Q${L - 30 - pad} ${H * 0.72} ${L + 10 - pad} ${H * 0.86} Q${L - 20 - pad} ${H * 0.95} ${L - 10 - pad} ${H + 10} ` +
    `L${R + 10 + pad} ${H + 10} Q${R + 20 + pad} ${H * 0.95} ${R - 10 + pad} ${H * 0.86} Q${R + 30 + pad} ${H * 0.72} ${R + pad} ${H * 0.54} ` +
    `Q${W / 2 + 120 + pad} ${H * 0.47} ${W / 2 + 40 + pad} ${top} Z`;
  s += `<path d="${riverPath(26)}" fill="${d.linear('#d9c08a', '#c4a46a')}"/>`;
  s += `<path d="${riverPath(10)}" fill="#8f7a52" opacity="0.55"/>`;
  s += `<path d="${riverPath(0)}" fill="${d.linear('#7fd0f5', '#1f78c4')}"/>`;
  s += `<path d="${riverPath(0)}" fill="${d.linear('#ffffff', '#ffffff', true)}" opacity="0.06"/>`;
  // docks where the boat moors
  const dockY = H * 0.62;
  for (const [x0, dir] of [[L - 60, 1], [R + 60, -1]]) {
    const xs = dir === 1 ? x0 : x0 - 114;
    s += `<rect x="${xs}" y="${dockY + 40}" width="114" height="46" rx="6" fill="#6d4321"/>`;
    for (let i = 0; i < 4; i++) {
      s += `<rect x="${xs + i * 28 + 2}" y="${dockY + 34}" width="24" height="46" rx="4" fill="${i % 2 ? '#b77b43' : '#a96f3a'}"/>`;
    }
    for (const px of [xs + 8, xs + 94]) {
      s += `<rect x="${px}" y="${dockY + 20}" width="14" height="96" rx="5" fill="#5a3518"/>`;
    }
  }
  // rocks along the banks
  const rocks = [[L - 10, H * 0.56, 34], [L - 28, H * 0.9, 42], [R + 18, H * 0.58, 30], [R + 26, H * 0.93, 46], [L + 4, H * 0.76, 18], [R - 4, H * 0.8, 20]];
  rocks.forEach(([x, y, rr]) => {
    s += `<ellipse cx="${x}" cy="${y}" rx="${rr}" ry="${rr * 0.7}" fill="${d.linear('#b4bcc4', '#77818b')}"/>`;
    s += `<ellipse cx="${x - rr * 0.3}" cy="${y - rr * 0.25}" rx="${rr * 0.35}" ry="${rr * 0.18}" fill="#fff" opacity="0.4"/>`;
  });
  // reeds
  for (const [x, y] of [[L - 60, H * 0.98], [L + 20, H * 0.99], [R + 60, H * 0.97], [R - 30, H * 0.99], [L - 40, H * 0.6], [R + 50, H * 0.62]]) {
    for (let i = 0; i < 5; i++) {
      const dx = (i - 2) * 9;
      s += `<path d="M${x + dx} ${y} Q${x + dx * 1.6} ${y - 50} ${x + dx * 2.2} ${y - 80 - r() * 30}" stroke="#3d7f32" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    }
    s += `<rect x="${x - 3}" y="${y - 110}" width="10" height="30" rx="5" fill="#7b4f2a"/>`;
  }
  // grass tufts and flowers
  for (let i = 0; i < 160; i++) {
    let x = r() * W;
    const y = H * 0.44 + r() * H * 0.56;
    if (x > L - 60 && x < R + 60) {
      x = x < W / 2 ? L - 80 - r() * 200 : R + 80 + r() * 200;
    }
    if (r() < 0.6) {
      s += `<path d="M${x - 8} ${y} L${x - 4} ${y - 16} L${x} ${y} L${x + 4} ${y - 20} L${x + 8} ${y}" fill="none" stroke="#3f8f37" stroke-width="3" stroke-linejoin="round" opacity="0.7"/>`;
    } else {
      const c = ['#ffffff', '#ffe066', '#ff8fb1', '#b39dff'][Math.floor(r() * 4)];
      s += `<g opacity="0.95">${[0, 72, 144, 216, 288].map(a => `<circle cx="${(x + Math.cos((a * Math.PI) / 180) * 5).toFixed(1)}" cy="${(y + Math.sin((a * Math.PI) / 180) * 5).toFixed(1)}" r="4" fill="${c}"/>`).join('')}<circle cx="${x}" cy="${y}" r="3" fill="#ffb300"/></g>`;
    }
  }
  // bushes in the far corners
  for (const [x, y] of [[60, 470], [2140, 470]]) {
    s += `<circle cx="${x - 40}" cy="${y}" r="56" fill="#3f8b4a"/><circle cx="${x + 30}" cy="${y - 20}" r="64" fill="#4b9a52"/><circle cx="${x}" cy="${y + 20}" r="50" fill="#57a85c"/>`;
  }
  // soft vignette
  s += `<rect width="${W}" height="${H}" fill="${d.radial('#000000', '#000000', 0.5, 0.45, 0.75, 0, 0.22)}"/>`;
  save('scene', W, H, `${d}${s}`, W, H);
}

function cloud() {
  const d = new Defs('cloud');
  const fill = d.linear('#ffffff', '#e3eef8');
  const s =
    `<g fill="${fill}"><circle cx="110" cy="110" r="56"/><circle cx="180" cy="80" r="70"/><circle cx="260" cy="104" r="58"/>` +
    `<circle cx="320" cy="124" r="40"/><rect x="70" y="110" width="280" height="56" rx="28"/></g>`;
  save('cloud', 400, 180, `${d}${s}`, 600, 270);
}

function ripples() {
  const r = rng(7);
  let s = '';
  for (let i = 0; i < 46; i++) {
    const x = r() * 512;
    const y = r() * 512;
    const w = 18 + r() * 40;
    const o = (0.18 + r() * 0.3).toFixed(2);
    for (const dy of [-512, 0, 512]) {
      for (const dx of [-512, 0, 512]) {
        s += `<path d="M${(x + dx).toFixed(0)} ${(y + dy).toFixed(0)} q${(w / 2).toFixed(0)} -7 ${w.toFixed(0)} 0" stroke="#ffffff" stroke-width="4" stroke-linecap="round" fill="none" opacity="${o}"/>`;
      }
    }
  }
  save('ripples', 512, 512, s);
}

// ------------------------------------------------------------- UI + misc --

function trophy() {
  const d = new Defs('trophy');
  const gold = d.linear('#ffe682', '#e09a12');
  let s = '';
  s += `<circle cx="150" cy="130" r="128" fill="${d.radial('#fff3a6', '#fff3a6', 0.5, 0.5, 0.5, 0.7, 0)}"/>`;
  s += `<path d="M86 70 Q36 70 44 112 Q52 150 104 152" stroke="${gold}" stroke-width="16" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M214 70 Q264 70 256 112 Q248 150 196 152" stroke="${gold}" stroke-width="16" fill="none" stroke-linecap="round"/>`;
  s += `<path d="M76 52 L224 52 Q226 150 150 178 Q74 150 76 52 Z" fill="${gold}"/>`;
  s += `<path d="M92 62 Q96 130 136 160" stroke="#fff6c8" stroke-width="10" fill="none" stroke-linecap="round" opacity="0.7"/>`;
  s += `<rect x="134" y="174" width="32" height="40" fill="${d.linear('#f2c13a', '#b97a0b')}"/>`;
  s += `<rect x="100" y="212" width="100" height="22" rx="8" fill="${gold}"/>`;
  s += `<rect x="86" y="232" width="128" height="40" rx="10" fill="${d.linear('#7b4a22', '#4a2b12')}"/>`;
  s += `<rect x="120" y="242" width="60" height="18" rx="4" fill="#ffd54f"/>`;
  s += `<path d="M150 78 l9 19 l21 3 l-15 14 l4 21 l-19 -10 l-19 10 l4 -21 l-15 -14 l21 -3 z" fill="#fffbe6"/>`;
  sprite('trophy', 300, 300, d, s, 1.5);
}

function splash() {
  const d = new Defs('splash');
  let pts = '';
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const rr = i % 2 ? 92 : 132;
    pts += `${(150 + Math.cos(a) * rr).toFixed(1)},${(150 + Math.sin(a) * rr).toFixed(1)} `;
  }
  let s = `<polygon points="${pts}" fill="${d.linear('#ff8a65', '#e53935')}" stroke-linejoin="round"/>`;
  s += `<circle cx="150" cy="150" r="78" fill="${d.linear('#ffb199', '#ff5252')}"/>`;
  s += `<rect x="136" y="92" width="28" height="74" rx="14" fill="#fff"/><circle cx="150" cy="196" r="15" fill="#fff"/>`;
  sprite('splash', 300, 300, d, s, 1.5);
}

function star(name, filled) {
  const d = new Defs(name);
  const fill = filled ? d.linear('#ffe682', '#f2a20c') : '#ffffff';
  const s =
    `<path d="M50 6 L62 34 L93 37 L69 58 L77 89 L50 73 L23 89 L31 58 L7 37 L38 34 Z" fill="${fill}" ${filled ? '' : 'opacity="0.35"'} stroke-linejoin="round"/>` +
    (filled ? `<path d="M40 30 L50 14 L54 26" stroke="#fffbe6" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.8"/>` : '');
  sprite(name, 100, 96, d, s, 1.5);
}

function icon(name, content) {
  save(name, 96, 96, `<g fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">${content}</g>`, 144, 144);
}

function icons() {
  icon('ic_back', `<path d="M58 20 L30 48 L58 76"/>`);
  icon('ic_undo', `<path d="M36 26 L18 44 L36 62"/><path d="M20 44 H58 Q80 44 80 62 Q80 80 58 80 H44"/>`);
  icon('ic_reset', `<path d="M76 50 A28 28 0 1 1 66 26"/><path d="M52 16 L68 26 L58 42"/>`);
  icon('ic_hint', `<path d="M48 12 Q74 12 76 38 Q76 54 62 64 L62 70 L34 70 L34 64 Q20 54 20 38 Q22 12 48 12 Z" fill="#fff" stroke="none"/><path d="M36 80 H60 M40 88 H56"/>`);
  icon('ic_rules', `<path d="M16 22 Q32 14 48 26 Q64 14 80 22 V78 Q64 70 48 82 Q32 70 16 78 Z"/><path d="M48 26 V80"/>`);
  icon('ic_sound', `<path d="M14 38 H30 L50 20 V76 L30 58 H14 Z" fill="#fff"/><path d="M62 36 Q70 48 62 60"/><path d="M72 26 Q88 48 72 70"/>`);
  icon('ic_sound_off', `<path d="M14 38 H30 L50 20 V76 L30 58 H14 Z" fill="#fff"/><path d="M64 36 L86 60 M86 36 L64 60"/>`);
  icon('ic_music', `<path d="M38 72 V22 L80 12 V62" /><ellipse cx="28" cy="72" rx="12" ry="9" fill="#fff"/><ellipse cx="70" cy="62" rx="12" ry="9" fill="#fff"/>`);
  icon('ic_music_off', `<path d="M38 72 V22 L80 12 V62" /><ellipse cx="28" cy="72" rx="12" ry="9" fill="#fff"/><ellipse cx="70" cy="62" rx="12" ry="9" fill="#fff"/><path d="M14 14 L84 84" stroke="#26303d" stroke-width="16"/><path d="M14 14 L84 84"/>`);
  icon('ic_check', `<path d="M20 50 L40 70 L78 28"/>`);
  icon('ic_play', `<path d="M30 18 L78 48 L30 78 Z" fill="#fff"/>`);
  icon('ic_paddle', `<path d="M22 74 L66 30"/><path d="M58 22 Q74 6 86 14 Q94 26 78 40 L70 38 L60 30 Z" fill="#fff"/>`);
  icon('ic_people', `<circle cx="34" cy="32" r="12" fill="#fff" stroke="none"/><circle cx="66" cy="36" r="10" fill="#fff" stroke="none"/><path d="M12 80 Q12 52 34 52 Q56 52 56 80 Z" fill="#fff" stroke="none"/><path d="M50 80 Q52 56 66 56 Q84 56 86 80 Z" fill="#fff" stroke="none"/>`);
  icon('ic_clock', `<circle cx="48" cy="50" r="32"/><path d="M48 30 V50 L62 60"/><path d="M38 12 H58"/>`);
  icon('ic_lock', `<path d="M30 44 V32 Q30 12 48 12 Q66 12 66 32 V44"/><rect x="20" y="42" width="56" height="42" rx="9" fill="#fff" stroke="none"/><circle cx="48" cy="59" r="6" fill="#26303d" stroke="none"/><rect x="45" y="60" width="6" height="13" rx="3" fill="#26303d" stroke="none"/>`);
}

/** Small backdrops for the stage cards: a sunny riverside and a moonlit bridge. */
function cardBackdrops() {
  const W = 320;
  const H = 260;
  let d = new Defs('cardday');
  let s = `<rect width="${W}" height="${H}" fill="${d.linear('#5bb6f2', '#d2f0ff')}"/>`;
  s += `<circle cx="258" cy="52" r="70" fill="${d.radial('#fff7c2', '#fff7c2', 0.5, 0.5, 0.5, 0.7, 0)}"/><circle cx="258" cy="52" r="22" fill="#fff6cf"/>`;
  s += `<path d="M-10 150 L50 92 L100 140 L160 80 L220 138 L270 96 L330 150 Z" fill="#b9d6f2"/>`;
  s += `<path d="M150 92 L160 80 L170 92 L163 89 L160 95 L157 89 Z M40 102 L50 92 L60 102 L53 99 L50 105 L47 99 Z" fill="#ffffff"/>`;
  s += `<path d="M0 160 Q80 128 160 150 Q240 126 320 152 L320 200 L0 200 Z" fill="#7fc472"/>`;
  s += `<path d="M0 182 Q160 166 320 182 L320 ${H} L0 ${H} Z" fill="${d.linear('#8fd36a', '#5aa64a')}"/>`;
  s += `<path d="M118 ${H} Q140 210 150 182 L170 182 Q180 210 202 ${H} Z" fill="${d.linear('#7fd0f5', '#2f86c9')}"/>`;
  for (const [x, y, c] of [[34, 222, '#ffe066'], [70, 240, '#ff8fb1'], [250, 226, '#ffffff'], [286, 244, '#b39dff']]) {
    s += `<circle cx="${x}" cy="${y}" r="4" fill="${c}"/>`;
  }
  save('card_day', W, H, `${d}${s}`, W * 2, H * 2);

  d = new Defs('cardnight');
  const r = rng(5);
  s = `<rect width="${W}" height="${H}" fill="${d.linear('#0b1a3a', '#2b3f78')}"/>`;
  for (let i = 0; i < 40; i++) {
    s += `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * 130).toFixed(0)}" r="${(0.6 + r() * 1.6).toFixed(1)}" fill="#ffffff" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
  }
  s += `<circle cx="62" cy="54" r="60" fill="${d.radial('#fff6d8', '#fff6d8', 0.5, 0.5, 0.5, 0.35, 0)}"/><circle cx="62" cy="54" r="18" fill="#f6f0d4"/>`;
  s += `<path d="M-10 150 L60 100 L120 140 L190 90 L250 136 L330 104 L330 160 L-10 160 Z" fill="#22346a"/>`;
  s += `<rect y="160" width="${W}" height="100" fill="${d.linear('#0e1a33', '#050a18')}"/>`;
  s += `<path d="M0 160 L96 160 L84 ${H} L0 ${H} Z M224 160 L320 160 L320 ${H} L236 ${H} Z" fill="${d.linear('#3f7a4c', '#24503a')}"/>`;
  s += `<path d="M84 196 Q160 210 236 196" stroke="#5b4027" stroke-width="5" fill="none"/>`;
  for (let x = 88; x < 234; x += 12) {
    s += `<rect x="${x}" y="${(196 + 10 * Math.sin((Math.PI * (x - 84)) / 152) - 3).toFixed(1)}" width="9" height="7" rx="2" fill="#8a5a32"/>`;
  }
  s += `<path d="M84 168 Q160 186 236 168" stroke="#a0784e" stroke-width="3" fill="none"/>`;
  save('card_night', W, H, `${d}${s}`, W * 2, H * 2);
}

// ------------------------------------------------------------------ run --

const COUPLE_COLORS = ['#e53935', '#43a047', '#1e88e5', '#fb8c00'];

person('farmer', { skin: SKIN.tan, hair: '#6d4c41', hairStyle: 'short', shirt: '#d84d3b', outfit: 'overalls', hat: 'straw', mood: 'happy' });
person('missionary', { skin: SKIN.light, hair: '#8d6e63', hairStyle: 'monk', shirt: '#8d6e63', outfit: 'robe', mood: 'happy', shoes: '#6d4c41' });
person('cannibal', { skin: SKIN.ogre, hair: '#3e2723', hairStyle: 'wild', shirt: '#9ccc65', outfit: 'tribal', mood: 'grin', browColor: '#3e2723', eyeColor: '#c98a1a', shoes: '#5d4037' });
COUPLE_COLORS.forEach((c, i) => {
  person(`husband${i + 1}`, { skin: [SKIN.tan, SKIN.brown, SKIN.light, SKIN.dark][i], hair: ['#3e2723', '#212121', '#a1662f', '#1b1b1b'][i], hairStyle: 'short', shirt: c, pants: '#37474f', mood: 'happy', mustache: i === 1 });
  person(`wife${i + 1}`, { skin: [SKIN.light, SKIN.dark, SKIN.tan, SKIN.brown][i], hair: ['#f2c14e', '#1b1b1b', '#8b3a1a', '#3e2723'][i], hairStyle: i % 2 ? 'bun' : 'long', shirt: c, outfit: 'dress', mood: 'happy', lashes: true, eyeColor: ['#3b78c4', '#4a2c1a', '#3f8a4f', '#6b4226'][i], shoes: shade(c, -0.3) });
});
person('father', { skin: SKIN.tan, hair: '#4e342e', hairStyle: 'short', shirt: '#26a69a', pants: '#455a64', mood: 'happy', mustache: true });
person('mother', { skin: SKIN.tan, hair: '#5d4037', hairStyle: 'long', shirt: '#ab47bc', outfit: 'dress', mood: 'happy', lashes: true, shoes: '#6a1b9a' });
person('son', { skin: SKIN.tan, hair: '#5d4037', hairStyle: 'spiky', shirt: '#ffa726', pants: '#1e88e5', mood: 'open', kid: true, shoes: '#e53935' });
person('daughter', { skin: SKIN.tan, hair: '#5d4037', hairStyle: 'pigtails', shirt: '#ec407a', outfit: 'dress', mood: 'open', kid: true, lashes: true, shoes: '#ad1457' });
person('police', { skin: SKIN.brown, hair: '#212121', hairStyle: 'short', shirt: '#3f6fd1', pants: '#1a2a52', outfit: 'police', hat: 'police', mood: 'happy', shoes: '#111' });
person('thief', { skin: SKIN.light, hair: '#212121', hairStyle: 'short', shirt: '#2b2f3a', pants: '#2b2f3a', outfit: 'stripes', hat: 'beanie', mask: true, mood: 'sly', shoes: '#111' });
person('soldier', { skin: SKIN.tan, hair: '#4e342e', hairStyle: 'short', shirt: '#6b7b45', pants: '#4f5a32', outfit: 'uniform', hat: 'helmet', mood: 'happy', shoes: '#2b2b2b' });
person('grandpa', { skin: SKIN.light, hair: '#e6e6e6', hairStyle: 'monk', shirt: '#8d6e63', pants: '#5d6b75', mood: 'happy', mustache: true, glasses: true, cane: true, browColor: '#bdbdbd', shoes: '#4e342e' });
person('grandma', { skin: SKIN.light, hair: '#d7dde2', hairStyle: 'bun', shirt: '#7e57c2', outfit: 'dress', mood: 'happy', lashes: true, glasses: true, cane: true, browColor: '#b0b8bf', shoes: '#4a2f6b' });
wolf();
dog();
cat();
mouse();
goat();
cabbage();
boat();
oar();
scene();
sceneNight();
torch();
glow();
cloud();
ripples();
trophy();
splash();
star('star', true);
star('star_empty', false);
icons();
cardBackdrops();

fs.writeFileSync(path.join(OUT, '..', 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Generated ${manifest.length} SVGs in ${OUT}`);
