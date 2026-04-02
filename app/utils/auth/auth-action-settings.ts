import type { ActionCodeSettings } from 'firebase/auth';
import paths from '~/config/config.json';

const AUTH_ROUTE_PATH = '/';
const DEFAULT_CONTINUE_PATH = '/';
const POST_ACTION_RETURN_PARAM = 'postActionReturn';
const POST_ACTION_EXPIRES_PARAM = 'postActionExpiresAt';
const POST_ACTION_SIGNATURE_PARAM = 'postActionSig';
const SIGNED_STATE_TTL_SECONDS = 900;
const RETURN_STATE_ENDPOINT = '/api/auth/return-state';

const normalizedBaseUrl = paths.url.replace(/\/$/, '');
const appOrigin = new URL(normalizedBaseUrl).origin;
const normalizedAuthActionUrl = (paths.auth_action_url ?? normalizedBaseUrl).replace(/\/$/, '');
const authActionOrigin = new URL(normalizedAuthActionUrl).origin;
const allowedRootHostname = new URL(authActionOrigin).hostname.toLowerCase();

export interface SafeContinueDestination {
  path: string;
  url: string;
  isCrossOrigin: boolean;
  isDefault: boolean;
}

interface SignReturnStateResponse {
  returnUrl: string;
  expiresAt: number;
  signature: string;
}

interface VerifyReturnStateResponse {
  valid: boolean;
}

const getCurrentOrigin = (): string => {
  if (typeof window === 'undefined' || !window.location?.origin) {
    return appOrigin;
  }

  return window.location.origin;
};

const isAllowedReturnUrl = (url: URL): boolean => {
  if (url.protocol !== 'https:') {
    return false;
  }

  const hostname = url.hostname.toLowerCase();
  return hostname === allowedRootHostname || hostname.endsWith(`.${allowedRootHostname}`);
};

const normalizeContinuePath = (continuePath?: string): string => {
  if (!continuePath || continuePath.trim().length === 0) {
    return DEFAULT_CONTINUE_PATH;
  }

  if (!continuePath.startsWith('/') || continuePath.startsWith('//')) {
    return DEFAULT_CONTINUE_PATH;
  }

  return continuePath;
};

const getDefaultDestination = (): SafeContinueDestination => {
  const currentOrigin = getCurrentOrigin();
  const defaultUrl = new URL(DEFAULT_CONTINUE_PATH, currentOrigin).toString();

  return {
    path: DEFAULT_CONTINUE_PATH,
    url: defaultUrl,
    isCrossOrigin: false,
    isDefault: true,
  };
};

const getPostActionReturnUrl = (continuePath?: string): string => {
  const safeContinuePath = normalizeContinuePath(continuePath);
  const currentOrigin = getCurrentOrigin();

  try {
    const currentUrl = new URL(currentOrigin);
    if (!isAllowedReturnUrl(currentUrl)) {
      return `${appOrigin}${safeContinuePath}`;
    }

    return `${currentUrl.origin}${safeContinuePath}`;
  } catch {
    return `${appOrigin}${safeContinuePath}`;
  }
};

const parseNumericTimestamp = (value: string | null): number => {
  if (!value) {
    return Number.NaN;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const requestSignedReturnState = async (returnUrl: string): Promise<SignReturnStateResponse> => {
  const response = await fetch(RETURN_STATE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      mode: 'sign',
      returnUrl,
      ttlSeconds: SIGNED_STATE_TTL_SECONDS,
    }),
  });

  if (!response.ok) {
    throw new Error('Unable to sign email action return state.');
  }

  const payload = await response.json() as Partial<SignReturnStateResponse>;
  if (
    typeof payload.returnUrl !== 'string' ||
    typeof payload.signature !== 'string' ||
    typeof payload.expiresAt !== 'number'
  ) {
    throw new Error('Invalid signed return state response.');
  }

  return {
    returnUrl: payload.returnUrl,
    signature: payload.signature,
    expiresAt: payload.expiresAt,
  };
};

const verifySignedReturnState = async (
  returnUrl: string,
  expiresAt: number,
  signature: string
): Promise<boolean> => {
  const response = await fetch(RETURN_STATE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify({
      mode: 'verify',
      returnUrl,
      expiresAt,
      signature,
    }),
  });

  if (!response.ok) {
    return false;
  }

  const payload = await response.json() as Partial<VerifyReturnStateResponse>;
  return payload.valid === true;
};

const toSafeDestination = (destinationUrl: URL): SafeContinueDestination => {
  const currentOrigin = getCurrentOrigin();
  const defaultUrl = new URL(DEFAULT_CONTINUE_PATH, currentOrigin).toString();
  const safePath = `${destinationUrl.pathname}${destinationUrl.search}${destinationUrl.hash}`;
  const normalizedPath = safePath.startsWith('/') ? safePath : DEFAULT_CONTINUE_PATH;
  const destination = destinationUrl.toString();

  return {
    path: normalizedPath,
    url: destination,
    isCrossOrigin: destinationUrl.origin !== currentOrigin,
    isDefault: destination === defaultUrl,
  };
};

const extractDestinationUrl = (continueUrl: string): URL | null => {
  const parsedContinueUrl = new URL(continueUrl, authActionOrigin);
  const postActionReturn = parsedContinueUrl.searchParams.get(POST_ACTION_RETURN_PARAM);

  if (postActionReturn && postActionReturn.trim().length > 0) {
    return new URL(postActionReturn);
  }

  // Legacy fallback for previously issued links that only contain same-origin continue targets.
  if (parsedContinueUrl.origin === appOrigin) {
    return parsedContinueUrl;
  }

  return null;
};

export const buildActionCodeSettings = async (continuePath?: string): Promise<ActionCodeSettings> => {
  const actionUrl = new URL(getAuthActionRoutePath(), authActionOrigin);
  const returnUrl = getPostActionReturnUrl(continuePath);
  const signedState = await requestSignedReturnState(returnUrl);

  actionUrl.searchParams.set(POST_ACTION_RETURN_PARAM, signedState.returnUrl);
  actionUrl.searchParams.set(POST_ACTION_EXPIRES_PARAM, String(signedState.expiresAt));
  actionUrl.searchParams.set(POST_ACTION_SIGNATURE_PARAM, signedState.signature);

  return {
    url: actionUrl.toString(),
  };
};

export const getSafeContinueDestination = async (continueUrl: string | null | undefined): Promise<SafeContinueDestination> => {
  const defaultDestination = getDefaultDestination();

  if (!continueUrl || continueUrl.trim().length === 0) {
    return defaultDestination;
  }

  try {
    const parsedContinueUrl = new URL(continueUrl, authActionOrigin);
    const postActionReturn = parsedContinueUrl.searchParams.get(POST_ACTION_RETURN_PARAM);
    const postActionExpiresAt = parseNumericTimestamp(parsedContinueUrl.searchParams.get(POST_ACTION_EXPIRES_PARAM));
    const postActionSignature = parsedContinueUrl.searchParams.get(POST_ACTION_SIGNATURE_PARAM);

    if (postActionReturn && postActionSignature && Number.isFinite(postActionExpiresAt)) {
      const destinationUrl = new URL(postActionReturn);
      if (!isAllowedReturnUrl(destinationUrl)) {
        return defaultDestination;
      }

      if (postActionExpiresAt <= Date.now()) {
        return defaultDestination;
      }

      const validSignature = await verifySignedReturnState(postActionReturn, postActionExpiresAt, postActionSignature);
      if (!validSignature) {
        return defaultDestination;
      }

      return toSafeDestination(destinationUrl);
    }

    // Legacy fallback for old links without signed return state.
    const destinationUrl = extractDestinationUrl(continueUrl);
    if (!destinationUrl || !isAllowedReturnUrl(destinationUrl)) {
      return defaultDestination;
    }

    return toSafeDestination(destinationUrl);
  } catch {
    return defaultDestination;
  }
};

export const getSafeContinuePath = (continueUrl: string | null | undefined): string => {
  void continueUrl;
  return DEFAULT_CONTINUE_PATH;
};

export const getAuthActionRoutePath = (): string => AUTH_ROUTE_PATH;
