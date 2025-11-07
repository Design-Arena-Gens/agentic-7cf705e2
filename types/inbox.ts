export type PhishingRisk = 'low' | 'medium' | 'high';

export type AttachmentTokenRecord = {
  token: string;
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
  expiresAt: number;
};

export type InboxMessage = {
  id: string;
  subject: string;
  from: { address: string; name?: string };
  preview: string;
  createdAt: string;
  html?: string;
  text?: string;
  attachments: AttachmentTokenRecord[];
  expiresAt: number;
  summary: string[];
  phishingRisk: PhishingRisk;
};
