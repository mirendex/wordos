import { S, save } from '../core/persist';

export async function notifyPlan(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const P = (window as any).Capacitor && (window as any).Capacitor.Plugins;
  if (!P || !P.LocalNotifications) return;
  try {
    if (!S.cfg.notify) {
      await P.LocalNotifications.cancel({ notifications: [{ id: 1 }] });
      return;
    }
    const perm = await P.LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') {
      S.cfg.notify = false;
      save();
      return;
    }
    await P.LocalNotifications.cancel({ notifications: [{ id: 1 }] });
    const at = new Date();
    at.setHours(S.cfg.notifyHour || 19, 30, 0, 0);
    if (at < new Date()) at.setDate(at.getDate() + 1);
    await P.LocalNotifications.schedule({
      notifications: [
        {
          id: 1,
          title: 'English',
          body: 'Пара карточек, пока есть минута',
          schedule: { at, repeats: true, every: 'day' },
          smallIcon: 'ic_stat_en',
          iconColor: '#3C4EA8',
        },
      ],
    });
  } catch {
    /* ignore */
  }
}
