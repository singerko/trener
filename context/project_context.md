# Project Context

## Identity

`Trener` is a mobile training assistant app. It manages workout plans, runs live workouts, stores local workout history, and supports offline voice control plus TTS feedback.

The app is part of the SingerLand ecosystem and uses the SingerLand brand on the info screen and native splash screen.

## Product Goals

- Offline-first workout assistant for gym use.
- Voice-guided live workout flow with minimal touch interaction.
- Local plan, exercise, history, progress, and settings storage.
- Android app packaging through Capacitor.

## Current Stack

- React 19 + TypeScript + Vite.
- React Router for screen routing.
- Tailwind CSS 4 for UI styling.
- Lucide React for icons.
- Zustand with persist middleware for local app state.
- Capacitor 8 Android wrapper.
- Offline speech recognition through `vosk-speech-recognition-capacitor`.
- TTS through `@capacitor-community/text-to-speech`.
- Keep-awake through `@capacitor-community/keep-awake`.
- Date utilities through `date-fns`.

## Build And Workflow Rules

- Do not run project builds unless explicitly requested.
- The user runs builds through `make`.
- Preferred make targets:
  - `make build-web`
  - `make sync`
  - `make rebuild-apk`
  - `make sign`
  - `make install`
  - `make deploy`
- `make rebuild-apk` builds Android in a Podman Android build container and copies the debug APK to `Trener.apk`.
- `make deploy` rebuilds, signs, and installs the app.

## Branding

- Brand source lives in `../dizajn/logo.md` and `../dizajn/logo/`.
- App-local font copies live in `public/fonts/`.
- Android-native font copies live in `android/app/src/main/res/font/`.
- SingerLand wordmark:
  - `Singer`: Syne, weight 700, light `#1A1A18`, dark `#F0F0EE`.
  - `Land`: Syne, weight 400, light `#4A8200`, dark `#6BB800`.
  - Subtitle: uppercase, letter-spaced, secondary text color.
- App subtitle is `TRENER`.

## Important UX Notes

- The app is mobile-first.
- Live workout screens must remain readable at a distance and usable during exercise.
- Dark mode matters for low-light gym use.
- Safe-area handling is centralized in `src/index.css`.
- Bottom navigation and fixed live controls must account for Android system navigation insets.

## Data Persistence

- Zustand persist stores app data in browser `localStorage`.
- Storage key: `trener-storage`.
- Stored data includes exercises, workout plans, workout history, and settings.
- Workout plan order is manual and follows the persisted order of the `plany` array.
- One-off modified workout starts are stored only in `sessionStorage` and must not overwrite the saved workout plan.
- During a live workout, quick edits apply only to the current session. Editing an exercise item affects the current and future occurrences of that same planned item in the session.
- During a live workout, set round count can be reduced for the current set, but not below the current round.
- Workout plan export/import uses a versioned JSON package containing the plan and all exercises referenced by the plan.
- Import matches exercises by normalized exercise name. Existing exercises are reused, missing exercises are created.
- Import matches workout plans by normalized plan name. Existing plans are updated, otherwise a new plan is created.
- `SetItem.typ` supports:
  - `POCTOVY`: manual or voice-counted repetitions.
  - `CASOVY`: one timed exercise duration.
  - `DRZANE_OPAKOVANIA`: counted held repetitions, for example 12 reps where each rep is held for 20 seconds with a 5 second pause between reps.
  - `METRONOM`: automatically counted repetitions with an audio tick every `metronomeSec` seconds.

## Voice Behavior

- Voice control is initialized in live workout context, not globally.
- Current voice command categories include:
  - Start/resume commands: `start`, `spusti`.
  - Rep counting commands: Slovak/Czech number words.
  - Finish commands: `stop`, `hotovo`, `dalej`.
  - Pause command: `pauza`.
- TTS should stop stale speech when skipping or changing current exercise.
- Held repetitions and metronome repetitions are timer-led. Voice commands are used for start, pause, and next/skip, not for counting individual reps.

## Native Splash

- The reliable startup splash is implemented as a native Android `SplashActivity`.
- It uses `android/app/src/main/res/layout/activity_splash.xml` with Android `TextView` elements, not WebView-rendered React.
- `SplashActivity` opens Capacitor `MainActivity` after `SPLASH_DURATION_MS`.
- `MainActivity` uses a light `windowBackground` to avoid a black flash before WebView content loads.
