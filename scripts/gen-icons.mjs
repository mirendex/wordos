import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// the brand colour: the desktop the app itself is drawn on, so launcher icon, splash and app
// follow each other without a jump
const DESK = '#3B3560';

// the logo is the app's own window, drawn as pixel art: a thin red title bar with a button,
// a paper body saying "En", and the desktop's arrow pointer resting on its corner. It's kept as
// a pixel map and only ever scaled by whole numbers, so every stroke stays the same width at
// every size
const LOGO = `
KKKKKKKKKKKKKKKKKKKKKKKK...
KRRRRRRRRRRRRRRRRRRbbbRK...
KRRRRRRRRRRRRRRRRRRbbbRK...
KRRRRRRRRRRRRRRRRRRbbbRK...
KKKKKKKKKKKKKKKKKKKKKKKK...
KPPPPPPPPPPPPPPPPPPPPPPK...
KPPPPPPPPPPPPPPPPPPPPPPK...
KPPPKKKKKKPPPPPPPPPPPPPK...
KPPPKKPPPPPPPPPPPPPPPPPK...
KPPPKKPPPPPPPPPPPPPPPPPK...
KPPPKKKKKPPPKKPKKKPPPPPK...
KPPPKKPPPPPPKKKPPKKPPPPK...
KPPPKKPPPPPPKKPPPKKPPPPK...
KPPPKKPPPPPPKKPPPKKPPPPK...
KPPPKKPPPPPPKKPPPKKPPPPK...
KPPPKKKKKKPPKKPPPKKPKPPK...
KPPPPPPPPPPPPPPPPPPPKKPK...
KPPPPPPPPPPPPPPPPPPPKWKK...
KPPPPPPPPPPPPPPPPPPPKWWK...
KPPPPPPPPPPPPPPPPPPPKWWWK..
KPPPPPPPPPPPPPPPPPPPKWWWWK.
KKKKKKKKKKKKKKKKKKKKKWWWWWK
....................KWWKKKK
....................KWK....
....................KK.....
`
  .trim()
  .split('\n');

const PALETTE = {
  K: '#16151A', // ink: frame and lettering
  R: '#C1432C', // title bar
  b: '#EDE7D8', // title bar button
  P: '#EDE7D8', // window body
  W: '#FFFFFF', // pointer
};

// the themed (monochrome) icon has no colours to tell parts apart, so the title bar, the body
// and the pointer stay solid, and the ink — frame and lettering — becomes the gaps
const MONO = 'RbPW';

const W = LOGO[0].length;
const H = LOGO.length;

// farthest corner of any drawn pixel from the centre, in pixels of the map
const REACH = Math.max(
  ...LOGO.flatMap((row, y) =>
    [...row].flatMap((c, x) =>
      c === '.' ? [] : [0, 1].flatMap((dx) => [0, 1].map((dy) => Math.hypot(x + dx - W / 2, y + dy - H / 2))),
    ),
  ),
);

// draw the map centred in a `size` px square, scaled by the largest whole number that keeps
// its reach within `radius` px
function place(size, radius, fill) {
  const k = Math.max(1, Math.floor(radius / REACH));
  const x0 = Math.round((size - W * k) / 2);
  const y0 = Math.round((size - H * k) / 2);
  let out = '';
  LOGO.forEach((row, y) => {
    for (let x = 0; x < W;) {
      const c = row[x];
      let n = 1;
      while (row[x + n] === c) n++;
      const colour = fill(c);
      if (c !== '.' && colour)
        out += `<rect x="${x0 + x * k}" y="${y0 + y * k}" width="${n * k}" height="${k}" fill="${colour}"/>`;
      x += n;
    }
  });
  return out;
}

const colour = (c) => PALETTE[c];
const mono = (c) => (MONO.includes(c) ? '#fff' : null);

// one proportion everywhere: an adaptive icon is a 108dp canvas of which launchers show the
// inner 72dp, and the logo reaches 33dp out, so it spans the same share of every icon shape
const SHARE = 33 / 72;
// legacy and round icons draw their own shape, inset by 1/34 of the canvas like the system's
const INSET = 1 / 34;

const svg = (size, view, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${view}" shape-rendering="crispEdges">${body}</svg>`;

const px = (s, body) => svg(s, `0 0 ${s} ${s}`, body);

const square = (s) =>
  `<rect x="${s * INSET}" y="${s * INSET}" width="${s * (1 - 2 * INSET)}" height="${s * (1 - 2 * INSET)}" rx="${s * 6 * INSET}" fill="${DESK}"/>`;

const variants = {
  foreground: (s) => px(s, place(s, (s * 33) / 108, colour)),
  monochrome: (s) => px(s, place(s, (s * 33) / 108, mono)),
  legacy: (s) => px(s, square(s) + place(s, s * (1 - 2 * INSET) * SHARE, colour)),
  round: (s) =>
    px(
      s,
      `<circle cx="${s / 2}" cy="${s / 2}" r="${s * (0.5 - INSET)}" fill="${DESK}"/>` +
        place(s, s * (1 - 2 * INSET) * SHARE, colour),
    ),
  // a maskable web icon is cropped by the platform, so it's full-bleed and keeps the logo
  // inside the 40% safe circle
  maskable: (s) => px(s, `<rect width="${s}" height="${s}" fill="${DESK}"/>` + place(s, s * 0.4, colour)),
  // iOS rounds the corners itself and doesn't allow transparency
  touch: (s) => px(s, `<rect width="${s}" height="${s}" fill="${DESK}"/>` + place(s, s * SHARE, colour)),
  favicon: (s) => px(s, place(s, s / 2, colour)),
  // Android 12+ draws the launcher icon at 240dp on the splash screen; older versions show
  // this drawable instead, so it's the same logo at the same size
  splash: (s) => px(s, place(s, (s * 33) / 108, colour)),
  stat: (s) => svg(s, '0 0 24 24', stat()),
};

// the status-bar icon is a white silhouette inside the 20dp live area of the 24dp grid: the
// window with a 1dp frame, its title bar solid with the button cut out, "En" inside, and the
// pointer on the corner with a clear 1dp halo so it reads as sitting on top
const STAT = `
........................
........................
........................
..##################....
..#############..###....
..#############..###....
..##################....
..#................#....
..#.#####..........#....
..#.##.............#....
..#.##....##.##....#....
..#.####..###.##...#....
..#.##....##..##...#....
..#.##....##..##.#......
..#.#####.##..##.##.....
..#..............###....
..#..............####...
..##############.#####..
.................###....
.................#.##...
...................##...
........................
........................
........................
`
  .slice(1, -1)
  .split('\n');

const stat = () =>
  STAT.flatMap((row, y) =>
    [...row].map((c, x) => (c === '#' ? `<rect x="${x}" y="${y}" width="1" height="1" fill="#fff"/>` : '')),
  ).join('');

const RES = 'android/app/src/main/res';
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const jobs = [];
for (const [d, k] of Object.entries(DENSITIES)) {
  jobs.push([`${RES}/mipmap-${d}/ic_launcher.png`, 'legacy', 48 * k]);
  jobs.push([`${RES}/mipmap-${d}/ic_launcher_round.png`, 'round', 48 * k]);
  jobs.push([`${RES}/mipmap-${d}/ic_launcher_foreground.png`, 'foreground', 108 * k]);
  jobs.push([`${RES}/mipmap-${d}/ic_launcher_monochrome.png`, 'monochrome', 108 * k]);
  jobs.push([`${RES}/drawable-${d}/splash_logo.png`, 'splash', 240 * k]);
  jobs.push([`${RES}/drawable-${d}/ic_stat_en.png`, 'stat', 24 * k]);
}
jobs.push(['public/icon-192.png', 'legacy', 192]);
jobs.push(['public/icon-512.png', 'legacy', 512]);
jobs.push(['public/icon-maskable-512.png', 'maskable', 512]);
jobs.push(['public/apple-touch-icon.png', 'touch', 180]);
jobs.push(['public/favicon-32.png', 'favicon', 32]);

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
