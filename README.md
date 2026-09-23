# diff/en

Android-приложение для изучения английского на своём материале: словарь по частоте языка,
тексты и переводы через LLM, игры на слова, диктовка и повтор вслух, дневник на английском.
Работает как отдельная «псевдо-ОС» внутри одного WebView-окна — со своими окнами, иконками
на столе и панелью задач.

Собрано на [Capacitor](https://capacitorjs.com/): веб-часть на TypeScript без фреймворка,
нативная обёртка — Android.

## Возможности

- **WORDS.DB** — обучение по 5000 самых частотных слов языка, с интервальным повторением (SRS)
  и карточками, которые генерирует LLM (пример, перевод, разбор форм).
- **READER** — тексты на заданную тему и уровень (CEFR), с разбором слов по тапу.
- **DIARY** — свой текст на английском с проверкой и разбором ошибок.
- **LISTEN / ECHO** — диктовка на слух и повтор вслух с распознаванием речи.
- **GAMES** — виселица, поиск пар, сборка предложения, поиск слов на сетке, wordle-игра «пять букв».
- **TERM** — текстовый квест: файловая система «чужого компьютера», которую генерирует LLM,
  и который нужно исследовать командами `cd`/`ls`/`cat`, чтобы найти код.
- Жест «назад» с предиктивной анимацией через собственный Capacitor-плагин (`BackGate`),
  вибрация, синтез и распознавание речи, локальные уведомления о повторении слов.
- Окна двигаются, разворачиваются на весь экран и обратно, ресайзятся за угол и сворачиваются
  в панель задач — мышью и тапом; на ширине ≤760px (телефон) окно всегда во весь экран.

## Стек

- **Vite + TypeScript** — сборка веб-части (без UI-фреймворка, рендер через шаблонные строки).
- **Vitest** — юнит-тесты на чистую логику (SRS, диффы, парсинг JSON от LLM, генерация уровней).
- **ESLint + Prettier** — статическая проверка и единый стиль кода.
- **Capacitor 8** — Android-обёртка и доступ к нативным API (Haptics, TTS/STT, уведомления).
- Хранение — `localStorage` через небольшой асинхронный shim (`window.storage`, `src/core/storage.ts`).
- LLM — [OpenRouter](https://openrouter.ai/) (ключ пользователь указывает сам в настройках приложения).
- Playwright — сквозной дымовой прогон приложения в headless-браузере (`scripts/smoke.mjs`).

## Архитектура

Рендер — набор шаблонных строк, без виртуального DOM: `paint()` перерисовывает окна и стол при
каждом изменении состояния. Циклическая зависимость «всё вызывает paint, paint вызывает всё»
разорвана через `core/paint.ts` — этот модуль ничего не знает про экраны, а только хранит
текущую функцию отрисовки (`setPainter`), которую подставляет `ui/render.ts` при старте.

```
index.html              точка входа, разметка десктопа
src/
  main.ts                bootstrap: подписка на жесты/клавиатуру/клики, load() → boot()
  types.ts, env.d.ts      глобальные декларации (window.storage, *.txt?raw)
  styles/                 CSS, поделённый по разделам интерфейса
  lib/                    чистые функции без побочных эффектов — то, что покрыто тестами:
                          json.ts (разбор частично оборванного JSON от LLM), scale.ts (шкала уровня, CEFR),
                          text.ts (расстояние Левенштейна, сверка ответов, дифф текста), five.ts (wordle),
                          termfs.ts (сборка файловой системы квеста), grid.ts (укладка слов в сетку)
  data/                   словарь частоты (freq.txt, 5000 слов)
  core/                   state.ts/persist.ts (S, BANK, load/save), paint.ts (лист дерева зависимостей),
                          storage.ts (localStorage-шим), util.ts, keys.ts
  platform/               обёртки над Capacitor: haptics.ts, speech.ts (TTS/STT), appinfo.ts, notify.ts
  services/               llm.ts (запросы к OpenRouter), models.ts (список моделей), translate.ts
  domain/                 бизнес-логика словаря: frequency.ts, vocab.ts (SRS), progress.ts, cards.ts
  ui/                     windows.ts (мини-менеджер окон + жест «назад»), render.ts (paint + роутер экранов),
                          icons.ts, modal.ts, gestures.ts (drag/marquee/slider), keyboard.ts, actions.ts (клики)
  apps/                   каждое приложение — свой модуль: about, reader, notes, setup,
                          diary/, echo/, listen/, terminal/, vocab/, games/{hangman,pairs,order,letters,five}
scripts/
  smoke.mjs               headless-прогон: открывает каждое окно, играет во все игры, проверяет
                          persistence в localStorage и управление окнами (maximize/restore/resize/
                          minimize) на планшетной ширине — запускается вручную и в CI
android/                  нативный Android-проект (Capacitor)
  app/src/main/java/dev/mirendex/diffen/
    MainActivity.java      регистрация нативных плагинов
    BackGatePlugin.java     предиктивный жест «назад», синхронизированный с состоянием окон в JS
```

## Разработка

```bash
npm install
npm run dev          # локальный сервер с горячей перезагрузкой
npm run typecheck    # проверка типов (строгий tsconfig)
npm run lint         # ESLint
npm test             # Vitest
npm run build        # сборка веб-части в www/
node scripts/smoke.mjs  # сквозной прогон в headless-браузере
```

## Сборка APK

```bash
npm run copy         # сборка веб-части + npx cap copy android
npm run open         # открыть проект в Android Studio
npm run apk          # copy + сборка debug-APK через gradlew
```

CI (`.github/workflows/build-apk.yml`) на каждый push в `main`/`master` прогоняет линт, тесты и
`scripts/smoke.mjs`, собирает веб-часть и debug-APK, и выкладывает его как артефакт и в релиз.
