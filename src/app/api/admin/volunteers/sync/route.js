import { NextResponse } from 'next/server';
import { getAllUsers } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { syncVolunteerToSheet } from '@/lib/sheets';

// Push every volunteer to the "Volunteer Master" tab. Used to backfill existing
// volunteers and to re-sync on demand. Upserts by email, so it's safe to re-run.
export async function POST() {
  try {
    const user = await getSession();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const users = await getAllUsers();
    let synced = 0;
    for (const u of users) {
      try {
        await syncVolunteerToSheet(u);
        synced += 1;
      } catch (err) {
        console.error('Volunteer sync error for', u.email, err);
      }
    }

    return NextResponse.json({ success: true, synced, total: users.length });
  } catch (error) {
    console.error('Volunteer bulk sync error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
