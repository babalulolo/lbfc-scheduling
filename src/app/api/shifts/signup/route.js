import { NextResponse } from 'next/server';
import { getShiftById, getSignupsForShift, getSignupByUserAndShift, createSignup, deleteSignup } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendShiftConfirmation, sendCancellationNotice } from '@/lib/email';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { shiftId } = await request.json();
    if (!shiftId) {
      return NextResponse.json({ error: 'Shift ID is required' }, { status: 400 });
    }

    const shift = getShiftById(shiftId);
    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    const existing = getSignupByUserAndShift(user.id, shiftId);
    if (existing) {
      return NextResponse.json({ error: 'You are already signed up for this shift' }, { status: 400 });
    }

    const signups = getSignupsForShift(shiftId);
    if (signups.length >= shift.slotsTotal) {
      return NextResponse.json({ error: 'This shift is full' }, { status: 400 });
    }

    createSignup({
      id: uuidv4(),
      shiftId,
      userId: user.id,
      signedUpAt: new Date().toISOString(),
    });

    // Send confirmation emails (non-blocking)
    try {
      await sendShiftConfirmation(user, {
        ...shift,
        start_time: shift.startTime,
        end_time: shift.endTime,
        location_address: shift.locationAddress,
      });
    } catch (emailError) {
      console.error('Email error (non-blocking):', emailError);
    }

    return NextResponse.json({ success: true, message: 'Successfully signed up for shift' });
  } catch (error) {
    console.error('Shift signup error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { shiftId } = await request.json();
    if (!shiftId) {
      return NextResponse.json({ error: 'Shift ID is required' }, { status: 400 });
    }

    const shift = getShiftById(shiftId);
    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    const signup = getSignupByUserAndShift(user.id, shiftId);
    if (!signup) {
      return NextResponse.json({ error: 'You are not signed up for this shift' }, { status: 400 });
    }

    deleteSignup(user.id, shiftId);

    try {
      await sendCancellationNotice(user, {
        ...shift,
        start_time: shift.startTime,
        end_time: shift.endTime,
      });
    } catch (emailError) {
      console.error('Email error (non-blocking):', emailError);
    }

    return NextResponse.json({ success: true, message: 'Signup cancelled' });
  } catch (error) {
    console.error('Cancel signup error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
