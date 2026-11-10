import { accountId } from "./account-session";
import { sameAppOrigin } from "./auth-policy";
import {
  applicationKeyHeader,
  keyMetadata,
  newKeyMaterial,
  type StoredApiKey,
  type ApiKeyScope,
} from "./api-key-crypto";
import {
  insertStoredKey,
  listStoredKeys,
  revokeStoredKey,
  rotateStoredKey,
  KeyStoreError,
} from "./api-key-store";
export type KeyApiDependencies = {
  session: () => Promise<string | null>;
  list: typeof listStoredKeys;
  insert: typeof insertStoredKey;
  revoke: typeof revokeStoredKey;
  rotate: typeof rotateStoredKey;
  now: () => number;
};
const dependencies: KeyApiDependencies = {
  session: accountId,
  list: listStoredKeys,
  insert: insertStoredKey,
  revoke: revokeStoredKey,
  rotate: rotateStoredKey,
  now: Date.now,
};
const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie, Authorization, X-API-Key",
  "X-Content-Type-Options": "nosniff",
};
const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers });
async function smallJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw Error("body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      throw Error("body");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
}
export function createKeyApi(deps: KeyApiDependencies = dependencies) {
  async function run(
    request: Request,
    mutation: boolean,
    work: (userId: string) => Promise<Response>,
  ) {
    // An application key can never mint, list, revoke, or rotate credentials.
    if (applicationKeyHeader(request.headers))
      return json(
        {
          error:
            "Sign in with Clerk to manage API keys. Application API keys cannot manage credentials.",
        },
        403,
      );
    try {
      const userId = await deps.session();
      if (!userId)
        return json(
          { error: "Unauthorized. Sign in with Clerk to manage API keys." },
          401,
        );
      if (mutation) {
        const origin = request.headers.get("origin"),
          bearer = /^Bearer\s+\S+$/i.test(
            request.headers.get("authorization") ?? "",
          );
        if ((origin && !sameAppOrigin(origin)) || (!origin && !bearer))
          return json({ error: "Invalid origin" }, 403);
      }
      return await work(userId);
    } catch (error) {
      if (error instanceof KeyStoreError)
        return json(
          {
            error:
              error.code === "limit"
                ? "You already have 10 active keys. Revoke one before creating another."
                : error.code === "inactive"
                  ? "Expired or revoked keys cannot be rotated. Create a new key."
                  : error.code === "conflict"
                    ? "This key was already rotated. Reload the key list before trying again."
                    : "Key not found.",
          },
          error.code === "not-found" ? 404 : 409,
        );
      return json({ error: "API key service unavailable." }, 503);
    }
  }
  return {
    list: (request: Request) =>
      run(request, false, async (userId) =>
        json({ data: (await deps.list(userId)).map(keyMetadata) }),
      ),
    create: (request: Request) =>
      run(request, true, async (userId) => {
        let body: Record<string, unknown>;
        try {
          body = await smallJson(request);
        } catch {
          return json({ error: "Expected a JSON object up to 4 KB." }, 400);
        }
        if (!body || typeof body !== "object" || Array.isArray(body))
          return json({ error: "Invalid key options." }, 400);
        const name = typeof body.name === "string" ? body.name.trim() : "",
          scope = body.scope ?? "read",
          days = body.expiresInDays ?? 90;
        if (
          !name ||
          name.length > 64 ||
          /[\u0000-\u001f\u007f]/.test(name) ||
          !["read", "read-write"].includes(scope as string) ||
          typeof days !== "number" ||
          !Number.isInteger(days) ||
          days < 1 ||
          days > 365
        )
          return json(
            {
              error:
                "Use a name of 1–64 characters, scope read or read-write, and expiry of 1–365 days.",
            },
            400,
          );
        const material = newKeyMaterial(),
          now = deps.now();
        const key: StoredApiKey = {
          id: material.id,
          userId,
          name,
          prefix: material.prefix,
          secretHash: material.secretHash,
          scope: scope as ApiKeyScope,
          createdAt: now,
          expiresAt: now + days * 86400000,
          revokedAt: null,
          rotatedAt: null,
          version: 1,
        };
        await deps.insert(key);
        return json({ data: keyMetadata(key), key: material.token }, 201);
      }),
    revoke: (request: Request, id: string) =>
      run(request, true, async (userId) => {
        if (!/^[0-9a-f]{32}$/.test(id))
          return json({ error: "Key not found." }, 404);
        await deps.revoke(userId, id, deps.now());
        return json({ revoked: true });
      }),
    rotate: (request: Request, id: string) =>
      run(request, true, async (userId) => {
        if (!/^[0-9a-f]{32}$/.test(id))
          return json({ error: "Key not found." }, 404);
        const match = request.headers.get("if-match");
        if (!match)
          return json(
            {
              error: "If-Match is required. Use the key version from the list.",
            },
            428,
          );
        if (!/^"[1-9]\d*"$/.test(match))
          return json({ error: "Invalid key version." }, 400);
        const version = Number(match.slice(1, -1));
        if (
          !Number.isSafeInteger(version) ||
          version >= Number.MAX_SAFE_INTEGER
        )
          return json({ error: "Invalid key version." }, 400);
        const material = newKeyMaterial(id),
          key = await deps.rotate(
            userId,
            id,
            version,
            material.secretHash,
            deps.now(),
          );
        return json({ data: keyMetadata(key), key: material.token });
      }),
  };
}
export const keyApi = createKeyApi();
