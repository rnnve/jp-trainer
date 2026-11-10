import { Redis } from "@upstash/redis";
import { createHash, randomUUID } from "node:crypto";
import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  API_KEY_LIMIT,
  keyIsActive,
  type StoredApiKey,
} from "./api-key-crypto";
export class KeyStoreError extends Error {
  constructor(public code: "not-found" | "inactive" | "conflict" | "limit") {
    super(code);
  }
}
function redis() {
  const url = process.env.UPSTASH_REDIS_REST_URL,
    token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}
const ownerKey = (userId: string) =>
  "kotoba:api-keys:owner:" + createHash("sha256").update(userId).digest("hex");
const lookupKey = (id: string) => "kotoba:api-key:lookup:" + id;
type FileState = {
  owners: Record<string, StoredApiKey[]>;
  lookups: Record<string, string>;
};
const filename = () => path.join(process.cwd(), ".data", "api-keys.json");
async function fileState(): Promise<FileState> {
  if (process.env.NODE_ENV === "production")
    throw Error("API key storage is not configured.");
  try {
    return JSON.parse(await readFile(filename(), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { owners: {}, lookups: {} };
    throw error;
  }
}
let lock: Promise<void> = Promise.resolve();
async function mutateFile<T>(work: (state: FileState) => T): Promise<T> {
  const previous = lock;
  let release!: () => void;
  lock = new Promise((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    const state = await fileState();
    const result = work(state);
    await mkdir(path.dirname(filename()), { recursive: true });
    const temporary = filename() + "." + randomUUID() + ".tmp";
    await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
    await rename(temporary, filename());
    return result;
  } finally {
    release();
  }
}
export async function listStoredKeys(userId: string): Promise<StoredApiKey[]> {
  const client = redis();
  if (client) return (await client.get<StoredApiKey[]>(ownerKey(userId))) ?? [];
  return (await fileState()).owners[ownerKey(userId)] ?? [];
}
export async function findStoredKey(id: string): Promise<StoredApiKey | null> {
  if (!/^[0-9a-f]{32}$/.test(id)) return null;
  const client = redis();
  if (client) {
    const lookup = await client.get<{ userId: string }>(lookupKey(id));
    if (!lookup) return null;
    return (
      (await listStoredKeys(lookup.userId)).find(
        (key) => key.id === id && key.userId === lookup.userId,
      ) ?? null
    );
  }
  const state = await fileState(),
    userId = state.lookups[id];
  if (!userId) return null;
  return (
    state.owners[ownerKey(userId)]?.find(
      (key) => key.id === id && key.userId === userId,
    ) ?? null
  );
}
export async function insertStoredKey(key: StoredApiKey): Promise<void> {
  const client = redis();
  if (client) {
    const result = await client.eval(
      `local keys=cjson.decode(redis.call('GET',KEYS[1]) or '[]'); local count=0; for _,k in ipairs(keys) do if k.revokedAt==cjson.null and k.expiresAt>tonumber(ARGV[2]) then count=count+1 end end; if count>=tonumber(ARGV[3]) then return 0 end; table.insert(keys,cjson.decode(ARGV[1])); redis.call('SET',KEYS[1],cjson.encode(keys)); redis.call('SET',KEYS[2],ARGV[4]); return 1`,
      [ownerKey(key.userId), lookupKey(key.id)],
      [
        JSON.stringify(key),
        key.createdAt,
        API_KEY_LIMIT,
        JSON.stringify({ userId: key.userId }),
      ],
    );
    if (result !== 1) throw new KeyStoreError("limit");
    return;
  }
  await mutateFile((state) => {
    const owner = ownerKey(key.userId),
      keys = state.owners[owner] ?? [];
    if (
      keys.filter((k) => keyIsActive(k, key.createdAt)).length >= API_KEY_LIMIT
    )
      throw new KeyStoreError("limit");
    state.owners[owner] = [...keys, key];
    state.lookups[key.id] = key.userId;
  });
}
export async function revokeStoredKey(
  userId: string,
  id: string,
  now = Date.now(),
): Promise<void> {
  const client = redis();
  if (client) {
    const result = await client.eval(
      `local keys=cjson.decode(redis.call('GET',KEYS[1]) or '[]'); for _,k in ipairs(keys) do if k.id==ARGV[1] then if k.revokedAt==cjson.null then k.revokedAt=tonumber(ARGV[2]) end; redis.call('SET',KEYS[1],cjson.encode(keys)); return 1 end end; return 0`,
      [ownerKey(userId)],
      [id, now],
    );
    if (result !== 1) throw new KeyStoreError("not-found");
    return;
  }
  await mutateFile((state) => {
    const key = state.owners[ownerKey(userId)]?.find(
      (k) => k.id === id && k.userId === userId,
    );
    if (!key) throw new KeyStoreError("not-found");
    if (key.revokedAt === null) key.revokedAt = now;
  });
}
export async function rotateStoredKey(
  userId: string,
  id: string,
  version: number,
  secretHash: string,
  now = Date.now(),
): Promise<StoredApiKey> {
  const client = redis();
  if (client) {
    const result = await client.eval(
      `local keys=cjson.decode(redis.call('GET',KEYS[1]) or '[]'); for _,k in ipairs(keys) do if k.id==ARGV[1] then if k.revokedAt~=cjson.null or k.expiresAt<=tonumber(ARGV[2]) then return 'inactive' end; if k.version~=tonumber(ARGV[3]) then return 'conflict' end; k.secretHash=ARGV[4]; k.rotatedAt=tonumber(ARGV[2]); k.version=k.version+1; redis.call('SET',KEYS[1],cjson.encode(keys)); return cjson.encode(k) end end; return 'not-found'`,
      [ownerKey(userId)],
      [id, now, version, secretHash],
    );
    if (
      typeof result === "string" &&
      ["inactive", "conflict", "not-found"].includes(result)
    )
      throw new KeyStoreError(result as "inactive" | "conflict" | "not-found");
    return typeof result === "string"
      ? JSON.parse(result)
      : (result as StoredApiKey);
  }
  return mutateFile((state) => {
    const key = state.owners[ownerKey(userId)]?.find(
      (k) => k.id === id && k.userId === userId,
    );
    if (!key) throw new KeyStoreError("not-found");
    if (!keyIsActive(key, now)) throw new KeyStoreError("inactive");
    if (key.version !== version) throw new KeyStoreError("conflict");
    key.secretHash = secretHash;
    key.rotatedAt = now;
    key.version++;
    return { ...key };
  });
}
