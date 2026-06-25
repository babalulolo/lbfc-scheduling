// ─── Google Sheets sync ───────────────────────────────────────────────────────
// Pushes shift signup / cancellation events to a Google Apps Script web app that
// appends or removes rows in the "Calendar Import" tab of the LBFC volunteer
// workbook.
//
// Configured via environment variables:
//   SHEETS_WEBHOOK_URL    — the Apps Script web-app deployment URL
//   SHEETS_WEBHOOK_SECRET — shared secret, must match the SECRET in the script
//
// If SHEETS_WEBHOOK_URL is not set, every call is a no-op, so this is safe to
// deploy before the sheet side is configured. All failures are swallowed —
// syncing to a spreadsheet must NEVER block or fail a volunteer signup.

function computeScheduledHours(startTime, endTime) {
  if (!startTime || !endTime) return '';
  const [sh, sm] = String(startTime).split(':').map(Number);
  const [eh, em] = String(endTime).split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return '';
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // tolerate overnight shifts
  return Math.round((mins / 60) * 100) / 100;
}

async function postToSheet(payload) {
  const url = process.env.SHEETS_WEBHOOK_URL;
  if (!url) return; // integration not configured — no-op

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, secret: process.env.SHEETS_WEBHOOK_SECRET || '' }),
      signal: controller.signal,
    });
  } catch (err) {
    console.error('Sheet sync error (non-blocking):', err);
  } finally {
    clearTimeout(timeout);
  }
}

function hoursBetween(startIso, endIso) {
  if (!startIso || !endIso) return '';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return '';
  return Math.round((ms / 3600000) * 100) / 100;
}

/**
 * Sync one signup to the spreadsheet.
 * @param {'add'|'remove'} action
 * @param {object} shift     a shift record (camelCase or snake_case fields)
 * @param {object} volunteer the volunteer ({ id, name, email })
 */
export async function syncSignupToSheet(action, shift, volunteer) {
  if (!shift || !volunteer) return;
  const startTime = shift.startTime || shift.start_time || '';
  const endTime = shift.endTime || shift.end_time || '';
  await postToSheet({
    action,
    // Stable key so the script can find & remove the exact row on cancellation.
    signupKey: `${shift.id}__${volunteer.id}`,
    date: shift.date || '',
    event: shift.title || '',
    shiftStart: startTime,
    shiftEnd: endTime,
    scheduledHours: computeScheduledHours(startTime, endTime),
    volunteerName: volunteer.name || '',
    volunteerEmail: volunteer.email || '',
    eventDescription: shift.description || '',
    location: shift.location || shift.locationAddress || shift.location_address || '',
  });
}

/**
 * Sync clock-in/out (actual attendance hours) to the spreadsheet.
 * The Apps Script will handle the 'clock' action once the Attendance tab
 * mapping is wired up; until then this is a harmless no-op.
 * @param {object} shift
 * @param {object} volunteer ({ id, name, email })
 * @param {object} signup    ({ clockInAt, clockOutAt })
 */
export async function syncClockToSheet(shift, volunteer, signup) {
  if (!shift || !volunteer || !signup) return;
  await postToSheet({
    action: 'clock',
    signupKey: `${shift.id}__${volunteer.id}`,
    date: shift.date || '',
    event: shift.title || '',
    volunteerName: volunteer.name || '',
    volunteerEmail: volunteer.email || '',
    clockInAt: signup.clockInAt || '',
    clockOutAt: signup.clockOutAt || '',
    actualHours: hoursBetween(signup.clockInAt, signup.clockOutAt),
  });
}
