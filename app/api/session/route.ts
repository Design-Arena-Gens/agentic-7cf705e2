import { NextResponse } from 'next/server';
import { createAccount } from '@/lib/mailService';
import { createSession, TTL_OPTIONS } from '@/lib/sessionStore';

export async function POST() {
  try {
    const account = await createAccount();
    const session = createSession({
      address: account.address,
      accountId: account.id,
      password: account.password,
      token: account.token
    });

    return NextResponse.json({
      sessionId: session.sessionId,
      address: session.address,
      ttl: session.ttl,
      ttlOptions: TTL_OPTIONS
    });
  } catch (error) {
    console.error('Session creation failed', error);
    return NextResponse.json({ message: 'Unable to create temporary inbox' }, { status: 500 });
  }
}
