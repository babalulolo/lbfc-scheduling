import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'data', 'db.json');
const SEED_PATH = path.join(process.cwd(), 'data', 'seed.json');

const DEFAULT_DB = {
  users: [],
  shifts: [],
  shiftSignups: [],
  inviteCodes: [],
};

function ensureDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadSeedData() {
  try {
    if (fs.existsSync(SEED_PATH)) {
      const raw = fs.readFileSync(SEED_PATH, 'utf-8');
      const seed = JSON.parse(raw);
      return {
        ...DEFAULT_DB,
        shifts: seed.shifts || [],
        inviteCodes: seed.inviteCodes || [],
        accessCodes: seed.accessCodes || undefined,
      };
    }
  } catch (e) {
    console.error('Failed to load seed data:', e.message);
  }
  return DEFAULT_DB;
}

export function readDb() {
  ensureDir();
  if (!fs.existsSync(DB_PATH)) {
    const initial = loadSeedData();
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2));
    return structuredClone(initial);
  }
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  const data = JSON.parse(raw);

  // If db exists but has no shifts and no users, seed it
  if (data.shifts.length === 0 && data.users.length === 0) {
    const seed = loadSeedData();
    if (seed.shifts.length > 0) {
      data.shifts = seed.shifts;
      data.inviteCodes = seed.inviteCodes || data.inviteCodes;
      data.accessCodes = seed.accessCodes || data.accessCodes;
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    }
  }

  return data;
}

export function writeDb(data) {
  ensureDir();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// --- Query helpers ---

export function findUser(email) {
  const db = readDb();
  return db.users.find((u) => u.email === email) || null;
}

export function findUserById(id) {
  const db = readDb();
  return db.users.find((u) => u.id === id) || null;
}

export function createUser(user) {
  const db = readDb();
  db.users.push(user);
  writeDb(db);
  return user;
}

export function getShifts(filter = {}) {
  const db = readDb();
  let shifts = db.shifts;

  if (filter.date) {
    shifts = shifts.filter((s) => s.date === filter.date);
  } else if (filter.month) {
    shifts = shifts.filter((s) => s.date.startsWith(filter.month));
  } else if (filter.fromToday) {
    const today = new Date().toISOString().split('T')[0];
    shifts = shifts.filter((s) => s.date >= today);
  }

  return shifts.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });
}

export function getShiftById(id) {
  const db = readDb();
  return db.shifts.find((s) => s.id === id) || null;
}

export function createShift(shift) {
  const db = readDb();
  db.shifts.push(shift);
  writeDb(db);
  return shift;
}

export function updateShift(id, updates) {
  const db = readDb();
  const idx = db.shifts.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  db.shifts[idx] = { ...db.shifts[idx], ...updates };
  writeDb(db);
  return db.shifts[idx];
}

export function deleteShift(id) {
  const db = readDb();
  db.shifts = db.shifts.filter((s) => s.id !== id);
  db.shiftSignups = db.shiftSignups.filter((s) => s.shiftId !== id);
  writeDb(db);
}

export function getSignupsForShift(shiftId) {
  const db = readDb();
  return db.shiftSignups.filter((s) => s.shiftId === shiftId);
}

export function getSignupByUserAndShift(userId, shiftId) {
  const db = readDb();
  return db.shiftSignups.find((s) => s.userId === userId && s.shiftId === shiftId) || null;
}

export function createSignup(signup) {
  const db = readDb();
  db.shiftSignups.push(signup);
  writeDb(db);
  return signup;
}

export function deleteSignup(userId, shiftId) {
  const db = readDb();
  db.shiftSignups = db.shiftSignups.filter((s) => !(s.userId === userId && s.shiftId === shiftId));
  writeDb(db);
}

// Reusable access codes — one for volunteers, one for admins
const DEFAULT_CODES = {
  volunteer: 'LBFC-VOLUNTEER',
  admin: 'LBFC-ADMIN',
};

export function getAccessCodes() {
  const db = readDb();
  return db.accessCodes || DEFAULT_CODES;
}

export function setAccessCodes(codes) {
  const db = readDb();
  db.accessCodes = { ...getAccessCodes(), ...codes };
  writeDb(db);
}

export function validateAccessCode(code) {
  const codes = getAccessCodes();
  const upper = code.toUpperCase().trim();
  if (upper === codes.volunteer.toUpperCase()) return 'volunteer';
  if (upper === codes.admin.toUpperCase()) return 'admin';
  return null;
}

export function getAllUsers() {
  const db = readDb();
  return db.users;
}

export function createInviteCode(inviteCode) {
  const db = readDb();
  if (!db.inviteCodes) db.inviteCodes = [];
  db.inviteCodes.push(inviteCode);
  writeDb(db);
  return inviteCode;
}

export function hasAnyUsers() {
  const db = readDb();
  return db.users.length > 0;
}
