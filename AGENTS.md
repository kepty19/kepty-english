# Project Guidelines

## Overview

Kepty English is a mobile-first English learning portal (Pre-Alpha). The frontend is a static multi-page site (no build step), and learning data is served by a Google Apps Script (GAS) backend.

## Architecture

- **index.html** — Entry/menu page with links to each portal page.
- **main.html** — Core training application. Contains most app state and rendering logic for learning modules.
- **dashboard.html** — Learning stats dashboard UI (Chart.js-based visualizations).
- **learning-direction.html** — Learning strategy/policy page.
- **dressing-room.html** — "Dressing Room" showcase page.
- **admin-audio.html** — Audio admin panel for selecting Shadowing audio source and managing local folder/theme mappings.
- **index.css** — Main style sheet used by `main.html`.
- **app.js** — GAS server-side code (`doGet`/`doPost`) for spreadsheet data fetching and recorded-audio upload.
- **content/** — Local assets (audio files and images).
- **README.md** — Version history/changelog.

## Key Concepts

### Training Modules (`main.html`)
The training app has 8 footer modules:
- Vocabulary
- Pronunciation
- Grammar
- Shadowing
- Reading
- Topic Talk
- Speaking Form
- Sentence Building

Rendering is primarily controlled by `renderContent()` and `renderExamStep()`.

### Data Flow
- `main.html` fetches data from the GAS web app endpoint (`GAS_WEB_APP_URL`) using query param `id` (`userId`).
- Data is cached in `portalData` and used across all module renders.
- Core runtime state is managed by global `let` variables: `currentApp`, `currentModeIdx`, `currentSubKey`, `currentTheme`, `examIdx`, and related exam/audio state.
- `app.js` aggregates data from multiple spreadsheets and returns a single JSON payload.

### Shadowing Audio System
- Uses one shared `<audio id="global-player">` element in `main.html`.
- Audio source is switchable via `localStorage` key `keptyAudioSource`:
	- `drive`: uses audio URLs from spreadsheet data.
	- `local`: resolves `content/audios/...` paths from local mappings.
- `admin-audio.html` manages:
	- `keptyAudioSource`
	- `keptyLocalAudioMap`
	- `keptyThemeToFileMap`
- `stopAudio()` is called on lesson/theme changes to avoid overlap.

### Recording Upload
- Microphone recording in training flows uses `MediaRecorder` (browser side).
- Recorded audio is POSTed to GAS (`doPost`) as base64.
- GAS stores `.webm` files in Google Drive and returns a public link.

## Code Style

- Vanilla JavaScript only (no bundler, no npm runtime dependency).
- Tailwind CSS is loaded via CDN.
- Lucide icons are loaded via CDN; call `lucide.createIcons()` after dynamic DOM updates.
- Some pages also use additional CDN libraries (for example, Chart.js in `dashboard.html`).
- Most page logic is inline inside each HTML file's `<script>` tags.
- Keep naming in camelCase for variables/functions.

## Conventions

- **Global state (`main.html`)**: Reuse existing global `let` variables; do not redeclare state names.
- **Navigation shell**: Side-menu markup/styles are duplicated across pages. Keep menu links and item labels consistent when editing.
- **Versioning**: `x.y.z` format (major.feature.bugfix). Update `README.md` when version-related changes are made.
- **Branch**: Default branch is `main`.
- **Git email**: Use GitHub noreply email for push consistency.

## Common Pitfalls

- Do not redeclare existing state variables in `main.html` (for example audio/exam globals), or runtime will break silently.
- Keep braces balanced in large inline scripts; one misplaced `}` can break all subsequent logic.
- When editing Shadowing playback logic, preserve the current behavior: pause/resume on same track, restart on different track.
- If you update lesson/theme naming, also verify `keptyLocalAudioMap` / `keptyThemeToFileMap` resolution logic.
- `app.js` is GAS code and must use GAS APIs (`SpreadsheetApp`, `DriveApp`, `ContentService`, `Utilities`), not browser APIs.

## Testing

No automated test suite is configured.

Manual verification checklist:
- Open `index.html` and confirm page navigation works.
- In `main.html`, verify all footer modules render and mode switches work.
- In Shadowing, verify audio playback and stop behavior when switching lesson/theme.
- In `admin-audio.html`, switch audio source and confirm `main.html` respects it after reload.
- Verify record/upload flow (mic start/stop and successful POST response).
