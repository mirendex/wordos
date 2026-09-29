# WordOS

An Android app for learning English on your own material: a frequency-based vocabulary,
LLM-generated texts and translations, word games, listening dictation and read-aloud practice,
and an English-language diary. It runs as its own little "desktop OS" inside a single WebView —
with its own windows, desktop icons, and a taskbar.

Built on [Capacitor](https://capacitorjs.com/): the web part is framework-free TypeScript,
wrapped in a native Android shell.

## Features

- **WORDS.DB** — learning the 5000 most frequent words of the language, with spaced repetition
  (SRS) and LLM-generated flashcards (example sentence, translation, word forms).
- **GOAL** — preparing for a specific event by a date: scenario-based vocabulary and phrases
  (a trip, an interview, a move) with its own SRS and progress, plus a role-play dialogue with
  the LLM for each scenario.
- **READER** — texts on a chosen topic and level (CEFR), with a tap-to-translate word lookup.
- **DIARY** — write your own English text and get it checked and corrected.
- **LISTEN / ECHO** — listening dictation and read-aloud practice with speech recognition.
- **GAMES** — hangman, word-pair matching, sentence ordering, a word-search grid, and a
  wordle-style "five letters" game.
- **TERM** — a text adventure: an LLM-generated filesystem on "someone else's computer" that you
  explore with `cd`/`ls`/`cat` to find the code.
- A predictive-animation back gesture through a custom Capacitor plugin (`BackGate`), haptics,
  text-to-speech and speech recognition, and local reminders to review words.
- Windows drag, maximize/restore, resize from the corner, and minimize to the taskbar — with
  both mouse and touch; on screens ≤760px wide (phones) a window is always fullscreen.

## Stack

- **Vite + TypeScript** — builds the web part (no UI framework, rendering is template strings).
- **Vitest** — unit tests for the pure logic (SRS, diffing, parsing JSON from the LLM, level
  estimation).
- **ESLint + Prettier** — static checks and a single code style.
- **Capacitor 8** — the Android wrapper and access to native APIs (haptics, TTS/STT,
  notifications).
- Storage — `localStorage` behind a small async shim (`window.storage`, `src/core/storage.ts`).
- LLM — [OpenRouter](https://openrouter.ai/) (the user supplies their own key in the app's
  settings).
- Playwright — an end-to-end smoke run of the app in a headless browser (`scripts/smoke.mjs`).

## Architecture

Rendering is a set of template strings, no virtual DOM: `paint()` redraws the windows and desktop
on every state change. The circular "everything calls paint, paint calls everything" dependency
is broken by `core/paint.ts` — this module knows nothing about the screens, it just holds the
current render function (`setPainter`), which `ui/render.ts` supplies at startup.

```
index.html              entry point, desktop markup
src/
  main.ts                bootstrap: wires up gestures/keyboard/clicks, load() → boot()
  types.ts, env.d.ts      global declarations (window.storage, *.txt?raw)
  styles/                 CSS, split by interface section
  lib/                    pure functions with no side effects — what the tests cover:
                          json.ts (parsing partially cut-off JSON from the LLM), scale.ts (level
                          scale, CEFR), text.ts (Levenshtein distance, answer checking, text diff),
                          five.ts (wordle), termfs.ts (building the quest filesystem),
                          grid.ts (laying words out on a grid), srs.ts (the spaced-repetition
                          ladder, shared by WORDS.DB and GOAL), plan.ts (countdown, daily quota,
                          goal progress)
  data/                   the frequency dictionary (freq.txt, 5000 words)
  core/                   state.ts/persist.ts (S, BANK, load/save), paint.ts (a leaf of the
                          dependency tree), storage.ts (the localStorage shim), util.ts, keys.ts
  platform/               wrappers over Capacitor: haptics.ts, speech.ts (TTS/STT), appinfo.ts,
                          notify.ts
  services/               llm.ts (OpenRouter requests), models.ts (the model list), translate.ts
  domain/                 vocabulary business logic: frequency.ts, vocab.ts (SRS), progress.ts,
                          cards.ts, goal.ts (GOAL: scenarios, cards, dialogue)
  ui/                     windows.ts (a small window manager + the back gesture), render.ts
                          (paint + the screen router), icons.ts, modal.ts, gestures.ts
                          (drag/marquee/slider), keyboard.ts, actions.ts (clicks)
  apps/                   each app is its own module: about, reader, notes, setup,
                          diary/, echo/, listen/, terminal/, vocab/, goal/, games/{hangman,pairs,
                          order,letters,five}
scripts/
  smoke.mjs               a headless run: opens every window, plays every game, checks
                          persistence in localStorage and window management (maximize/restore/
                          resize/minimize) at a tablet width — run manually and in CI
android/                  the native Android project (Capacitor)
  app/src/main/java/dev/mirendex/diffen/
    MainActivity.java      registers the native plugins
    BackGatePlugin.java     the predictive back gesture, kept in sync with window state in JS
```

## Development

```bash
npm install
npm run dev          # local dev server with hot reload
npm run typecheck    # type checking (strict tsconfig)
npm run lint         # ESLint
npm test             # Vitest
npm run build        # build the web part into www/
node scripts/smoke.mjs  # end-to-end run in a headless browser
```

## Building the APK

```bash
npm run copy         # build the web part + npx cap copy android
npm run open         # open the project in Android Studio
npm run apk          # copy + build a debug APK via gradlew
```

CI (`.github/workflows/build-apk.yml`) runs on every push to `main`/`master`: lint and tests,
then builds the web part and a signed release APK and uploads it as an artifact and to a release.
The headless smoke run (`scripts/smoke.mjs`) is not part of CI: it takes about two minutes, so it's
run by hand.
