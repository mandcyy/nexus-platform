
// presence/src/PresenceManager.ts
/**
 * Nexus Platform — Presence Durable Object
 * Tracks online/offline status per user.
 * Lightweight, ephemeral state.
 */

class PresenceManager {
  private status = 'OFFLINE';
  private lastSeen = Date.now();

  constructor(private state) {}

  async fetch(request)<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/get-presence') {
      return new Response(JSON.stringify({
        status.status,
        lastSeen.lastSeen,
      }));
    }

    if (request.method === 'POST' && path === '/set-status') {
      const { status } = await request.json!();
      this.status = status;
      if (status === 'OFFLINE') {
        this.lastSeen = Date.now();
      }
      return new Response(JSON.stringify({ success }));
    }

    return new Response('Not Found', { status });
  }
}
// auth-edge/src/UserSession.ts
/**
 * Nexus Platform — UserSession Durable Object
 * Manages WebSocket connections per user across all devices.
 */



class UserSession {
  private devices<string, DeviceSession> = new Map();

  constructor(private state) {}

  async fetch(request)<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      const url = new URL(request.url);
      const deviceId = url.searchParams.get('deviceId') || 'unknown';

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.devices.set(deviceId, { deviceId, socket, connectedAt.now() });

      server.accept();

      server.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data as string);

          // Route to appropriate chat room
          if (data.type === 'chat:join') {
            // Forward to ChatRoom DO
            this.sendToChatRoom(data.chatId, data, deviceId);
          }
        } catch (err) {
          console.error('Session message error:', err);
        }
      });

      server.addEventListener('close', () => {
        this.devices.delete(deviceId);
      });

      return new Response(null, { status, webSocket });
    }

    return new Response('WebSocket only', { status });
  }

  private async sendToChatRoom(chatId, data, deviceId) {
    // Route messages to the appropriate ChatRoom DO
    // This is where the user session acts as a proxy to chat rooms
  }

  getDeviceCount() {
    return this.devices.size;
  }
}
// chat-durable-object/src/ChatRoom.ts
/**
 * Nexus Platform — ChatRoom Durable Object
 * 
 * Handles real-time messaging for a single chat room.
 * All WebSocket connections for a chat room are managed here.
 * Messages are broadcast instantly, then persisted to D1.
 * 
 * Scale DO instance per chat room (up to millions of rooms)
 */





class ChatRoom {
  private sessions<string, WebSocketState> = new Map();
  private messageBuffer = [];
  private flushTimer<typeof setInterval> | null = null;
  private env;

  constructor(private state, env) {
    this.env = env;
  }

  async fetch(request)<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocketUpgrade(request);
    }

    // HTTP API for sending messages (from API Gateway)
    if (request.method === 'POST' && path === '/send') {
      const body = await request.json();
      await this.broadcastMessage(body);
      return new Response('ok');
    }

    // Get connected users
    if (path === '/users') {
      return new Response(JSON.stringify({
        users.from(this.sessions.values()).map(s => s.userId),
        count.sessions.size,
      }));
    }

    return new Response('Not Found', { status });
  }

  private async handleWebSocketUpgrade(request)<Response> {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId') || 'anonymous';

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.sessions.set(userId, {
      userId,
      socket,
      joinedAt.now(),
    });

    server.accept();

    server.addEventListener('message', async (event) => {
      try {
        const data = JSON.parse(event.data as string);

        switch (data.type) {
          case 'message:send':
            await this.handleIncomingMessage(userId, data);
            break;
          case 'typing':
            this.broadcast({ type: 'typing', userId, chatId.chatId, isTyping.isTyping }, userId);
            break;
          case 'read:receipt':
            this.broadcast({ type: 'read:receipt', userId, messageId.messageId }, userId);
            break;
          case 'reaction:add':
            this.broadcast({ type: 'reaction', userId, messageId.messageId, emoji.emoji }, userId);
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
      this.broadcast({ type: 'presence', userId, status: 'OFFLINE', lastSeen.now() });

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

    return new Response(null, { status, webSocket });
  }

  private async handleIncomingMessage(userId, data) {
    const messageId = crypto.randomUUID();
    const now = Date.now();

    const message = {
      id,
      chatId.chatId,
      senderId,
      content.content,
      contentType.contentType || 'text',
      createdAt,
      replyTo.replyTo,
    };

    // 1. Broadcast instantly to all connected users
    this.broadcast({ type: 'message:new', message });

    // 2. Buffer for batch persistence
    this.messageBuffer.push(message);
    this.scheduleFlush();

    // 3. Enqueue for notification service
    await this.env.NOTIFICATION_QUEUE.send({
      chatId.chatId,
      messageId,
      senderId,
      contentPreview data.content === 'string' ? data.content.substring(0, 100) : 'Media',
    });

    // 4. Enqueue for search indexing
    await this.env.MESSAGE_QUEUE.send({
      action: 'index',
      message,
    });
  }

  private broadcast(data, excludeUserId?) {
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
        typeof msg.content === 'string' ? msg.content .stringify(msg.content),
        msg.createdAt, msg.replyTo || null)
    );

    await this.env.NEXUS_DB.batch(stmts);

    if (this.messageBuffer.length === 0 && this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}
// api-gateway/src/queue-consumer.ts
/**
 * Nexus Platform — Queue Consumer
 * Processes background tasks indexing, notifications, analytics
 */



const __defaultExport = {
  async queue(batch<any>, env)<void> {
    for (const msg of batch.messages) {
      try {
        const { action, message } = msg.body;

        switch (action) {
          case 'index':
            // Index message in D1 FTS
            await env.NEXUS_DB.prepare(`
              INSERT INTO messages_fts (message_id, content) VALUES (?, ?)
            `).bind(message.id, JSON.stringify(message.content)).run();
            break;

          case 'notify':
            // Process notifications
            break;

          case 'analytics':
            // Store analytics data
            break;
        }

        msg.ack();
      } catch (err) {
        console.error('Queue processing error:', err);
        msg.retry({ delaySeconds });
      }
    }
  },
};
// api-gateway/src/index.ts
/**
 * Nexus Platform — Cloudflare API Gateway
 * 
 * Architecture:
 * - All API requests hit this worker first
 * - JWT validation at edge (fast, no DB roundtrip)
 * - Routes to appropriate handlers
 * - Rate limiting via KV
 * - WebSocket upgrade to Durable Objects
 * - Static assets via R2/Pages
 */







export { ChatRoom, PresenceManager, UserSession };



const router = Router();

// ──── CORS Middleware ────
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// ──── Health Check ────
router.get('/health', () => new Response(JSON.stringify({
  status: 'ok', timestamp.now(), region: (globalThis as any).location
}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }));

// ──── Auth Routes ────
router.post('/auth/register', async (req, env) => {
  const body = await req.json!();
  const { username, email, password, displayName } = body;

  // Validation
  if (!password || password.length < 8) {
    return json({ error: 'Password too short' }, 400);
  }

  // Check existing user via D1
  const existing = await env.NEXUS_DB.prepare(
    'SELECT id FROM users WHERE username = ? OR email = ?'
  ).bind(username, email).first();

  if (existing) {
    return json({ error: 'User already exists' }, 409);
  }

  // Hash password
  const hash = await hashPassword(password);
  const userId = crypto.randomUUID();

  await env.NEXUS_DB.prepare(
    'INSERT INTO users (id, username, email, password_hash, display_name) VALUES (?, ?, ?, ?, ?)'
  ).bind(userId, username, email, hash, displayName).run();

  // Generate tokens
  const tokens = await generateTokens(userId, env);

  return json({ user: { id, username, email, displayName }, ...tokens });
});

router.post('/auth/login', async (req, env) => {
  const body = await req.json!();
  const { identifier, password } = body;

  const user = await env.NEXUS_DB.prepare(
    'SELECT * FROM users WHERE username = ? OR email = ? OR phone = ?'
  ).bind(identifier, identifier, identifier).first();

  if (!user || !(await verifyPassword(password, user.password_hash as string))) {
    return json({ error: 'Invalid credentials' }, 401);
  }

  // Check rate limit
  const rateKey = `login:${identifier}`;
  const attempts = parseInt((await env.RATE_LIMIT.get(rateKey)) || '0');
  if (attempts >= 5) {
    return json({ error: 'Too many attempts. Try again later.' }, 429);
  }
  await env.RATE_LIMIT.put(rateKey, String(attempts + 1), { expirationTtl });

  const tokens = await generateTokens(user.id as string, env);

  return json({ user: { id.id, username.username, displayName.display_name }, ...tokens });
});

// ──── Token Verification Middleware ────
async function authenticate(req, env)<string | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const payload = await verify(token, env.JWT_SECRET);
    return payload.sub as string;
  } catch {
    return null;
  }
}

// ──── Chat API Routes ────
router.get('/chats', async (req, env) => {
  const userId = await authenticate(req, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const chats = await env.NEXUS_DB.prepare(`
    SELECT c.*, cp.role, cp.last_read_message_id
    FROM chats c
    JOIN chat_participants cp ON c.id = cp.chat_id
    WHERE cp.user_id = ?
    ORDER BY c.updated_at DESC
    LIMIT 50
  `).bind(userId).all();

  return json({ chats.results });
});

router.post('/chats', async (req, env) => {
  const userId = await authenticate(req, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);
  const { type, name, participantIds } = await req.json!();

  const chatId = crypto.randomUUID();
  await env.NEXUS_DB.batch([
    env.NEXUS_DB.prepare('INSERT INTO chats (id, type, name) VALUES (?, ?, ?)').bind(chatId, type, name),
    ...([userId, ...participantIds].map(pid =>
      env.NEXUS_DB.prepare('INSERT INTO chat_participants (chat_id, user_id, role) VALUES (?, ?, ?)')
        .bind(chatId, pid, pid === userId ? 'OWNER' : 'MEMBER')
    )),
  ]);

  return json({ chat: { id, type, name } }, 201);
});

// ──── Message Routes ────
router.get('/chats/:chatId/messages', async (req, env) => {
  const userId = await authenticate(req, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const { chatId } = req.params!;
  const limit = parseInt(req.query?.limit || '50');

  const messages = await env.NEXUS_DB.prepare(`
    SELECT m.*, r.reactions_json
    FROM messages m
    LEFT JOIN (SELECT message_id, json_group_array(json_object('emoji', emoji, 'userId', user_id)) as reactions_json FROM reactions GROUP BY message_id) r ON m.id = r.message_id
    WHERE m.chat_id = ?
    ORDER BY m.created_at DESC
    LIMIT ?
  `).bind(chatId, limit).all();

  return json({ messages.results });
});

// ──── Media Upload ────
router.post('/media/upload', async (req, env) => {
  const userId = await authenticate(req, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const contentType = req.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    // Direct R2 upload via presigned URL
    const fileId = crypto.randomUUID();
    const uploadUrl = await env.MEDIA_BUCKET.createMultipartUpload(fileId);

    return json({
      uploadId,
      uploadUrl,
      // Client uploads directly to R2, then notifies us
    });
  }

  // For smaller files, proxy through worker
  const formData = await req.formData();
  const file = formData.get('file') as File;
  if (!file) return json({ error: 'No file' }, 400);

  const fileId = crypto.randomUUID();
  const ext = file.name.split('.').pop();
  const key = `media/${userId}/${fileId}.${ext}`;

  await env.MEDIA_BUCKET.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType.type },
  });

  return json({
    id,
    url: `/cdn/${key}`,
    size.size,
    mimeType.type,
  });
});

// ──── CDN Proxy (R2) ────
router.get('/cdn/*', async (req, env) => {
  const path = new URL(req.url).pathname.replace('/cdn/', '');
  const object = await env.MEDIA_BUCKET.get(path);

  if (!object) return new Response('Not Found', { status });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('etag', object.httpEtag);

  return new Response(object.body, { headers });
});

// ──── WebSocket Upgrade → Durable Object ────
router.get('/ws', async (req, env) => {
  const token = req.query?.token;
  if (!token) return new Response('Token required', { status });

  try {
    const payload = await verify(token, env.JWT_SECRET);
    const userId = payload.sub as string;

    // Each user gets a dedicated DO instance for WebSocket
    const id = env.USER_SESSION.idFromName(userId);
    const stub = env.USER_SESSION.get(id);

    return stub.fetch(req);
  } catch {
    return new Response('Invalid token', { status });
  }
});

// ──── AI Routes (proxy to external) ────
router.post('/ai/*', async (req, env) => {
  const userId = await authenticate(req, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  return env.EXTERNAL_AI.fetch(req);
});

// ──── Search Routes ────
router.get('/search', async (req, env) => {
  const userId = await authenticate(req, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  // Try D1 FTS first (lightweight), fallback to external Elasticsearch
  const query = req.query?.q || '';
  if (!query) return json({ results: [] });

  const results = await env.NEXUS_DB.prepare(`
    SELECT * FROM messages_fts WHERE messages_fts MATCH ? LIMIT 20
  `).bind(query).all();

  return json({ results.results });
});

// ──── Presence Routes ────
router.get('/presence/:userId', async (req, env) => {
  const id = env.PRESENCE.idFromName(req.params!.userId);
  const stub = env.PRESENCE.get(id);
  return stub.fetch(new Request('https://internal/get-presence'));
});

router.post('/presence/status', async (req, env) => {
  const userId = await authenticate(req, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const { status } = await req.json!();
  const id = env.PRESENCE.idFromName(userId);
  const stub = env.PRESENCE.get(id);

  return stub.fetch(new Request('https://internal/set-status', {
    method: 'POST',
    body.stringify({ status }),
  }));
});

// ──── Default 404 ────
router.all('*', () => new Response('Not Found', { status }));

// ──── Main Handler ────
const __defaultExport = {
  async fetch(request, env, ctx)<Response> {
    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers });
    }

    try {
      const response = await router.handle(request, env, ctx);

      // Add CORS headers to all responses
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));

      return new Response(response.body, {
        status.status,
        statusText.statusText,
        headers,
      });
    } catch (err) {
      console.error('Unhandled error:', err);
      return json({ error: 'Internal Server Error', message.message }, 500);
    }
  },
};

// ──── Utilities ────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function hashPassword(password)<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function verifyPassword(password, hash)<boolean> {
  return (await hashPassword(password)) === hash;
}

async function generateTokens(userId, env) {
  const accessToken = await sign(
    { sub, iat.floor(Date.now() / 1000), exp.floor(Date.now() / 1000) + 900 },
    env.JWT_SECRET
  );

  const refreshToken = await sign(
    { sub, type: 'refresh', iat.floor(Date.now() / 1000), exp.floor(Date.now() / 1000) + 2592000 },
    env.JWT_REFRESH_SECRET
  );

  return { accessToken, refreshToken, expiresIn };
}
export default __defaultExport;
