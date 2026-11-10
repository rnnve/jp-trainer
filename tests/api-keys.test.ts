import { expect, test } from "bun:test";
import {
  newKeyMaterial,
  keyMatches,
  keyMetadata,
  applicationKeyHeader,
  applicationKeyToken,
  type StoredApiKey,
} from "../src/lib/api-key-crypto";
import { apiKeyPrincipal } from "../src/lib/account-principal";
import { createKeyApi, type KeyApiDependencies } from "../src/lib/api-key-api";
import { KeyStoreError } from "../src/lib/api-key-store";
const now = Date.now();
function fixture(): { token: string; key: StoredApiKey } {
  const m = newKeyMaterial();
  return {
    token: m.token,
    key: {
      id: m.id,
      userId: "user_a",
      name: "Script",
      prefix: m.prefix,
      secretHash: m.secretHash,
      scope: "read",
      createdAt: now,
      expiresAt: now + 86400000,
      revokedAt: null,
      rotatedAt: null,
      version: 1,
    },
  };
}
test("API keys verify the secret, expiry, revocation and active account; metadata omits secrets", async () => {
  const { token, key } = fixture();
  const find = async () => key;
  expect(keyMatches(token, key, now)).toBe(true);
  expect(keyMatches(newKeyMaterial(key.id).token, key, now)).toBe(false);
  expect(keyMatches(token, { ...key, revokedAt: now }, now)).toBe(false);
  expect(keyMatches(token, key, key.expiresAt)).toBe(false);
  expect(keyMatches(token, { ...key, secretHash: "bad" }, now)).toBe(false);
  expect(await apiKeyPrincipal(token, find, async () => true, now)).toEqual({
    userId: "user_a",
    method: "api-key",
    scope: "read",
    keyId: key.id,
  });
  expect(await apiKeyPrincipal(token, find, async () => false, now)).toBeNull();
  expect(
    await apiKeyPrincipal(
      token,
      async () => null,
      async () => true,
      now,
    ),
  ).toBeNull();
  expect(await apiKeyPrincipal("bad", find, async () => true, now)).toBeNull();
  const metadata = JSON.stringify(keyMetadata(key));
  for (const secret of [key.secretHash, token, key.userId])
    expect(metadata).not.toContain(secret);
  expect(
    new Set(Array.from({ length: 100 }, () => newKeyMaterial().token)).size,
  ).toBe(100);
});
test("explicit API key credentials are authoritative and ambiguous credentials are rejected", () => {
  const { token } = fixture();
  for (const h of [
    new Headers({ "X-API-Key": token }),
    new Headers({ Authorization: `Bearer ${token}` }),
  ]) {
    expect(applicationKeyHeader(h)).toBe(true);
    expect(applicationKeyToken(h)).toBe(token);
  }
  for (const h of [
    new Headers({ "X-API-Key": "", Cookie: "session" }),
    new Headers({ "X-API-Key": token, Authorization: `Bearer ${token}` }),
    new Headers({ Authorization: "Bearer kt_malformed" }),
  ]) {
    expect(applicationKeyHeader(h)).toBe(true);
    expect(
      applicationKeyToken(h) === null ||
        applicationKeyToken(h) === "" ||
        applicationKeyToken(h) === "kt_malformed",
    ).toBe(true);
  }
  expect(
    applicationKeyHeader(
      new Headers({ Authorization: "Bearer clerk-session" }),
    ),
  ).toBe(false);
});
function harness() {
  let userId: string | null = "user_a";
  let clock = now;
  const records = new Map<string, StoredApiKey>();
  const deps: KeyApiDependencies = {
    session: async () => userId,
    now: () => clock,
    list: async (id) => [...records.values()].filter((k) => k.userId === id),
    insert: async (k) => {
      records.set(k.id, k);
    },
    revoke: async (id, keyId, time) => {
      const k = records.get(keyId);
      if (!k || k.userId !== id) throw new KeyStoreError("not-found");
      k.revokedAt ??= time!;
    },
    rotate: async (id, keyId, version, hash, time) => {
      const k = records.get(keyId);
      if (!k || k.userId !== id) throw new KeyStoreError("not-found");
      if (k.revokedAt !== null || k.expiresAt <= time!)
        throw new KeyStoreError("inactive");
      if (k.version !== version) throw new KeyStoreError("conflict");
      const next = {
        ...k,
        secretHash: hash,
        version: version + 1,
        rotatedAt: time!,
      };
      records.set(keyId, next);
      return next;
    },
  };
  return {
    api: createKeyApi(deps),
    records,
    as: (id: string | null) => {
      userId = id;
    },
    tick: () => {
      clock++;
    },
  };
}
const request = (
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  new Request("https://kotoba.test/api/v1/me/api-keys", {
    method,
    headers: { Authorization: "Bearer verified-clerk-session", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
test("key lifecycle issues secrets once; rotation preserves permissions/expiry and invalidates the old key", async () => {
  const h = harness();
  const created = await h.api.create(request("POST", { name: " Script " }));
  expect(created.status).toBe(201);
  expect(created.headers.get("cache-control")).toContain("no-store");
  const first = await created.json(),
    id = first.data.id;
  expect(first.data.scope).toBe("read");
  expect(Date.parse(first.data.expiresAt) - now).toBe(90 * 86400000);
  expect((await h.api.list(request()).then((r) => r.json())).data).toEqual([
    first.data,
  ]);
  h.tick();
  const rotated = await h.api.rotate(
    request("POST", undefined, { "If-Match": '"1"' }),
    id,
  );
  expect(rotated.status).toBe(200);
  const second = await rotated.json();
  expect(second.key).not.toBe(first.key);
  expect(second.data).toMatchObject({
    ...first.data,
    version: 2,
    rotatedAt: new Date(now + 1).toISOString(),
  });
  expect(keyMatches(first.key, h.records.get(id)!, now + 1)).toBe(false);
  expect(keyMatches(second.key, h.records.get(id)!, now + 1)).toBe(true);
  expect(
    (await h.api.rotate(request("POST", undefined, { "If-Match": '"1"' }), id))
      .status,
  ).toBe(409);
  expect((await h.api.rotate(request("POST"), id)).status).toBe(428);
  expect(
    (await h.api.rotate(request("POST", undefined, { "If-Match": "1" }), id))
      .status,
  ).toBe(400);
  h.as("user_b");
  expect((await h.api.list(request()).then((r) => r.json())).data).toEqual([]);
  expect((await h.api.revoke(request("DELETE"), id)).status).toBe(404);
  expect(
    (await h.api.rotate(request("POST", undefined, { "If-Match": '"2"' }), id))
      .status,
  ).toBe(404);
  h.as("user_a");
  expect((await h.api.revoke(request("DELETE"), id)).status).toBe(200);
  expect((await h.api.revoke(request("DELETE"), id)).status).toBe(200);
  expect(keyMatches(second.key, h.records.get(id)!, now + 1)).toBe(false);
  expect(
    (await h.api.rotate(request("POST", undefined, { "If-Match": '"2"' }), id))
      .status,
  ).toBe(409);
  const listed = JSON.stringify(
    await h.api.list(request()).then((r) => r.json()),
  );
  expect(listed).not.toContain(second.key);
  expect(listed).not.toContain("secretHash");
});
test("management requires a Clerk session, rejects application keys and cross-origin writes", async () => {
  const h = harness();
  const id = fixture().key.id;
  for (const headers of [
    { "X-API-Key": "invalid" } as Record<string, string>,
    { Authorization: "Bearer kt_invalid" },
  ]) {
    for (const response of [
      await h.api.list(request("GET", undefined, headers)),
      await h.api.create(request("POST", { name: "test" }, headers)),
      await h.api.revoke(request("DELETE", undefined, headers), id),
      await h.api.rotate(request("POST", undefined, headers), id),
    ])
      expect(response.status).toBe(403);
  }
  h.as(null);
  expect((await h.api.list(request())).status).toBe(401);
  expect((await h.api.create(request("POST", { name: "test" }))).status).toBe(
    401,
  );
  h.as("user_a");
  expect(
    (
      await h.api.create(
        request("POST", { name: "test" }, { Origin: "https://evil.test" }),
      )
    ).status,
  ).toBe(403);
  const cookie = request("POST", { name: "test" });
  cookie.headers.delete("authorization");
  expect((await h.api.create(cookie)).status).toBe(403);
  expect(h.records.size).toBe(0);
});
test("key options and oversized JSON are validated before persistence", async () => {
  const h = harness();
  for (const options of [
    null,
    [],
    {},
    { name: " " },
    { name: "x".repeat(65) },
    { name: "x\nx" },
    { name: "ok", scope: "admin" },
    { name: "ok", expiresInDays: 0 },
    { name: "ok", expiresInDays: 366 },
    { name: "ok", expiresInDays: 1.1 },
    { name: "ok", expiresInDays: "90" },
  ])
    expect((await h.api.create(request("POST", options))).status).toBe(400);
  expect(
    (await h.api.create(request("POST", { name: "x".repeat(5000) }))).status,
  ).toBe(400);
  expect(h.records.size).toBe(0);
  expect(
    (
      await h.api.create(
        request("POST", {
          name: "Write",
          scope: "read-write",
          expiresInDays: 30,
        }),
      )
    ).status,
  ).toBe(201);
});
