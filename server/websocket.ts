import { WebSocketServer, WebSocket } from "ws";
import type { Server, IncomingMessage } from "http";
import { randomUUID, createHmac } from "crypto";
import { logger } from "./observability/logger.js";
import { metricsCollector } from "./observability/metrics.js";
import { db } from "./db.js";
import { sql } from "drizzle-orm";
import { storage } from "./storage.js";

const PUBLIC_CHANNELS = new Set(['vehicles', 'wash-queue', 'activity', 'notifications']);

interface ClientConnection {
  ws: WebSocket;
  userId?: number;
  role?: string;
  stationId?: number;
  subscriptions: Set<string>;
  authenticated: boolean;
  isAlive: boolean;
}

function parseCookies(header: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const pair of header.split(';')) {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const name = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      try { cookies[name] = decodeURIComponent(value); } catch { cookies[name] = value; }
    }
  }
  return cookies;
}

function unsignSessionCookie(cookieValue: string, secret: string): string | null {
  if (!cookieValue.startsWith('s:')) return null;
  const signed = cookieValue.slice(2);
  const dotIdx = signed.lastIndexOf('.');
  if (dotIdx < 0) return null;
  const sessionId = signed.slice(0, dotIdx);
  const signature = signed.slice(dotIdx + 1);
  const expected = createHmac('sha256', secret)
    .update(sessionId)
    .digest('base64')
    .replace(/=+$/, '');
  if (expected !== signature) return null;
  return sessionId;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ClientConnection> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  initialize(httpServer: Server): void {
    this.wss = new WebSocketServer({
      server: httpServer,
      path: '/ws',
    });

    this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
      const clientId = randomUUID();
      const client: ClientConnection = {
        ws,
        subscriptions: new Set(),
        authenticated: false,
        isAlive: true,
      };

      this.clients.set(clientId, client);

      // Attempt session-based auth from cookie
      await this.resolveSession(req, client, clientId);

      logger.info('WebSocket client connected', {
        clientId,
        authenticated: client.authenticated,
        userId: client.userId,
      });

      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(clientId, message);
        } catch (error) {
          logger.error('Failed to parse WebSocket message', error as Error, { clientId });
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        metricsCollector.recordWsDisconnect();
        logger.info('WebSocket client disconnected', { clientId });
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', error, { clientId });
      });

      ws.on('pong', () => {
        client.isAlive = true;
      });

      ws.send(JSON.stringify({
        type: 'connected',
        clientId,
        authenticated: client.authenticated,
      }));
    });

    logger.info('WebSocket server initialized');

    // Heartbeat: ping every 30s, terminate unresponsive clients
    this.heartbeatInterval = setInterval(() => {
      for (const [clientId, client] of Array.from(this.clients.entries())) {
        if (!client.isAlive) {
          logger.info('Terminating unresponsive WebSocket client', { clientId });
          client.ws.terminate();
          this.clients.delete(clientId);
          continue;
        }
        client.isAlive = false;
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.ping();
        }
      }
    }, 30_000);
  }

  private async resolveSession(req: IncomingMessage, client: ClientConnection, clientId: string): Promise<void> {
    const secret = process.env.SESSION_SECRET;
    if (!secret) return;

    const cookieHeader = req.headers.cookie || '';
    const cookies = parseCookies(cookieHeader);
    const sid = cookies['connect.sid'];
    if (!sid) return;

    const sessionId = unsignSessionCookie(sid, secret);
    if (!sessionId) return;

    try {
      const result = await db.execute(
        sql`SELECT sess FROM "user_sessions" WHERE sid = ${sessionId} AND expire > now()`
      );
      const rows = result.rows as Array<{ sess: unknown }>;
      if (rows.length === 0) return;

      const sess = typeof rows[0].sess === 'string' ? JSON.parse(rows[0].sess) : rows[0].sess;
      const userId = sess?.passport?.user;
      if (typeof userId !== 'number') return;

      const user = await storage.getUser(userId);
      if (!user) return;

      client.userId = user.id;
      client.role = user.role;
      client.authenticated = true;
    } catch (err) {
      logger.error('Failed to resolve WebSocket session', err as Error, { clientId });
    }
  }

  private handleMessage(clientId: string, message: { type: string; [key: string]: unknown }): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    switch (message.type) {
      case 'subscribe': {
        const channel = message.channel as string;
        if (!channel) break;
        // Unauthenticated sockets can only subscribe to public channels
        if (!client.authenticated && !PUBLIC_CHANNELS.has(channel)) {
          client.ws.send(JSON.stringify({ type: 'error', message: 'Authentication required for this channel' }));
          break;
        }
        client.subscriptions.add(channel);
        logger.debug('Client subscribed to channel', { clientId, channel });
        break;
      }

      case 'unsubscribe': {
        const unsubChannel = message.channel as string;
        if (unsubChannel) {
          client.subscriptions.delete(unsubChannel);
          logger.debug('Client unsubscribed from channel', { clientId, channel: unsubChannel });
        }
        break;
      }

      case 'ping':
        client.ws.send(JSON.stringify({ type: 'pong' }));
        break;

      // 'authenticate' messages from clients are ignored — identity is derived from session only
      case 'authenticate':
        client.ws.send(JSON.stringify({
          type: 'auth_result',
          authenticated: client.authenticated,
          message: client.authenticated ? 'Already authenticated via session' : 'Session authentication required',
        }));
        break;

      default:
        logger.warn('Unknown WebSocket message type', { clientId, type: message.type });
    }
  }

  broadcast(event: {
    type: string;
    channel?: string;
    data: unknown;
    stationId?: number;
  }): void {
    const message = JSON.stringify({
      type: event.type,
      data: event.data,
      timestamp: new Date().toISOString(),
    });

    let sentCount = 0;

    for (const [clientId, client] of Array.from(this.clients.entries())) {
      if (client.ws.readyState !== WebSocket.OPEN) continue;

      if (event.channel && !client.subscriptions.has(event.channel)) continue;

      if (event.stationId && client.stationId && client.stationId !== event.stationId) continue;

      try {
        client.ws.send(message);
        sentCount++;
      } catch (error) {
        logger.error('Failed to send WebSocket message', error as Error, { clientId });
      }
    }

    logger.debug('Broadcast message', {
      type: event.type,
      channel: event.channel,
      recipients: sentCount,
    });
  }

  sendToUser(userId: number, event: { type: string; data: unknown }): void {
    const message = JSON.stringify({
      type: event.type,
      data: event.data,
      timestamp: new Date().toISOString(),
    });

    for (const [clientId, client] of Array.from(this.clients.entries())) {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(message);
        } catch (error) {
          logger.error('Failed to send WebSocket message to user', error as Error, {
            clientId,
            userId,
          });
        }
      }
    }
  }

  getStats(): {
    totalClients: number;
    authenticatedClients: number;
    subscriptions: Record<string, number>;
  } {
    let authenticatedCount = 0;
    const subscriptionCounts: Record<string, number> = {};

    for (const client of Array.from(this.clients.values())) {
      if (client.authenticated) authenticatedCount++;

      for (const channel of Array.from(client.subscriptions)) {
        subscriptionCounts[channel] = (subscriptionCounts[channel] || 0) + 1;
      }
    }

    return {
      totalClients: this.clients.size,
      authenticatedClients: authenticatedCount,
      subscriptions: subscriptionCounts,
    };
  }
}

export const wsManager = new WebSocketManager();
