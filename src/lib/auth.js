import { cookies } from 'next/headers';
import { createDbSession, getDbSessionUser, deleteDbSession } from './db';
import crypto from 'crypto';

const SESSION_COOKIE = 'lbfc_session';

export function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export async function createSession(userId) {
  const token = createSessionToken();
  await createDbSession(token, userId);
  return token;
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const user = await getDbSessionUser(token);
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
    await deleteDbSession(token);
  }
  cookieStore.delete(SESSION_COOKIE);
}
