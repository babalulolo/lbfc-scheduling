import { NextResponse } from 'next/server';
import { getShifts, getSignupsForShift, findUserById } from '@/lib/db';
import { getSession } from '@/lib/auth';

export async function GET(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const date = searchParams.get('date');

    let shifts;
    if (date) {
      shifts = getShifts({ date });
    } else if (month) {
      shifts = getShifts({ month });
    } else {
      shifts = getShifts({ fromToday: true });
    }

    const enrichedShifts = shifts.map((shift) => {
      const signups = getSignupsForShift(shift.id);
      const signupDetails = signups.map((s) => {
        const u = findUserById(s.userId);
        return u ? { name: u.name, email: u.email, phone: u.phone, userId: u.id } : null;
      }).filter(Boolean);

      const isSignedUp = signups.some((s) => s.userId === user.id);
      const slotsRemaining = shift.slotsTotal - signups.length;

      return {
        ...shift,
        signups: user.role === 'admin' ? signupDetails : signupDetails.map(s => ({ name: s.name })),
        signupCount: signups.length,
        slotsRemaining,
        isSignedUp,
      };
    });

    return NextResponse.json({ shifts: enrichedShifts });
  } catch (error) {
    console.error('Get shifts error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
