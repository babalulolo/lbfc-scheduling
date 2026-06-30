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

## Known gap

The script currently handles `add` and `remove` only. The app also sends a
`clock` action (clock-in/out hours); the script ignores it for now. Wire up an
Attendance tab later if you want those hours in the sheet too.
