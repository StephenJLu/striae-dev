#!/bin/bash

validate_data_at_rest_encryption_settings() {
    local enabled_normalized
    enabled_normalized=$(printf '%s' "${DATA_AT_REST_ENCRYPTION_ENABLED:-false}" | tr '[:upper:]' '[:lower:]')

    if [ "$enabled_normalized" = "1" ] || [ "$enabled_normalized" = "true" ] || [ "$enabled_normalized" = "yes" ] || [ "$enabled_normalized" = "on" ]; then
        if [ -z "$DATA_AT_REST_ENCRYPTION_PRIVATE_KEY" ] || is_placeholder "$DATA_AT_REST_ENCRYPTION_PRIVATE_KEY"; then
            echo -e "${RED}❌ Error: DATA_AT_REST_ENCRYPTION_PRIVATE_KEY is required when DATA_AT_REST_ENCRYPTION_ENABLED is true${NC}"
            exit 1
        fi

        if [ -z "$DATA_AT_REST_ENCRYPTION_PUBLIC_KEY" ] || is_placeholder "$DATA_AT_REST_ENCRYPTION_PUBLIC_KEY"; then
            echo -e "${RED}❌ Error: DATA_AT_REST_ENCRYPTION_PUBLIC_KEY is required when DATA_AT_REST_ENCRYPTION_ENABLED is true${NC}"
            exit 1
        fi

        if [ -z "$DATA_AT_REST_ENCRYPTION_KEY_ID" ] || is_placeholder "$DATA_AT_REST_ENCRYPTION_KEY_ID"; then
            echo -e "${RED}❌ Error: DATA_AT_REST_ENCRYPTION_KEY_ID is required when DATA_AT_REST_ENCRYPTION_ENABLED is true${NC}"
            exit 1
        fi
    fi
}

validate_user_kv_encryption_settings() {
    if [ -z "$USER_KV_ENCRYPTION_PRIVATE_KEY" ] || is_placeholder "$USER_KV_ENCRYPTION_PRIVATE_KEY"; then
        echo -e "${RED}❌ Error: USER_KV_ENCRYPTION_PRIVATE_KEY is required${NC}"
        exit 1
    fi

    if [ -z "$USER_KV_ENCRYPTION_PUBLIC_KEY" ] || is_placeholder "$USER_KV_ENCRYPTION_PUBLIC_KEY"; then
        echo -e "${RED}❌ Error: USER_KV_ENCRYPTION_PUBLIC_KEY is required${NC}"
        exit 1
    fi

    if [ -z "$USER_KV_ENCRYPTION_KEY_ID" ] || is_placeholder "$USER_KV_ENCRYPTION_KEY_ID"; then
        echo -e "${RED}❌ Error: USER_KV_ENCRYPTION_KEY_ID is required${NC}"
        exit 1
    fi
}

# Validate required variables
required_vars=(
    # Core Cloudflare Configuration
    "ACCOUNT_ID"

    # Shared Authentication & Storage
    "USER_DB_AUTH"
    "R2_KEY_SECRET"
    "IMAGES_API_TOKEN"

    # Firebase Auth Configuration
    "API_KEY"
    "AUTH_DOMAIN"
    "PROJECT_ID"
    "STORAGE_BUCKET"
    "MESSAGING_SENDER_ID"
    "APP_ID"
    "MEASUREMENT_ID"
    "FIREBASE_SERVICE_ACCOUNT_EMAIL"
    "FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY"

    # Pages Configuration
    "PAGES_PROJECT_NAME"
    "PAGES_CUSTOM_DOMAIN"

    # Worker Names (required for config replacement)
    "KEYS_WORKER_NAME"
    "USER_WORKER_NAME"
    "DATA_WORKER_NAME"
    "AUDIT_WORKER_NAME"
    "IMAGES_WORKER_NAME"
    "PDF_WORKER_NAME"

    # Worker Domains (required for proxy/env secrets and worker fallbacks)
    "KEYS_WORKER_DOMAIN"
    "USER_WORKER_DOMAIN"
    "DATA_WORKER_DOMAIN"
    "AUDIT_WORKER_DOMAIN"
    "IMAGES_WORKER_DOMAIN"
    "PDF_WORKER_DOMAIN"

    # Storage Configuration (required for config replacement)
    "DATA_BUCKET_NAME"
    "AUDIT_BUCKET_NAME"
    "FILES_BUCKET_NAME"
    "KV_STORE_ID"
    "USER_KV_ENCRYPTION_PRIVATE_KEY"
    "USER_KV_ENCRYPTION_KEY_ID"
    "USER_KV_ENCRYPTION_PUBLIC_KEY"

    # Worker-Specific Secrets (required for deployment)
    "KEYS_AUTH"
    "PDF_WORKER_AUTH"
    "IMAGE_SIGNED_URL_SECRET"
    "BROWSER_API_TOKEN"
    "MANIFEST_SIGNING_PRIVATE_KEY"
    "MANIFEST_SIGNING_KEY_ID"
    "MANIFEST_SIGNING_PUBLIC_KEY"
    "EXPORT_ENCRYPTION_PRIVATE_KEY"
    "EXPORT_ENCRYPTION_KEY_ID"
    "EXPORT_ENCRYPTION_PUBLIC_KEY"
)

validate_required_vars() {
    echo -e "${YELLOW}🔍 Validating required environment variables...${NC}"
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ] || is_placeholder "${!var}"; then
            echo -e "${RED}❌ Error: $var is not set in .env file or is a placeholder${NC}"
            exit 1
        fi
    done
    echo -e "${GREEN}✅ All required variables found${NC}"
}

assert_file_exists() {
    local file_path=$1

    if [ ! -f "$file_path" ]; then
        echo -e "${RED}❌ Error: required file is missing: $file_path${NC}"
        exit 1
    fi
}

assert_contains_literal() {
    local file_path=$1
    local literal=$2
    local description=$3

    if ! grep -Fq -- "$literal" "$file_path"; then
        echo -e "${RED}❌ Error: ${description}${NC}"
        echo -e "${YELLOW}   Expected to find '$literal' in $file_path${NC}"
        exit 1
    fi
}

assert_no_match_in_file() {
    local file_path=$1
    local pattern=$2
    local description=$3
    local matches

    matches=$(grep -En "$pattern" "$file_path" | head -n 3 || true)
    if [ -n "$matches" ]; then
        echo -e "${RED}❌ Error: ${description}${NC}"
        echo -e "${YELLOW}   First matching lines in $file_path:${NC}"
        echo "$matches"
        exit 1
    fi
}

validate_json_file() {
    local file_path=$1

    if ! node -e "const fs=require('fs'); JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));" "$file_path" > /dev/null 2>&1; then
        echo -e "${RED}❌ Error: invalid JSON in $file_path${NC}"
        exit 1
    fi
}

validate_domain_var() {
    local var_name=$1
    local value="${!var_name}"
    local normalized

    value=$(strip_carriage_returns "$value")
    normalized=$(normalize_domain_value "$value")

    if [ -z "$value" ] || is_placeholder "$value"; then
        echo -e "${RED}❌ Error: $var_name is missing or placeholder${NC}"
        exit 1
    fi

    if [ "$value" != "$normalized" ]; then
        echo -e "${RED}❌ Error: $var_name must not include protocol, trailing slash, or surrounding whitespace${NC}"
        echo -e "${YELLOW}   Use '$normalized' instead${NC}"
        exit 1
    fi

    if [[ "$value" == */* ]]; then
        echo -e "${RED}❌ Error: $var_name must be a bare domain (no path segments)${NC}"
        exit 1
    fi
}

validate_env_value_formats() {
    echo -e "${YELLOW}🔍 Validating environment value formats...${NC}"

    validate_domain_var "PAGES_CUSTOM_DOMAIN"
    validate_domain_var "KEYS_WORKER_DOMAIN"
    validate_domain_var "USER_WORKER_DOMAIN"
    validate_domain_var "DATA_WORKER_DOMAIN"
    validate_domain_var "AUDIT_WORKER_DOMAIN"
    validate_domain_var "IMAGES_WORKER_DOMAIN"
    validate_domain_var "PDF_WORKER_DOMAIN"

    if ! [[ "$KV_STORE_ID" =~ ^([0-9a-fA-F]{32}|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$ ]]; then
        echo -e "${RED}❌ Error: KV_STORE_ID must be a 32-character hex namespace ID (or UUID format)${NC}"
        exit 1
    fi

    if [[ "$ACCOUNT_ID" =~ [[:space:]] ]]; then
        echo -e "${RED}❌ Error: ACCOUNT_ID must not contain whitespace${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Environment value formats look valid${NC}"
}

validate_env_file_entries() {
    local var_name
    local escaped_var_name
    local count

    echo -e "${YELLOW}🔍 Verifying required .env entries...${NC}"
    for var_name in "${required_vars[@]}"; do
        escaped_var_name=$(escape_for_sed_pattern "$var_name")
        count=$(grep -c "^$escaped_var_name=" .env || true)

        if [ "$count" -lt 1 ]; then
            echo -e "${RED}❌ Error: missing .env entry for $var_name${NC}"
            exit 1
        fi
    done
    echo -e "${GREEN}✅ Required .env entries found${NC}"
}

validate_generated_configs() {
    echo -e "${YELLOW}🔍 Running generated configuration checkpoint validations...${NC}"

    local required_files=(
        "wrangler.toml"
        "app/config/config.json"
        "app/config/firebase.ts"
        "app/config/admin-service.json"
        "app/routes/auth/login.tsx"
        "app/routes/auth/login.module.css"
        "workers/audit-worker/wrangler.jsonc"
        "workers/data-worker/wrangler.jsonc"
        "workers/image-worker/wrangler.jsonc"
        "workers/keys-worker/wrangler.jsonc"
        "workers/pdf-worker/wrangler.jsonc"
        "workers/user-worker/wrangler.jsonc"
        "workers/audit-worker/src/audit-worker.ts"
        "workers/data-worker/src/data-worker.ts"
        "workers/image-worker/src/image-worker.ts"
        "workers/keys-worker/src/keys.ts"
        "workers/pdf-worker/src/pdf-worker.ts"
        "workers/user-worker/src/user-worker.ts"
    )

    local file_path
    for file_path in "${required_files[@]}"; do
        assert_file_exists "$file_path"
    done

    validate_json_file "app/config/config.json"
    validate_json_file "app/config/admin-service.json"

    assert_contains_literal "wrangler.toml" "\"$PAGES_PROJECT_NAME\"" "PAGES_PROJECT_NAME was not applied to wrangler.toml"

    assert_contains_literal "workers/keys-worker/wrangler.jsonc" "$KEYS_WORKER_NAME" "KEYS_WORKER_NAME was not applied"
    assert_contains_literal "workers/user-worker/wrangler.jsonc" "$USER_WORKER_NAME" "USER_WORKER_NAME was not applied"
    assert_contains_literal "workers/data-worker/wrangler.jsonc" "$DATA_WORKER_NAME" "DATA_WORKER_NAME was not applied"
    assert_contains_literal "workers/audit-worker/wrangler.jsonc" "$AUDIT_WORKER_NAME" "AUDIT_WORKER_NAME was not applied"
    assert_contains_literal "workers/image-worker/wrangler.jsonc" "$IMAGES_WORKER_NAME" "IMAGES_WORKER_NAME was not applied"
    assert_contains_literal "workers/pdf-worker/wrangler.jsonc" "$PDF_WORKER_NAME" "PDF_WORKER_NAME was not applied"

    assert_contains_literal "workers/keys-worker/wrangler.jsonc" "$ACCOUNT_ID" "ACCOUNT_ID missing in keys worker config"
    assert_contains_literal "workers/user-worker/wrangler.jsonc" "$ACCOUNT_ID" "ACCOUNT_ID missing in user worker config"
    assert_contains_literal "workers/data-worker/wrangler.jsonc" "$ACCOUNT_ID" "ACCOUNT_ID missing in data worker config"
    assert_contains_literal "workers/audit-worker/wrangler.jsonc" "$ACCOUNT_ID" "ACCOUNT_ID missing in audit worker config"
    assert_contains_literal "workers/image-worker/wrangler.jsonc" "$ACCOUNT_ID" "ACCOUNT_ID missing in image worker config"
    assert_contains_literal "workers/pdf-worker/wrangler.jsonc" "$ACCOUNT_ID" "ACCOUNT_ID missing in pdf worker config"

    assert_contains_literal "workers/data-worker/wrangler.jsonc" "$DATA_BUCKET_NAME" "DATA_BUCKET_NAME missing in data worker config"
    assert_contains_literal "workers/audit-worker/wrangler.jsonc" "$AUDIT_BUCKET_NAME" "AUDIT_BUCKET_NAME missing in audit worker config"
    assert_contains_literal "workers/image-worker/wrangler.jsonc" "$FILES_BUCKET_NAME" "FILES_BUCKET_NAME missing in image worker config"
    assert_contains_literal "workers/user-worker/wrangler.jsonc" "$KV_STORE_ID" "KV_STORE_ID missing in user worker config"

    assert_contains_literal "app/config/config.json" "https://$PAGES_CUSTOM_DOMAIN" "PAGES_CUSTOM_DOMAIN missing in app/config/config.json"
    assert_contains_literal "app/config/config.json" "$EXPORT_ENCRYPTION_KEY_ID" "EXPORT_ENCRYPTION_KEY_ID missing in app/config/config.json"
    assert_contains_literal "app/config/config.json" "\"export_encryption_public_key\":" "export_encryption_public_key missing in app/config/config.json"
    assert_contains_literal "app/routes/auth/login.tsx" "const APP_CANONICAL_ORIGIN = 'https://$PAGES_CUSTOM_DOMAIN';" "PAGES_CUSTOM_DOMAIN missing in app/routes/auth/login.tsx canonical origin"

    assert_contains_literal "app/config/firebase.ts" "$API_KEY" "API_KEY missing in app/config/firebase.ts"
    assert_contains_literal "app/config/firebase.ts" "$AUTH_DOMAIN" "AUTH_DOMAIN missing in app/config/firebase.ts"
    assert_contains_literal "app/config/firebase.ts" "$PROJECT_ID" "PROJECT_ID missing in app/config/firebase.ts"
    assert_contains_literal "app/config/firebase.ts" "$STORAGE_BUCKET" "STORAGE_BUCKET missing in app/config/firebase.ts"
    assert_contains_literal "app/config/firebase.ts" "$MESSAGING_SENDER_ID" "MESSAGING_SENDER_ID missing in app/config/firebase.ts"
    assert_contains_literal "app/config/firebase.ts" "$APP_ID" "APP_ID missing in app/config/firebase.ts"
    assert_contains_literal "app/config/firebase.ts" "$MEASUREMENT_ID" "MEASUREMENT_ID missing in app/config/firebase.ts"

    assert_contains_literal "workers/audit-worker/src/audit-worker.ts" "https://$PAGES_CUSTOM_DOMAIN" "PAGES_CUSTOM_DOMAIN missing in audit-worker source"
    assert_contains_literal "workers/data-worker/src/data-worker.ts" "https://$PAGES_CUSTOM_DOMAIN" "PAGES_CUSTOM_DOMAIN missing in data-worker source"
    assert_contains_literal "workers/image-worker/src/image-worker.ts" "https://$PAGES_CUSTOM_DOMAIN" "PAGES_CUSTOM_DOMAIN missing in image-worker source"
    assert_contains_literal "workers/keys-worker/src/keys.ts" "https://$PAGES_CUSTOM_DOMAIN" "PAGES_CUSTOM_DOMAIN missing in keys-worker source"
    assert_contains_literal "workers/pdf-worker/src/pdf-worker.ts" "https://$PAGES_CUSTOM_DOMAIN" "PAGES_CUSTOM_DOMAIN missing in pdf-worker source"
    assert_contains_literal "workers/user-worker/src/user-worker.ts" "https://$PAGES_CUSTOM_DOMAIN" "PAGES_CUSTOM_DOMAIN missing in user-worker source"

    local placeholder_pattern
    placeholder_pattern="(\"(ACCOUNT_ID|PAGES_PROJECT_NAME|PAGES_CUSTOM_DOMAIN|KEYS_WORKER_NAME|USER_WORKER_NAME|DATA_WORKER_NAME|AUDIT_WORKER_NAME|IMAGES_WORKER_NAME|PDF_WORKER_NAME|KEYS_WORKER_DOMAIN|USER_WORKER_DOMAIN|DATA_WORKER_DOMAIN|AUDIT_WORKER_DOMAIN|IMAGES_WORKER_DOMAIN|PDF_WORKER_DOMAIN|DATA_BUCKET_NAME|AUDIT_BUCKET_NAME|FILES_BUCKET_NAME|KV_STORE_ID|MANIFEST_SIGNING_KEY_ID|MANIFEST_SIGNING_PUBLIC_KEY|EXPORT_ENCRYPTION_KEY_ID|EXPORT_ENCRYPTION_PUBLIC_KEY|YOUR_FIREBASE_API_KEY|YOUR_FIREBASE_AUTH_DOMAIN|YOUR_FIREBASE_PROJECT_ID|YOUR_FIREBASE_STORAGE_BUCKET|YOUR_FIREBASE_MESSAGING_SENDER_ID|YOUR_FIREBASE_APP_ID|YOUR_FIREBASE_MEASUREMENT_ID)\"|'(PAGES_CUSTOM_DOMAIN|DATA_WORKER_DOMAIN|IMAGES_WORKER_DOMAIN)')"

    local files_to_scan=(
        "wrangler.toml"
        "workers/audit-worker/wrangler.jsonc"
        "workers/data-worker/wrangler.jsonc"
        "workers/image-worker/wrangler.jsonc"
        "workers/keys-worker/wrangler.jsonc"
        "workers/pdf-worker/wrangler.jsonc"
        "workers/user-worker/wrangler.jsonc"
        "workers/audit-worker/src/audit-worker.ts"
        "workers/data-worker/src/data-worker.ts"
        "workers/image-worker/src/image-worker.ts"
        "workers/keys-worker/src/keys.ts"
        "workers/pdf-worker/src/pdf-worker.ts"
        "workers/user-worker/src/user-worker.ts"
        "app/config/config.json"
        "app/config/firebase.ts"
        "app/routes/auth/login.tsx"
    )

    for file_path in "${files_to_scan[@]}"; do
        assert_no_match_in_file "$file_path" "$placeholder_pattern" "Unresolved placeholder token found after config update"
    done

    echo -e "${GREEN}✅ Generated configuration checkpoint validation passed${NC}"
}

run_validation_checkpoint() {
    validate_required_vars
    validate_env_value_formats
    validate_env_file_entries
    validate_data_at_rest_encryption_settings
    validate_user_kv_encryption_settings
    validate_generated_configs
}
