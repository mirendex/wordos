import { Quest } from '../../lib/termfs';
import { S } from '../../core/persist';

export const QUESTS: Quest[] = [
  {
    id: 'kestrel',
    name: 'kestrel',
    lock: '0413',
    title: 'ноутбук Марса',
    intro: ['kestrel os 1.0 / гостевая сессия', 'Ноутбук ушедшего разработчика. Печатай help.'],
    fs: {
      '~': {
        d: ['mail', 'logs', 'locked'],
        f: {
          'README.txt':
            'KESTREL / handover notes\n\nThis is the laptop I used for the Kestrel project. I am moving on, so it is yours now.\n\nRead the mail first, then the logs. The locked folder holds my last note. It asks for a four digit code.\n\nThe code is the day we froze the API, written as month and day. The client mail mentions it.\n\nMars',
          'todo.md':
            '- reply to the client about the frozen endpoints\n- clean up the deploy log, it is a mess\n- water the plant',
        },
      },
      '~/mail': {
        d: [],
        f: {
          'client.txt':
            'From: dana@kestrel.co\nSubject: spring release\n\nHi Mars,\n\nThank you for pushing the spring release out on April 13th. That was the day we agreed to freeze the API, and your team held the line.\n\nOne small thing: the reports still show yesterday numbers in the morning. Could you look into it before you hand things over?\n\nDana',
          'team.txt':
            'From: ivo@kestrel.co\nSubject: re: freeze\n\nMars, people keep asking when the freeze happened. The exact date is in the client mail. The deploy log also has a line marked FROZEN.\n\nIvo',
        },
      },
      '~/logs': {
        d: [],
        f: {
          'deploy.log':
            '2026-03-28 10:12 deploy ok   build 881\n2026-04-02 17:40 deploy ok   build 884\n2026-04-11 09:03 rollback     build 889 (bad migration)\n2026-04-13 16:20 deploy ok   build 890  <-- FROZEN api surface\n2026-04-19 11:55 deploy ok   build 893 (docs only)',
          'notes.txt':
            'The rollback on the 11th scared everyone. Two days later we shipped the build that froze the API and nobody touched the endpoints after that.',
        },
      },
      '~/locked': {
        lock: 1,
        d: [],
        f: {
          'letter.txt':
            'You got in. Good.\n\nThe clients who stayed with me were not the ones I impressed. They were the ones I kept informed. A short honest message on a bad day beats a brilliant one on a good day.\n\nYour English does not have to be clean. It has to be clear and on time.\n\nThe plant on the desk is yours now. Please water it.\n\nMars',
        },
      },
    },
    hint: 'Код это месяц и день заморозки API. Дата есть в письме клиента и в строке FROZEN в логе. Четыре цифры, например 0101.',
    done: 'Первая машина разобрана. Печатай next, чтобы взять следующую.',
  },
  {
    id: 'ferry',
    name: 'ferry',
    lock: '1907',
    title: 'сервер парома',
    intro: ['ferry-ops shell / read only', 'Сервер расписания паромов. Что-то сломалось в июле.'],
    fs: {
      '~': {
        d: ['tickets', 'crew', 'archive'],
        f: {
          'README.txt':
            'FERRY OPS\n\nWe run three boats between the islands. Support tickets go to tickets/, crew notes to crew/.\n\nThe archive with the incident report is locked. The code is the day the summer schedule broke, month and day, four digits.\n\nThe crew writes dates the British way. The office does not.',
          'schedule.txt':
            'Summer schedule, three departures a day.\nMorning 07:10, noon 12:40, evening 18:25.\nAfter the incident the evening run was cancelled for a week.',
        },
      },
      '~/tickets': {
        d: [],
        f: {
          't-118.txt':
            'From: passenger\nSubject: missed the boat\n\nYour site showed the evening ferry as running on 19/07 but nothing came. We waited two hours on the pier.\n\nPlease fix your schedule.',
          't-119.txt':
            'From: passenger\nSubject: same problem\n\nThe app told me the evening run was fine. It was not. This was the same day the other complaint mentions.',
        },
      },
      '~/crew': {
        d: [],
        f: {
          'log.txt':
            '19/07 evening run cancelled, engine check.\n20/07 back to normal, three runs.\nRemember: we write dates as day slash month, the office writes them the other way round.',
          'note.txt':
            'If you need the code for the archive, use the American order: month first, then day. Four digits, no slash.',
        },
      },
      '~/archive': {
        lock: 1,
        d: [],
        f: {
          'report.txt':
            'INCIDENT REPORT\n\nWhat actually happened: nobody told the website. The engine check was known three days earlier, but the notice sat in a mailbox that nobody reads.\n\nThe fix was not technical. We gave one person the job of saying things out loud.\n\nMost outages are like this. The system knew. The people did not.',
        },
      },
    },
    hint: 'Дата в тикетах записана как день/месяц, а код нужен как месяц-день. Ищи день отмены вечернего рейса.',
    done: 'Паром разобран. Печатай next для следующей машины.',
  },
  {
    id: 'atlas',
    name: 'atlas',
    lock: '2140',
    title: 'узел atlas',
    intro: ['atlas node / maintenance shell', 'Узел, который падает каждую ночь. Найди, во сколько.'],
    fs: {
      '~': {
        d: ['metrics', 'chat', 'vault'],
        f: {
          'README.txt':
            'ATLAS NODE\n\nThe node goes down every night and comes back by itself. Ops wants to know when exactly.\n\nThe vault is locked with the time of the nightly spike, written as hhmm in 24 hour format. Look at the metrics, then check what the team says about it.',
          'runbook.txt':
            'If the node is down: wait five minutes, it comes back. If it does not, page the on-call. Nobody has been paged in two months.',
        },
      },
      '~/metrics': {
        d: [],
        f: {
          'load.txt':
            '20:00  cpu 22%\n20:30  cpu 25%\n21:00  cpu 31%\n21:40  cpu 98%  <-- spike, node unreachable for 4 min\n22:00  cpu 27%\n23:00  cpu 20%',
          'jobs.txt':
            'Nightly jobs: backup at 21:40, report mailer at 21:40, cache warm at 21:41.\nAll three were scheduled by different people who did not talk to each other.',
        },
      },
      '~/chat': {
        d: [],
        f: {
          'ops.txt':
            'kai: the node blinks every night around nine forty in the evening\nrin: same time as the backup?\nkai: same minute. we have three jobs on one clock\nrin: someone should move two of them',
          'todo.txt':
            'Move the report mailer to 22:10. Move the cache warm to 22:20. Nobody has done it yet.',
        },
      },
      '~/vault': {
        lock: 1,
        d: [],
        f: {
          'answer.txt':
            'Three teams, one clock, no conversation.\n\nThe node was never broken. Every team chose a round number for their job and never asked what else runs at that time.\n\nWhen you join a project, the first useful question is not what the code does. It is who else touches this at the same moment.',
        },
      },
    },
    hint: 'Время ночного пика в метриках, формат чч:мм. Код это те же цифры без двоеточия.',
    done: 'Три готовых машины пройдены. Дальше приложение собирает новые само: печатай new.',
  },
];

export interface TermState {
  qi: number;
  cwd: string;
  unlocked: Record<string, 1>;
  out: { t: '' | 'cmd' | 'sys' | 'ok'; x: string }[];
  solved: string[];
  saved: Quest[];
  lastFile?: string;
  gen?: { busy?: boolean; err?: string };
}

export function termInit(): TermState {
  const t = S.term;
  const bad =
    !t ||
    !Array.isArray(t.solved) ||
    !Array.isArray(t.out) ||
    typeof t.unlocked !== 'object' ||
    !t.unlocked ||
    typeof t.cwd !== 'string' ||
    t.cwd.charAt(0) !== '~';
  if (bad)
    S.term = {
      qi: 0,
      cwd: '~',
      unlocked: {},
      out: [],
      solved: [],
      saved: t && Array.isArray(t.saved) ? t.saved : [],
    };
  if (!S.term.saved) S.term.saved = [];
  if (S.term.saved.length && QUESTS.length === 3) {
    S.term.saved.forEach((q: Quest) => {
      if (!QUESTS.find((x) => x.id === q.id)) QUESTS.push(q);
    });
  }
  if (!S.term.out.length) {
    const q = QUESTS[S.term.qi] || QUESTS[0];
    S.term.out = q.intro.map((x: string) => ({ t: 'sys', x }));
  }
  return S.term;
}

export function quest(): Quest {
  const t = termInit();
  return QUESTS[Math.min(t.qi, QUESTS.length - 1)];
}

export function node(path: string) {
  const q = quest();
  return q.fs[path];
}
