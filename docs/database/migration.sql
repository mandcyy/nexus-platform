-- Nexus Platform - Initial Database Migration
-- PostgreSQL 16

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create sharded tablespace (for horizontal scaling)
CREATE TABLESPACE shard_01 LOCATION '/data/postgresql/shard_01';
CREATE TABLESPACE shard_02 LOCATION '/data/postgresql/shard_02';

-- Users table (shard key: id)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(32) UNIQUE,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    bio VARCHAR(500),
    status VARCHAR(20) DEFAULT 'OFFLINE',
    last_seen TIMESTAMPTZ,
    is_verified BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    role VARCHAR(20) DEFAULT 'USER',
    level INT DEFAULT 1,
    xp BIGINT DEFAULT 0,
    reputation INT DEFAULT 0,
    totp_secret VARCHAR(100),
    totp_enabled BOOLEAN DEFAULT FALSE,
    otp_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
) TABLESPACE shard_01;

-- Indexes for user lookup
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_display_name ON users USING gin(display_name gin_trgm_ops);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Sessions
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
) TABLESPACE shard_01;
CREATE INDEX idx_sessions_user ON sessions(user_id, is_revoked);
CREATE INDEX idx_sessions_device ON sessions(device_id);

-- Devices
CREATE TABLE devices (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    os_version VARCHAR(50),
    app_version VARCHAR(20),
    fingerprint VARCHAR(255),
    push_token TEXT,
    is_trusted BOOLEAN DEFAULT TRUE,
    is_revoked BOOLEAN DEFAULT FALSE,
    first_seen TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, device_id)
) TABLESPACE shard_01;
CREATE INDEX idx_devices_user ON devices(user_id);

-- Recovery Codes
CREATE TABLE recovery_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code VARCHAR(10) NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ
);
CREATE INDEX idx_recovery_codes ON recovery_codes(user_id, is_used);

-- E2EE Key Bundles
CREATE TABLE key_bundles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    identity_key TEXT NOT NULL,
    signed_pre_key TEXT NOT NULL,
    signed_pre_key_id INT NOT NULL,
    registration_id INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One-Time Pre-Keys
CREATE TABLE one_time_pre_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_id INT NOT NULL,
    public_key TEXT NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_prekeys_user ON one_time_pre_keys(user_id, is_used);

-- Chats (sharded by ID)
CREATE TABLE chats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) NOT NULL CHECK (type IN ('PERSONAL','SECRET','GROUP','SUPER_GROUP','BROADCAST','COMMUNITY','FORUM')),
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
) TABLESPACE shard_02;
CREATE INDEX idx_chats_updated ON chats(updated_at DESC);

-- Chat Participants
CREATE TABLE chat_participants (
    chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'MEMBER' CHECK (role IN ('OWNER','ADMIN','MODERATOR','MEMBER','RESTRICTED','BANNED')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    last_read_message_id UUID,
    is_muted BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (chat_id, user_id)
) TABLESPACE shard_02;
CREATE INDEX idx_part_user ON chat_participants(user_id);

-- Messages (partitioned by chat_id for scale)
CREATE TABLE messages (
    id UUID NOT NULL,
    chat_id UUID NOT NULL,
    sender_id UUID NOT NULL REFERENCES users(id),
    content_type VARCHAR(20) NOT NULL,
    content_json JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'SENT' CHECK (status IN ('SENDING','SENT','DELIVERED','SEEN','READ','FAILED','DELETED')),
    reply_to UUID,
    forward_from_json JSONB,
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMPTZ,
    is_pinned BOOLEAN DEFAULT FALSE,
    is_starred BOOLEAN DEFAULT FALSE,
    self_destruct_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Monthly partitions
CREATE TABLE messages_2024_01 PARTITION OF messages FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE messages_2024_02 PARTITION OF messages FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
-- (Add more partitions as needed via cron)

CREATE INDEX idx_messages_chat ON messages(chat_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_content ON messages USING gin(content_json);

-- Reactions
CREATE TABLE reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- Calls
CREATE TABLE calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id UUID,
    caller_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(20) CHECK (type IN ('VOICE','VIDEO','SCREEN_SHARE')),
    status VARCHAR(20),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_calls_user ON calls(caller_id);

-- Stories
CREATE TABLE stories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(20),
    media_url TEXT NOT NULL,
    caption TEXT,
    viewers_json JSONB,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_stories_user ON stories(user_id);
CREATE INDEX idx_stories_expires ON stories(expires_at);

-- Follows
CREATE TABLE follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

-- Offline Queue
CREATE TABLE offline_queue (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    retry_count INT DEFAULT 0,
    max_retries INT DEFAULT 5,
    next_retry_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_offline_queue ON offline_queue(next_retry_at, retry_count);

-- Sharding configuration for horizontal scaling
-- Shard users by user_id range
-- Shard messages by chat_id hash
-- Use Citus for distributed PostgreSQL
SELECT create_distributed_table('users', 'id');
SELECT create_distributed_table('sessions', 'user_id');
SELECT create_distributed_table('messages', 'chat_id');
SELECT create_distributed_table('chat_participants', 'chat_id');
