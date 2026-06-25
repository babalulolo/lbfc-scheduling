import { NextResponse } from 'next/server';
import {
  getShiftById,
  getSignupByUserAndShift,
  setClockTimes,
  findUserById,
} from '@/lib/db';
import { getSession } from '@/lib/auth';
import { syncClockToSheet } from '@/lib/sheets';

// Admin views/edits a volunteer's clock-in / clock-out times for a shift.
export async function PUT(request) {
  try {
    const admin = await getSession();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { shiftId, userId, clockInAt, clockOutAt } = await request.json();
    if (!shiftId || !userId) {
      return NextResponse.json({ error: 'Shift ID and volunteer are required' }, { status: 400 });
    }

    const signup = await getSignupByUserAndShift(userId, shiftId);
    if (!signup) {
      return NextResponse.json({ error: 'This volunteer is not on this shift' }, { status: 400 });
    }

    const inVal = clockInAt || null;
    const outVal = clockOutAt || null;

    if (inVal && outVal && new Date(outVal).getTime() < new Date(inVal).getTime()) {
      return NextResponse.json({ error: 'Clock-out cannot be before clock-in' }, { status: 400 });
    }

    const updated = await setClockTimes(userId, shiftId, { clockInAt: inVal, clockOutAt: outVal });

    // Sync corrected hours to the spreadsheet (non-blocking, no-op until configured)
    try {
      const shift = await getShiftById(shiftId);
      const volunteer = await findUserById(userId);
      await syncClockToSheet(shift, volunteer, updated);
    } catch (syncErr) {
      console.error('Clock sheet sync error (non-blocking):', syncErr);
    }

    return NextResponse.json({
      success: true,
      clockInAt: updated.clockInAt,
      clockOutAt: updated.clockOutAt,
    });
  } catch (error) {
    console.error('Admin clock edit error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
