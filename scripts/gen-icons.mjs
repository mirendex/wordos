import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DESK = '#3B3560';
const INK = '#16151A';
const PAPER = '#EDE7D8';
const PAPER2 = '#E2DBC8';
const BLUE = '#39479E';
const RED = '#C1432C';
const YELLOW = '#D9A404';
const YELLOW_HI = '#F0C94A';
const SHADOW = 'rgba(0,0,0,0.35)';

// 36×36 grid = the 108dp adaptive canvas; the book stays inside the 66dp safe zone
const box = (x, y, w, h, fill) => [
  [x, y, w, h, INK],
  [x + 1, y + 1, w - 2, h - 2, fill],
];

const lines = [
  [10, 14, 5, 1],
  [10, 16, 5, 1],
  [10, 18, 5, 1],
  [10, 20, 3, 1],
  [19, 14, 2, 1],
  [19, 16, 2, 1],
  [19, 19, 6, 1],
  [19, 21, 6, 1],
  [19, 23, 4, 1],
];
const underline = [10, 22, 6, 1];
const spine = [17, 11, 1, 15];
const ribbon = [22, 8, 4, 9];

const BOOK = [
  ...box(7, 13, 22, 15, BLUE),
  ...box(8, 11, 10, 15, PAPER2),
  ...box(17, 11, 11, 15, PAPER),
  ...lines.map((l) => [...l, BLUE]),
  [...underline, RED],
  ...box(...ribbon, YELLOW),
  [23, 9, 1, 7, YELLOW_HI],
];

const rects = (px) =>
  px.map(([x, y, w, h, c]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`).join('');

function book() {
  const shadow = BOOK.filter((p) => p[4] === INK).map(([x, y, w, h]) => [x + 1, y + 1, w, h, SHADOW]);
  return rects([...shadow, ...BOOK]);
}

function monochrome() {
  const white = BOOK.map(([x, y, w, h]) => [x, y, w, h, '#fff']);
  const cut = [...lines, underline, spine, ribbon].map(([x, y, w, h]) => [x, y, w, h, '#000']);
  const [rx, ry, rw, rh] = ribbon;
  const mask = rects([...white, ...cut, [rx + 1, ry + 1, rw - 2, rh - 2, '#fff']]);
  return `<mask id="m">${mask}</mask><rect width="36" height="36" fill="#fff" mask="url(#m)"/>`;
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
};

const RES = 'android/app/src/main/res';
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const jobs = [];
for (const [d, k] of Object.entries(DENSITIES)) {
  jobs.push([`${RES}/mipmap-${d}/ic_launcher.png`, 'legacy', 48 * k]);
  jobs.push([`${RES}/mipmap-${d}/ic_launcher_round.png`, 'round', 48 * k]);
  jobs.push([`${RES}/mipmap-${d}/ic_launcher_foreground.png`, 'foreground', 108 * k]);
  jobs.push([`${RES}/mipmap-${d}/ic_launcher_monochrome.png`, 'monochrome', 108 * k]);
}
jobs.push(['public/icon-192.png', 'full', 192]);
jobs.push(['public/icon-512.png', 'full', 512]);

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage();
for (const [out, kind, size] of jobs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:transparent">${variants[kind](size)}</body>`);
  writeFileSync(resolve(out), await page.locator('svg').screenshot({ omitBackground: true }));
  console.log(out, size);
}
await browser.close();
