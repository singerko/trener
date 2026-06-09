# Architecture

## High-Level Shape

The app has two layers:

- Web app: React + TypeScript built by Vite into `dist/`.
- Android shell: Capacitor project under `android/`, packaging the web app plus native assets and plugins.

Capacitor loads the built web app from Android assets after `npx cap sync` or the project `make sync` target.

## Web Entry Points

- `src/main.tsx`: React root bootstrap.
- `src/App.tsx`: route tree.
- `src/index.css`: Tailwind import, theme tokens, safe-area utilities, SingerLand font registration, and shared logo CSS.

## Routes And Screens

Routes are defined in `src/App.tsx`.

- `/`: `Layout` wrapper with bottom navigation.
- `/`: `Dashboard`.
- `/cviky`: `ExerciseLibrary`.
- `/historia`: `History`.
- `/historia/:id`: `HistoryDetail`.
- `/merania`: `Measurements`.
- `/merania/:id`: `Measurements` detail for one measurement definition.
- `/progres`: `ProgressView`.
- `/help`: `Help`, currently also the settings/info screen.
- `/start/:id`: `WorkoutStartEditor`, one-off workout parameter editor before live start.
- `/editor/:id`: `PlanEditor`.
- `/trening/:id`: `LiveWorkout`.

## Shared Components

- `src/components/Layout.tsx`
  - Applies light/dark/system theme to the document root.
  - Renders bottom nav.
- `src/components/SingerLandLogo.tsx`
  - Shared React implementation of SingerLand wordmark for the web UI.
  - Uses CSS variables and Syne font registered in `src/index.css`.
- `src/components/Help.tsx`
  - Settings for theme, voice control, TTS.
  - App info block with SingerLand brand.
- `src/components/Dashboard.tsx`
  - Lists workout plans.
  - Keeps plan cards compact with direct play plus an overflow menu for edit, export, and one-off modified start.
  - Imports workout JSON files and delegates merge behavior to the store.
- `src/components/WorkoutStartEditor.tsx`
  - Creates a temporary copy of a workout plan for one-off parameter changes before starting.
  - Uses the shared `PlanForm`, so saved-plan editing and one-off start editing stay aligned.
  - Exports the currently displayed workout settings as a shareable JSON file including referenced exercises.
- `src/components/PlanForm.tsx`
  - Shared workout-plan form used by both `PlanEditor` and `WorkoutStartEditor`.
  - Owns set/exercise editing UI, item validation, held-rep fields, weights, ordering, and add/remove controls.
- `src/components/Measurements.tsx`
  - Lists measurement definitions, edits their fields and units, records timestamped values, and renders SVG trend charts.
  - Note colors are scoped to one measurement definition and are resolved dynamically for historical chart points.
- `src/components/NativeBackHandler.tsx`
  - Defines app route hierarchy for Android system back navigation.
  - Root route lets Android move the app to the background.

## State And Domain Model

- `src/lib/types.ts`: domain types for exercises, plans, sets, sessions, logs, and settings.
- `src/lib/store.ts`: Zustand store and mutations.
- `src/lib/workoutRuntime.ts`: sessionStorage helpers for temporary workout plans used by one-off modified starts.
- `src/lib/workoutShare.ts`: shared web/native export and share helper for workout JSON files.
- `src/lib/workoutTransfer.ts`: versioned workout export/import package validation, serialization, and merge logic.
- Persisted state uses `localStorage` through Zustand persist.
- Historical workout entries should store snapshots of values that can later change in plans, especially weight.
- Measurement data is split into definitions and entries. `MeasurementDefinition` stores name, unit, fields, and note presets. `MeasurementEntry` stores timestamp, field values, and note text.
- Measurement note colors are scoped per definition, so the same note text can have different colors for hmotnosť, tlak, or opuch. Chart colors are resolved from the current definition to allow historical recoloring.
- Held repetitions use `DRZANE_OPAKOVANIA` with `ciel` as the rep count, `holdSec` as the hold duration, and `restBetweenRepsSec` as the pause between reps.
- Metronome repetitions use `METRONOM` with `ciel` as the rep count and `metronomeSec` as the audio tick interval.
- History logs can snapshot held-rep and metronome fields through `holdSec`, `restBetweenRepsSec`, `restAfterSec`, `completedHeldReps`, and `metronomeSec`.

## Voice And Audio

- `src/lib/voice.ts`: speech recognition integration and command parsing.
- `src/lib/tts.ts`: text-to-speech wrapper.
- `src/lib/audio.ts`: local audio helpers.
- Live workout is the primary consumer of voice/TTS behavior.
- For `DRZANE_OPAKOVANIA`, `LiveWorkout` runs internal `HOLD` and `REST_BETWEEN_REPS` phases instead of relying on rep voice counting.
- For `METRONOM`, `LiveWorkout` increments repetitions automatically on the configured interval instead of showing manual rep increment controls.

## Android Project

Important Android files:

- `android/app/src/main/AndroidManifest.xml`
  - Launcher activity is `SplashActivity`.
  - Capacitor activity is `MainActivity`.
- `android/app/src/main/java/com/trener/app/SplashActivity.java`
  - Native startup splash.
  - Shows `activity_splash` and then starts `MainActivity`.
- `android/app/src/main/java/com/trener/app/MainActivity.java`
  - Capacitor `BridgeActivity`.
  - Intercepts Android system back and delegates route handling to the React `NativeBackHandler`.
- `android/app/src/main/java/com/trener/app/WorkoutSharePlugin.java`
  - App-local Capacitor plugin for Android share-sheet export of workout JSON files.
- `android/app/src/main/res/layout/activity_splash.xml`
  - Native text-based SingerLand splash screen.
- `android/app/src/main/res/layout/activity_main.xml`
  - Capacitor WebView container.
- `android/app/src/main/res/values/styles.xml`
  - App themes and light background to avoid black startup flash.
- `android/app/src/main/res/values/colors.xml`
  - Splash and brand colors.
- `android/app/src/main/res/font/`
  - Native Syne font assets.

## Android Assets

- Built web assets are copied to `android/app/src/main/assets/public`.
- Offline Vosk model lives in `android/app/src/main/assets/vosk-model-cs`.
- Do not edit generated `android/app/src/main/assets/public` directly; edit `src/`, build/sync through make.

## Branding Assets

- Design manual source: `../dizajn/logo.md`.
- Design logo source files: `../dizajn/logo/`.
- Web font copies: `public/fonts/`.
- Native Android font copies: `android/app/src/main/res/font/`.

When updating brand rules, keep the design source, web implementation, and native Android implementation aligned.

## Build Pipeline

Makefile flow:

- `make build-web`
  - bumps version via `scripts/bump_version.js`
  - runs `npm run build`
- `make sync`
  - runs `make build-web`
  - runs Capacitor add/sync
- `make rebuild-apk`
  - runs sync
  - builds Android debug APK in Podman
  - copies output to `Trener.apk`
- `make sign`
  - signs `Trener.apk` to `Trener.sign.apk`
- `make deploy`
  - rebuilds, signs, installs

Builds are user-owned. Do not run build commands unless explicitly asked.
