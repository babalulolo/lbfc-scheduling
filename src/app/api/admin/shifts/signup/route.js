import { NextResponse } from 'next/server';
import {
  getShiftById,
  getSignupsForShift,
  getSignupByUserAndShift,
  createSignup,
  deleteSignup,
  findUserById,
} from '@/lib/db';
import { getSession } from '@/lib/auth';
import { sendShiftConfirmation } from '@/lib/email';
import { syncSignupToSheet } from '@/lib/sheets';
import { v4 as uuidv4 } from 'uuid';

// Admin adds a volunteer to a shift
export async function POST(request) {
  try {
    const admin = await getSession();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { shiftId, userId } = await request.json();
    if (!shiftId || !userId) {
      return NextResponse.json({ error: 'Shift ID and volunteer are required' }, { status: 400 });
    }

    const shift = await getShiftById(shiftId);
    if (!shift) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    const volunteer = await findUserById(userId);
    if (!volunteer) {
      return NextResponse.json({ error: 'Volunteer not found' }, { status: 404 });
    }

    const existing = await getSignupByUserAndShift(userId, shiftId);
    if (existing) {
      return NextResponse.json({ error: 'This volunteer is already on this shift' }, { status: 400 });
    }

    const signups = await getSignupsForShift(shiftId);
    if (signups.length >= shift.slotsTotal) {
      return NextResponse.json({ error: 'This shift is full' }, { status: 400 });
    }

    await createSignup({
      id: uuidv4(),
      shiftId,
      userId,
      signedUpAt: new Date().toISOString(),
    });

    // Sync to the volunteer spreadsheet (non-blocking, no-op until configured)
    await syncSignupToSheet('add', shift, volunteer);

    // Notify the volunteer they've been scheduled (non-blocking)
    try {
      await sendShiftConfirmation(volunteer, {
        ...shift,
        start_time: shift.startTime,
        end_time: shift.endTime,
        location_address: shift.locationAddress,
      });
    } catch (emailError) {
      console.error('Email error (non-blocking):', emailError);
    }

    return NextResponse.json({ success: true, message: `${volunteer.name} added to shift` });
  } catch (error) {
    console.error('Admin add volunteer error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

// Admin removes a volunteer from a shift
export async function DELETE(request) {
  try {
    const admin = await getSession();
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { shiftId, userId } = await request.json();
    if (!shiftId || !userId) {
      return NextResponse.json({ error: 'Shift ID and volunteer are required' }, { status: 400 });
    }

    const signup = await getSignupByUserAndShift(userId, shiftId);
    if (!signup) {
      return NextResponse.json({ error: 'This volunteer is not on this shift' }, { status: 400 });
    }

    await deleteSignup(userId, shiftId);

    // Remove from the volunteer spreadsheet (non-blocking, no-op until configured)
    const shift = await getShiftById(shiftId);
    const volunteer = await findUserById(userId);
    await syncSignupToSheet('remove', shift, volunteer);

    return NextResponse.json({ success: true, message: 'Volunteer removed from shift' });
  } catch (error) {
    console.error('Admin remove volunteer error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
