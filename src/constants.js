export const AWS_REGION = process.env.REACT_APP_AWS_REGION;
export const IDENTITY_POOL = process.env.REACT_APP_COGNITO_IDENTITY_POOL_ID;
export const IOT_ENDPOINT = process.env.REACT_APP_IOT_ENDPOINT;
export const BASE_URL_LAMBDA = process.env.REACT_APP_BASE_URL_LAMBDA;

// Topics you want to auto-(re)subscribe
export const DEFAULT_TOPICS = ["pump/status"];

// Reconnect/backoff
export const BASE_RECONNECT_MS = 1000;   // min backoff
export const MAX_RECONNECT_MS  = 30000;  // max backoff
export const KEEPALIVE_SEC     = 60;

// Credential refresh cooldown to avoid thrash
export const REFRESH_COOLDOWN_MS = 60_000;