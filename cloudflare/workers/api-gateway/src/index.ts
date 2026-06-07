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

import { Router, IRequest } from 'itty-router';
import { verify, sign } from '@tsndr/cloudflare-worker-jwt';
import { ChatRoom } from '../chat-durable-object/src/ChatRoom';
import { PresenceManager } from '../presence/src/PresenceManager';
import { UserSession } from '../auth-edge/src/UserSession';

export { ChatRoom, PresenceManager, UserSession };

interface Env {
  AUTH_CACHE: KVNamespace;
  RATE_LIMIT: KVNamespace;
  MEDIA_BUCKET: R2Bucket;
  NEXUS_DB: D1Database;
  MESSAGE_QUEUE: Queue;
  NOTIFICATION_QUEUE: Queue;
  EXTERNAL_AI: Fetcher;
  EXTERNAL_SEARCH: Fetcher;
  CHAT_ROOM: DurableObjectNamespace;
  PRESENCE: DurableObjectNamespace;
  USER_SESSION: DurableObjectNamespace;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
}

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
  status: 'ok', timestamp: Date.now(), region: (globalThis as any).location
}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }));

// ──── Auth Routes ────
router.post('/auth/register', async (req: IRequest, env: Env) => {
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

  return json({ user: { id: userId, username, email, displayName }, ...tokens });
});

router.post('/auth/login', async (req: IRequest, env: Env) => {
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
  await env.RATE_LIMIT.put(rateKey, String(attempts + 1), { expirationTtl: 300 });

  const tokens = await generateTokens(user.id as string, env);

  return json({ user: { id: user.id, username: user.username, displayName: user.display_name }, ...tokens });
});

// ──── Token Verification Middleware ────
async function authenticate(req: IRequest, env: Env): Promise<string | null> {
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
router.get('/chats', async (req: IRequest, env: Env) => {
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

  return json({ chats: chats.results });
});

router.post('/chats', async (req: IRequest, env: Env) => {
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

  return json({ chat: { id: chatId, type, name } }, 201);
});

// ──── Message Routes ────
router.get('/chats/:chatId/messages', async (req: IRequest, env: Env) => {
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

  return json({ messages: messages.results });
});

// ──── Media Upload ────
router.post('/media/upload', async (req: IRequest, env: Env) => {
  const userId = await authenticate(req, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const contentType = req.headers.get('Content-Type') || '';
  if (!contentType.includes('multipart/form-data')) {
    // Direct R2 upload via presigned URL
    const fileId = crypto.randomUUID();
    const uploadUrl = await env.MEDIA_BUCKET.createMultipartUpload(fileId);

    return json({
      uploadId: fileId,
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
    httpMetadata: { contentType: file.type },
  });

  return json({
    id: fileId,
    url: `/cdn/${key}`,
    size: file.size,
    mimeType: file.type,
  });
});

// ──── CDN Proxy (R2) ────
router.get('/cdn/*', async (req: IRequest, env: Env) => {
  const path = new URL(req.url).pathname.replace('/cdn/', '');
  const object = await env.MEDIA_BUCKET.get(path);

  if (!object) return new Response('Not Found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('etag', object.httpEtag);

  return new Response(object.body, { headers });
});

// ──── WebSocket Upgrade → Durable Object ────
router.get('/ws', async (req: IRequest, env: Env) => {
  const token = req.query?.token;
  if (!token) return new Response('Token required', { status: 401 });

  try {
    const payload = await verify(token, env.JWT_SECRET);
    const userId = payload.sub as string;

    // Each user gets a dedicated DO instance for WebSocket
    const id = env.USER_SESSION.idFromName(userId);
    const stub = env.USER_SESSION.get(id);

    return stub.fetch(req);
  } catch {
    return new Response('Invalid token', { status: 401 });
  }
});

// ──── AI Routes (proxy to external) ────
router.post('/ai/*', async (req: IRequest, env: Env) => {
  const userId = await authenticate(req, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  return env.EXTERNAL_AI.fetch(req);
});

// ──── Search Routes ────
router.get('/search', async (req: IRequest, env: Env) => {
  const userId = await authenticate(req, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  // Try D1 FTS first (lightweight), fallback to external Elasticsearch
  const query = req.query?.q || '';
  if (!query) return json({ results: [] });

  const results = await env.NEXUS_DB.prepare(`
    SELECT * FROM messages_fts WHERE messages_fts MATCH ? LIMIT 20
  `).bind(query).all();

  return json({ results: results.results });
});

// ──── Presence Routes ────
router.get('/presence/:userId', async (req: IRequest, env: Env) => {
  const id = env.PRESENCE.idFromName(req.params!.userId);
  const stub = env.PRESENCE.get(id);
  return stub.fetch(new Request('https://internal/get-presence'));
});

router.post('/presence/status', async (req: IRequest, env: Env) => {
  const userId = await authenticate(req, env);
  if (!userId) return json({ error: 'Unauthorized' }, 401);

  const { status } = await req.json!();
  const id = env.PRESENCE.idFromName(userId);
  const stub = env.PRESENCE.get(id);

  return stub.fetch(new Request('https://internal/set-status', {
    method: 'POST',
    body: JSON.stringify({ status }),
  }));
});

// ──── Default 404 ────
router.all('*', () => new Response('Not Found', { status: 404 }));

// ──── Main Handler ────
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle OPTIONS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const response = await router.handle(request, env, ctx);

      // Add CORS headers to all responses
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (err: any) {
      console.error('Unhandled error:', err);
      return json({ error: 'Internal Server Error', message: err.message }, 500);
    }
  },
};

// ──── Utilities ────
function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (await hashPassword(password)) === hash;
}

async function generateTokens(userId: string, env: Env) {
  const accessToken = await sign(
    { sub: userId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 900 },
    env.JWT_SECRET
  );

  const refreshToken = await sign(
    { sub: userId, type: 'refresh', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 2592000 },
    env.JWT_REFRESH_SECRET
  );

  return { accessToken, refreshToken, expiresIn: 900 };
}