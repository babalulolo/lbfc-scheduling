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
      shifts = await getShifts({ date });
    } else if (month) {
      shifts = await getShifts({ month });
    } else {
      shifts = await getShifts({ fromToday: true });
    }

    const enrichedShifts = await Promise.all(
      shifts.map(async (shift) => {
        const signups = await getSignupsForShift(shift.id);
        const signupDetails = (
          await Promise.all(
            signups.map(async (s) => {
              const u = await findUserById(s.userId);
              return u
                ? {
                    name: u.name,
                    email: u.email,
                    phone: u.phone,
                    userId: u.id,
                    avatarUrl: u.avatar ? `/api/avatar/${u.id}` : null,
                    clockInAt: s.clockInAt || null,
                    clockOutAt: s.clockOutAt || null,
                  }
                : null;
            })
          )
        ).filter(Boolean);

        const mySignup = signups.find((s) => s.userId === user.id);
        const isSignedUp = !!mySignup;
        const slotsRemaining = shift.slotsTotal - signups.length;

        return {
          ...shift,
          signups: user.role === 'admin' ? signupDetails : signupDetails.map((s) => ({ name: s.name, avatarUrl: s.avatarUrl })),
          signupCount: signups.length,
          slotsRemaining,
          isSignedUp,
          myClockInAt: mySignup ? mySignup.clockInAt || null : null,
          myClockOutAt: mySignup ? mySignup.clockOutAt || null : null,
        };
      })
    );

    return NextResponse.json({ shifts: enrichedShifts });
  } catch (error) {
    console.error('Get shifts error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
