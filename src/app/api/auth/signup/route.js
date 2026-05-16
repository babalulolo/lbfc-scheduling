import { NextResponse } from 'next/server';
import { findUser, createUser, validateAccessCode } from '@/lib/db';
import { createSession, setSessionCookie } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const { email, password, name, phone, emergencyContactName, emergencyContactPhone, inviteCode } = await request.json();

    if (!email || !password || !name || !inviteCode) {
      return NextResponse.json({ error: 'Email, name, password, and access code are required' }, { status: 400 });
    }

    // Validate access code and determine role
    const role = await validateAccessCode(inviteCode);
    if (!role) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 400 });
    }

    // Check if email already exists
    const existing = await findUser(email);
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 400 });
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);

    await createUser({
      id,
      email,
      name,
      phone: phone || null,
      passwordHash,
      role,
      emergencyContactName: emergencyContactName || null,
      emergencyContactPhone: emergencyContactPhone || null,
      createdAt: new Date().toISOString(),
    });

    const token = await createSession(id);
    await setSessionCookie(token);

    return NextResponse.json({ success: true, user: { id, email, name, role } });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
