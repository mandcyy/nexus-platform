#!/bin/bash
# Nexus Platform — Quick Deploy to Cloudflare

echo "===================================="
echo " Nexus Platform CF — Quick Deploy"
echo "===================================="
echo ""

if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js not found. Install: pkg install nodejs"
    exit 1
fi

# Get credentials if not set
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "1. Create API Token at: https://dash.cloudflare.com/profile/api-tokens"
    echo "   Required: Workers, D1, R2, KV, Queues permissions"
    read -sp "   API Token: " CLOUDFLARE_API_TOKEN
    echo ""
fi

if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
    echo "2. Find Account ID at: https://dash.cloudflare.com"
    echo "   (Copy from right sidebar under API section)"
    read -p "   Account ID: " CLOUDFLARE_ACCOUNT_ID
fi

if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
fi

export CLOUDFLARE_API_TOKEN CLOUDFLARE_ACCOUNT_ID JWT_SECRET

echo ""
echo "Deploying..."
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node "$SCRIPT_DIR/cf-deploy.js"

echo ""
echo "Done! Check Cloudflare Dashboard for details."
