# Cloudflare Terraform Rules for Nexus Platform

resource "cloudflare_worker_script" "api_gateway" {
  account_id = var.cloudflare_account_id
  name       = "nexus-api-gateway"
  content    = file("../workers/api-gateway/dist/index.js")
  module     = true

  plain_text_binding {
    name = "JWT_SECRET"
    text = var.jwt_secret
  }

  plain_text_binding {
    name = "JWT_REFRESH_SECRET"
    text = var.jwt_refresh_secret
  }

  r2_bucket_binding {
    name        = "MEDIA_BUCKET"
    bucket_name = "nexus-media"
  }

  d1_database_binding {
    name        = "NEXUS_DB"
    database_id = cloudflare_d1_database.nexus.id
  }

  kv_namespace_binding {
    name         = "AUTH_CACHE"
    namespace_id = cloudflare_kv_namespace.auth_cache.id
  }

  kv_namespace_binding {
    name         = "RATE_LIMIT"
    namespace_id = cloudflare_kv_namespace.rate_limit.id
  }

  service_binding {
    name    = "EXTERNAL_AI"
    service = "nexus-ai-service"
  }

  service_binding {
    name    = "EXTERNAL_SEARCH"
    service = "nexus-search-service"
  }

  queue_binding {
    binding = "MESSAGE_QUEUE"
    queue   = cloudflare_queue.message_queue.id
  }

  queue_binding {
    binding = "NOTIFICATION_QUEUE"
    queue   = cloudflare_queue.notification_queue.id
  }

  durable_object_binding {
    name        = "CHAT_ROOM"
    class_name  = "ChatRoom"
    script_name = cloudflare_worker_script.api_gateway.name
  }

  durable_object_binding {
    name        = "PRESENCE"
    class_name  = "PresenceManager"
    script_name = cloudflare_worker_script.api_gateway.name
  }

  durable_object_binding {
    name        = "USER_SESSION"
    class_name  = "UserSession"
    script_name = cloudflare_worker_script.api_gateway.name
  }
}

# Routes
resource "cloudflare_worker_route" "api" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "api.nexus-platform.com/*"
  script_name = cloudflare_worker_script.api_gateway.name
}

resource "cloudflare_worker_route" "cdn" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "cdn.nexus-platform.com/*"
  script_name = cloudflare_worker_script.api_gateway.name
}

resource "cloudflare_worker_route" "ws" {
  zone_id     = var.cloudflare_zone_id
  pattern     = "ws.nexus-platform.com/*"
  script_name = cloudflare_worker_script.api_gateway.name
}

# D1 Database
resource "cloudflare_d1_database" "nexus" {
  account_id = var.cloudflare_account_id
  name       = "nexus-platform"
}

# KV Namespaces
resource "cloudflare_kv_namespace" "auth_cache" {
  account_id = var.cloudflare_account_id
  title      = "nexus-auth-cache"
}

resource "cloudflare_kv_namespace" "rate_limit" {
  account_id = var.cloudflare_account_id
  title      = "nexus-rate-limit"
}

# R2 Bucket
resource "cloudflare_r2_bucket" "media" {
  account_id = var.cloudflare_account_id
  name       = "nexus-media"
}

# Queues
resource "cloudflare_queue" "message_queue" {
  account_id = var.cloudflare_account_id
  name       = "nexus-messages"
}

resource "cloudflare_queue" "notification_queue" {
  account_id = var.cloudflare_account_id
  name       = "nexus-notifications"
}

# Cloudflare Pages
resource "cloudflare_pages_project" "web_client" {
  account_id        = var.cloudflare_account_id
  name              = "nexus-web"
  production_branch = "main"

  build_config {
    build_command   = "npm run build"
    destination_dir = "dist"
    root_dir        = "web-client"
  }
}

resource "cloudflare_pages_project" "admin" {
  account_id        = var.cloudflare_account_id
  name              = "nexus-admin"
  production_branch = "main"

  build_config {
    build_command   = "npm run build"
    destination_dir = "dist"
    root_dir        = "admin-dashboard"
  }
}

# Custom domain for Pages
resource "cloudflare_pages_domain" "web" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.web_client.name
  domain       = "nexus-platform.com"
}

resource "cloudflare_pages_domain" "admin" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.admin.name
  domain       = "admin.nexus-platform.com"
}

# Security Rules
resource "cloudflare_ruleset" "waf" {
  account_id = var.cloudflare_account_id
  name       = "nexus-waf"
  kind       = "zone"
  phase      = "http_request_firewall_custom"

  rules {
    action      = "block"
    expression  = "(http.user_agent contains "bot" and not http.user_agent contains "googlebot")"
    description = "Block known bad bots"
    enabled     = true
  }

  rules {
    action      = "managed_challenge"
    expression  = "cf.threat_score gt 50"
    description = "Challenge high threat score requests"
    enabled     = true
  }
}

# Rate Limiting Rule
resource "cloudflare_ruleset" "rate_limit" {
  account_id = var.cloudflare_account_id
  name       = "nexus-rate-limit"
  kind       = "zone"
  phase      = "http_ratelimit"

  rules {
    action      = "block"
    expression  = "http.request.uri.path contains "/auth/login""
    description = "Rate limit login attempts"

    ratelimit {
      characteristics = ["cf.colo.id", "ip.src"]
      period         = 60
      requests_per_period = 5
      mitigation_timeout = 60
    }
  }

  rules {
    action      = "block"
    expression  = "http.request.uri.path contains "/api/""
    description = "API rate limit"

    ratelimit {
      characteristics = ["cf.colo.id", "ip.src"]
      period         = 10
      requests_per_period = 100
      mitigation_timeout = 10
    }
  }
}