export interface Env {
  USER_DB_AUTH: string;
  USER_DB: KVNamespace;
  STRIAE_DATA: R2Bucket;
  STRIAE_FILES: R2Bucket;
  R2_KEY_SECRET: string;
  IMAGES_API_TOKEN?: string;
  DATA_WORKER_DOMAIN?: string;
  IMAGES_WORKER_DOMAIN?: string;
  AUDIT_WORKER_DOMAIN?: string;
  PROJECT_ID: string;
  FIREBASE_SERVICE_ACCOUNT_EMAIL: string;
  FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY: string;
  USER_KV_ENCRYPTION_PRIVATE_KEY: string;
  USER_KV_ENCRYPTION_PUBLIC_KEY: string;
  USER_KV_ENCRYPTION_KEY_ID: string;
  USER_KV_ENCRYPTION_KEYS_JSON?: string;
  USER_KV_ENCRYPTION_ACTIVE_KEY_ID?: string;
}

export interface KeyRegistryPayload {
  activeKeyId?: unknown;
  keys?: unknown;
}

export interface PrivateKeyRegistry {
  activeKeyId: string | null;
  keys: Record<string, string>;
}

export type DecryptionTelemetryOutcome = 'primary-hit' | 'fallback-hit' | 'all-failed';

export interface CaseItem {
  caseNumber: string;
  caseName?: string;
  [key: string]: unknown;
}

export interface ReadOnlyCaseItem {
  caseNumber: string;
  caseName?: string;
  [key: string]: unknown;
}

export interface UserData {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  badgeId?: string;
  permitted: boolean;
  cases: CaseItem[];
  readOnlyCases?: ReadOnlyCaseItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UserRequestData {
  email?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  badgeId?: string;
  permitted?: boolean;
  readOnlyCases?: ReadOnlyCaseItem[];
}

export interface AddCasesRequest {
  cases: CaseItem[];
}

export interface DeleteCasesRequest {
  casesToDelete: string[];
}

export interface AccountDeletionProgressEvent {
  event: 'start' | 'case-start' | 'case-complete' | 'complete' | 'error';
  totalCases: number;
  completedCases: number;
  currentCaseNumber?: string;
  success?: boolean;
  message?: string;
}

export interface GoogleOAuthTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export interface FirebaseDeleteAccountErrorResponse {
  error?: {
    message?: string;
  };
}

export type ResponseHeaders = Record<string, string>;