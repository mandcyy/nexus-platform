# Nexus Platform — Cloudflare Deployment

## Architecture Overview

```
                          ┌─────────────────────────────┐
                          │     Cloudflare Global Edge   │
                          │                              │
  Mobile App ──────►      │  ┌─────────────────────┐    │
  Web Client ──────►      │  │   API Gateway Worker │    │
  Admin Panel ────►       │  │   (Routes + Auth)    │    │
                          │  └──────┬──────────────┘    │
                          │         │                    │
                          │    ┌────┴──────────┐        │
                          │    ▼                ▼        │
                          │ ┌──────────┐ ┌────────────┐ │
                          │ │ ChatRoom │ │  Presence   │ │
                          │ │   DO     │ │    DO       │ │
                          │ │(WebSocket)│ │ (Online?)   │ │
                          │ └────┬─────┘ └────────────┘ │
                          │      │                       │
                          │ ┌────┴───────────────────┐  │
                          │ │    D1 Database (SQLite)  │  │
                          │ │    Users, Chats, Messages │  │
                          │ └──────────────────────────┘  │
                          │ ┌──────┐ ┌──────┐ ┌────────┐ │
                          │ │  R2  │ │  KV  │ │ Queues │ │
                          │ │Media │ │Cache │ │Async   │ │
                          │ └──────┘ └──────┘ └────────┘ │
                          └──────────────────────────────┘
                                      │
                          ┌───────────┴──────────────┐
                          │   External Services       │
                          │   (for heavy workloads)    │
                          │                            │
                          │  • AI/ML (GPU workers)     │
                          │  • Elasticsearch           │
                          │  • Video transcoding       │
                          │  • TURN/STUN servers       │
                          └────────────────────────────┘
```

## What Runs on Cloudflare (Edge-Native)

| Component             | Cloudflare Service     | Benefit                      |
|----------------------|------------------------|-----------------------------|
| API Gateway          | Worker                 | Global low latency (~10ms)  |
| Auth (JWT verify)    | Worker + KV            | No DB roundtrip for auth    |
| Realtime Chat        | Durable Object + WS    | Stateful WebSocket at edge  |
| Media Storage        | R2                     | Zero egress fees            |
| Image Optimization   | Images (built-in)      | On-the-fly resize/convert   |
| Database             | D1 (SQLite)            | Global read replication     |
| Caching              | KV                     | Sub-ms reads                |
| Async Tasks          | Queues                 | Reliable background jobs    |
| Static Hosting       | Pages                  | Auto-deploy from Git        |
| CDN                  | Built-in               | 330+ edge locations          |
| DDoS Protection      | Built-in               | Always-on L3/L7             |
| WAF                  | Rulesets               | Custom firewall rules        |

## What Needs External Services

| Component             | Where                    | Why                          |
|----------------------|--------------------------|------------------------------|
| AI Processing        | Dedicated GPU server     | Workers CPU/memory limit     |
| Elasticsearch        | Elastic Cloud / Self-host | Complex full-text search    |
| Video Transcoding    | Dedicated server         | CPU-intensive FFmpeg         |
| TURN/STUN            | Dedicated server         | UDP protocol not supported   |
| PostgreSQL (optional)| Neon / Supabase / AWS    | Complex relational queries   |

## Quick Start

```bash
# 1. Install Wrangler CLI
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Create D1 Database
wrangler d1 create nexus-platform

# 4. Apply Schema
wrangler d1 execute nexus-platform --file=config/d1-schema.sql

# 5. Create KV Namespaces
wrangler kv:namespace create AUTH_CACHE
wrangler kv:namespace create RATE_LIMIT

# 6. Create R2 Bucket
wrangler r2 bucket create nexus-media

# 7. Create Queues
wrangler queues create nexus-messages
wrangler queues create nexus-notifications

# 8. Set Secrets
wrangler secret put JWT_SECRET
wrangler secret put JWT_REFRESH_SECRET

# 9. Deploy!
wrangler deploy
```

## Cost Estimate (per month)

| Service             | Free Tier           | 10M Users Estimate  |
|---------------------|---------------------|---------------------|
| Workers             | 100K req/day        | $50-200             |
| Durable Objects     | 1M requests         | $100-500            |
| D1                  | 5GB storage         | $50-200             |
| R2                  | 10GB storage        | $0.015/GB stored    |
| KV                  | 1GB storage         | $0.50/million reads |
| Queues              | 1M operations       | $40/million ops     |
| Pages               | Unlimited (static)  | Free                |

Total estimated: **$300-1000/month** for 10M users (vs $5000-20000 for AWS K8s)

## Why Cloudflare > AWS for Messaging

1. **Global Edge**: Messages delivered in <50ms anywhere vs 200-500ms from single region
2. **WebSocket at Edge**: Durable Objects handle WebSocket natively
3. **Zero Egress**: R2 has zero egress fees (massive savings for media-heavy apps)
4. **Auto-Scaling**: No K8s, no load balancers, no node management
5. **Security**: DDoS protection, WAF, bot management included
6. **Cost**: Pay-per-use, no idle server costs
