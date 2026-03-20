# dashboard_data

Use JSON files in this folder to control dashboard planning data per user ID.

## 1) Map user IDs
Edit `users.json`:
- `defaultUserId`: fallback user when ID is not found.
- `users.<id>.configFile`: file name for that user.

## 2) Configure each user
Create one JSON file per user (example: `tomohiro.19.json`).

Supported fields:
- `planned.dailyTargetMinutes`: 7 numbers (Mon..Sun), in minutes.
- `planned.weeklyTargetMinutes`: total weekly target in minutes.
- `storageMode`:
  - `json-plus-local` (default): combines `historyDayActivityMs` with browser tracker data.
  - `json-only`: uses only `historyDayActivityMs`.
- `historyDayActivityMs`: object keyed by `YYYY-MM-DD`, values in milliseconds.

## Example
```json
{
  "planned": {
    "dailyTargetMinutes": [60, 60, 60, 60, 60, 30, 30],
    "weeklyTargetMinutes": 360
  },
  "storageMode": "json-plus-local",
  "historyDayActivityMs": {
    "2026-03-10": 2700000
  }
}
```
