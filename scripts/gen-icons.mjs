import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// the brand colour: the desktop the app itself is drawn on, so launcher icon and app
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
  jobs.push([`${RES}/drawable-${d}/ic_stat_en.png`, 'stat', 24 * k]);
}
jobs.push(['public/icon-192.png', 'legacy', 192]);
jobs.push(['public/icon-512.png', 'legacy', 512]);
jobs.push(['public/icon-maskable-512.png', 'maskable', 512]);
jobs.push(['public/apple-touch-icon.png', 'touch', 180]);
jobs.push(['public/favicon-32.png', 'favicon', 32]);

// the launch animation flies the arrow pointer around the window, so the logo comes as two SVG
// layers over the same box: the window with the pointer taken off, and the pointer alone. Laid
// over each other they are exactly the logo, which is checked here.
const POINTER = [
  'K.....',
  'KK....',
  'KWK...',
  'KWWK..',
  'KWWWK.',
  'KWWWWK',
  'KWWWWWK',
  'KWWKKKK',
  'KWK....',
  'KK.....',
];
const POINTER_AT = [20, 15];
const WINDOW_SIZE = [24, 22];

// The system splash is the launch animation: an animated vector of the logo, the window popping
// in, the pointer coming out onto its corner and clicking it, a ring spreading from the tip. Only
// Android 12+ plays it, older versions show the logo standing still. Each colour of the pixel map
// is one path of 1x1 cells; the units are pixels of the logo.
const SPLASH_MS = 700;
const TIP = [POINTER_AT[0] + 0.5, POINTER_AT[1] + 0.5];
const PRESS_WIN = 0.93; // how far the click presses the window in, and the pointer
const PRESS_PTR = 0.8;
const VIEW = 72; // the splash icon is drawn 240dp wide and cropped to its middle two thirds

function cells(map) {
  const byColour = new Map();
  map.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '.') return;
      if (!byColour.has(c)) byColour.set(c, []);
      byColour.get(c).push(`M${x},${y}h1v1h-1z`);
    }),
  );
  return [...byColour].map(
    ([c, d]) => `<path android:fillColor="${PALETTE[c]}" android:pathData="${d.join('')}"/>`,
  );
}

function layers() {
  const cols = Math.max(...LOGO.map((r) => r.length));
  const blank = () => LOGO.map((r) => '.'.repeat(r.length));
  const win = blank().map((r) => [...r]);
  const ptr = blank().map((r) => [...r]);
  LOGO.forEach((row, y) => [...row].forEach((c, x) => (win[y][x] = c)));
  POINTER.forEach((row, j) =>
    [...row].forEach((c, i) => {
      if (c === '.') return;
      const x = POINTER_AT[0] + i;
      const y = POINTER_AT[1] + j;
      ptr[y][x] = c;
      // what the pointer covers: the window's paper, its right and bottom edge, or nothing
      const inside = x < WINDOW_SIZE[0] && y < WINDOW_SIZE[1];
      win[y][x] = inside ? (x === WINDOW_SIZE[0] - 1 || y === WINDOW_SIZE[1] - 1 ? 'K' : 'P') : '.';
    }),
  );
  LOGO.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if ((ptr[y][x] !== '.' ? ptr[y][x] : win[y][x]) !== c)
        throw new Error(`the two logo layers differ from the logo at ${x},${y}`);
    }),
  );
  return { cols, rows: LOGO.length, win: win.map((r) => r.join('')), ptr: ptr.map((r) => r.join('')) };
}

// the same two layers for the web part, which draws the last moment of the splash and opens it
function writeWebLogo({ cols, rows, win, ptr }) {
  const svg = (map) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols} ${rows}" shape-rendering="crispEdges">` +
    map
      .flatMap((row, y) => {
        const out = [];
        for (let x = 0; x < row.length;) {
          let n = 1;
          while (row[x + n] === row[x]) n++;
          if (row[x] !== '.')
            out.push(`<rect x="${x}" y="${y}" width="${n}" height="1" fill="${PALETTE[row[x]]}"/>`);
          x += n;
        }
        return out;
      })
      .join('') +
    '</svg>';
  const file = 'src/ui/bootlogo.ts';
  writeFileSync(
    resolve(file),
    [
      "// generated by scripts/gen-icons.mjs: the logo's pixel map as two SVG layers, the window and the pointer",
      `export const BOOT_WINDOW = '${svg(win)}';`,
      `export const BOOT_POINTER = '${svg(ptr)}';`,
      `export const BOOT_COLS = ${cols};`,
      `export const BOOT_ROWS = ${rows};`,
      `export const BOOT_WIN_COLS = ${WINDOW_SIZE[0]};`,
      `export const BOOT_WIN_ROWS = ${WINDOW_SIZE[1]};`,
      `export const BOOT_TIP = [${TIP[0]}, ${TIP[1]}];`,
      `export const BOOT_PRESS_WIN = ${PRESS_WIN};`,
      `export const BOOT_PRESS_PTR = ${PRESS_PTR};`,
      '',
    ].join('\n'),
  );
  execFileSync('npx', ['prettier', '--write', file], { stdio: 'ignore' });
  console.log(file);
}

function writeSplash() {
  const { cols, rows, win, ptr } = layers();
  const ring = (r, w, colour, name) =>
    `<path android:name="${name}" android:strokeColor="${colour}" android:strokeWidth="${w}" android:strokeAlpha="0" ` +
    `android:pathData="M${TIP[0] - r},${TIP[1]}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0"/>`;
  const vector = `<?xml version="1.0" encoding="utf-8"?>
<!-- generated by scripts/gen-icons.mjs -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="${VIEW}dp" android:height="${VIEW}dp"
    android:viewportWidth="${VIEW}" android:viewportHeight="${VIEW}">
  <group android:name="logo" android:pivotX="${VIEW / 2}" android:pivotY="${VIEW / 2}">
    <group android:name="place" android:translateX="${(VIEW - cols) / 2}" android:translateY="${(VIEW - rows) / 2}">
      <group android:name="win" android:pivotX="${WINDOW_SIZE[0] / 2}" android:pivotY="${WINDOW_SIZE[1] / 2}">
        ${cells(win).join('\n        ')}
      </group>
      <group android:name="ptr" android:pivotX="${TIP[0]}" android:pivotY="${TIP[1]}">
        ${cells(ptr).join('\n        ')}
      </group>
      <group android:name="ring" android:pivotX="${TIP[0]}" android:pivotY="${TIP[1]}" android:scaleX="0.3" android:scaleY="0.3">
        ${ring(6, 0.6, '#16151A', 'ringInk')}
        ${ring(5.6, 0.5, '#FFFFFF', 'ringLight')}
      </group>
    </group>
  </group>
</vector>
`;
  // one animator per target, all over the same time line, so the parts stay in step. A key is
  // [ms, value] and the value is held from the last key until the next
  const EASE = { true: '@android:interpolator/overshoot', decel: '@android:interpolator/decelerate_quad' };
  const frac = (ms) => (ms / SPLASH_MS).toFixed(4);
  const animator = (prop, keys, type = 'floatType') =>
    `<objectAnimator android:duration="${SPLASH_MS}">
          <propertyValuesHolder android:propertyName="${prop}" android:valueType="${type}">` +
    keys
      .map(
        ([ms, v, ease]) =>
          `<keyframe android:fraction="${frac(ms)}" android:value="${v}"${ease ? ` android:interpolator="${EASE[ease]}"` : ''}/>`,
      )
      .join('') +
    `</propertyValuesHolder></objectAnimator>`;
  const target = (name, anims) =>
    `  <target android:name="${name}">
    <aapt:attr name="android:animation">
      <set xmlns:android="http://schemas.android.com/apk/res/android">
        ${anims.join('\n        ')}
      </set>
    </aapt:attr>
  </target>`;
  const CLICK = 380;
  const both = (keys) => [animator('scaleX', keys), animator('scaleY', keys)];
  // the window is there from the start. The pointer comes out from the lower right, clicks the
  // window (the ring spreads) and the window is pressed in and stays so: the web part takes it
  // from there, with the window springing back and opening into the first real window
  const avd = `<?xml version="1.0" encoding="utf-8"?>
<!-- generated by scripts/gen-icons.mjs: the launch animation, played by the system splash -->
<animated-vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:drawable="@drawable/splash_logo_vector">
${target('ptr', [
  ...both([
    [0, 0],
    [150, 0],
    [300, 1, true],
    [CLICK, 1],
    [440, PRESS_PTR],
    [SPLASH_MS, PRESS_PTR],
  ]),
  animator('translateX', [
    [0, 9],
    [150, 9],
    [300, 0, 'decel'],
    [SPLASH_MS, 0],
  ]),
  animator('translateY', [
    [0, 11],
    [150, 11],
    [300, 0, 'decel'],
    [SPLASH_MS, 0],
  ]),
])}
${target(
  'win',
  both([
    [0, 1],
    [CLICK, 1],
    [470, PRESS_WIN, 'decel'],
    [SPLASH_MS, PRESS_WIN],
  ]),
)}
${target(
  'ring',
  both([
    [0, 0.3],
    [CLICK, 0.3],
    [SPLASH_MS, 1],
  ]),
)}
${target('ringInk', [
  animator('strokeAlpha', [
    [0, 0],
    [CLICK, 0],
    [CLICK + 1, 1],
    [SPLASH_MS, 0],
  ]),
])}
${target('ringLight', [
  animator('strokeAlpha', [
    [0, 0],
    [CLICK, 0],
    [CLICK + 1, 1],
    [SPLASH_MS, 0],
  ]),
])}
</animated-vector>
`;
  writeWebLogo({ cols, rows, win, ptr });
  const dir = 'android/app/src/main/res/drawable';
  writeFileSync(resolve(dir, 'splash_logo_vector.xml'), vector);
  writeFileSync(resolve(dir, 'splash_logo.xml'), avd);
  console.log(`${dir}/splash_logo.xml`);
}

// `node scripts/gen-icons.mjs stat` redraws just the given kinds
const only = process.argv.slice(2);
if (!only.length || only.includes('splash')) writeSplash();

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage();
for (const [out, kind, size] of jobs) {
  if (only.length && !only.includes(kind)) continue;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0;background:transparent">${variants[kind](size)}</body>`);
  writeFileSync(resolve(out), await page.locator('svg').screenshot({ omitBackground: true }));
  console.log(out, size);
}
await browser.close();
