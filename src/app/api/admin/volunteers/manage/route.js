import { NextResponse } from 'next/server';
import {
  findUserById,
  setUserActive,
  deleteUser,
  countActiveAdmins,
  getSignupsForUser,
} from '@/lib/db';
import { getSession } from '@/lib/auth';
import { syncSignupToSheet, syncVolunteerRemoveFromSheet } from '@/lib/sheets';

// Block / unblock / remove a volunteer. Admin-only.
export async function POST(request) {
  try {
    const admin = await getSession();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { userId, action } = await request.json();
    if (!userId || !['block', 'unblock', 'remove'].includes(action)) {
      return NextResponse.json({ error: 'A userId and a valid action are required' }, { status: 400 });
    }

    const target = await findUserById(userId);
    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Guard: can't act on your own account.
    if (userId === admin.id) {
      return NextResponse.json({ error: "You can't block or remove your own account." }, { status: 400 });
    }

    // Guard: don't strip the last active admin.
    if (target.role === 'admin' && (action === 'block' || action === 'remove')) {
      const activeAdmins = await countActiveAdmins();
      if (activeAdmins <= 1) {
        return NextResponse.json({ error: "Can't remove the last active admin." }, { status: 400 });
      }
    }

    if (action === 'block') {
      await setUserActive(userId, false);
      return NextResponse.json({ success: true, status: 'blocked' });
    }

    if (action === 'unblock') {
      await setUserActive(userId, true);
      return NextResponse.json({ success: true, status: 'active' });
    }

    // action === 'remove' — clear sheet rows first (need their data before deleting), then delete.
    try {
      const shifts = await getSignupsForUser(userId);
      for (const shift of shifts) {
        await syncSignupToSheet('remove', shift, target); // Calendar Import + Attendance
      }
      await syncVolunteerRemoveFromSheet(target); // Volunteer Master
    } catch (sheetErr) {
      console.error('Sheet cleanup error (non-blocking):', sheetErr);
    }

    await deleteUser(userId); // cascades shift_signups + clears sessions

    return NextResponse.json({ success: true, status: 'removed' });
  } catch (error) {
    console.error('Manage volunteer error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
