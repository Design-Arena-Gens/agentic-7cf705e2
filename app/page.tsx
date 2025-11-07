'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import DOMPurify from 'isomorphic-dompurify';
import type { InboxMessage } from '@/types/inbox';
import { formatRelativeTime, formatTimestamp } from '@/lib/time';
import { generateUsernameSuggestions } from '@/lib/aiAssistant';

const TTL_LABELS: Record<number, string> = {
  600: '10 min',
  3600: '1 hour',
  21600: '6 hours',
  86400: '24 hours'
};

type SessionState = {
  sessionId: string;
  address: string;
  ttl: number;
  ttlOptions: number[];
};

type InboxUpdatePayload = {
  messages: InboxMessage[];
};

type ConnectionState = 'initializing' | 'connected' | 'error';

export default function Home() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('initializing');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const selectedMessage = useMemo(
    () => messages.find((message) => message.id === selectedMessageId) ?? messages[0],
    [messages, selectedMessageId]
  );

  useEffect(() => {
    const createSession = async () => {
      try {
        const response = await fetch('/api/session', { method: 'POST' });
        if (!response.ok) {
          throw new Error('Failed to initialise session');
        }
        const data = await response.json();
        setSession(data);
        setUsernameSuggestions(generateUsernameSuggestions(data.address.split('@')[1] ?? 'mail.tm'));
      } catch (error) {
        console.error(error);
        setErrorMessage('Unable to create a temporary inbox. Please retry in a moment.');
      }
    };

    createSession();
  }, []);

  useEffect(() => {
    if (!session) return;

    const socket = io({ path: '/api/socket' });
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnectionState('connected');
      socket.emit('joinSession', { sessionId: session.sessionId });
    });

    socket.on('disconnect', () => {
      setConnectionState('error');
    });

    socket.on('inbox:update', (payload: InboxUpdatePayload) => {
      setMessages(payload.messages);
      setErrorMessage(null);
      if (!selectedMessageId && payload.messages.length) {
        setSelectedMessageId(payload.messages[0].id);
      }
    });

    socket.on('inbox:error', (payload: { message: string }) => {
      setErrorMessage(payload.message);
    });

    socket.on('session:error', (payload: { message: string }) => {
      setErrorMessage(payload.message);
    });

    socket.on('session:expired', () => {
      setErrorMessage('Session expired. Refresh to generate a new inbox.');
      setMessages([]);
    });

    return () => {
      socket.emit('leaveSession', { sessionId: session.sessionId });
      socket.disconnect();
    };
  }, [session, selectedMessageId]);

  const handleCopyAddress = useCallback(async () => {
    if (!session) return;
    await navigator.clipboard.writeText(session.address);
  }, [session]);

  const handleRotateAddress = useCallback(async () => {
    if (!session) return;
    try {
      const response = await fetch('/api/session/rotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.sessionId })
      });
      if (!response.ok) {
        throw new Error('Rotation failed');
      }
      const data = await response.json();
      setSession((prev) => (prev ? { ...prev, address: data.address } : prev));
      setMessages([]);
      setSelectedMessageId(null);
      setUsernameSuggestions(generateUsernameSuggestions(data.address.split('@')[1] ?? 'mail.tm'));
      socketRef.current?.emit('joinSession', { sessionId: session.sessionId });
    } catch (error) {
      console.error(error);
      setErrorMessage('Unable to rotate address.');
    }
  }, [session]);

  const handleTTLChange = useCallback(
    async (ttl: number) => {
      if (!session) return;
      try {
        const response = await fetch('/api/ttl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: session.sessionId, ttl })
        });
        if (!response.ok) {
          throw new Error('TTL update failed');
        }
        setSession((prev) => (prev ? { ...prev, ttl } : prev));
      } catch (error) {
        console.error(error);
        setErrorMessage('Failed to update message lifetime.');
      }
    },
    [session]
  );

  const sanitizeHtml = useCallback((html?: string) => {
    if (!html) return '';
    return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
  }, []);

  const inboxStatusBadge = useMemo(() => {
    switch (connectionState) {
      case 'connected':
        return <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300">Live</span>;
      case 'error':
        return <span className="rounded-full bg-amber-500/20 px-3 py-1 text-xs text-amber-300">Reconnecting…</span>;
      default:
        return <span className="rounded-full bg-slate-500/20 px-3 py-1 text-xs text-slate-300">Starting…</span>;
    }
  }, [connectionState]);

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-10 md:flex-row">
      <section className="flex w-full flex-col gap-6 md:w-2/3">
        <header className="rounded-3xl bg-gradient-to-r from-slate-900/80 via-indigo-900/50 to-blue-900/30 p-[1px] shadow-glass">
          <div className="rounded-3xl bg-slate-950/70 p-6 backdrop-blur">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-widest text-indigo-300">InstantTempMail</p>
                <h1 className="mt-1 text-2xl font-semibold">Disposable inboxes that auto-expire</h1>
                <p className="mt-1 max-w-xl text-sm text-slate-300">
                  Generate a burner email, watch messages stream in real time, and let the AI copilot keep you safe.
                </p>
              </div>
              <div className="flex items-center gap-4">
                {inboxStatusBadge}
                <button
                  onClick={handleCopyAddress}
                  className="rounded-full border border-indigo-500/50 px-4 py-2 text-sm font-medium text-indigo-200 transition hover:border-indigo-300 hover:text-white"
                >
                  Copy address
                </button>
                <button
                  onClick={handleRotateAddress}
                  className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  Rotate
                </button>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-slate-700/60 bg-slate-900/40 p-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">Active inbox</p>
                <p className="text-lg font-semibold text-white">{session?.address ?? 'Loading…'}</p>
              </div>
              <div className="h-6 w-px bg-slate-700/80" />
              <div className="flex items-center gap-2">
                <p className="text-xs uppercase tracking-widest text-slate-400">Message lifetime</p>
                <div className="flex gap-2">
                  {session?.ttlOptions?.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleTTLChange(option)}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                        option === session.ttl ? 'bg-indigo-600 text-white' : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {TTL_LABELS[option] ?? `${Math.round(option / 60)}m`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {errorMessage && <p className="mt-4 text-sm text-amber-300">{errorMessage}</p>}
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 rounded-3xl border border-slate-800/60 bg-slate-950/60 p-4 md:p-6">
          <h2 className="text-lg font-semibold">Inbox</h2>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="max-h-[60vh] w-full overflow-y-auto rounded-2xl border border-slate-800/60 bg-slate-900/50 md:w-1/2">
              {messages.length === 0 ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 text-center text-sm text-slate-400">
                  <span>No messages yet.</span>
                  <span>Share your address and incoming emails will appear here instantly.</span>
                </div>
              ) : (
                <ul className="divide-y divide-slate-800/70">
                  {messages.map((message) => (
                    <li key={message.id}>
                      <button
                        className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition hover:bg-slate-800/60 ${
                          selectedMessage?.id === message.id ? 'bg-slate-800/50' : ''
                        }`}
                        onClick={() => setSelectedMessageId(message.id)}
                      >
                        <div className="flex w-full items-center justify-between">
                          <span className="text-sm font-semibold text-white">
                            {message.subject || 'No subject'}
                          </span>
                          <span className="text-xs text-slate-400">{formatTimestamp(message.createdAt)}</span>
                        </div>
                        <div className="flex w-full items-center justify-between text-xs text-slate-400">
                          <span>{message.from.address}</span>
                          <span>Expires in {formatRelativeTime(message.expiresAt)}</span>
                        </div>
                        <p className="line-clamp-2 text-xs text-slate-300">{message.preview}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <article className="flex w-full flex-col gap-4 rounded-2xl border border-slate-800/60 bg-slate-900/40 p-4 md:w-1/2">
              {selectedMessage ? (
                <>
                  <header>
                    <p className="text-xs uppercase tracking-widest text-slate-400">From</p>
                    <p className="text-sm font-medium text-indigo-200">{selectedMessage.from.address}</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">
                      {selectedMessage.subject || 'No subject'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Received {formatTimestamp(selectedMessage.createdAt)} · Expires in{' '}
                      {formatRelativeTime(selectedMessage.expiresAt)}
                    </p>
                  </header>

                  <section className="rounded-xl bg-slate-950/60 p-4 text-sm text-slate-200">
                    {selectedMessage.html ? (
                      <div
                        className="prose prose-invert max-w-none text-sm"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedMessage.html) }}
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm text-slate-200">
                        {selectedMessage.text ?? 'No content available.'}
                      </pre>
                    )}
                  </section>

                  {selectedMessage.attachments.length > 0 && (
                    <section>
                      <p className="text-xs uppercase tracking-widest text-slate-400">Attachments</p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {selectedMessage.attachments.map((attachment) => (
                          <li key={attachment.token}>
                            <a
                              href={`/api/attachment?token=${attachment.token}`}
                              className="inline-flex items-center gap-2 rounded-full border border-indigo-500/40 px-3 py-1 text-xs text-indigo-200 hover:border-indigo-300"
                            >
                              {attachment.filename}
                              <span className="text-[10px] text-slate-400">{Math.round(attachment.size / 1024)}KB</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center text-center text-sm text-slate-400">
                  Select a message to inspect content and attachments.
                </div>
              )}
            </article>
          </div>
        </div>
      </section>

      <aside className="flex w-full flex-col gap-4 rounded-3xl border border-slate-800/60 bg-slate-950/70 p-5 backdrop-blur md:w-1/3">
        <header>
          <p className="text-xs uppercase tracking-[0.4em] text-slate-400">AI Copilot</p>
          <h2 className="text-xl font-semibold text-white">Inbox Intelligence</h2>
          <p className="mt-1 text-sm text-slate-300">
            Instant summaries, username inspiration, and live phishing risk assessments for every message.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4">
          <h3 className="text-sm font-semibold text-white">Quick suggestions</h3>
          <p className="text-xs text-slate-400">Tap to copy a fresh alias</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {usernameSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={async () => navigator.clipboard.writeText(suggestion)}
                className="rounded-xl border border-slate-700/70 bg-slate-800/40 px-3 py-2 text-left text-xs text-slate-200 transition hover:border-indigo-400 hover:text-white"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Summary</h3>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                selectedMessage?.phishingRisk === 'high'
                  ? 'bg-rose-500/20 text-rose-300'
                  : selectedMessage?.phishingRisk === 'medium'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-emerald-500/20 text-emerald-200'
              }`}
            >
              Risk: {selectedMessage?.phishingRisk ?? 'low'}
            </span>
          </div>

          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-xs text-slate-200">
            {(selectedMessage?.summary?.length ? selectedMessage.summary : ['No message selected yet.']).map(
              (item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              )
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-4">
          <h3 className="text-sm font-semibold text-white">Smart actions</h3>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <button
              onClick={handleCopyAddress}
              className="rounded-xl border border-slate-700/70 px-3 py-2 text-left text-slate-200 transition hover:border-indigo-400 hover:text-white"
            >
              Copy current inbox address
            </button>
            <button
              onClick={handleRotateAddress}
              className="rounded-xl border border-slate-700/70 px-3 py-2 text-left text-slate-200 transition hover:border-indigo-400 hover:text-white"
            >
              Recycle inbox and clear messages
            </button>
            <button
              onClick={() => setUsernameSuggestions(generateUsernameSuggestions(session?.address.split('@')[1] ?? 'mail.tm'))}
              className="rounded-xl border border-slate-700/70 px-3 py-2 text-left text-slate-200 transition hover:border-indigo-400 hover:text-white"
            >
              Refresh username ideas
            </button>
          </div>
        </section>
      </aside>
    </main>
  );
}
