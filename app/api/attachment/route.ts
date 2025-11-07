import { NextRequest, NextResponse } from 'next/server';
import { collectAttachmentToken, revokeAttachmentToken } from '@/lib/sessionStore';
import { fetchAttachment } from '@/lib/mailService';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ message: 'Missing token' }, { status: 400 });
  }

  const match = collectAttachmentToken(token);
  if (!match) {
    return NextResponse.json({ message: 'Attachment token invalid or expired' }, { status: 404 });
  }

  try {
    const buffer = await fetchAttachment(match.session.token, match.record.messageId, match.record.attachmentId);

    const response = new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': match.record.mimeType,
        'Content-Length': String(buffer.byteLength),
        'Content-Disposition': `attachment; filename="${match.record.filename}"`,
        'Cache-Control': 'no-store'
      }
    });

    revokeAttachmentToken(token);
    return response;
  } catch (error) {
    console.error('Attachment download failed', error);
    return NextResponse.json({ message: 'Unable to download attachment' }, { status: 500 });
  }
}
