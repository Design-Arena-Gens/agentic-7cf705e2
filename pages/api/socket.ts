import type { NextApiRequest, NextApiResponse } from 'next';
import type { Server as HTTPServer } from 'http';
import type { Socket as NetSocket } from 'net';
import { Server as SocketIOServer } from 'socket.io';
import { getSession } from '@/lib/sessionStore';
import { refreshSession } from '@/lib/inboxService';

interface SocketServer extends HTTPServer {
  io?: SocketIOServer;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

const pollingTasks = new Map<string, NodeJS.Timeout>();
const connectionCount = new Map<string, number>();

async function pollAndEmit(io: SocketIOServer, sessionId: string) {
  const session = getSession(sessionId);
  if (!session) {
    io.to(sessionId).emit('session:expired');
    return;
  }

  try {
    const messages = await refreshSession(session);
    io.to(sessionId).emit('inbox:update', { messages });
  } catch (error) {
    console.error('Polling failed', error);
    io.to(sessionId).emit('inbox:error', { message: 'Unable to sync inbox' });
  }
}

function ensurePolling(io: SocketIOServer, sessionId: string) {
  if (pollingTasks.has(sessionId)) return;
  const task = setInterval(() => pollAndEmit(io, sessionId), 7000);
  pollingTasks.set(sessionId, task);
}

function releasePolling(sessionId: string) {
  const task = pollingTasks.get(sessionId);
  if (task) {
    clearInterval(task);
    pollingTasks.delete(sessionId);
  }
}

const handler = (_req: NextApiRequest, res: NextApiResponseWithSocket) => {
  const socketServer = res.socket.server as SocketServer;

  if (socketServer.io) {
    res.end();
    return;
  }

  const io = new SocketIOServer(socketServer, {
    path: '/api/socket',
    cors: {
      origin: '*'
    }
  });

  socketServer.io = io;

  io.on('connection', (socket) => {
    socket.on('joinSession', async ({ sessionId }) => {
      const session = getSession(sessionId);
      if (!session) {
        socket.emit('session:error', { message: 'Session not found' });
        return;
      }

      socket.join(sessionId);
      const current = connectionCount.get(sessionId) ?? 0;
      connectionCount.set(sessionId, current + 1);
      ensurePolling(io, sessionId);
      await pollAndEmit(io, sessionId);
    });

    socket.on('leaveSession', ({ sessionId }) => {
      socket.leave(sessionId);
      const current = connectionCount.get(sessionId) ?? 0;
      const next = Math.max(current - 1, 0);
      connectionCount.set(sessionId, next);
      if (next === 0) {
        releasePolling(sessionId);
      }
    });

    socket.on('disconnecting', () => {
      for (const sessionId of socket.rooms) {
        if (sessionId === socket.id) continue;
        const current = connectionCount.get(sessionId) ?? 0;
        const next = Math.max(current - 1, 0);
        connectionCount.set(sessionId, next);
        if (next === 0) {
          releasePolling(sessionId);
        }
      }
    });
  });

  res.end();
};

export const config = {
  api: {
    bodyParser: false
  }
};

export default handler;
