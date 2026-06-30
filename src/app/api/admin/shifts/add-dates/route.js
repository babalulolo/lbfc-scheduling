import { NextResponse } from 'next/server';
import {
  getShiftById,
  getShiftsByGroup,
  setShiftRecurrenceGroup,
  createShift,
} from '@/lib/db';
import { getSession } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';

// Add new occurrences of an existing shift on additional dates, all sharing the
// same recurrence group. If the shift wasn't recurring, this starts a group and
// links the original. Duplicate dates (already in the series) are skipped.
export async function POST(request) {
  try {
    const user = await getSession();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id, dates } = await request.json();
    if (!id || !Array.isArray(dates) || dates.length === 0) {
      return NextResponse.json({ error: 'A shift id and at least one date are required' }, { status: 400 });
    }

    const existing = await getShiftById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Shift not found' }, { status: 404 });
    }

    // Dates already in this shift's series, so we don't create duplicates.
    let groupId = existing.recurrenceGroupId;
    const existingDates = new Set(
      groupId ? (await getShiftsByGroup(groupId)).map((s) => s.date) : [existing.date]
    );

    const newDates = [...new Set(dates)]
      .filter((d) => d && !existingDates.has(d))
      .sort();

    if (newDates.length === 0) {
      return NextResponse.json({ success: true, added: 0, message: 'Those dates already exist for this shift.' });
    }

    // Promote a single shift into a recurring series if needed.
    if (!groupId) {
      groupId = uuidv4();
      await setShiftRecurrenceGroup(existing.id, groupId);
    }

    const created = await Promise.all(
      newDates.map((d) =>
        createShift({
          id: uuidv4(),
          title: existing.title,
          description: existing.description || null,
          date: d,
          startTime: existing.startTime,
          endTime: existing.endTime || null,
          location: existing.location,
          locationAddress: existing.locationAddress || null,
          notes: existing.notes || null,
          slotsTotal: existing.slotsTotal || 5,
          recurrenceGroupId: groupId,
          createdBy: user.id,
          createdAt: new Date().toISOString(),
        })
      )
    );

    return NextResponse.json({ success: true, added: created.length });
  } catch (error) {
    console.error('Add dates error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
