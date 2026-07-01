import { findUserById } from '@/lib/db';

// Serve a volunteer's avatar image. The avatar is stored as a base64 data URL
// in the DB; here we decode it to real image bytes so browsers can cache it and
// list/calendar responses stay lightweight (they just reference /api/avatar/<id>).
export async function GET(_request, { params }) {
  try {
    const { id } = params;
    const user = await findUserById(id);
    if (!user || !user.avatar) {
      return new Response('Not found', { status: 404 });
    }

    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(user.avatar);
    if (!match) {
      return new Response('Not found', { status: 404 });
    }

    const contentType = match[1];
    const bytes = Buffer.from(match[2], 'base64');

    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // Short cache so a freshly changed photo shows up quickly.
        'Cache-Control': 'private, max-age=30',
      },
    });
  } catch (error) {
    console.error('Avatar fetch error:', error);
    return new Response('Error', { status: 500 });
  }
}
