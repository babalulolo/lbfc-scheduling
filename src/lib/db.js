import { Pool } from 'pg';
import { todayLA } from './time.js';

// ─── Connection pool ──────────────────────────────────────────────────────────
const connectionString =
  process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL;

const pool = new Pool({
  connectionString,
  ssl: connectionString && connectionString.includes('railway.internal')
    ? false
    : { rejectUnauthorized: false },
});

// ─── Schema bootstrap ─────────────────────────────────────────────────────────
let initialized = false;

async function initDb() {
  if (initialized) return;
  initialized = true;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id                      TEXT PRIMARY KEY,
      email                   TEXT UNIQUE NOT NULL,
      name                    TEXT NOT NULL,
      phone                   TEXT,
      password_hash           TEXT NOT NULL,
      role                    TEXT NOT NULL DEFAULT 'volunteer',
      emergency_contact_name  TEXT,
      emergency_contact_phone TEXT,
      created_at              TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shifts (
      id                   TEXT PRIMARY KEY,
      title                TEXT NOT NULL,
      description          TEXT,
      date                 TEXT NOT NULL,
      start_time           TEXT NOT NULL,
      end_time             TEXT,
      location             TEXT,
      location_address     TEXT,
      notes                TEXT,
      slots_total          INTEGER NOT NULL DEFAULT 1,
      recurrence_group_id  TEXT,
      created_by           TEXT,
      created_at           TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shift_signups (
      id           TEXT PRIMARY KEY,
      shift_id     TEXT NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
      user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      signed_up_at TEXT NOT NULL,
      UNIQUE(shift_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS invite_codes (
      id         TEXT PRIMARY KEY,
      code       TEXT UNIQUE NOT NULL,
      role       TEXT NOT NULL,
      created_by TEXT,
      created_at TEXT NOT NULL,
      used_by    TEXT,
      used_at    TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );

    INSERT INTO settings (key, value)
    VALUES ('volunteer_code', 'LBFC-VOLUNTEER'),
           ('admin_code',     'LBFC-ADMIN')
    ON CONFLICT (key) DO NOTHING;
  `);

  // Migrate existing shifts table if recurrence_group_id column is missing
  await pool.query(`
    ALTER TABLE shifts ADD COLUMN IF NOT EXISTS recurrence_group_id TEXT;
  `);

  // Migrate shift_signups for clock in/out tracking
  await pool.query(`
    ALTER TABLE shift_signups ADD COLUMN IF NOT EXISTS clock_in_at  TEXT;
    ALTER TABLE shift_signups ADD COLUMN IF NOT EXISTS clock_out_at TEXT;
  `);

  // Migrate users for block/deactivate support
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;
  `);
}

async function withDb(fn) {
  await initDb();
  return fn(pool);
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    passwordHash: row.password_hash,
    role: row.role,
    emergencyContactName: row.emergency_contact_name,
    emergencyContactPhone: row.emergency_contact_phone,
    active: row.active !== false, // default true (column may be null on old rows)
    createdAt: row.created_at,
  };
}

function rowToShift(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    locationAddress: row.location_address,
    notes: row.notes,
    slotsTotal: row.slots_total,
    recurrenceGroupId: row.recurrence_group_id || null,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

function rowToSignup(row) {
  if (!row) return null;
  return {
    id: row.id,
    shiftId: row.shift_id,
    userId: row.user_id,
    signedUpAt: row.signed_up_at,
    clockInAt: row.clock_in_at || null,
    clockOutAt: row.clock_out_at || null,
  };
}

// ─── User functions ───────────────────────────────────────────────────────────

export async function findUser(email) {
  return withDb(async (db) => {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [email]
    );
    return rowToUser(rows[0]) || null;
  });
}

export async function findUserById(id) {
  return withDb(async (db) => {
    const { rows } = await db.query(
      'SELECT * FROM users WHERE id = $1 LIMIT 1',
      [id]
    );
    return rowToUser(rows[0]) || null;
  });
}

export async function createUser(user) {
  return withDb(async (db) => {
    await db.query(
      `INSERT INTO users
         (id, email, name, phone, password_hash, role,
          emergency_contact_name, emergency_contact_phone, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        user.id,
        user.email,
        user.name,
        user.phone || null,
        user.passwordHash,
        user.role || 'volunteer',
        user.emergencyContactName || null,
        user.emergencyContactPhone || null,
        user.createdAt || new Date().toISOString(),
      ]
    );
    return user;
  });
}

export async function getAllUsers() {
  return withDb(async (db) => {
    const { rows } = await db.query('SELECT * FROM users ORDER BY created_at');
    return rows.map(rowToUser);
  });
}

// Block (active=false) or reactivate (active=true) a user.
export async function setUserActive(userId, active) {
  return withDb(async (db) => {
    await db.query('UPDATE users SET active = $1 WHERE id = $2', [active, userId]);
    if (!active) {
      // Kill existing sessions so a blocked user is logged out immediately.
      await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    }
  });
}

// Permanently delete a user. shift_signups cascade automatically; remove sessions explicitly.
export async function deleteUser(userId) {
  return withDb(async (db) => {
    await db.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
  });
}

// Count active admins — used to prevent removing/blocking the last one.
export async function countActiveAdmins() {
  return withDb(async (db) => {
    const { rows } = await db.query(
      "SELECT COUNT(*)::int AS n FROM users WHERE role = 'admin' AND active = TRUE"
    );
    return rows[0].n;
  });
}

// Shifts a user is signed up for — used to clean their rows from the sheet on removal.
export async function getSignupsForUser(userId) {
  return withDb(async (db) => {
    const { rows } = await db.query(
      `SELECT s.* FROM shift_signups su
         JOIN shifts s ON s.id = su.shift_id
        WHERE su.user_id = $1`,
      [userId]
    );
    return rows.map(rowToShift);
  });
}

export async function hasAnyUsers() {
  return withDb(async (db) => {
    const { rows } = await db.query('SELECT 1 FROM users LIMIT 1');
    return rows.length > 0;
  });
}

// ─── Shift functions ──────────────────────────────────────────────────────────

export async function getShifts(filter = {}) {
  return withDb(async (db) => {
    let query = 'SELECT * FROM shifts';
    const params = [];

    if (filter.date) {
      params.push(filter.date);
      query += ` WHERE date = $${params.length}`;
    } else if (filter.month) {
      params.push(filter.month + '%');
      query += ` WHERE date LIKE $${params.length}`;
    } else if (filter.fromToday) {
      const today = todayLA(); // Pacific "today", not UTC
      params.push(today);
      query += ` WHERE date >= $${params.length}`;
    }

    query += ' ORDER BY date ASC, start_time ASC';
    const { rows } = await db.query(query, params);
    return rows.map(rowToShift);
  });
}

export async function getShiftById(id) {
  return withDb(async (db) => {
    const { rows } = await db.query(
      'SELECT * FROM shifts WHERE id = $1 LIMIT 1',
      [id]
    );
    return rowToShift(rows[0]) || null;
  });
}

export async function createShift(shift) {
  return withDb(async (db) => {
    await db.query(
      `INSERT INTO shifts
         (id, title, description, date, start_time, end_time,
          location, location_address, notes, slots_total,
          recurrence_group_id, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        shift.id,
        shift.title,
        shift.description || null,
        shift.date,
        shift.startTime,
        shift.endTime || null,
        shift.location || null,
        shift.locationAddress || null,
        shift.notes || null,
        shift.slotsTotal || 1,
        shift.recurrenceGroupId || null,
        shift.createdBy || null,
        shift.createdAt || new Date().toISOString(),
      ]
    );
    return shift;
  });
}

export async function updateShift(id, updates) {
  return withDb(async (db) => {
    const fields = [];
    const params = [];

    const colMap = {
      title: 'title',
      description: 'description',
      date: 'date',
      startTime: 'start_time',
      endTime: 'end_time',
      location: 'location',
      locationAddress: 'location_address',
      notes: 'notes',
      slotsTotal: 'slots_total',
    };

    for (const [key, col] of Object.entries(colMap)) {
      if (key in updates) {
        params.push(updates[key]);
        fields.push(`${col} = $${params.length}`);
      }
    }

    if (fields.length === 0) return getShiftById(id);

    params.push(id);
    await db.query(
      `UPDATE shifts SET ${fields.join(', ')} WHERE id = $${params.length}`,
      params
    );
    return getShiftById(id);
  });
}

export async function deleteShift(id) {
  return withDb(async (db) => {
    await db.query('DELETE FROM shifts WHERE id = $1', [id]);
  });
}

export async function deleteShiftsByRecurrenceGroup(groupId) {
  return withDb(async (db) => {
    const { rowCount } = await db.query(
      'DELETE FROM shifts WHERE recurrence_group_id = $1',
      [groupId]
    );
    return rowCount;
  });
}

// ─── Signup functions ─────────────────────────────────────────────────────────

export async function getSignupsForShift(shiftId) {
  return withDb(async (db) => {
    const { rows } = await db.query(
      'SELECT * FROM shift_signups WHERE shift_id = $1',
      [shiftId]
    );
    return rows.map(rowToSignup);
  });
}

export async function getSignupByUserAndShift(userId, shiftId) {
  return withDb(async (db) => {
    const { rows } = await db.query(
      'SELECT * FROM shift_signups WHERE user_id = $1 AND shift_id = $2 LIMIT 1',
      [userId, shiftId]
    );
    return rowToSignup(rows[0]) || null;
  });
}

export async function createSignup(signup) {
  return withDb(async (db) => {
    await db.query(
      `INSERT INTO shift_signups (id, shift_id, user_id, signed_up_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (shift_id, user_id) DO NOTHING`,
      [
        signup.id,
        signup.shiftId,
        signup.userId,
        signup.signedUpAt || new Date().toISOString(),
      ]
    );
    return signup;
  });
}

export async function deleteSignup(userId, shiftId) {
  return withDb(async (db) => {
    await db.query(
      'DELETE FROM shift_signups WHERE user_id = $1 AND shift_id = $2',
      [userId, shiftId]
    );
  });
}

// ─── Clock in / out ───────────────────────────────────────────────────────────

export async function setClockIn(userId, shiftId, timestamp) {
  return withDb(async (db) => {
    await db.query(
      `UPDATE shift_signups SET clock_in_at = $1
       WHERE user_id = $2 AND shift_id = $3`,
      [timestamp, userId, shiftId]
    );
    return getSignupByUserAndShift(userId, shiftId);
  });
}

export async function setClockOut(userId, shiftId, timestamp) {
  return withDb(async (db) => {
    await db.query(
      `UPDATE shift_signups SET clock_out_at = $1
       WHERE user_id = $2 AND shift_id = $3`,
      [timestamp, userId, shiftId]
    );
    return getSignupByUserAndShift(userId, shiftId);
  });
}

// Admin override — set either/both timestamps directly (null clears a value)
export async function setClockTimes(userId, shiftId, { clockInAt, clockOutAt }) {
  return withDb(async (db) => {
    await db.query(
      `UPDATE shift_signups
         SET clock_in_at = $1, clock_out_at = $2
       WHERE user_id = $3 AND shift_id = $4`,
      [clockInAt ?? null, clockOutAt ?? null, userId, shiftId]
    );
    return getSignupByUserAndShift(userId, shiftId);
  });
}

// ─── Access codes ─────────────────────────────────────────────────────────────

const DEFAULT_CODES = { volunteer: 'LBFC-VOLUNTEER', admin: 'LBFC-ADMIN' };

export async function getAccessCodes() {
  return withDb(async (db) => {
    const { rows } = await db.query(
      "SELECT key, value FROM settings WHERE key IN ('volunteer_code','admin_code')"
    );
    const codes = { ...DEFAULT_CODES };
    for (const row of rows) {
      if (row.key === 'volunteer_code') codes.volunteer = row.value;
      if (row.key === 'admin_code') codes.admin = row.value;
    }
    return codes;
  });
}

export async function setAccessCodes(updates) {
  return withDb(async (db) => {
    if (updates.volunteer !== undefined) {
      await db.query(
        "INSERT INTO settings (key,value) VALUES ('volunteer_code',$1) ON CONFLICT (key) DO UPDATE SET value=$1",
        [updates.volunteer]
      );
    }
    if (updates.admin !== undefined) {
      await db.query(
        "INSERT INTO settings (key,value) VALUES ('admin_code',$1) ON CONFLICT (key) DO UPDATE SET value=$1",
        [updates.admin]
      );
    }
  });
}

export async function validateAccessCode(code) {
  const codes = await getAccessCodes();
  const upper = code.toUpperCase().trim();
  if (upper === codes.volunteer.toUpperCase()) return 'volunteer';
  if (upper === codes.admin.toUpperCase()) return 'admin';
  return null;
}

// ─── Invite codes ─────────────────────────────────────────────────────────────

export async function createInviteCode(inviteCode) {
  return withDb(async (db) => {
    await db.query(
      `INSERT INTO invite_codes (id, code, role, created_by, created_at, used_by, used_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        inviteCode.id,
        inviteCode.code,
        inviteCode.role || 'volunteer',
        inviteCode.createdBy || null,
        inviteCode.createdAt || new Date().toISOString(),
        inviteCode.usedBy || null,
        inviteCode.usedAt || null,
      ]
    );
    return inviteCode;
  });
}


// ─── Session functions ────────────────────────────────────────────────────────

export async function createDbSession(token, userId) {
  return withDb(async (db) => {
    await db.query(
      'INSERT INTO sessions (token, user_id, created_at) VALUES ($1, $2, $3) ON CONFLICT (token) DO NOTHING',
      [token, userId, Date.now()]
    );
  });
}

export async function getDbSessionUser(token) {
  return withDb(async (db) => {
    const { rows } = await db.query(
      'SELECT user_id FROM sessions WHERE token = $1 LIMIT 1',
      [token]
    );
    if (!rows[0]) return null;
    return findUserById(rows[0].user_id);
  });
}

export async function deleteDbSession(token) {
  return withDb(async (db) => {
    await db.query('DELETE FROM sessions WHERE token = $1', [token]);
  });
}
