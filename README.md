# FORGE

A workout planner and tracker for the PH-PPL program (Power/Hypertrophy Push-Pull-Legs). Runs in Chrome and installs to the home screen like a regular app.

## Where the data lives

On the phone, inside Chrome. Nothing is sent anywhere. Use **Settings → Back up data** to send a copy to Drive, email or a text, and **Restore from backup** to load one. The app reminds you on the Home screen when a backup is overdue.

## Files

| File | What it is |
|---|---|
| `index.html` | The app's page |
| `guide.html` | The user guide for this copy, live at [lumen-drogulus.github.io/Forge-Uncle/guide.html](https://lumen-drogulus.github.io/Forge-Uncle/guide.html) |
| `js/config.js` | Whose copy this is. **The only app file that differs from the main FORGE.** |
| `js/data.js` | The program: each exercise once (name, tip, video), then each workout's sets, reps and rest |
| `js/app.js` | Everything the app does |
| `js/figures.js`, `js/moves.js` | The animated exercise figures (generated files, don't hand-edit) |
| `css/` | The look and the icons |
| `fonts/` | The app's fonts, stored here so it works with no signal |
| `sw.js` | Lets the app work offline and pick up updates |
| `manifest.json`, `*.png` | App name and icons |

## Updating from the main FORGE

Copy every file over this repo **except `js/config.js`, `guide.html` and this README**. Logged workouts are untouched: they live on the phone, not in these files.
