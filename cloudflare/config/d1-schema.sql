-- Nexus Platform — D1 Database Schema
-- Cloudflare D1 (SQLite-compatible at edge)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  status TEXT DEFAULT 'OFFLINE',
  last_seen INTEGER,
  is_verified INTEGER DEFAULT 0,
  is_premium INTEGER DEFAULT 0,
  role TEXT DEFAULT 'USER',
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  device_id TEXT,
  ip_address TEXT,
  is_revoked INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('PERSONAL','SECRET','GROUP','SUPER_GROUP','BROADCAST','COMMUNITY','FORUM')),
  name TEXT NOT NULL,
  avatar_url TEXT,
  description TEXT,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_chats_updated ON chats(updated_at DESC);

CREATE TABLE IF NOT EXISTS chat_participants (
  chat_id TEXT NOT NULL REFERENCES chats(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT DEFAULT 'MEMBER',
  joined_at INTEGER DEFAULT (unixepoch()),
  last_read_message_id TEXT,
  PRIMARY KEY (chat_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  content_json TEXT NOT NULL,
  status TEXT DEFAULT 'SENT',
  reply_to TEXT,
  is_edited INTEGER DEFAULT 0,
  edited_at INTEGER,
  is_pinned INTEGER DEFAULT 0,
  is_starred INTEGER DEFAULT 0,
  self_destruct_at INTEGER,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);

-- Full-Text Search
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
  content,
  content_rowid='message_id',
  tokenize='porter unicode61'
);

CREATE TABLE IF NOT EXISTS reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS follows (
  id TEXT PRIMARY KEY,
  follower_id TEXT NOT NULL REFERENCES users(id),
  following_id TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER DEFAULT (unixepoch()),
  UNIQUE(follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  media_url TEXT NOT NULL,
  caption TEXT,
  expires_at INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_stories_user ON stories(user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires ON stories(expires_at);

CREATE TABLE IF NOT EXISTS calls (
  id TEXT PRIMARY KEY,
  chat_id TEXT,
  caller_id TEXT NOT NULL,
  type TEXT,
  status TEXT,
  started_at INTEGER,
  ended_at INTEGER,
  duration INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS key_bundles (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  identity_key TEXT NOT NULL,
  signed_pre_key TEXT NOT NULL,
  signed_pre_key_id INTEGER NOT NULL,
  registration_id INTEGER NOT NULL,
  created_at INTEGER DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS one_time_pre_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  key_id INTEGER NOT NULL,
  public_key TEXT NOT NULL,
  is_used INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch())
);