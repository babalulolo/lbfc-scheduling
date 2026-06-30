# Google Sheets sync

The scheduling app pushes shift signups/cancellations into the **master Google
Sheet** ("Calendar Import" tab). This folder is the **backup** of the script
that makes that work.

## How it connects

```
App (src/lib/sheets.js)  ──POST JSON──►  Apps Script web app  ──►  "Calendar Import" tab
```

The app posts to a Google Apps Script "web app" URL. The script appends a row on
signup and deletes it on cancellation, matched by a hidden key in **column J**.

## The two values that must match

| What | Where it lives | Notes |
|------|----------------|-------|
| `SHEETS_WEBHOOK_URL` | Railway env var | The Apps Script web-app deployment URL |
| `SHEETS_WEBHOOK_SECRET` | Railway env var **and** `SECRET` in `Code.gs` | Must be identical on both sides |

If the sync stops working, 99% of the time it's because these drifted apart
(e.g. the script was re-deployed at a new URL, or the secret changed on one side).

## The master sheet is load-bearing

The live script lives **inside** the master Google Sheet (Extensions → Apps
Script). Don't delete that sheet or replace it with a copy — that breaks the
sync. `Code.gs` here is the recovery copy if it ever happens.

## To redeploy from this backup

1. Open the master sheet → **Extensions → Apps Script**
2. Paste in `Code.gs`
3. Set `SECRET` to the real value (same as Railway's `SHEETS_WEBHOOK_SECRET`)
4. **Deploy → New deployment → Web app** → Execute as **Me**, Access **Anyone**
5. Copy the new URL into Railway's `SHEETS_WEBHOOK_URL`, then redeploy the app

## Two tabs

- **Calendar Import** — one row per signup. Row 1 banner, row 2 headers, data
  from row 3, hidden key in column **J**. Unchanged, proven behavior.
- **Attendance Tracker** — one row per signup (created on `add`). Columns A–O are
  `Date · Event · Shift Start · Shift End · Volunteer Name · Email · Phone ·
  Scheduled Hours · Showed Up · Check-in Time · Check-out Time · Actual Hours ·
  No Show? · Calendar Event ID · Notes`. The match key is stored in a hidden
  column **P**. Clock in/out fills **Check-in (J)**, **Check-out (K)**, and
  **Actual Hours (L)** on that same row. `Showed Up`, `No Show?`, and `Notes`
  are left for the coordinator.

On cancellation (`remove`) the Calendar Import row is deleted and the Attendance
row is cleared (values only — formatting and dropdowns are preserved so the row
is reusable).

- **Volunteer Master** — one row per volunteer, **upserted by email**. Columns
  A–J are `Volunteer Name · Email · Phone · Can Drive? · Preferred Roles ·
  Emergency Contact · Total Hours · Events Attended · No Shows · Notes`. The app
  writes **Name, Email, Phone, Emergency Contact** (name + phone combined) and
  leaves the rest for the coordinator / sheet formulas. Fired by `volunteer_upsert`
  on registration, and in bulk by the admin "Sync to Google Sheet" button
  (POST `/api/admin/volunteers/sync`).

## Redeploying after a script change

Editing the code does NOT update the live web app on its own. After pasting a new
version: **Deploy → Manage deployments → Edit (pencil) → Version: New version →
Deploy**. The web-app URL stays the same, so Railway needs no change.
