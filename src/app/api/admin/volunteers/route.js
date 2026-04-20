import { NextResponse } from 'next/server';
import { getAllUsers } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getSession();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const users = getAllUsers();
    const volunteers = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      emergencyContactName: u.emergencyContactName,
      emergencyContactPhone: u.emergencyContactPhone,
      createdAt: u.createdAt,
    }));

    return NextResponse.json({ volunteers });
  } catch (error) {
    console.error('Get volunteers error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
