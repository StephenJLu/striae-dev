#!/bin/bash

# ======================================
# STRIAE PAGES SECRETS DEPLOYMENT SCRIPT
# ======================================
# This script deploys required secrets to Cloudflare Pages environments.

set -e
set -o pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Striae Pages Secrets Deployment Script${NC}"
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

trap 'echo -e "\n${RED}❌ deploy-pages-secrets.sh failed near line ${LINENO}${NC}"' ERR

require_command() {
    local cmd=$1
    if ! command -v "$cmd" > /dev/null 2>&1; then
        echo -e "${RED}❌ Error: required command '$cmd' is not installed or not in PATH${NC}"
        exit 1
    fi
}

strip_carriage_returns() {
    printf '%s' "$1" | tr -d '\r'
}

is_placeholder() {
    local value="$1"
    local normalized

    normalized=$(echo "$value" | tr '[:upper:]' '[:lower:]')

    if [ -z "$normalized" ]; then
        return 0
    fi

    [[ "$normalized" == your_*_here ]]
}

load_required_project_id() {
    local admin_service_path="app/config/admin-service.json"
    local service_project_id

    if [ ! -f "$admin_service_path" ]; then
        echo -e "${RED}❌ Error: Required Firebase admin service file not found: $admin_service_path${NC}"
        echo -e "${YELLOW}   Create app/config/admin-service.json before deploying Pages secrets.${NC}"
        exit 1
    fi

    if ! service_project_id=$(node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); process.stdout.write(data.project_id || '');" "$admin_service_path"); then
        echo -e "${RED}❌ Error: Could not parse project_id from $admin_service_path${NC}"
        exit 1
    fi

    service_project_id=$(strip_carriage_returns "$service_project_id")

    if [ -z "$service_project_id" ] || is_placeholder "$service_project_id"; then
        echo -e "${RED}❌ Error: project_id in $admin_service_path is missing or placeholder${NC}"
        exit 1
    fi

    PROJECT_ID="$service_project_id"
    export PROJECT_ID

    echo -e "${GREEN}✅ Loaded PROJECT_ID from $admin_service_path${NC}"
}

get_required_value() {
    local var_name=$1
    local value="${!var_name}"

    value=$(strip_carriage_returns "$value")

    if [ -z "$value" ] || is_placeholder "$value"; then
        echo -e "${RED}❌ Error: required value for $var_name is missing or placeholder${NC}" >&2
        exit 1
    fi

    printf '%s' "$value"
}

get_optional_value() {
    local var_name=$1
    local value="${!var_name}"

    value=$(strip_carriage_returns "$value")

    if [ -z "$value" ] || is_placeholder "$value"; then
        printf ''
        return 0
    fi

    printf '%s' "$value"
}

deploy_pages_secrets() {
    local secret
    local secret_value

    echo -e "\n${BLUE}🔧 Deploying Pages secrets to production...${NC}"

    for secret in "${required_pages_secrets[@]}"; do
        secret_value=$(get_required_value "$secret")
        echo -e "${YELLOW}  Setting $secret...${NC}"
        printf '%s' "$secret_value" | wrangler pages secret put "$secret" --project-name "$PAGES_PROJECT_NAME"
    done

    local optional_primershear_emails
    optional_primershear_emails=$(get_optional_value "PRIMERSHEAR_EMAILS")
    echo -e "${YELLOW}  Setting PRIMERSHEAR_EMAILS...${NC}"
    printf '%s' "$optional_primershear_emails" | wrangler pages secret put "PRIMERSHEAR_EMAILS" --project-name "$PAGES_PROJECT_NAME"

    local optional_registration_emails
    optional_registration_emails=$(get_optional_value "REGISTRATION_EMAILS")
    echo -e "${YELLOW}  Setting REGISTRATION_EMAILS...${NC}"
    printf '%s' "$optional_registration_emails" | wrangler pages secret put "REGISTRATION_EMAILS" --project-name "$PAGES_PROJECT_NAME"

    echo -e "${GREEN}✅ Pages secrets deployed to production${NC}"
}

require_command wrangler
require_command node

if [ ! -f ".env" ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo -e "${YELLOW}   Run deploy-config first to generate and populate .env.${NC}"
    exit 1
fi

echo -e "${YELLOW}📖 Loading environment variables from .env...${NC}"
source .env

load_required_project_id

PAGES_PROJECT_NAME=$(strip_carriage_returns "$PAGES_PROJECT_NAME")
if [ -z "$PAGES_PROJECT_NAME" ] || is_placeholder "$PAGES_PROJECT_NAME"; then
    echo -e "${RED}❌ Error: PAGES_PROJECT_NAME is missing or placeholder in .env${NC}"
    exit 1
fi

required_pages_secrets=(
    "AUDIT_WORKER_DOMAIN"
    "DATA_WORKER_DOMAIN"
    "IMAGES_API_TOKEN"
    "IMAGES_WORKER_DOMAIN"
    "PDF_WORKER_AUTH"
    "PDF_WORKER_DOMAIN"
    "PROJECT_ID"
    "R2_KEY_SECRET"
    "USER_DB_AUTH"
    "USER_WORKER_DOMAIN"
)

echo -e "${YELLOW}🔍 Validating required Pages secret values...${NC}"
for secret in "${required_pages_secrets[@]}"; do
    get_required_value "$secret" > /dev/null
done
echo -e "${GREEN}✅ Required Pages secret values found${NC}"

deploy_pages_secrets

echo -e "\n${GREEN}🎉 Pages secrets deployment completed!${NC}"
