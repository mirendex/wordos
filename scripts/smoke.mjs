import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = 4319;
const URL = `http://localhost:${PORT}`;

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

async function main() {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  let serverOut = '';
  server.stdout.on('data', (d) => (serverOut += d));
  server.stderr.on('data', (d) => (serverOut += d));

  const errors = [];
  try {
    await waitForServer(URL);
    const browser = await chromium.launch();
    const page = await browser.newPage();
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !/navigator\.vibrate/.test(msg.text())) {
        errors.push('console: ' + msg.text());
      }
    });
    page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));

    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.waitForSelector('#icons .ic', { timeout: 5000 });

    const iconApps = await page.$$eval('#icons [data-app]', (els) => els.map((e) => e.dataset.app));
    console.log('icons found:', iconApps);

    for (const app of iconApps) {
      await page.click(`#icons [data-app="${app}"]`, { force: true });
      await page.waitForTimeout(150);
      const closeBtn = await page.$('#wins .win:last-child [data-close]');
      if (closeBtn) await closeBtn.click({ force: true });
      await page.waitForTimeout(80);
    }

    // deeper interaction pass: exercise game tabs, key entry, terminal, diary draft
    const clickAll = async (selector) => {
      const els = await page.$$(selector);
      for (const el of els) {
        await el.click({ force: true }).catch(() => {});
        await page.waitForTimeout(30);
      }
    };

    await page.click('#icons [data-app="games"]', { force: true });
    await page.waitForTimeout(100);
    for (const tab of ['five', 'fw', 'order', 'pairs', 'hang']) {
      await page.click(`[data-gtab="${tab}"]`, { force: true }).catch(() => {});
      await page.waitForTimeout(80);
    }
    // letters: tap a couple of tiles
    await page.click('[data-gtab="fw"]', { force: true }).catch(() => {});
    await page.waitForTimeout(80);
    const letterTiles = await page.$$('[data-fwtap]');
    for (const t of letterTiles.slice(0, 2)) await t.click({ force: true }).catch(() => {});
    await page.click('[data-fwhint]', { force: true }).catch(() => {});
    await page.click('[data-fwclear]', { force: true }).catch(() => {});
    // five: type a guess and submit
    await page.click('[data-gtab="five"]', { force: true }).catch(() => {});
    await page.waitForTimeout(80);
    await clickAll('[data-fkey]');
    await page.waitForTimeout(50);
    // hangman: guess a letter
    await page.click('[data-gtab="hang"]', { force: true }).catch(() => {});
    await page.waitForTimeout(80);
    await page.click('[data-hkey]', { force: true }).catch(() => {});
    // pairs: tap two cards
    await page.click('[data-gtab="pairs"]', { force: true }).catch(() => {});
    await page.waitForTimeout(80);
    const pairCards = await page.$$('[data-ptap]');
    for (const c of pairCards.slice(0, 2)) await c.click({ force: true }).catch(() => {});
    // order: tap a word tile
    await page.click('[data-gtab="order"]', { force: true }).catch(() => {});
    await page.waitForTimeout(80);
    await page.click('[data-otap]', { force: true }).catch(() => {});
    await page.click('#wins .win:last-child [data-close]', { force: true }).catch(() => {});

    // terminal: run a command
    await page.click('#icons [data-app="term"]', { force: true });
    await page.waitForTimeout(100);
    await page.fill('#tin', 'help').catch(() => {});
    await page.press('#tin', 'Enter').catch(() => {});
    await page.waitForTimeout(100);
    await page.click('#wins .win:last-child [data-close]', { force: true }).catch(() => {});

    // vocab: switch tabs
    await page.click('#icons [data-app="vocab"]', { force: true });
    await page.waitForTimeout(100);
    for (const tab of ['learn', 'stats', 'find', 'chart']) {
      await page.click(`[data-vtab="${tab}"]`, { force: true }).catch(() => {});
      await page.waitForTimeout(80);
    }
    await page.click('#wins .win:last-child [data-close]', { force: true }).catch(() => {});

    // diary: type a draft
    await page.click('#icons [data-app="diary"]', { force: true });
    await page.waitForTimeout(100);
    await page.fill('textarea[data-diary]', 'Hello world').catch(() => {});
    await page.waitForTimeout(50);
    await page.click('#wins .win:last-child [data-close]', { force: true }).catch(() => {});

    // notes: switch tabs
    await page.click('#icons [data-app="notes"]', { force: true });
    await page.waitForTimeout(100);
    await page.click('[data-tab="notes"]', { force: true }).catch(() => {});
    await page.click('[data-tab="words"]', { force: true }).catch(() => {});
    await page.click('#wins .win:last-child [data-close]', { force: true }).catch(() => {});

    // setup: open (models list fetch may fail offline, that's fine, just no thrown errors)
    await page.click('#icons [data-app="setup"]', { force: true });
    await page.waitForTimeout(200);
    await page.click('#wins .win:last-child [data-close]', { force: true }).catch(() => {});

    // persistence: os:state must exist in localStorage and survive a reload
    const stateRaw = await page.evaluate(() => localStorage.getItem('os:state'));
    if (!stateRaw) throw new Error('persistence check failed: os:state missing from localStorage');
    const parsed = JSON.parse(stateRaw);
    if (typeof parsed.level !== 'number') throw new Error('persistence check failed: os:state malformed');

    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('os:state'));
      s.words.push({ en: 'smoketest', ru: 'проверка' });
      localStorage.setItem('os:state', JSON.stringify(s));
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#icons .ic', { timeout: 5000 });
    const roundTrip = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('os:state')).words.some((w) => w.en === 'smoketest'),
    );
    if (!roundTrip) throw new Error('persistence check failed: written word did not survive reload');
    console.log('persistence OK');

    await page.screenshot({ path: 'scripts/smoke.png', fullPage: false });

    // tablet viewport: maximize / restore / resize / minimize
    const tablet = await browser.newPage({ viewport: { width: 1024, height: 768 } });
    tablet.on('console', (msg) => {
      if (msg.type() === 'error' && !/navigator\.vibrate/.test(msg.text())) {
        errors.push('tablet console: ' + msg.text());
      }
    });
    tablet.on('pageerror', (err) => errors.push('tablet pageerror: ' + err.message));
    await tablet.goto(URL, { waitUntil: 'networkidle' });
    await tablet.waitForSelector('#icons .ic', { timeout: 5000 });

    // paint() replaces #wins innerHTML on every action, so element handles go stale —
    // re-query '.win' after each click instead of reusing one
    const winBox = () => tablet.$('#wins .win').then((el) => el.boundingBox());

    await tablet.click('#icons [data-app="vocab"]', { force: true });
    await tablet.waitForTimeout(150);
    const before = await winBox();

    await tablet.click('[data-winmax]', { force: true });
    await tablet.waitForTimeout(100);
    const maxed = await winBox();
    const desk = await tablet.$eval('#desk', (el) => {
      const r = el.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    if (Math.abs(maxed.width - desk.width) > 2 || Math.abs(maxed.height - desk.height) > 2) {
      throw new Error(
        `maximize check failed: window ${JSON.stringify(maxed)} vs desk ${JSON.stringify(desk)}`,
      );
    }

    await tablet.click('[data-winmax]', { force: true });
    await tablet.waitForTimeout(100);
    const restored = await winBox();
    if (Math.abs(restored.width - before.width) > 2 || Math.abs(restored.height - before.height) > 2) {
      throw new Error(
        `restore check failed: got ${JSON.stringify(restored)}, expected ${JSON.stringify(before)}`,
      );
    }

    const handle = await tablet.$('[data-resizek]');
    const hbox = await handle.boundingBox();
    await tablet.mouse.move(hbox.x + hbox.width / 2, hbox.y + hbox.height / 2);
    await tablet.mouse.down();
    await tablet.mouse.move(hbox.x + 80, hbox.y + 80, { steps: 5 });
    await tablet.mouse.up();
    await tablet.waitForTimeout(100);
    const resized = await winBox();
    if (resized.width <= before.width + 20 || resized.height <= before.height + 20) {
      throw new Error(
        `resize check failed: before ${JSON.stringify(before)}, after ${JSON.stringify(resized)}`,
      );
    }

    await tablet.click('[data-winmin]', { force: true });
    await tablet.waitForTimeout(100);
    const stillThere = await tablet.$('#wins .win');
    if (stillThere) throw new Error('minimize check failed: window still rendered in #wins');
    const taskbarBtn = await tablet.$('#taskbar .t.min');
    if (!taskbarBtn) throw new Error('minimize check failed: no taskbar entry left for minimized window');
    await taskbarBtn.click({ force: true });
    await tablet.waitForTimeout(100);
    const backAgain = await tablet.$('#wins .win');
    if (!backAgain) throw new Error('restore-from-taskbar check failed: window did not come back');
    console.log('window management OK');

    await tablet.close();
    await browser.close();
  } finally {
    server.kill();
  }

  if (errors.length) {
    console.error('SMOKE FAILED, console/page errors:');
    for (const e of errors) console.error(' -', e);
    console.error('--- server output ---');
    console.error(serverOut);
    process.exit(1);
  }
  console.log('SMOKE OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
