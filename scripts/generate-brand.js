/* eslint-env node */
// App icon, logo and Play Store graphics, built from the game's own sprites in art/svg.
// Needs @resvg/resvg-js and pngjs (see art/README.md). Usage:
//   NODE_PATH=<scratch>/node_modules node scripts/generate-brand.js
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const { PNG } = require('pngjs');

const ROOT = path.join(__dirname, '..');
const ART = path.join(ROOT, 'art', 'svg');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const IOS_ICON = path.join(ROOT, 'ios', 'HelpMeCross', 'Images.xcassets', 'AppIcon.appiconset');
const STORE = path.join(ROOT, 'store');

const FONT_FILES = ['seguibl.ttf', 'ariblk.ttf']
  .map(f => path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts', f))
  .filter(f => fs.existsSync(f));
const TITLE_FONT = `font-family="Segoe UI Black, Segoe UI, Arial Black, sans-serif" font-weight="900"`;
const INK = '#2b2433';

const sprite = name =>
  `data:image/svg+xml;base64,${fs.readFileSync(path.join(ART, `${name}.svg`)).toString('base64')}`;
const img = (name, x, y, w, h) => `<image href="${sprite(name)}" x="${x}" y="${y}" width="${w}" height="${h}"/>`;

/** The landing screen's boat: farmer and goat riding between the back and front of the hull. */
function boatWithRiders(cx, bottom, B) {
  const hullH = B * 0.36;
  const riderW = B * 0.36;
  const riderH = riderW * 1.25;
  const riderBottom = bottom - B * 0.14;
  const top = bottom - hullH;
  return (
    img('boat_back', cx - B / 2, top, B, hullH) +
    img('farmer', cx - riderW + B * 0.02, riderBottom - riderH, riderW, riderH) +
    img('goat', cx - B * 0.02, riderBottom - riderH, riderW, riderH) +
    img('boat_front', cx - B / 2, top, B, hullH)
  );
}

/** Wake lines on either side of the hull. */
function wake(cx, y, B) {
  let s = '';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x0 = cx + side * (B * 0.5 + 14 + i * 34);
      const x1 = x0 + side * (60 - i * 10);
      const yy = y - 6 + i * 22;
      s += `<path d="M${x0} ${yy} Q${(x0 + x1) / 2} ${yy - 10} ${x1} ${yy}" stroke="#fff" stroke-width="${12 - i * 3}" stroke-linecap="round" fill="none" opacity="${0.75 - i * 0.2}"/>`;
    }
  }
  return s;
}

/** Full-bleed 1024 backdrop: sky, far bank and river. Adaptive-icon background layer. */
function backdrop() {
  return (
    `<defs>` +
    `<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b8ad6"/><stop offset="1" stop-color="#a6d7f7"/></linearGradient>` +
    `<linearGradient id="river" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd0f4"/><stop offset="1" stop-color="#2465ad"/></linearGradient>` +
    `<radialGradient id="sun"><stop offset="0" stop-color="#fff6cf" stop-opacity="0.95"/><stop offset="1" stop-color="#fff6cf" stop-opacity="0"/></radialGradient>` +
    `</defs>` +
    `<rect width="1024" height="1024" fill="url(#sky)"/>` +
    `<circle cx="720" cy="300" r="190" fill="url(#sun)"/><circle cx="720" cy="300" r="62" fill="#f8edc6"/>` +
    `<path d="M0 470 Q130 395 300 440 T620 420 T1024 430 V560 H0 Z" fill="#6cb85a"/>` +
    `<path d="M0 500 Q110 455 240 485 T520 470 T800 478 T1024 470 V560 H0 Z" fill="#3f8f45"/>` +
    `<rect y="528" width="1024" height="16" fill="#c9a96b"/>` +
    `<rect y="540" width="1024" height="484" fill="url(#river)"/>` +
    [
      [180, 640, 120], [760, 610, 150], [300, 900, 170], [820, 880, 130], [120, 790, 90], [900, 740, 90],
    ]
      .map(([x, y, w]) => `<path d="M${x} ${y} h${w}" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity="0.28"/>`)
      .join('')
  );
}

/** Adaptive-icon foreground: the boat, kept inside the 66% safe circle. */
function foreground() {
  const B = 560;
  const bottom = 700;
  return (
    `<ellipse cx="512" cy="${bottom - 6}" rx="${B * 0.52}" ry="26" fill="#0d3b6e" opacity="0.28"/>` +
    wake(512, bottom - 30, B) +
    boatWithRiders(512, bottom, B)
  );
}

const svgDoc = (w, h, body, viewBox = `0 0 ${w} ${h}`) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">${body}</svg>`;

/** Icon art cropped to the area a launcher mask shows, optionally clipped to a shape. */
function icon(size, shape) {
  const crop = 120; // trims the outer band that adaptive masks cut away anyway
  const box = 1024 - crop * 2;
  const clip =
    shape === 'circle'
      ? `<clipPath id="c"><circle cx="512" cy="512" r="${box / 2}"/></clipPath>`
      : shape === 'rounded'
        ? `<clipPath id="c"><rect x="${crop}" y="${crop}" width="${box}" height="${box}" rx="${box * 0.2}"/></clipPath>`
        : '';
  const body = `<defs>${clip}</defs><g ${clip ? 'clip-path="url(#c)"' : ''}>${backdrop()}${foreground()}</g>`;
  return svgDoc(size, size, body, `${crop} ${crop} ${box} ${box}`);
}

function render(svg, width) {
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Segoe UI' },
  })
    .render()
    .asPng();
}

/** Writes a PNG; `opaque` drops the alpha channel (App Store icons and Play feature graphics). */
function write(file, svg, width, opaque = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let png = render(svg, width);
  if (opaque) {
    const decoded = PNG.sync.read(png);
    png = PNG.sync.write(decoded, { colorType: 2, inputColorType: 6, inputHasAlpha: true });
  }
  fs.writeFileSync(file, png);
}

// ---- Android launcher icons -------------------------------------------------
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(DENSITIES)) {
  const dir = path.join(RES, `mipmap-${d}`);
  write(path.join(dir, 'ic_launcher.png'), icon(1024, 'rounded'), 48 * k);
  write(path.join(dir, 'ic_launcher_round.png'), icon(1024, 'circle'), 48 * k);
  write(path.join(dir, 'ic_launcher_foreground.png'), svgDoc(1024, 1024, foreground()), 108 * k);
  write(path.join(dir, 'ic_launcher_background.png'), svgDoc(1024, 1024, backdrop()), 108 * k);
}
const adaptive =
  `<?xml version="1.0" encoding="utf-8"?>\n` +
  `<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n` +
  `    <background android:drawable="@mipmap/ic_launcher_background"/>\n` +
  `    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n` +
  `</adaptive-icon>\n`;
fs.mkdirSync(path.join(RES, 'mipmap-anydpi-v26'), { recursive: true });
fs.writeFileSync(path.join(RES, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive);
fs.writeFileSync(path.join(RES, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive);

// ---- iOS: one 1024 universal icon (Xcode 14+), no alpha ----------------------
write(path.join(IOS_ICON, 'AppIcon-1024.png'), icon(1024), 1024, true);
fs.writeFileSync(
  path.join(IOS_ICON, 'Contents.json'),
  JSON.stringify(
    {
      images: [{ filename: 'AppIcon-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' }],
      info: { author: 'xcode', version: 1 },
    },
    null,
    2,
  ) + '\n',
);

// ---- Logo -------------------------------------------------------------------
function wordmark(x, y, size, anchor = 'start') {
  const line = (text, dy, fill) =>
    `<text x="${x}" y="${y + dy}" ${TITLE_FONT} font-size="${size}" letter-spacing="${size * 0.03}" text-anchor="${anchor}" ` +
    `fill="${fill}" stroke="${INK}" stroke-width="${size * 0.11}" stroke-linejoin="round" paint-order="stroke">${text}</text>`;
  return (
    `<defs><linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe682"/><stop offset="1" stop-color="#f2a20c"/></linearGradient>` +
    `<filter id="drop" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="${size * 0.05}" stdDeviation="${size * 0.04}" flood-color="#000" flood-opacity="0.35"/></filter></defs>` +
    `<g filter="url(#drop)">${line('HELP ME', 0, '#fff')}${line('CROSS', size * 0.98, 'url(#gold)')}</g>`
  );
}
const iconImage = (x, y, s) =>
  `<image href="data:image/png;base64,${render(icon(1024, 'rounded'), s).toString('base64')}" x="${x}" y="${y}" width="${s}" height="${s}"/>`;

const logo = svgDoc(1500, 560, iconImage(30, 30, 500) + wordmark(590, 258, 170));
fs.mkdirSync(path.join(STORE, 'brand'), { recursive: true });
fs.writeFileSync(path.join(STORE, 'brand', 'logo.svg'), logo);
write(path.join(STORE, 'brand', 'logo.png'), logo, 1500);
const logoStacked = svgDoc(900, 940, iconImage(200, 30, 500) + wordmark(450, 700, 160, 'middle'));
write(path.join(STORE, 'brand', 'logo-stacked.png'), logoStacked, 900);
write(path.join(STORE, 'brand', 'icon-1024.png'), icon(1024), 1024);

// ---- Google Play listing graphics ------------------------------------------
write(path.join(STORE, 'play', 'icon-512.png'), icon(1024), 512);

function featureGraphic() {
  // Landing scene scaled to cover 1024x500, boat on the river, title over the sky.
  const sceneW = 1100;
  const B = 300;
  return svgDoc(
    1024,
    500,
    `<defs><linearGradient id="shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0e2040" stop-opacity="0.45"/><stop offset="0.5" stop-color="#0e2040" stop-opacity="0"/></linearGradient></defs>` +
      img('scene', -(sceneW - 1024) / 2, 0, sceneW, 500) +
      `<rect width="1024" height="500" fill="url(#shade)"/>` +
      `<ellipse cx="512" cy="452" rx="${B * 0.52}" ry="14" fill="#0d3b6e" opacity="0.3"/>` +
      wake(512, 440, B * 0.55) +
      boatWithRiders(512, 458, B) +
      `<text x="512" y="118" ${TITLE_FONT} font-size="86" letter-spacing="3" text-anchor="middle" fill="#fff" stroke="${INK}" stroke-width="10" stroke-linejoin="round" paint-order="stroke">HELP ME CROSS</text>` +
      `<text x="512" y="168" ${TITLE_FONT} font-size="30" letter-spacing="4" text-anchor="middle" fill="#ffc83d" stroke="${INK}" stroke-width="6" stroke-linejoin="round" paint-order="stroke">RIVER &amp; BRIDGE PUZZLES</text>`,
  );
}
write(path.join(STORE, 'play', 'feature-graphic.png'), featureGraphic(), 1024, true);

console.log(`Brand assets written (fonts: ${FONT_FILES.map(f => path.basename(f)).join(', ') || 'none found'})`);
