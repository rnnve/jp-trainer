import { clerkClient } from "@clerk/nextjs/server";
import { headers as requestHeaders } from "next/headers";
import { accountId } from "./account-session";
import { clerkConfigured } from "./auth-policy";
import {
  apiKeyId,
  applicationKeyHeader,
  applicationKeyToken,
  keyMatches,
  type ApiKeyScope,
  type StoredApiKey,
} from "./api-key-crypto";
import { findStoredKey } from "./api-key-store";
export type AccountPrincipal = {
  userId: string;
  method: "session" | "api-key";
  scope: ApiKeyScope;
  keyId?: string;
};
export async function apiKeyPrincipal(
  token: string,
  find = findStoredKey,
  activeAccount: (id: string) => Promise<boolean> = async (id) => {
    if (!clerkConfigured()) return false;
    try {
      const client = await clerkClient();
      const user = await client.users.getUser(id);
      return !user.banned && !user.locked;
    } catch (error) {
      if ((error as { status?: number }).status === 404) return false;
      throw error;
    }
  },
  now = Date.now(),
): Promise<AccountPrincipal | null> {
  const id = apiKeyId(token);
  if (!id) return null;
  const key: StoredApiKey | null = await find(id);
  if (
    !key ||
    !keyMatches(token, key, now) ||
    !(await activeAccount(key.userId))
  )
    return null;
  return {
    userId: key.userId,
    method: "api-key",
    scope: key.scope,
    keyId: key.id,
  };
}
export async function accountPrincipal(
  request?: Request,
): Promise<AccountPrincipal | null> {
  const headers = request?.headers ?? (await requestHeaders());
  if (applicationKeyHeader(headers)) {
    const token = applicationKeyToken(headers);
    return token ? apiKeyPrincipal(token) : null;
  }
  const userId = await accountId();
  return userId ? { userId, method: "session", scope: "read-write" } : null;
}
