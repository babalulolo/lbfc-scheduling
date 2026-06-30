/**
 * LBFC Volunteer Schedule — sheet sync
 * ------------------------------------------------
 * Lives INSIDE the master Google Sheet (Extensions → Apps Script).
 * The scheduling app POSTs JSON events here; this script writes them into:
 *
 *   "Calendar Import"     — one row per signup
 *   "Attendance Tracker"  — one row per signup; clock in/out fills Check-in /
 *                           Check-out / Actual Hours on the SAME row
 *   "Volunteer Master"    — one row per volunteer (upserted by email)
 *
 * Actions (sent by src/lib/sheets.js):
 *   add              → Calendar Import row + Attendance row (static info)
 *   remove           → delete Calendar Import row + clear the Attendance row
 *   clock            → set Check-in / Check-out / Actual Hours on the Attendance row
 *   volunteer_upsert → create/update the volunteer's row in Volunteer Master
 *
 * SETUP: set SECRET to match the app's SHEETS_WEBHOOK_SECRET (Railway).
 * After editing: Deploy → Manage deployments → Edit → Version: New version → Deploy
 * (the web-app URL stays the same).
 */

// ─── CONFIG ──────────────────────────────────────────────────────────────────
var SECRET = 'SET_THIS_TO_MATCH_SHEETS_WEBHOOK_SECRET'; // redacted in repo

// Calendar Import: row 1 banner, row 2 headers, data from row 3, key in col J.
var CAL_SHEET     = 'Calendar Import';
var CAL_FIRST_ROW = 3;
var CAL_KEY_COL   = 10; // column J

// Attendance Tracker: row 1 banner, row 2 headers, data from row 3.
// Visible columns A–O; match key stored in a hidden column P.
var ATT_SHEET     = 'Attendance Tracker';
var ATT_FIRST_ROW = 3;
var ATT_KEY_COL   = 16; // column P (hidden key)
var ATT = {
  date: 1, event: 2, shiftStart: 3, shiftEnd: 4,
  volunteerName: 5, email: 6, phone: 7, scheduledHours: 8,
  showedUp: 9, checkIn: 10, checkOut: 11, actualHours: 12,
  noShow: 13, calendarEventId: 14, notes: 15, key: 16,
};

// Volunteer Master: row 1 banner, row 2 headers, data from row 3. Matched by email.
var VOL_SHEET     = 'Volunteer Master';
var VOL_FIRST_ROW = 3;
var VOL = {
  name: 1, email: 2, phone: 3, canDrive: 4, preferredRoles: 5,
  emergencyContact: 6, totalHours: 7, eventsAttended: 8, noShows: 9, notes: 10,
};

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return json({ ok: false, error: 'busy' }); }
  try {
    if (!e || !e.postData || !e.postData.contents) return json({ ok: false, error: 'empty request' });
    var body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return json({ ok: false, error: 'unauthorized' });

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (body.action === 'add') {
      calendarAdd(ss, body);
      attendanceAdd(ss, body);
      return json({ ok: true, action: 'add' });
    }
    if (body.action === 'remove') {
      var c = calendarRemove(ss, body);
      var a = attendanceRemove(ss, body);
      return json({ ok: true, action: 'remove', calendarRemoved: c, attendanceCleared: a });
    }
    if (body.action === 'clock') {
      var row = attendanceClock(ss, body);
      return json({ ok: true, action: 'clock', row: row });
    }
    if (body.action === 'volunteer_upsert') {
      var vrow = volunteerUpsert(ss, body);
      return json({ ok: true, action: 'volunteer_upsert', row: vrow });
    }
    if (body.action === 'volunteer_remove') {
      var vcleared = volunteerRemove(ss, body);
      return json({ ok: true, action: 'volunteer_remove', cleared: vcleared });
    }
    return json({ ok: true, action: 'ignored' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json({ ok: true, service: 'LBFC sheet sync', ready: true });
}

// ─── CALENDAR IMPORT ─────────────────────────────────────────────────────────
function calendarAdd(ss, b) {
  var sheet = ss.getSheetByName(CAL_SHEET);
  if (!sheet) return;
  if (findRowByKey(sheet, CAL_FIRST_ROW, CAL_KEY_COL, b.signupKey) !== -1) return;
  sheet.appendRow([
    b.date, b.event, b.shiftStart, b.shiftEnd, b.scheduledHours,
    b.volunteerName, b.volunteerEmail, b.eventDescription, b.location, b.signupKey,
  ]);
}

function calendarRemove(ss, b) {
  var sheet = ss.getSheetByName(CAL_SHEET);
  if (!sheet) return false;
  var row = findRowByKey(sheet, CAL_FIRST_ROW, CAL_KEY_COL, b.signupKey);
  if (row === -1) return false;
  sheet.deleteRow(row);
  return true;
}

// ─── ATTENDANCE TRACKER ──────────────────────────────────────────────────────
function attendanceAdd(ss, b) {
  var sheet = ss.getSheetByName(ATT_SHEET);
  if (!sheet) return;
  if (findRowByKey(sheet, ATT_FIRST_ROW, ATT_KEY_COL, b.signupKey) !== -1) return;
  writeAttendanceStatic(sheet, firstEmptyRow(sheet, ATT_FIRST_ROW, ATT.date, ATT.key), b);
}

function attendanceRemove(ss, b) {
  var sheet = ss.getSheetByName(ATT_SHEET);
  if (!sheet) return false;
  var row = findRowByKey(sheet, ATT_FIRST_ROW, ATT_KEY_COL, b.signupKey);
  if (row === -1) return false;
  sheet.getRange(row, 1, 1, ATT_KEY_COL).clearContent(); // keep formatting + dropdowns
  return true;
}

function attendanceClock(ss, b) {
  var sheet = ss.getSheetByName(ATT_SHEET);
  if (!sheet) return -1;
  var row = findRowByKey(sheet, ATT_FIRST_ROW, ATT_KEY_COL, b.signupKey);
  if (row === -1) {
    row = firstEmptyRow(sheet, ATT_FIRST_ROW, ATT.date, ATT.key);
    writeAttendanceStatic(sheet, row, b);
  }
  if (b.clockIn !== undefined)  sheet.getRange(row, ATT.checkIn).setValue(b.clockIn || '');
  if (b.clockOut !== undefined) sheet.getRange(row, ATT.checkOut).setValue(b.clockOut || '');
  if (b.actualHours !== undefined && b.actualHours !== '' && b.actualHours !== null) {
    sheet.getRange(row, ATT.actualHours).setValue(b.actualHours);
  }
  return row;
}

function writeAttendanceStatic(sheet, row, b) {
  sheet.getRange(row, ATT.date, 1, 8).setValues([[
    b.date || '', b.event || '', b.shiftStart || '', b.shiftEnd || '',
    b.volunteerName || '', b.volunteerEmail || '', b.volunteerPhone || '',
    (b.scheduledHours === undefined ? '' : b.scheduledHours),
  ]]);
  sheet.getRange(row, ATT.key).setValue(b.signupKey || '');
}

// ─── VOLUNTEER MASTER ────────────────────────────────────────────────────────
// Upsert by email. Writes Name / Email / Phone / Emergency Contact; leaves
// Can Drive?, Preferred Roles, Total Hours, Events Attended, No Shows, Notes.
function volunteerUpsert(ss, b) {
  var sheet = ss.getSheetByName(VOL_SHEET);
  if (!sheet) return -1;
  var email = String(b.volunteerEmail || '').trim();
  if (!email) return -1;
  var row = findRowByKey(sheet, VOL_FIRST_ROW, VOL.email, email);
  if (row === -1) row = firstEmptyRow(sheet, VOL_FIRST_ROW, VOL.name, VOL.email);
  sheet.getRange(row, VOL.name).setValue(b.volunteerName || '');
  sheet.getRange(row, VOL.email).setValue(email);
  sheet.getRange(row, VOL.phone).setValue(b.volunteerPhone || '');
  if (b.emergencyContact) sheet.getRange(row, VOL.emergencyContact).setValue(b.emergencyContact);
  return row;
}

// Clear a volunteer's row (matched by email); keeps formatting + dropdowns.
function volunteerRemove(ss, b) {
  var sheet = ss.getSheetByName(VOL_SHEET);
  if (!sheet) return false;
  var email = String(b.volunteerEmail || '').trim();
  if (!email) return false;
  var row = findRowByKey(sheet, VOL_FIRST_ROW, VOL.email, email);
  if (row === -1) return false;
  sheet.getRange(row, 1, 1, VOL.notes).clearContent(); // clear A–J values
  return true;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
// First row (from firstRow) where BOTH colA and colB are empty; else next new row.
function firstEmptyRow(sheet, firstRow, colA, colB) {
  var last = sheet.getLastRow();
  if (last < firstRow) return firstRow;
  var n = last - firstRow + 1;
  var a = sheet.getRange(firstRow, colA, n, 1).getValues();
  var b = sheet.getRange(firstRow, colB, n, 1).getValues();
  for (var i = 0; i < n; i++) {
    if (!String(a[i][0]).trim() && !String(b[i][0]).trim()) return firstRow + i;
  }
  return last + 1;
}

function findRowByKey(sheet, firstRow, keyCol, key) {
  if (!key) return -1;
  var last = sheet.getLastRow();
  if (last < firstRow) return -1;
  var keys = sheet.getRange(firstRow, keyCol, last - firstRow + 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === String(key)) return firstRow + i;
  }
  return -1;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
