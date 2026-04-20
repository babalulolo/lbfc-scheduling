import { NextResponse } from 'next/server';
import { createShift, updateShift, deleteShift, getShiftById } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request) {
  try {
    const user = await getSession();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { title, description, date, startTime, endTime, location, locationAddress, notes, slotsTotal } = await request.json();

    if (!title || !date || !startTime || !endTime || !location) {
      return NextResponse.json({ error: 'Title, date, start time, end time, and location are required' }, { status: 400 });
    }

    const id = uuidv4();
    const shift = createShift({
      id,
      title,
      description: description || null,
      date,
      startTime,
      endTime,
      location,
      locationAddress: locationAddress || null,
      notes: notes || null,
      slotsTotal: slotsTotal || 5,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, shift });
  } catch (error) {
    console.error('Create shift error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const user = await getSession();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id, title, description, date, startTime, endTime, location, locationAddress, notes, slotsTotal } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Shift ID is required' }, { status: 400 });
    }

    const existing = getShiftById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (date !== undefined) updates.date = date;
    if (startTime !== undefined) updates.startTime = startTime;
    if (endTime !== undefined) updates.endTime = endTime;
    if (location !== undefined) updates.location = location;
    if (locationAddress !== undefined) updates.locationAddress = locationAddress;
    if (notes !== undefined) updates.notes = notes;
    if (slotsTotal !== undefined) updates.slotsTotal = slotsTotal;

    updateShift(id, updates);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update shift error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const user = await getSession();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Shift ID is required' }, { status: 400 });
    }

    deleteShift(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete shift error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
