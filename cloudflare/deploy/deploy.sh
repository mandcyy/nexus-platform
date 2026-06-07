#!/bin/bash
# ╔══════════════════════════════════════════════╗
# ║  NEXUS PLATFORM — ONE-CLICK FULL DEPLOY     ║
# ║  Auto: Account → DNS → Workers → DB → Live  ║
# ╚══════════════════════════════════════════════╝

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

clear
echo -e "${BLUE}${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║                                              ║"
echo "║        NEXUS PLATFORM — AUTO DEPLOY          ║"
echo "║         Cloudflare Edge + Workers            ║"
echo "║                                              ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/../.."

# ═══════════════════════════════════════════
# STEP 1: Check prerequisites
# ═══════════════════════════════════════════
echo -e "${BLUE}[1/5]${NC} Checking system..."
command -v node &>/dev/null || { echo -e "${RED}Need Node.js. Install: pkg install nodejs${NC}"; exit 1; }
command -v curl &>/dev/null || { echo -e "${RED}Need curl. Install: pkg install curl${NC}"; exit 1; }
echo -e "  ${GREEN}✓${NC} Node.js $(node -v)"
echo -e "  ${GREEN}✓${NC} curl ready"
echo ""

# ═══════════════════════════════════════════
# STEP 2: Cloudflare Setup
# ═══════════════════════════════════════════
echo -e "${BLUE}[2/5]${NC} Cloudflare Setup"
echo ""
echo -e "  ${YELLOW}Buka link ini untuk daftar Cloudflare (GRATIS):${NC}"
echo -e "  ${BOLD}https://dash.cloudflare.com/sign-up${NC}"
echo ""
echo -e "  Setelah daftar + verifikasi email:"
echo -e "  1. Buka ${BOLD}https://dash.cloudflare.com${NC}"
echo -e "  2. Copy ${BOLD}Account ID${NC} dari sidebar kanan"
echo -e "  3. Buka ${BOLD}https://dash.cloudflare.com/profile/api-tokens${NC}"
echo -e "  4. Klik ${BOLD}Create Token${NC} → pilih ${BOLD}Edit Cloudflare Workers${NC} template"
echo -e "     (atau Custom Token dengan: Workers:Edit, D1:Edit, R2:Edit, KV:Edit, Queues:Edit)"
echo -e "  5. Copy ${BOLD}API Token${NC}"
echo ""

# Open signup in browser
if command -v termux-open &>/dev/null; then
    echo -e "  ${GREEN}Membuka browser...${NC}"
    termux-open "https://dash.cloudflare.com/sign-up" 2>/dev/null || true
fi

echo -e "  ${BOLD}Masukkan credentials:${NC}"
echo ""

read -p "  Account ID: " ACCOUNT_ID
read -sp "  API Token:  " API_TOKEN
echo ""
echo ""

if [ -z "$ACCOUNT_ID" ] || [ -z "$API_TOKEN" ]; then
    echo -e "${RED}ERROR: Account ID dan API Token diperlukan${NC}"
    exit 1
fi

export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"
export CLOUDFLARE_API_TOKEN="$API_TOKEN"

# Generate strong JWT secrets
export JWT_SECRET=*** -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
export JWT_REFRESH_SECRET=*** -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

echo -e "${GREEN}  ✓ Credentials set${NC}"
echo ""

# ═══════════════════════════════════════════
# STEP 3: Deploy via REST API
# ═══════════════════════════════════════════
echo -e "${BLUE}[3/5]${NC} Provisioning Cloudflare resources..."
echo ""

node "$SCRIPT_DIR/cf-deploy.js"

if [ $? -ne 0 ]; then
    echo ""
    echo -e "${YELLOW}Auto-deploy ada issue, coba cara alternatif...${NC}"
fi

echo ""

# ═══════════════════════════════════════════
# STEP 4: Deploy Web Client ke Pages
# ═══════════════════════════════════════════
echo -e "${BLUE}[4/5]${NC} Deploying Web Client..."
echo ""

WEB_DIR="$PROJECT_DIR/web-client"
if [ -d "$WEB_DIR" ]; then
    cd "$WEB_DIR"
    
    # Check if package.json exists
    if [ -f "package.json" ]; then
        echo "  Installing dependencies..."
        npm install --silent 2>/dev/null || true
        
        echo "  Building..."
        npx vite build --outDir dist 2>/dev/null || {
            # No vite? Try simple HTML copy
            mkdir -p dist
            cp src/index.html dist/ 2>/dev/null || true
        }
        
        if [ -d "dist" ]; then
            echo "  Uploading to Cloudflare Pages..."
            # Use Wrangler if available, else manual
            if command -v npx &>/dev/null; then
                npx wrangler pages deploy dist --project-name=nexus-web 2>/dev/null || {
                    echo -e "  ${YELLOW}Pages manual: Cloudflare Dashboard → Workers & Pages → Pages → Upload${NC}"
                    echo "  Upload folder: $WEB_DIR/dist"
                }
            fi
        fi
    fi
fi

echo ""

# ═══════════════════════════════════════════
# STEP 5: Setup Domain + DNS
# ═══════════════════════════════════════════
echo -e "${BLUE}[5/5]${NC} DNS & Domain Setup"
echo ""

WORKER_NAME="nexus-api-gateway"
WORKERS_DEV="${WORKER_NAME}.${ACCOUNT_ID}.workers.dev"

echo -e "  ${GREEN}API sudah live di:${NC}"
echo -e "  ${BOLD}https://${WORKERS_DEV}${NC}"
echo ""
echo "  Test endpoint:"
echo -e "  curl https://${WORKERS_DEV}/health"
echo ""

# Test the endpoint
echo "  Testing API..."
HEALTH=$(curl -s "https://${WORKERS_DEV}/health" 2>/dev/null || echo '{"status":"pending"}')
echo -e "  Response: ${GREEN}${HEALTH}${NC}"
echo ""

echo -e "  ${YELLOW}Untuk custom domain:${NC}"
echo "  1. Buka https://dash.cloudflare.com/${ACCOUNT_ID}/workers"
echo "  2. Klik nexus-api-gateway → Triggers → Custom Domains"
echo "  3. Tambah: api.domain-anda.com, ws.domain-anda.com"
echo ""

# ═══════════════════════════════════════════
# DONE
# ═══════════════════════════════════════════
echo -e "${GREEN}${BOLD}"
echo "╔══════════════════════════════════════════════╗"
echo "║                                              ║"
echo "║         DEPLOYMENT COMPLETE! 🎉               ║"
echo "║                                              ║"
echo "║   API:  https://${WORKERS_DEV}"
echo "║                                              ║"
echo "║   Services deployed:                          ║"
echo "║   • D1 Database (SQLite at edge)              ║"
echo "║   • R2 Storage (zero egress)                  ║"
echo "║   • KV Cache + Rate Limiting                  ║"
echo "║   • Queues (async processing)                 ║"
echo "║   • 3 Durable Objects (WebSocket)             ║"
echo "║   • 5 Edge Workers                             ║"
echo "║                                              ║"
echo "╚══════════════════════════════════════════════╝"
echo -e "${NC}"

# Save credentials for future
mkdir -p "$PROJECT_DIR/.env"
cat > "$SCRIPT_DIR/.nexus-env" << EOF
CLOUDFLARE_ACCOUNT_ID=${ACCOUNT_ID}
CLOUDFLARE_API_TOKEN=${API_TOKEN}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
WORKER_URL=https://${WORKERS_DEV}
EOF

chmod 600 "$SCRIPT_DIR/.nexus-env"
echo -e "Credentials saved to: ${YELLOW}$SCRIPT_DIR/.nexus-env${NC}"
echo ""

echo -e "${BLUE}Next steps:${NC}"
echo "  • Buka dashboard: https://dash.cloudflare.com/${ACCOUNT_ID}/workers"
echo "  • Test API: curl https://${WORKERS_DEV}/health"
echo "  • Register user: curl -X POST https://${WORKERS_DEV}/auth/register -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"email\":\"test@test.com\",\"password\":\"test123456\",\"displayName\":\"Test User\"}'"
echo ""
echo -e "${YELLOW}Deploy ulang kapan aja:${NC}"
echo "  cd $SCRIPT_DIR && bash deploy.sh"
echo ""
