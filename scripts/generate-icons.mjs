// Generates every app icon from one vector motif (a sprout growing out of an open book).
// Run: npm run generate:icons
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

sharp.cache(false);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = (p) => resolve(root, 'assets/images', p);
mkdirSync(out(''), { recursive: true });

const C = {
  bgTop: '#F4FAEA',
  bgBottom: '#D3EDC2',
  glow: '#FFFBEA',
  cover: '#A07B55',
  coverEdge: '#82603F',
  page: '#FFFDF6',
  pageShade: '#F1E3CF',
  pageLine: '#E4D6BC',
  stem: '#5FA85A',
  leafA: '#8BCB6B',
  leafB: '#7CC57E',
  vein: '#5FA85A',
  shadow: '#5B4636',
};

/** Motif drawn on a 1024 canvas, roughly centered. `mono` = single-color silhouette. */
function motif({ detail = true, mono = null } = {}) {
  const f = (color) => mono ?? color;
  const lines = detail && !mono
    ? `<g stroke="${C.pageLine}" stroke-width="10" stroke-linecap="round" fill="none">
        <path d="M300 690 C360 672 420 674 470 692"/><path d="M300 740 C360 722 420 724 470 742"/>
        <path d="M724 690 C664 672 604 674 554 692"/><path d="M724 740 C664 722 604 724 554 742"/>
      </g>`
    : '';
  return `
  ${mono ? '' : `<ellipse cx="512" cy="872" rx="330" ry="34" fill="${C.shadow}" opacity="0.12"/>`}
  <path d="M512 668 C420 626 300 626 210 660 L210 842 C300 808 420 808 512 852 C604 808 724 808 814 842 L814 660 C724 626 604 626 512 668 Z"
        fill="${f(C.cover)}" ${mono ? '' : `stroke="${C.coverEdge}" stroke-width="10" stroke-linejoin="round"`}/>
  ${mono ? '' : `
  <path d="M512 650 C430 606 320 604 246 634 L246 806 C320 778 430 780 512 826 Z" fill="${C.page}" stroke="${C.pageShade}" stroke-width="8" stroke-linejoin="round"/>
  <path d="M512 650 C594 606 704 604 778 634 L778 806 C704 778 594 780 512 826 Z" fill="${C.page}" stroke="${C.pageShade}" stroke-width="8" stroke-linejoin="round"/>
  <path d="M512 650 L512 826" stroke="${C.pageShade}" stroke-width="10" stroke-linecap="round"/>
  ${lines}`}
  <path d="M512 660 C506 580 500 500 512 410" stroke="${f(C.stem)}" stroke-width="38" stroke-linecap="round" fill="none"/>
  <path d="M508 498 C430 504 336 462 300 360 C404 342 494 402 508 498 Z" fill="${f(C.leafA)}"/>
  <path d="M516 432 C536 330 640 258 750 276 C742 386 640 452 516 432 Z" fill="${f(C.leafB)}"/>
  ${mono ? '' : `
  <path d="M494 482 C440 470 384 434 344 382" stroke="${C.vein}" stroke-width="9" stroke-linecap="round" fill="none" opacity="0.55"/>
  <path d="M532 420 C590 396 648 350 704 302" stroke="${C.vein}" stroke-width="9" stroke-linecap="round" fill="none" opacity="0.55"/>
  <ellipse cx="640" cy="330" rx="40" ry="18" transform="rotate(-28 640 330)" fill="#FFFFFF" opacity="0.35"/>
  <ellipse cx="372" cy="398" rx="30" ry="13" transform="rotate(24 372 398)" fill="#FFFFFF" opacity="0.35"/>`}`;
}

const background = (rx = 0, { top = C.bgTop, bottom = C.bgBottom, glow = true } = {}) => `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="${rx}" fill="url(#bg)"/>
  ${glow ? `<circle cx="512" cy="430" r="300" fill="${C.glow}" opacity="0.7"/>` : ''}`;

const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;

/** Content group scaled around the canvas center. */
const scaled = (scale, dy, body) =>
  `<g transform="translate(512 512) scale(${scale}) translate(-512 ${-512 + dy})">${body}</g>`;

const ICON = svg(`${background()}${scaled(1, -60, motif())}`);
// Small sizes: stronger background contrast, no glow or page lines, bigger motif.
const FAVICON = svg(`${background(230, { top: '#E3F3D3', bottom: '#BFE3A6', glow: false })}${scaled(1.34, -40, motif({ detail: false }))}`);
const ADAPTIVE_FG = svg(scaled(0.6, -60, motif()));
const ADAPTIVE_BG = svg(background());
const MONO = svg(scaled(0.6, -60, motif({ mono: '#FFFFFF' })));
const SPLASH = svg(scaled(1.05, -60, motif()));

const render = (markup, size) => sharp(Buffer.from(markup), { density: 72 * (size / 1024) * 4 }).resize(size, size);

async function writePng(markup, size, file, { opaque = false, palette = false } = {}) {
  let img = render(markup, size);
  if (opaque) img = img.flatten({ background: C.bgBottom });
  await img.png({ compressionLevel: 9, palette, quality: 90, effort: 10 }).toFile(out(file));
}

/** Packs PNG images into a multi-size .ico (PNG-compressed entries, supported by all modern browsers). */
function writeIco(pngs, file) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + 16 * pngs.length;
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  writeFileSync(file, Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]));
}

await writePng(ICON, 1024, 'icon.png', { opaque: true });
await writePng(ICON, 500, 'app-icon-500.png', { opaque: true, palette: true });
await render(ICON, 500).flatten({ background: C.bgBottom }).jpeg({ quality: 90, mozjpeg: true }).toFile(out('app-icon-500.jpg'));
await writePng(ADAPTIVE_FG, 1024, 'android-icon-foreground.png');
await writePng(ADAPTIVE_BG, 1024, 'android-icon-background.png', { opaque: true });
await writePng(MONO, 1024, 'android-icon-monochrome.png');
await writePng(SPLASH, 1024, 'splash-icon.png');
await writePng(FAVICON, 64, 'favicon.png');

const icoPngs = await Promise.all(
  [16, 32, 48].map(async (size) => ({ size, data: await render(FAVICON, size).png({ compressionLevel: 9 }).toBuffer() })),
);
writeIco(icoPngs, resolve(root, 'public/favicon.ico'));
await render(FAVICON, 64).png({ compressionLevel: 9 }).toFile(resolve(root, 'public/favicon.png'));
await render(ICON, 180).flatten({ background: C.bgBottom }).png({ compressionLevel: 9 }).toFile(resolve(root, 'public/apple-touch-icon.png'));
writeFileSync(resolve(root, 'assets/images/icon-source.svg'), ICON);

for (const f of ['icon.png', 'app-icon-500.png', 'app-icon-500.jpg', 'android-icon-foreground.png', 'android-icon-background.png', 'android-icon-monochrome.png', 'splash-icon.png', 'favicon.png']) {
  const meta = await sharp(out(f)).metadata();
  console.log(`${f.padEnd(30)} ${meta.width}x${meta.height}  alpha=${meta.hasAlpha}  ${(statSync(out(f)).size / 1024).toFixed(1)}KB`);
}
console.log(`public/favicon.ico                16/32/48  ${(statSync(resolve(root, 'public/favicon.ico')).size / 1024).toFixed(1)}KB`);
