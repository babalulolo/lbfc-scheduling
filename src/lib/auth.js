import { cookies } from 'next/headers';
import { findUserById, readDb, writeDb } from './db';
import crypto from 'crypto';

const SESSION_COOKIE = 'lbfc_session';

export function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSession(userId) {
  const token = createSessionToken();
  const db = readDb();
  if (!db.sessions) db.sessions = [];
  db.sessions.push({ token, userId, createdAt: Date.now() });
  writeDb(db);
  return token;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const db = readDb();
  const sessions = db.sessions || [];
  const session = sessions.find((s) => s.token === token);
  if (!session) return null;

  const user = findUserById(session.userId);
  if (!user) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
  };
}

export async function setSessionCookie(token) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = readDb();
    db.sessions = (db.sessions || []).filter((s) => s.token !== token);
    writeDb(db);
  }
  cookieStore.delete(SESSION_COOKIE);
}
