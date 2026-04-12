#!/bin/bash

# ============================================
# MEMBERS EMAIL LIST DEPLOYMENT SCRIPT
# ============================================
# Reads app/config/members.emails, updates REGISTRATION_EMAILS in .env,
# then deploys that secret directly to Cloudflare Pages (production).

set -e
set -o pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}👥 Members Email List Deployment${NC}"
echo "=================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

trap 'echo -e "\n${RED}❌ deploy-members-emails.sh failed near line ${LINENO}${NC}"' ERR

# ── Read emails file ──────────────────────────────────────────────────────────

EMAILS_FILE="$PROJECT_ROOT/app/config/members.emails"

if [ ! -f "$EMAILS_FILE" ]; then
    echo -e "${RED}❌ members.emails not found at: $EMAILS_FILE${NC}"
    echo -e "${YELLOW}   Create it with one email address or @domain.com wildcard per line.${NC}"
    echo -e "${YELLOW}   See app/config-example/members.emails for the format.${NC}"
    exit 1
fi

# Strip comment lines and blank lines, then join with commas
# Use || true to avoid failure if paste gets no input (handles empty file gracefully)
REGISTRATION_EMAILS=$(grep -v '^[[:space:]]*#' "$EMAILS_FILE" | grep -v '^[[:space:]]*$' | paste -sd ',' - || true)

if [ -z "$REGISTRATION_EMAILS" ]; then
    echo -e "${YELLOW}⚠️  members.emails contains no active entries.${NC}"
    echo -e "${YELLOW}   The secret will be set to an empty string, disabling the gateway (open registration).${NC}"
fi

ENTRY_COUNT=$(echo "$REGISTRATION_EMAILS" | tr ',' '\n' | grep -c '[^[:space:]]' || true)
echo -e "${GREEN}✅ Loaded $ENTRY_COUNT entry(ies) from app/config/members.emails${NC}"

# ── Update .env ───────────────────────────────────────────────────────────────

ENV_FILE="$PROJECT_ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
    echo -e "${RED}❌ .env not found. Run deploy-config first.${NC}"
    exit 1
fi

# Replace the REGISTRATION_EMAILS= line in .env (handles both empty and populated values)
if grep -q '^REGISTRATION_EMAILS=' "$ENV_FILE"; then
    # Use a temp file to avoid sed -i portability issues across macOS/Linux
    local_tmp=$(mktemp)
    sed "s|^REGISTRATION_EMAILS=.*|REGISTRATION_EMAILS=${REGISTRATION_EMAILS}|" "$ENV_FILE" > "$local_tmp"
    mv "$local_tmp" "$ENV_FILE"
    echo -e "${GREEN}✅ Updated REGISTRATION_EMAILS in .env${NC}"
else
    echo "" >> "$ENV_FILE"
    echo "REGISTRATION_EMAILS=${REGISTRATION_EMAILS}" >> "$ENV_FILE"
    echo -e "${GREEN}✅ Appended REGISTRATION_EMAILS to .env${NC}"
fi

# ── Deploy to Cloudflare Pages ────────────────────────────────────────────────

if ! command -v wrangler > /dev/null 2>&1; then
    echo -e "${RED}❌ wrangler is not installed or not in PATH${NC}"
    exit 1
fi

source "$ENV_FILE"

PAGES_PROJECT_NAME=$(echo "$PAGES_PROJECT_NAME" | tr -d '\r')
if [ -z "$PAGES_PROJECT_NAME" ]; then
    echo -e "${RED}❌ PAGES_PROJECT_NAME is missing from .env${NC}"
    exit 1
fi

echo -e "${YELLOW}  Setting REGISTRATION_EMAILS for production...${NC}"
printf '%s' "$REGISTRATION_EMAILS" | wrangler pages secret put REGISTRATION_EMAILS \
    --project-name "$PAGES_PROJECT_NAME"

echo -e "${GREEN}✅ REGISTRATION_EMAILS deployed to production${NC}"

# Deploy Pages so the new secret takes effect immediately
echo -e "\n${YELLOW}🚀 Building and deploying Pages to activate new secret...${NC}"

if ! npm run deploy-pages; then
    echo -e "${RED}❌ Pages deployment failed${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Pages deployment complete${NC}"

echo -e "\n${GREEN}🎉 Members email list deployment complete!${NC}"
