import { NextResponse } from 'next/server';
import {
  getShiftById,
  getSignupByUserAndShift,
  setClockIn,
  setClockOut,
  findUserById,
} from '@/lib/db';
import { getSession } from '@/lib/auth';
import { syncClockToSheet } from '@/lib/sheets';
import { todayLA } from '@/lib/time';

export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { shiftId, action } = await request.json();
    if (!shiftId || !['in', 'out'].includes(action)) {
      return NextResponse.json({ error: 'Shift ID and a valid action are required' }, { status: 400 });
    }

    const shift = await getShiftById(shiftId);
    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    const signup = await getSignupByUserAndShift(user.id, shiftId);
    if (!signup) {
      return NextResponse.json({ error: 'You are not signed up for this shift' }, { status: 400 });
    }

    // Clocking is only allowed on the day of the shift
    if (shift.date !== todayLA()) {
      return NextResponse.json(
        { error: 'You can only clock in or out on the day of your shift' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    let updated;

    if (action === 'in') {
      if (signup.clockInAt) {
        return NextResponse.json({ error: 'You are already clocked in' }, { status: 400 });
      }
      updated = await setClockIn(user.id, shiftId, now);
    } else {
      if (!signup.clockInAt) {
        return NextResponse.json({ error: 'Clock in before clocking out' }, { status: 400 });
      }
      if (signup.clockOutAt) {
        return NextResponse.json({ error: 'You are already clocked out' }, { status: 400 });
      }
      updated = await setClockOut(user.id, shiftId, now);
    }

    // Sync clocked hours to the spreadsheet (non-blocking, no-op until configured)
    try {
      const volunteer = await findUserById(user.id);
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
    console.error('Clock error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
