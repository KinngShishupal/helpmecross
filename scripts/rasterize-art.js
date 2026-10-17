/* eslint-env node */
// Usage: node rasterize.js <art dir> <png out dir> [contact sheet path]
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const [artDir, outDir, sheet] = process.argv.slice(2);
const manifest = JSON.parse(fs.readFileSync(path.join(artDir, 'manifest.json'), 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

for (const item of manifest) {
  const svg = fs.readFileSync(path.join(artDir, 'svg', `${item.name}.svg`), 'utf8');
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: item.width } }).render().asPng();
  fs.writeFileSync(path.join(outDir, `${item.name}.png`), png);
}
console.log(`Rasterised ${manifest.length} images`);

if (sheet) {
  // Contact sheet of all sprites on a checker-free dark backdrop for review.
  const cells = manifest.filter(m => m.name !== 'scene' && m.name !== 'ripples');
  const cols = 8;
  const cw = 160;
  const ch = 190;
  const rows = Math.ceil(cells.length / cols);
  let body = `<rect width="100%" height="100%" fill="#5aa64a"/>`;
  cells.forEach((m, i) => {
    const x = (i % cols) * cw;
    const y = Math.floor(i / cols) * ch;
    const data = fs.readFileSync(path.join(outDir, `${m.name}.png`)).toString('base64');
    const scale = Math.min((cw - 10) / m.width, (ch - 10) / m.height);
    body += `<image x="${x + 5}" y="${y + 5}" width="${m.width * scale}" height="${m.height * scale}" href="data:image/png;base64,${data}"/>`;
  });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * cw}" height="${rows * ch}">${body}</svg>`;
  fs.writeFileSync(sheet, new Resvg(svg).render().asPng());
}
