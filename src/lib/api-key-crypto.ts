import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
export type ApiKeyScope = "read" | "read-write";
export type StoredApiKey = {
  id: string;
  userId: string;
  name: string;
  prefix: string;
  secretHash: string;
  scope: ApiKeyScope;
  createdAt: number;
  expiresAt: number;
  revokedAt: number | null;
  rotatedAt: number | null;
  version: number;
};
export type ApiKeyMetadata = {
  id: string;
  name: string;
  prefix: string;
  scope: ApiKeyScope;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  rotatedAt: string | null;
  version: number;
};
export const API_KEY_LIMIT = 10;
export function keyHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function apiKeyId(token: string) {
  return /^kt_live_([0-9a-f]{32})_[A-Za-z0-9_-]{43}$/.exec(token)?.[1] ?? null;
}
export function newKeyMaterial(id = randomBytes(16).toString("hex")) {
  const token = `kt_live_${id}_${randomBytes(32).toString("base64url")}`;
  return {
    id,
    token,
    secretHash: keyHash(token),
    prefix: `kt_live_${id.slice(0, 8)}…`,
  };
}
export function keyIsActive(key: StoredApiKey, now = Date.now()) {
  return key.revokedAt === null && key.expiresAt > now;
}
export function keyMatches(token: string, key: StoredApiKey, now = Date.now()) {
  if (
    apiKeyId(token) !== key.id ||
    !keyIsActive(key, now) ||
    !/^[0-9a-f]{64}$/.test(key.secretHash)
  )
    return false;
  return timingSafeEqual(
    Buffer.from(keyHash(token), "hex"),
    Buffer.from(key.secretHash, "hex"),
  );
}
export function keyMetadata(key: StoredApiKey): ApiKeyMetadata {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    scope: key.scope,
    createdAt: new Date(key.createdAt).toISOString(),
    expiresAt: new Date(key.expiresAt).toISOString(),
    revokedAt:
      key.revokedAt === null ? null : new Date(key.revokedAt).toISOString(),
    rotatedAt:
      key.rotatedAt === null ? null : new Date(key.rotatedAt).toISOString(),
    version: key.version,
  };
}
export function applicationKeyHeader(headers: Headers): boolean {
  return (
    headers.has("x-api-key") ||
    /^Bearer\s+kt_/i.test(headers.get("authorization") ?? "")
  );
}
export function applicationKeyToken(headers: Headers): string | null {
  if (headers.has("x-api-key"))
    return headers.has("authorization") ? null : headers.get("x-api-key");
  return (
    /^Bearer\s+(kt_\S+)$/i.exec(headers.get("authorization") ?? "")?.[1] ?? null
  );
}
