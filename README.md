# FORGE

A workout planner and tracker for the PH-PPL program (Power/Hypertrophy Push-Pull-Legs). Runs in Chrome and installs to the home screen like a regular app.

## Where the data lives

On the phone, inside Chrome. Nothing is sent anywhere. Use **Settings → Back up data** to send a copy to Drive, email or a text. The app reminds you on the Home screen when a backup is overdue.

## Files

| File | What it is |
|---|---|
| `index.html` | The app's page |
| `js/config.js` | Whose copy this is. **The only file that differs from the main FORGE.** |
| `js/data.js` | The program: workouts, exercises, tips, video links |
| `js/app.js` | Everything the app does |
| `js/figures.js`, `js/moves.js` | The animated exercise figures (generated files, don't hand-edit) |
| `css/` | The look |
| `sw.js` | Lets the app work offline and pick up updates |
| `manifest.json`, `*.png` | App name and icons |

## Updating from the main FORGE

Copy every file over this repo **except `js/config.js`**. Logged workouts are untouched: they live on the phone, not in these files.
