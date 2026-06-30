// ─── Pacific time helpers ─────────────────────────────────────────────────────
// The Long Beach Food Coalition operates in Long Beach, CA. The app is used
// only in Pacific time, so EVERY human-facing time and every "what day is it"
// decision must be evaluated in America/Los_Angeles — never UTC, never the
// browser's local zone.
//
// Timestamps are still STORED as UTC ISO strings in the database (that's the
// correct, unambiguous foundation). These helpers are the single place that
// converts to/from Pacific for display, day-boundary checks, and editing.
// Works identically on the server and in the browser (pure Intl, no deps).

export const TZ = 'America/Los_Angeles';

function laParts(d) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
}

/** Today's date as 'YYYY-MM-DD' in Pacific time. */
export function todayLA(d = new Date()) {
  const p = laParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** UTC ISO → readable Pacific clock time, e.g. '9:03 AM'. '' if missing. */
export function formatClockLA(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit', timeZone: TZ,
  });
}

/** UTC ISO → readable Pacific date+time, e.g. 'Jul 15, 2026, 9:03 AM'. */
export function formatDateTimeLA(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZone: TZ,
  });
}

/**
 * 'YYYY-MM-DD' (a shift date, no time) → long readable date.
 * Parsed as a plain calendar date so it never shifts by a day.
 */
export function formatDateLA(dateStr, opts) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00'); // noon avoids any DST edge
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', opts || {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}

/** UTC ISO → 'YYYY-MM-DDTHH:mm' Pacific wall-clock, for <input type="datetime-local">. */
export function isoToLocalInputLA(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = laParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** 'YYYY-MM-DDTHH:mm' Pacific wall-clock (from a datetime-local input) → UTC ISO. */
export function localInputToIsoLA(val) {
  if (!val) return null;
  const s = val.length === 16 ? val + ':00' : val;
  let guess = new Date(s + 'Z');
  if (isNaN(guess.getTime())) return null;
  // Correct the UTC guess by however LA renders it; iterate once for DST edges.
  for (let i = 0; i < 2; i++) {
    const p = laParts(guess);
    const asLA = `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
    const diff = new Date(s + 'Z').getTime() - new Date(asLA + 'Z').getTime();
    if (diff === 0) break;
    guess = new Date(guess.getTime() + diff);
  }
  return guess.toISOString();
}

/** Hours between two ISO timestamps, rounded to 1 decimal. null if invalid. */
export function hoursBetweenLA(inIso, outIso) {
  if (!inIso || !outIso) return null;
  const ms = new Date(outIso).getTime() - new Date(inIso).getTime();
  return ms > 0 ? Math.round((ms / 3600000) * 10) / 10 : null;
}
