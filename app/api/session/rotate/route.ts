import { NextResponse } from 'next/server';
import { createAccount } from '@/lib/mailService';
import { getSession, resetSession } from '@/lib/sessionStore';

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId) {
      return NextResponse.json({ message: 'Missing session id' }, { status: 400 });
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json({ message: 'Session not found' }, { status: 404 });
    }

    const account = await createAccount();
    resetSession(sessionId, {
      address: account.address,
      accountId: account.id,
      password: account.password,
      token: account.token
    });

    return NextResponse.json({
      address: account.address
    });
  } catch (error) {
    console.error('Rotate session failed', error);
    return NextResponse.json({ message: 'Unable to rotate address' }, { status: 500 });
  }
}
