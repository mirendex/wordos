<div align="center">

<img src="public/icon-512.png" alt="Логотип WordOS" width="112" height="112">

# WordOS

**Английский внутри маленькой пиксельной операционной системы.**
Словарь с интервальными повторениями, тексты и карточки от LLM, словесные игры, диктанты и
текстовый квест — каждое приложение открывается окном на рабочем столе телефона.

[![Build APK](https://github.com/mirendex/wordos/actions/workflows/build-apk.yml/badge.svg)](https://github.com/mirendex/wordos/actions/workflows/build-apk.yml)
[![Release](https://img.shields.io/github/v/release/mirendex/wordos?sort=semver&label=release&color=3B3560)](https://github.com/mirendex/wordos/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-C1432C)](LICENSE)
![Platform: Android](https://img.shields.io/badge/platform-Android-3DDC84?logo=android&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Capacitor 8](https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white)

[English](README.md) · **Русский**

<img src="docs/screenshots/tablet-desktop.png" alt="WordOS на планшете: окна WORDS.DB, TERMINAL и GAMES на рабочем столе" width="860">

<table>
  <tr>
    <td><img src="docs/screenshots/phone-desktop.png" alt="Рабочий стол" width="190"></td>
    <td><img src="docs/screenshots/phone-words.png" alt="WORDS.DB" width="190"></td>
    <td><img src="docs/screenshots/phone-games.png" alt="Игра «Пять букв»" width="190"></td>
    <td><img src="docs/screenshots/phone-terminal.png" alt="Квест в терминале" width="190"></td>
  </tr>
</table>

</div>

## О проекте

WordOS — Android-приложение для изучения английского на своём материале. Вместо ленты уроков
это маленькая настольная ОС в одном WebView: приложения — иконки, всё открывается в окнах,
которые можно перетаскивать, растягивать, разворачивать и сворачивать на панель задач. Все
приложения работают с одним общим словарём, поэтому прогресс в любом из них виден везде.

- Интерфейс на **русском** — приложение сделано для русскоязычных, кто учит английский. Код,
  комментарии и документация — на английском.
- Тексты, карточки, диалоги и проверки пишет LLM через [OpenRouter](https://openrouter.ai/)
  с **вашим собственным ключом**; модель выбирается любая.
- Без аккаунта и без сервера: всё хранится на устройстве.

## Возможности

| Приложение   | Что делает                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| **WORDS.DB** | 5000 самых частых английских слов с интервальными повторениями (SRS) и карточками: пример, перевод, формы слова.            |
| **GOAL**     | Подготовка к событию к дате — поездка, собеседование, переезд: слова и фразы по сценариям, дневная норма и ролевые диалоги. |
| **READER**   | Тексты на выбранную тему под ваш уровень (CEFR), появляются по мере написания, перевод любого слова по тапу.                |
| **DIARY**    | Пишете по-английски — текст проверяется, исправляется и объясняется.                                                        |
| **LISTEN**   | Диктант на слух с синтезом речи.                                                                                            |
| **ECHO**     | Чтение вслух с оценкой через распознавание речи.                                                                            |
| **GAMES**    | «Пять букв», поиск слов, порядок слов, пары и виселица.                                                                     |
| **TERMINAL** | Текстовый квест: исследуйте ноутбук ушедшего разработчика командами `ls`, `cd` и `cat`, чтобы найти код.                    |
| **NOTES**    | Сохранённые слова и исправления, собранные из дневника.                                                                     |
| **SETUP**    | Ключ и модель OpenRouter, голос, сила вибрации и ежедневные напоминания о повторении.                                       |

**Под капотом**

- Свой оконный менеджер: перетаскивание, изменение размера за угол, развернуть/восстановить,
  свернуть на панель задач, выделение рамкой — мышью и пальцем; на телефонах (≤ 760 px) окна
  открываются на весь экран. Окна возвращаются туда, где их оставили.
- Предиктивный жест «назад» в Android анимирует закрытие верхнего окна (свой плагин `BackGate`).
- Анимация запуска продолжает системный сплэш кадр в кадр.
- Вибрация с настоящей регулировкой силы на поддерживаемых телефонах (свой плагин `Vibe`),
  синтез и распознавание речи, локальные напоминания.
- Модель опрашивается заранее в фоне — следующие карточки, сцены, фразы для диктанта и машины
  для терминала, — поэтому большинство экранов открывается сразу.

## Установка

1. Скачайте `wordos-<версия>.apk` из [последнего релиза](https://github.com/mirendex/wordos/releases/latest)
   и установите (если попросит — разрешите установку из неизвестных источников).
2. Получите API-ключ на [openrouter.ai/keys](https://openrouter.ai/keys).
3. Откройте в приложении **SETUP**, вставьте ключ и выберите модель.

## Разработка

**Требования:** Node.js 22+; для APK ещё JDK 21 и Android SDK.

```bash
git clone https://github.com/mirendex/wordos.git
cd wordos
npm install
npm run dev
```

| Команда                  | Что делает                                                  |
| ------------------------ | ----------------------------------------------------------- |
| `npm run dev`            | Dev-сервер с горячей перезагрузкой                          |
| `npm run build`          | Проверка типов и сборка веб-части в `www/`                  |
| `npm run typecheck`      | TypeScript в строгом режиме                                 |
| `npm run lint`           | ESLint                                                      |
| `npm run format`         | Prettier                                                    |
| `npm test`               | Юнит-тесты Vitest                                           |
| `node scripts/smoke.mjs` | Сквозной прогон в headless Chromium (после `npm run build`) |
| `npm run screenshots`    | Пересоздать скриншоты для README в `docs/screenshots/`      |
| `npm run icons`          | Пересоздать иконки, сплэш и логотип загрузки                |

### Сборка APK

```bash
npm run copy   # собрать веб-часть и синхронизировать её в android/
npm run open   # открыть проект в Android Studio
npm run apk    # собрать debug APK через Gradle
```

### CI и релизы

[`build-apk.yml`](.github/workflows/build-apk.yml) запускается на каждый push в `master`: lint,
проверка типов и тесты, затем сборка веб-части и подписанный release APK, который сохраняется
как артефакт сборки. Для подписи нужны секреты репозитория `ANDROID_KEYSTORE_BASE64` (keystore в
base64) и `ANDROID_KEYSTORE_PASSWORD`; алиас ключа должен быть `wordos` (см.
`android/app/build.gradle`). Шаги подписи и релиза выполняются только в основном репозитории,
так что в форках проходят lint, тесты и сборка веб-части. Smoke-прогон занимает около двух минут
и запускается вручную.

### Выпуск новой версии

Версия задаётся в одном месте — в `package.json`; `versionName` и `versionCode` для Android
вычисляются из неё (`1.5.0` → `10500`). Релиз публикуется только при смене версии:

```bash
npm version minor --no-git-tag-version   # или patch / major
git commit -am "Release <version>"
git push
```

Если для версии ещё нет тега `v<версия>`, CI создаёт тег и
[релиз на GitHub](https://github.com/mirendex/wordos/releases) `WordOS <версия>` с файлом
`wordos-<версия>.apk` и списком коммитов с прошлой версии в описании. Установленное приложение
пару раз в день проверяет, нет ли релиза новее, и ненавязчиво предлагает его: кнопка
`↑ <версия>` на панели задач и строка в ABOUT. Push без смены версии только собирает
APK.

## Архитектура

TypeScript без фреймворков: рендер — шаблонные строки, без virtual DOM. `paint()` перерисовывает
рабочий стол и окна при каждом изменении состояния. Циклическая зависимость «всё вызывает paint,
paint вызывает всё» разорвана модулем `core/paint.ts`: он ничего не знает об экранах и только
хранит текущую функцию рендера (`setPainter`), которую при старте передаёт `ui/render.ts`.
Чистая логика лежит в `src/lib/` — её и покрывают юнит-тесты.

<details>
<summary>Структура проекта</summary>

```
index.html               точка входа, разметка рабочего стола
src/
  main.ts                запуск: жесты, клавиатура, клики, load() → boot()
  env.d.ts               глобальные объявления (window.storage, *.txt?raw)
  styles/                CSS по разделам интерфейса
  lib/                   чистые функции под тестами: json.ts (разбор обрезанного JSON от LLM),
                         scale.ts (шкала уровня, CEFR), text.ts (расстояние Левенштейна,
                         проверка ответов, diff), five.ts, termfs.ts (файловая система квеста),
                         grid.ts (раскладка поиска слов), srs.ts (лестница повторений),
                         plan.ts (обратный отсчёт, дневная норма, прогресс цели)
  data/                  частотный словарь (freq.txt, 5000 слов)
  core/                  persist.ts (состояние, банк карточек, load/save), paint.ts,
                         storage.ts (обёртка над localStorage), util.ts, keys.ts
  platform/              обёртки Capacitor: haptics.ts, speech.ts (TTS/STT), appinfo.ts,
                         notify.ts
  services/              llm.ts (OpenRouter), models.ts, translate.ts, warm.ts (фоновая
                         предзагрузка)
  domain/                frequency.ts, vocab.ts, progress.ts, cards.ts, goal.ts
  ui/                    windows.ts (оконный менеджер + жест «назад»), render.ts (paint +
                         роутер экранов), icons.ts, modal.ts, gestures.ts, keyboard.ts,
                         actions.ts, deal.ts (загрузка с раздачей карточек), bootanim.ts +
                         bootlogo.ts (анимация запуска; bootlogo.ts генерируется)
  apps/                  по модулю на приложение: about, reader, notes, setup, diary/, echo/,
                         listen/, terminal/, vocab/, goal/, games/
scripts/
  smoke.mjs              headless-прогон всех окон, игр, сохранения и управления окнами
  screenshots.mjs        скриншоты для README
  gen-icons.mjs          иконки, сплэш и логотип загрузки из одной пиксельной карты
android/                 нативный Android-проект (Capacitor)
  app/src/main/java/dev/mirendex/diffen/
    MainActivity.java    регистрирует плагины, передаёт сплэш веб-части
    BackGatePlugin.java  предиктивный жест «назад», синхронизирован с окнами в JS
    SplashGatePlugin.java  веб-часть сообщает, когда можно убрать сплэш
    VibePlugin.java      импульсы вибрации с заданной силой
```

</details>

## Приватность

Прогресс, карточки и настройки — включая API-ключ — хранятся в локальном хранилище приложения
и не покидают устройство, кроме этих запросов:

- [OpenRouter](https://openrouter.ai/) — запросы на тексты, карточки, проверки и диалоги,
  с вашим ключом;
- [MyMemory](https://mymemory.translated.net/) — бесплатный перевод отдельных слов (READER,
  поиск слов, игры);
- GitHub API — проверка новой версии, не чаще двух раз в день;
- Google Fonts — шрифты интерфейса.

## Лицензия

[MIT](LICENSE) © mirendex
