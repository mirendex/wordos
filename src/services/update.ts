import { S, save } from '../core/persist';
import { paint } from '../core/paint';
import { APPVER } from '../platform/appinfo';
import { isNewer } from '../lib/version';

const LATEST = 'https://api.github.com/repos/mirendex/wordos/releases/latest';
const RELEASES = 'https://github.com/mirendex/wordos/releases';
const EVERY_MS = 12 * 60 * 60 * 1000;

export interface Update {
  version: string;
  url: string;
  notes: string;
}

interface UpdState {
  at?: number;
  skip?: string;
  rel?: Update;
}

function state(): UpdState {
  if (!S.upd || typeof S.upd !== 'object') S.upd = {};
  return S.upd;
}

// the latest release, if it is newer than the installed app
export function available(): Update | null {
  const r = state().rel;
  if (!r || !APPVER || !isNewer(r.version, APPVER)) return null;
  // a release found by an earlier version links the APK itself; open its page instead
  return { ...r, url: r.url.replace(/\/releases\/download\/([^/]+)\/[^/]+\.apk$/i, '/releases/tag/$1') };
}

// the same, unless the user said "later" to this very version
export function offered(): Update | null {
  const r = available();
  return r && state().skip !== r.version ? r : null;
}

// the release notes as plain lines for a dialog: list items without their markers, no headings,
// links or the "Full Changelog" footer, at most `max` lines
export function releaseNotes(u: Update, max = 6): string {
  const lines = u.notes
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !/full changelog/i.test(l))
    .map((l) => l.replace(/^[-*]\s+/, '• ').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'));
  return lines.length > max ? lines.slice(0, max).join('\n') + '\n…' : lines.join('\n');
}

export function skipUpdate(version: string): void {
  state().skip = version;
  save();
  paint();
}

// Asks GitHub for the latest release at most every EVERY_MS, only in the installed app (the web
// build has no version to compare against) and only when online. Any failure is silent.
export async function checkUpdate(): Promise<void> {
  const st = state();
  if (!APPVER || !navigator.onLine || document.hidden) return;
  if (st.at && Date.now() - st.at < EVERY_MS) return;
  st.at = Date.now();
  save();
  try {
    const res = await fetch(LATEST, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return;
    const d = await res.json();
    const version = String(d.tag_name || '').replace(/^v/i, '');
    if (!version) return;
    // the release page, not the APK itself: Chrome handed an APK link by another app shows a
    // download sheet that can hang at 100%, while a tap on the APK on the page downloads normally
    st.rel = {
      version,
      url: d.html_url || RELEASES + '/tag/v' + version,
      notes: String(d.body || ''),
    };
    save();
    paint();
  } catch {
    /* offline or rate-limited: try again next time */
  }
}

export function installUpdateCheck(): void {
  // after the launch animation and the first background requests have settled
  setTimeout(checkUpdate, 5000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkUpdate();
  });
}

// In the installed app a page navigation to another host is handed to the system browser, which
// downloads the APK; in a plain browser open it in a new tab
export function openUrl(url: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).Capacitor?.isNativePlatform?.()) location.href = url;
  else window.open(url, '_blank', 'noopener');
}
