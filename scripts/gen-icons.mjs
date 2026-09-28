import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DESK = '#3B3560';
const INK = '#16151A';
const PAPER = '#EDE7D8';
const PAPER2 = '#E2DBC8';
const BLUE = '#39479E';
const RED = '#C1432C';

// 36×36 grid = the 108dp adaptive canvas; the laptop stays inside the 66dp safe zone
const box = (x, y, w, h, fill) => [
  [x, y, w, h, INK],
  [x + 1, y + 1, w - 2, h - 2, fill],
];

// an open laptop whose screen is the open book: the lid's ink bezel frames the two pages
// the way the old blue cover did, and the base underneath nods at the app being its own OS
const lines = [
  [11, 10, 4, 1],
  [11, 12, 4, 1],
  [11, 14, 4, 1],
  [11, 16, 3, 1],
  [19, 10, 2, 1],
  [19, 12, 2, 1],
  [19, 14, 2, 1],
  [19, 16, 2, 1],
  [19, 18, 5, 1],
];
const underline = [11, 18, 5, 1];
const spine = [17, 8, 1, 13];

// ribbon hangs from the top edge of the screen and ends in a swallowtail notch
const ribbon = [
  [22, 8, 3, 7],
  [22, 15, 1, 1],
  [24, 15, 1, 1],
];

// the bezel is one unit thick except for a two-unit chin above the hinge
const lid = [9, 7, 18, 16];
const deck = [6, 22, 24, 4];
const groove = [15, 24, 6, 1];

const LAPTOP = [
  ...box(...deck, PAPER2),
  [...groove, INK],
  [...lid, INK],
  [10, 8, 7, 13, PAPER2],
  [18, 8, 8, 13, PAPER],
  ...lines.map((l) => [...l, BLUE]),
  [...underline, RED],
  ...ribbon.map((r) => [...r, RED]),
];

const rects = (px) =>
  px.map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('');

// the laptop spans y 7..25; centre it on 18
const lift = (body) => `<g transform="translate(0 1.5)">${body}</g>`;

const book = () => lift(rects(LAPTOP));

function monochrome() {
  const white = LAPTOP.map(([x, y, w, h]) => [x, y, w, h, '#fff']);
  // with no colours to tell them apart, a gap at the hinge keeps the lid and the base
  // reading as two parts, and the ribbon becomes a bookmark-shaped hole in the page
  const hinge = [lid[0], 22, lid[2], 1];
  const hole = ribbon.map(([x, y, w, h]) => (y === 8 ? [x, 9, w, h - 1] : [x, y, w, h]));
  const cut = [...lines, underline, spine, hinge, groove, ...hole];
  const mask = lift(rects([...white, ...cut.map(([x, y, w, h]) => [x, y, w, h, '#000'])]));
  return `<mask id="m">${mask}</mask><rect width="36" height="36" fill="#fff" mask="url(#m)"/>`;
}

// the status-bar icon gets its own 24dp grid: the launcher book's 1-unit lines would shrink
// below a pixel at mdpi, so this is the same book redrawn with gaps wide enough to survive
const STAT_BOOK = [
  [3, 5, 9, 13],
  [13, 5, 9, 13],
  [2, 18, 21, 2],
];
const STAT_CUT = [
  [5, 8, 5, 1],
  [5, 11, 5, 1],
  [5, 14, 3, 1],
  [14, 8, 3, 1],
  [14, 11, 3, 1],
  [14, 14, 5, 1],
  [18, 6, 3, 4],
  [18, 10, 1, 1],
  [20, 10, 1, 1],
];

function stat() {
  const white = STAT_BOOK.map(([x, y, w, h]) => [x, y, w, h, '#fff']);
  const cut = STAT_CUT.map(([x, y, w, h]) => [x, y, w, h, '#000']);
  return `<mask id="m">${rects([...white, ...cut])}</mask><rect width="24" height="24" fill="#fff" mask="url(#m)"/>`;
}

const svg = (size, view, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${view}" shape-rendering="crispEdges">${body}</svg>`;

const variants = {
  foreground: (s) => svg(s, '-4 -4 44 44', book()),
  monochrome: (s) => svg(s, '-4 -4 44 44', monochrome()),
  legacy: (s) =>
    svg(s, '1 1 34 34', `<rect x="2" y="2" width="32" height="32" rx="6" fill="${DESK}"/>${book()}`),
  round: (s) => svg(s, '1 1 34 34', `<circle cx="18" cy="18" r="16" fill="${DESK}"/>${book()}`),
  full: (s) => svg(s, '-1 -1 38 38', `<rect x="-1" y="-1" width="38" height="38" fill="${DESK}"/>${book()}`),
  stat: (s) => svg(s, '0 0 24 24', stat()),
};

const RES = 'android/app/src/main/res';
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const jobs = [];
for (const [d, k] of Object.entries(DENSITIES)) {
  jobs.push([`${RES}/mipmap-${d}/ic_launcher.png`, 'legacy', 48 * k]);
  jobs.push([`${RES}/mipmap-${d}/ic_launcher_round.png`, 'round', 48 * k]);
  jobs.push([`${RES}/mipmap-${d}/ic_launcher_foreground.png`, 'foreground', 108 * k]);
  jobs.push([`${RES}/mipmap-${d}/ic_launcher_monochrome.png`, 'monochrome', 108 * k]);
  jobs.push([`${RES}/drawable-${d}/ic_stat_en.png`, 'stat', 24 * k]);
}
jobs.push(['public/icon-192.png', 'full', 192]);
jobs.push(['public/icon-512.png', 'full', 512]);

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage();
// `node scripts/gen-icons.mjs stat` redraws just the given kinds
const only = process.argv.slice(2);
for (const [out, kind, size] of jobs) {
  if (only.length && !only.includes(kind)) continue;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:transparent">${variants[kind](size)}</body>`);
  writeFileSync(resolve(out), await page.locator('svg').screenshot({ omitBackground: true }));
  console.log(out, size);
}
await browser.close();
