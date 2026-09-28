import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DESK = '#3B3560';

// the logo is pixel art, so it's kept as a pixel map: an open laptop whose lid is a hardcover
// book — blue cover, a Cyrillic Я and text lines on the pages, one of them highlighted in red —
// with a red speech bubble saying "Hi" breaking out of the lid's corner: a book in your own
// language that speaks a foreign one. It sits on a keyboard deck that widens towards the front
const LOGO = `
..................KKKKKKKKKKK...
.................KRRRRRRRRRRRK..
.................KRhhRRhhRhhRK..
.................KRhhRRhhRRRRK..
...KKKKKKKKKKKKKKKRhhhhhhRhhRK..
...KbbbbbbbbbbbbbKRhhRRhhRhhRK..
...KBBBBBBBBBBBBBKRhhRRhhRhhRK..
...KBBBpppppppBBBKRhhRRhhRhhRK..
...KBBpppppppppfPKRRRRRRRRRRRK..
...KBBppLLLLLppfPPKKRRKKKKKKKK..
...KBBpLLppLLppfPPPKRKPPPPBBK...
...KBBpLLppLLppfPPPKKPPPPPBBK...
...KBBppLLLLLppfPPPPPPPPPPBBK...
...KBBpppLLLLppfPLLLLLLPPPBBK...
...KBBppLLpLLppfPPPPPPPPPPBBK...
...KBBpLLppLLppfPLLLLLLPPPBBK...
...KBBpppppppppfPPPPPPPPPPBBK...
...KBBpRRRRRRppfPLLLLLLPPPBBK...
...KBBpppppppppfPPPPPPPPPPBBK...
...KBBpBBBBBBBpfPPBBBBBBBPBBK...
...KBBBBBBBBBBBBBBBBBBBBBBBBK...
...KNNNNNNNNNNNNNNNNNNNNNNNNK...
...KKKKKKKKKKKKKKKKKKKKKKKKKK...
..KDGGDGGDGGDGGDGGDGGDGGDGGDDK..
.KDGGDGGDGGDGGDGGDGGDGGDGGDGGDK.
.KDDDDDDDDDDGGGGGGGGDDDDDDDDDDK.
.KddddddddddddddddddddddddddddK.
..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..
...SSSSSSSSSSSSSSSSSSSSSSSSSS...
`
  .trim()
  .split('\n');

const PALETTE = {
  K: '#16151A', // ink outline
  b: '#5563BE', // light catching the top edge of the cover
  B: '#39479E', // cover
  N: '#2D3880', // cover in shadow above the hinge
  p: '#E2DBC8', // left page
  P: '#EDE7D8', // right page
  f: '#CBC3AD', // the fold into the spine
  L: '#39479E', // text lines
  R: '#C1432C', // speech bubble and highlighted line
  h: '#F4F0E6', // lettering in the bubble
  D: '#E2DBC8', // deck
  d: '#BDB6A4', // deck front edge
  G: '#8F887A', // keys and trackpad
  S: '#2C2750', // shadow under the laptop
};

// the themed (monochrome) icon has no colours to tell parts apart, so only the outlines, the
// pages, the bubble's lettering and the deck stay solid: the cover and the bubble's fill become
// gaps, and the letters, lines and keys become holes
const MONO = 'KpPfDdh';

const W = LOGO[0].length;
const H = LOGO.length;

// farthest corner of any drawn pixel from the centre, in pixels of the map; the shadow is soft
// enough to be allowed past the safe zone, so it doesn't count
const REACH = Math.max(
  ...LOGO.flatMap((row, y) =>
    [...row].flatMap((c, x) =>
      c === '.' || c === 'S'
        ? []
        : [0, 1].flatMap((dx) => [0, 1].map((dy) => Math.hypot(x + dx - W / 2, y + dy - H / 2))),
    ),
  ),
);

// scale the map so its reach lands on `safe` (px), centred in a `size` px square. From three
// device pixels per map pixel up, snap to a whole number so every line keeps the same width —
// as long as the snapped size still fits inside `limit`
function place(size, safe, limit, fill) {
  let k = safe / REACH;
  if (k >= 3) {
    k = Math.round(k);
    if (k * REACH > limit) k = Math.floor(limit / REACH);
  }
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

// adaptive icons: 108dp canvas, launchers show the inner 72dp, the 66dp circle is always safe
const adaptive = (s, fill) => place(s, (s * 33) / 108, (s * 36.5) / 108, fill);

// the status-bar icon is a white silhouette on the 24dp grid: the lid as a 1dp outline with the
// open book filling it — two pages with three lines each, sagging into the spine — the deck
// the full width underneath, and the logo's "Hi" bubble cut into the lid's corner with a 1dp
// clear halo so it reads as sitting on top
const STAT = `
................#######.
...............##.#.#.##
...............##.#.####
...............##...#.##
..############.##.#.#.##
..#............##.#.#.##
..#.#######..#..#######.
..#.#######..##.##......
..#.#.....#..#..#..#.#..
..#.#######..##...##.#..
..#.#.....#..#.....#.#..
..#.#######..#######.#..
..#.#.....#..#.....#.#..
..#.#######..#######.#..
..#.#######..#######.#..
..#......##..##......#..
..#..................#..
..####################..
##########....##########
.######################.
........................
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

const svg = (size, view, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${view}" shape-rendering="crispEdges">${body}</svg>`;

const px = (s, body) => svg(s, `0 0 ${s} ${s}`, body);

const variants = {
  foreground: (s) => px(s, adaptive(s, colour)),
  monochrome: (s) => px(s, adaptive(s, mono)),
  legacy: (s) =>
    px(
      s,
      `<rect x="${s / 34}" y="${s / 34}" width="${(s * 32) / 34}" height="${(s * 32) / 34}" rx="${(s * 6) / 34}" fill="${DESK}"/>` +
        place(s, s * 0.4, s * 0.42, colour),
    ),
  round: (s) =>
    px(
      s,
      `<circle cx="${s / 2}" cy="${s / 2}" r="${(s * 16) / 34}" fill="${DESK}"/>` +
        place(s, s * 0.39, s * 0.41, colour),
    ),
  // the 512px web icon doubles as the maskable one, so it keeps to the 40% safe radius too
  full: (s) =>
    px(s, `<rect width="${s}" height="${s}" fill="${DESK}"/>` + place(s, s * 0.36, s * 0.4, colour)),
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
