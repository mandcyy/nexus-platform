/**
 * Nexus Platform — ChatRoom Durable Object
 * 
 * Handles real-time messaging for a single chat room.
 * All WebSocket connections for a chat room are managed here.
 * Messages are broadcast instantly, then persisted to D1.
 * 
 * Scale: One DO instance per chat room (up to millions of rooms)
 */

interface Env {
  NEXUS_DB: D1Database;
  MESSAGE_QUEUE: Queue;
  NOTIFICATION_QUEUE: Queue;
  PRESENCE: DurableObjectNamespace;
}

interface WebSocketState {
  userId: string;
  socket: WebSocket;
  joinedAt: number;
}

export class ChatRoom {
  private sessions: Map<string, WebSocketState> = new Map();
  private messageBuffer: any[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private env: Env;

  constructor(private state: DurableObjectState, env: Env) {
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    // HTTP API for sending messages (from API Gateway)
    if (request.method === 'POST' && path === '/send') {
      const body: any = await request.json();
      await this.broadcastMessage(body);
      return new Response('ok');
    }

    // Get connected users
    if (path === '/users') {
      return new Response(JSON.stringify({
        users: Array.from(this.sessions.values()).map(s => s.userId),
        count: this.sessions.size,
      }));
    }

    return new Response('Not Found', { status: 404 });
  }

  private async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || 'anonymous';

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.sessions.set(userId, {
      userId,
      socket: server,
      joinedAt: Date.now(),
    });

    server.accept();

    server.addEventListener('message', async (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);

        switch (data.type) {
          case 'message:send':
            await this.handleIncomingMessage(userId, data);
            break;
          case 'typing':
            this.broadcast({ type: 'typing', userId, chatId: data.chatId, isTyping: data.isTyping }, userId);
            break;
          case 'read:receipt':
            this.broadcast({ type: 'read:receipt', userId, messageId: data.messageId }, userId);
            break;
          case 'reaction:add':
            this.broadcast({ type: 'reaction', userId, messageId: data.messageId, emoji: data.emoji }, userId);
            break;
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (err) {
        console.error('Message handling error:', err);
      }
    });

    server.addEventListener('close', () => {
      this.sessions.delete(userId);
      this.broadcast({ type: 'presence', userId, status: 'OFFLINE', lastSeen: Date.now() });

      // Cleanup if no one left
      if (this.sessions.size === 0) {
        this.flushMessages();
      }
    });

    server.addEventListener('error', (err) => {
      console.error('WebSocket error:', err);
      this.sessions.delete(userId);
    });

    // Notify others
    this.broadcast({ type: 'presence', userId, status: 'ONLINE' });

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handleIncomingMessage(userId: string, data: any) {
    const messageId = crypto.randomUUID();
    const now = Date.now();

    const message = {
      id: messageId,
      chatId: data.chatId,
      senderId: userId,
      content: data.content,
      contentType: data.contentType || 'text',
      createdAt: now,
      replyTo: data.replyTo,
    };

    // 1. Broadcast instantly to all connected users
    this.broadcast({ type: 'message:new', message });

    // 2. Buffer for batch persistence
    this.messageBuffer.push(message);
    this.scheduleFlush();

    // 3. Enqueue for notification service
    await this.env.NOTIFICATION_QUEUE.send({
      chatId: data.chatId,
      messageId,
      senderId: userId,
      contentPreview: typeof data.content === 'string' ? data.content.substring(0, 100) : 'Media',
    });

    // 4. Enqueue for search indexing
    await this.env.MESSAGE_QUEUE.send({
      action: 'index',
      message,
    });
  }

  private broadcast(data: any, excludeUserId?: string) {
    const payload = JSON.stringify(data);
    for (const [uid, state] of this.sessions) {
      if (uid !== excludeUserId && state.socket.readyState === WebSocket.READY_STATE_OPEN) {
        try {
          state.socket.send(payload);
        } catch (err) {
          console.error('Failed to send to', uid);
        }
      }
    }
  }

  private scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flushMessages(), 1000);
  }

  private async flushMessages() {
    if (this.messageBuffer.length === 0) return;
    const batch = this.messageBuffer.splice(0);

    // Batch insert into D1
    const stmts = batch.map(msg =>
      this.env.NEXUS_DB.prepare(
        'INSERT INTO messages (id, chat_id, sender_id, content_type, content_json, created_at, reply_to) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(msg.id, msg.chatId, msg.senderId, msg.contentType,
        typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        msg.createdAt, msg.replyTo || null)
    );

    await this.env.NEXUS_DB.batch(stmts);

    if (this.messageBuffer.length === 0 && this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}