import { NextResponse } from 'next/server';
import { hasAnyUsers, createUser, createInviteCode } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export async function POST(request) {
  try {
    if (await hasAnyUsers()) {
      return NextResponse.json({ error: 'Setup has already been completed. An admin account exists.' }, { status: 400 });
    }

    const { email, password, name } = await request.json();
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 });
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, 10);

    await createUser({
      id,
      email,
      name,
      phone: null,
      passwordHash,
      role: 'admin',
      emergencyContactName: null,
      emergencyContactPhone: null,
      createdAt: new Date().toISOString(),
    });

    // Generate initial batch of invite codes
    const codes = [];
    for (let i = 0; i < 5; i++) {
      const codeId = uuidv4();
      const code = 'LBFC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      await createInviteCode({
        id: codeId,
        code,
        role: 'volunteer',
        createdBy: id,
        usedBy: null,
        usedAt: null,
        createdAt: new Date().toISOString(),
      });
      codes.push(code);
    }

    return NextResponse.json({
      success: true,
      message: 'Admin account created successfully',
      inviteCodes: codes,
    });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
