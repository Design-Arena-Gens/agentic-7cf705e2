import { NextRequest, NextResponse } from 'next/server';
import { getSession, listMessages, pruneExpiredMessages } from '@/lib/sessionStore';

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId');
  if (!sessionId) {
    return NextResponse.json({ message: 'Session id is required' }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ message: 'Session not found' }, { status: 404 });
  }

  pruneExpiredMessages(sessionId);

  return NextResponse.json({ messages: listMessages(sessionId) });
}
