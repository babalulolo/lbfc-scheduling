/**
 * LBFC Volunteer Schedule — sheet sync
 * ------------------------------------------------
 * Lives INSIDE the master Google Sheet (Extensions → Apps Script).
 * The scheduling app POSTs JSON events here; this script writes them into two tabs:
 *
 *   "Calendar Import"     — one row per signup (unchanged, proven behavior)
 *   "Attendance Tracker"  — one row per signup; clock in/out fills Check-in /
 *                           Check-out / Actual Hours on the SAME row.
 *
 * Actions (sent by src/lib/sheets.js):
 *   add    → append Calendar Import row + create Attendance row (static info)
 *   remove → delete Calendar Import row + clear the Attendance row (cancellation)
 *   clock  → set Check-in / Check-out / Actual Hours on the Attendance row
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
// Visible columns A–O; we store the match key in a hidden column P.
var ATT_SHEET     = 'Attendance Tracker';
var ATT_FIRST_ROW = 3;
var ATT_KEY_COL   = 16; // column P (hidden key)
var ATT = {           // 1-based column positions
  date: 1, event: 2, shiftStart: 3, shiftEnd: 4,
  volunteerName: 5, email: 6, phone: 7, scheduledHours: 8,
  showedUp: 9, checkIn: 10, checkOut: 11, actualHours: 12,
  noShow: 13, calendarEventId: 14, notes: 15, key: 16,
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

// ─── CALENDAR IMPORT (proven behavior) ───────────────────────────────────────
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
// Create the row on signup with the static info; leave Showed Up / No Show? /
// Notes for the coordinator. Clock in/out fills Check-in, Check-out, Actual Hours.
function attendanceAdd(ss, b) {
  var sheet = ss.getSheetByName(ATT_SHEET);
  if (!sheet) return;
  if (findRowByKey(sheet, ATT_FIRST_ROW, ATT_KEY_COL, b.signupKey) !== -1) return; // already exists
  var row = firstEmptyAttendanceRow(sheet);
  writeAttendanceStatic(sheet, row, b);
}

function attendanceRemove(ss, b) {
  var sheet = ss.getSheetByName(ATT_SHEET);
  if (!sheet) return false;
  var row = findRowByKey(sheet, ATT_FIRST_ROW, ATT_KEY_COL, b.signupKey);
  if (row === -1) return false;
  // Clear values A–P but keep formatting + dropdown rules so the row is reusable.
  sheet.getRange(row, 1, 1, ATT_KEY_COL).clearContent();
  return true;
}

function attendanceClock(ss, b) {
  var sheet = ss.getSheetByName(ATT_SHEET);
  if (!sheet) return -1;
  var row = findRowByKey(sheet, ATT_FIRST_ROW, ATT_KEY_COL, b.signupKey);
  if (row === -1) {
    // Signup row missing (e.g. integration added after signup) — create a minimal one.
    row = firstEmptyAttendanceRow(sheet);
    writeAttendanceStatic(sheet, row, b);
  }
  if (b.clockIn !== undefined)  sheet.getRange(row, ATT.checkIn).setValue(b.clockIn || '');
  if (b.clockOut !== undefined) sheet.getRange(row, ATT.checkOut).setValue(b.clockOut || '');
  if (b.actualHours !== undefined && b.actualHours !== '' && b.actualHours !== null) {
    sheet.getRange(row, ATT.actualHours).setValue(b.actualHours);
  }
  return row;
}

// Write the static signup columns (A–H) + hidden key (P); leave I–O untouched.
function writeAttendanceStatic(sheet, row, b) {
  sheet.getRange(row, ATT.date, 1, 8).setValues([[
    b.date || '',
    b.event || '',
    b.shiftStart || '',
    b.shiftEnd || '',
    b.volunteerName || '',
    b.volunteerEmail || '',
    b.volunteerPhone || '',
    (b.scheduledHours === undefined ? '' : b.scheduledHours),
  ]]);
  sheet.getRange(row, ATT.key).setValue(b.signupKey || '');
}

// First row (from row 3) with both Date and key empty; else the next new row.
function firstEmptyAttendanceRow(sheet) {
  var last = sheet.getLastRow();
  if (last < ATT_FIRST_ROW) return ATT_FIRST_ROW;
  var n = last - ATT_FIRST_ROW + 1;
  var dates = sheet.getRange(ATT_FIRST_ROW, ATT.date, n, 1).getValues();
  var keys  = sheet.getRange(ATT_FIRST_ROW, ATT.key, n, 1).getValues();
  for (var i = 0; i < n; i++) {
    if (!String(dates[i][0]).trim() && !String(keys[i][0]).trim()) return ATT_FIRST_ROW + i;
  }
  return last + 1;
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
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
