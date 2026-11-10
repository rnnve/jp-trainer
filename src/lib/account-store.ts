import { Redis } from "@upstash/redis";
import { createHash, randomUUID } from "node:crypto";
import { readFile, mkdir, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { parseProgress, type Progress } from "./progress";
export type AccountRecord = {
  progress: Progress;
  revision: number;
  updatedAt: string;
};
export class RevisionConflict extends Error {
  constructor() {
    super("Account progress changed on another device.");
  }
}
function redis() {
  const url = process.env.UPSTASH_REDIS_REST_URL,
    token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? new Redis({ url, token }) : null;
}
export function accountStorageKey(userId: string) {
  if (!userId) throw Error("An authenticated user ID is required.");
  return (
    "kotoba:account:" +
    createHash("sha256").update(userId).digest("hex") +
    ":progress:v1"
  );
}
function filename(userId: string) {
  return path.join(
    process.cwd(),
    ".data",
    "accounts",
    accountStorageKey(userId).split(":")[2] + ".json",
  );
}
function validateRecord(record: AccountRecord | null): AccountRecord | null {
  if (!record) return null;
  if (
    !Number.isSafeInteger(record.revision) ||
    record.revision < 1 ||
    !Number.isFinite(Date.parse(record.updatedAt))
  )
    throw Error("Invalid account record");
  return { ...record, progress: parseProgress(record.progress) };
}
export async function readAccount(
  userId: string,
): Promise<AccountRecord | null> {
  const key = accountStorageKey(userId),
    client = redis();
  if (client) return validateRecord(await client.get<AccountRecord>(key));
  if (process.env.NODE_ENV === "production")
    throw Error("Account storage is not configured.");
  try {
    return validateRecord(JSON.parse(await readFile(filename(userId), "utf8")));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
const locks = new Map<string, Promise<void>>();
async function locked<T>(key: string, work: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  locks.set(key, current);
  await previous;
  try {
    return await work();
  } finally {
    release();
    if (locks.get(key) === current) locks.delete(key);
  }
}
export async function writeAccount(
  userId: string,
  progress: Progress,
  expectedRevision: number,
): Promise<AccountRecord> {
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 0 ||
    expectedRevision >= Number.MAX_SAFE_INTEGER
  )
    throw Error("Invalid revision");
  const key = accountStorageKey(userId),
    client = redis();
  const record: AccountRecord = {
    progress: parseProgress(progress),
    revision: expectedRevision + 1,
    updatedAt: new Date().toISOString(),
  };
  if (client) {
    const result = await client.eval(
      `local old=redis.call('GET',KEYS[1]); local revision=0; if old then revision=cjson.decode(old).revision end; if revision~=tonumber(ARGV[1]) then return 0 end; redis.call('SET',KEYS[1],ARGV[2]); return 1`,
      [key],
      [expectedRevision, JSON.stringify(record)],
    );
    if (result !== 1) throw new RevisionConflict();
    return record;
  }
  if (process.env.NODE_ENV === "production")
    throw Error("Account storage is not configured.");
  return locked(key, async () => {
    const previous = await readAccount(userId);
    if ((previous?.revision ?? 0) !== expectedRevision)
      throw new RevisionConflict();
    const destination = filename(userId);
    await mkdir(path.dirname(destination), { recursive: true });
    const temp = destination + "." + randomUUID() + ".tmp";
    await writeFile(temp, JSON.stringify(record), { mode: 0o600 });
    await rename(temp, destination);
    return record;
  });
}
