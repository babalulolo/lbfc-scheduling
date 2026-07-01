import { NextResponse } from 'next/server';
import { findUserById, updateUser } from '@/lib/db';
import { getSession } from '@/lib/auth';
import { syncVolunteerToSheet } from '@/lib/sheets';

// Max avatar payload (~500KB of base64). The client resizes to ~256px first,
// so real uploads are far smaller; this just guards against abuse.
const MAX_AVATAR_CHARS = 700000;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const u = await findUserById(session.id);
    if (!u) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({
      profile: {
        name: u.name,
        email: u.email,
        phone: u.phone || '',
        emergencyContactName: u.emergencyContactName || '',
        emergencyContactPhone: u.emergencyContactPhone || '',
        role: u.role,
        avatarUrl: u.avatar ? `/api/avatar/${u.id}` : null,
      },
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const updates = {};

    if (body.name !== undefined) {
      if (!String(body.name).trim()) {
        return NextResponse.json({ error: 'Name is required' }, { status: 400 });
      }
      updates.name = String(body.name).trim();
    }
    if (body.phone !== undefined) updates.phone = body.phone ? String(body.phone).trim() : null;
    if (body.emergencyContactName !== undefined) {
      updates.emergencyContactName = body.emergencyContactName ? String(body.emergencyContactName).trim() : null;
    }
    if (body.emergencyContactPhone !== undefined) {
      updates.emergencyContactPhone = body.emergencyContactPhone ? String(body.emergencyContactPhone).trim() : null;
    }
    if (body.avatar !== undefined) {
      // body.avatar is either a base64 data URL (new photo), or null/'' to remove.
      if (body.avatar) {
        if (typeof body.avatar !== 'string' || !body.avatar.startsWith('data:image/')) {
          return NextResponse.json({ error: 'Invalid image' }, { status: 400 });
        }
        if (body.avatar.length > MAX_AVATAR_CHARS) {
          return NextResponse.json({ error: 'Image is too large — try a smaller photo' }, { status: 400 });
        }
        updates.avatar = body.avatar;
      } else {
        updates.avatar = null;
      }
    }

    const updated = await updateUser(session.id, updates);

    // Keep the Volunteer Master sheet current when contact info changes.
    try {
      await syncVolunteerToSheet(updated);
    } catch (syncErr) {
      console.error('Volunteer sheet sync error (non-blocking):', syncErr);
    }

    return NextResponse.json({
      success: true,
      profile: {
        name: updated.name,
        email: updated.email,
        phone: updated.phone || '',
        emergencyContactName: updated.emergencyContactName || '',
        emergencyContactPhone: updated.emergencyContactPhone || '',
        role: updated.role,
        avatarUrl: updated.avatar ? `/api/avatar/${updated.id}` : null,
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
