import { NextResponse } from 'next/server';
import { getAccessCodes, setAccessCodes } from '@/lib/db';
import { getSession } from '@/lib/auth';

// Get current access codes (admin only)
export async function GET() {
  try {
    const user = await getSession();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const codes = getAccessCodes();
    return NextResponse.json({ codes });
  } catch (error) {
    console.error('Get access codes error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

// Update access codes (admin only)
export async function PUT(request) {
  try {
    const user = await getSession();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { volunteer, admin } = await request.json();
    const updates = {};
    if (volunteer) updates.volunteer = volunteer.toUpperCase().trim();
    if (admin) updates.admin = admin.toUpperCase().trim();

    setAccessCodes(updates);
    return NextResponse.json({ success: true, codes: getAccessCodes() });
  } catch (error) {
    console.error('Update access codes error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
