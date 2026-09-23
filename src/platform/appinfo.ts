import { paint } from '../core/paint';

export let APPVER = '';

export async function loadAppVersion(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const P = (window as any).Capacitor && (window as any).Capacitor.Plugins;
    if (P && P.App && P.App.getInfo) {
      const info = await P.App.getInfo();
      APPVER = (info && info.version) || '';
      paint();
    }
  } catch {
    /* ignore */
  }
}
