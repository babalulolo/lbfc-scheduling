/**
 * LBFC Volunteer Signup → "Calendar Import" sync
 * Receives signup / cancellation events from the scheduling app and writes
 * (or removes) rows in the "Calendar Import" tab.
 *
 * This is a BACKUP of the script that is deployed inside the master Google
 * Sheet ("LBFC Volunteer Schedule"). If that sheet is ever lost, redeploy this:
 *   Extensions → Apps Script → paste → set SECRET → Deploy as Web app.
 *
 * SECURITY: the real SECRET is intentionally NOT stored here. It lives only in
 * the deployed Apps Script and in Railway's SHEETS_WEBHOOK_SECRET env var.
 * The two must match. Paste the real value back in when redeploying.
 */

var SHEET_NAME     = 'Calendar Import';
var SECRET         = 'SET_THIS_TO_MATCH_SHEETS_WEBHOOK_SECRET'; // redacted in repo
var FIRST_DATA_ROW = 3;   // row 1 = title banner, row 2 = column headers
var KEY_COL        = 10;  // column J: hidden reference used to find rows on cancel

function doPost(e) {
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return json({ ok: false, error: 'busy' }); }
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.secret !== SECRET) return json({ ok: false, error: 'unauthorized' });

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) return json({ ok: false, error: 'sheet "' + SHEET_NAME + '" not found' });

    if (body.action === 'add') {
      if (findRowByKey(sheet, body.signupKey) === -1) {
        sheet.appendRow([
          body.date, body.event, body.shiftStart, body.shiftEnd,
          body.scheduledHours, body.volunteerName, body.volunteerEmail,
          body.eventDescription, body.location, body.signupKey
        ]);
      }
      return json({ ok: true, action: 'add' });
    }

    if (body.action === 'remove') {
      var row = findRowByKey(sheet, body.signupKey);
      if (row !== -1) sheet.deleteRow(row);
      return json({ ok: true, action: 'remove', removed: row !== -1 });
    }

    return json({ ok: true, action: 'ignored' });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function findRowByKey(sheet, key) {
  if (!key) return -1;
  var last = sheet.getLastRow();
  if (last < FIRST_DATA_ROW) return -1;
  var keys = sheet.getRange(FIRST_DATA_ROW, KEY_COL, last - FIRST_DATA_ROW + 1, 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === String(key)) return FIRST_DATA_ROW + i;
  }
  return -1;
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
