import { NextResponse } from 'next/server';
import { getSession, setTTL, TTL_OPTIONS } from '@/lib/sessionStore';

export async function POST(request: Request) {
  try {
    const { sessionId, ttl } = await request.json();
    if (!sessionId || !ttl) {
      return NextResponse.json({ message: 'Invalid payload' }, { status: 400 });
    }

    if (!TTL_OPTIONS.includes(ttl)) {
      return NextResponse.json({ message: 'Unsupported TTL option' }, { status: 422 });
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ message: 'Session not found' }, { status: 404 });
    }

    setTTL(sessionId, ttl);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update TTL failed', error);
    return NextResponse.json({ message: 'Unable to update TTL' }, { status: 500 });
  }
}
