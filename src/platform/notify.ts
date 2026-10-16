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
    // `on` fires at this time every day: the plugin sets the next one each time it fires. An `at`
    // with `repeats` is not daily on Android: it repeats every (at - now), so it came every few
    // hours, with a new gap each time the app opened
    await P.LocalNotifications.schedule({
      notifications: [
        {
          id: 1,
          title: 'English',
          body: 'Пара карточек, пока есть минута',
          schedule: { on: { hour: S.cfg.notifyHour || 19, minute: 30 }, allowWhileIdle: true },
          smallIcon: 'ic_stat_en',
          iconColor: '#3C4EA8',
        },
      ],
    });
  } catch {
    /* ignore */
  }
}
