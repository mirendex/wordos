// Takes the README screenshots from a production build (`npm run screenshots`) into docs/screenshots/.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import http from 'node:http';

const PORT = 4320;
const URL = `http://localhost:${PORT}`;
const OUT = 'docs/screenshots';

function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (Date.now() - start > timeoutMs) reject(new Error('server did not start in time'));
          else setTimeout(tryOnce, 300);
        });
    };
    tryOnce();
  });
}

// a learner a few weeks in: past the intro, ~1200 words known and a few dozen in review, so the
// windows show something other than empty states
function demoState() {
  const words = readFileSync('src/data/freq.txt', 'utf8')
    .split('|')
    .map((s) => s.split(' ')[0]);
  const day = (n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const srs = {};
  words.slice(1200, 1260).forEach((w, i) => {
    srs[w] = { b: i % 6, due: day((i % 5) - 1), reps: 1 + (i % 6), lapses: i % 3 ? 0 : 1, first: day(-20) };
  });
  return {
    v: 2,
    level: 40,
    seenIntro: true,
    words: [],
    notes: [],
    read: {},
    mt: {},
    cfg: { key: '', model: 'openai/gpt-4o-mini', haptic: true },
    vocab: {
      base: 1200,
      n: 1260,
      touched: 1,
      srs,
      known: {},
      log: {},
      seen: {},
      queue: [],
      i: 0,
      tab: 'chart',
    },
  };
}

async function openPage(browser, viewport, wins = null) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  await page.addInitScript(
    ([state, wins]) => {
      if (localStorage.getItem('os:state')) return;
      localStorage.setItem('os:state', state);
      if (wins) localStorage.setItem('os:wins', wins);
    },
    [JSON.stringify(demoState()), wins && JSON.stringify(wins)],
  );
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('#icons .ic', { timeout: 10000 });
  // the launch animation hands over to the desktop on its own; wait until it is gone
  await page
    .waitForFunction(() => !document.querySelector('.boot'), null, { timeout: 10000 })
    .catch(() => {});
  await page.waitForTimeout(600);
  return page;
}

async function open(page, app, { only = false } = {}) {
  if (only) {
    for (const close of await page.$$('#wins [data-close]')) await close.click({ force: true });
    await page.waitForTimeout(300);
  }
  await page.click(`#icons [data-app="${app}"]`, { force: true });
  await page.waitForTimeout(400);
}

// a couple of guesses in the five-letter game, so its grid is not blank
async function guess(page) {
  for (const word of ['house', 'cloud']) {
    for (const c of word + '+') {
      await page.click(`#wins .win:last-child [data-fkey="${c}"]`, { force: true });
      await page.waitForTimeout(60);
    }
    await page.waitForTimeout(400);
  }
}

// a few commands in the terminal quest, so it shows a session in progress
async function explore(page) {
  for (const cmd of ['ls', 'cat README.txt']) {
    await page.fill('#tin', cmd);
    await page.press('#tin', 'Enter');
    await page.waitForTimeout(250);
  }
}

async function shot(page, name) {
  await page.mouse.move(1, 1);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`${OUT}/${name}.png`);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    shell: true,
    detached: true,
  });
  try {
    await waitForServer(URL);
    const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

    const phone = { width: 390, height: 844 };
    // an empty window list restores as no windows at all: just the desktop
    const desk = await openPage(browser, phone, []);
    await shot(desk, 'phone-desktop');
    await desk.close();

    for (const [name, setup] of [
      ['phone-words', async () => {}],
      ['phone-games', (p) => open(p, 'games', { only: true }).then(() => guess(p))],
      ['phone-terminal', (p) => open(p, 'term', { only: true }).then(() => explore(p))],
    ]) {
      const page = await openPage(browser, phone);
      await setup(page);
      await shot(page, name);
      await page.close();
    }

    const win = (app, z, x, y, w, h) => ({ key: app + ':', app, z, x, y, w, h });
    const tablet = await openPage(browser, { width: 1280, height: 800 }, [
      win('vocab', 11, 40, 200, 520, 550),
      win('term', 12, 600, 190, 460, 330),
      win('games', 13, 770, 290, 470, 460),
    ]);
    await explore(tablet);
    await guess(tablet);
    // pressing the on-screen keys scrolls the game window down to them; show its grid instead
    await tablet.$$eval('#wins .win:last-child *', (els) => els.forEach((e) => (e.scrollTop = 0)));
    await shot(tablet, 'tablet-desktop');

    await browser.close();
  } finally {
    try {
      process.kill(-server.pid);
    } catch {
      server.kill();
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
