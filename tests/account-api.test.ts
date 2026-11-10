import { expect, test } from "bun:test";
import { createAccountApi } from "../src/lib/account-api";
import {
  accountStorageKey,
  RevisionConflict,
  type AccountRecord,
} from "../src/lib/account-store";
import { emptyProgress, type Progress } from "../src/lib/progress";
import { progressKey, readAccountCache } from "../src/lib/learner-cache";

function harness(
  scope: "read" | "read-write" = "read-write",
  method: "session" | "api-key" = "session",
) {
  let userId: string | null = null;
  const records = new Map<string, AccountRecord>();
  const calls: string[] = [];
  const api = createAccountApi({
    authenticate: async () => (userId ? { userId, method, scope } : null),
    profile: async (id) => ({
      id,
      username: id,
      firstName: null,
      lastName: null,
      email: `${id}@example.test`,
      imageUrl: "",
      createdAt: "2026-11-10T00:00:00.000Z",
    }),
    read: async (id) => {
      calls.push(id);
      return records.get(id) ?? null;
    },
    write: async (id, progress, revision) => {
      calls.push(id);
      if ((records.get(id)?.revision ?? 0) !== revision)
        throw new RevisionConflict();
      const record = {
        progress,
        revision: revision + 1,
        updatedAt: new Date().toISOString(),
      };
      records.set(id, record);
      return record;
    },
  });
  return {
    api,
    records,
    calls,
    as: (id: string | null) => {
      userId = id;
    },
  };
}
const request = (
  progress: unknown,
  revision = 0,
  extra: Record<string, string> = {},
) =>
  new Request("https://kotoba.example/api/v1/me/progress", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer verified-by-auth-layer",
      "If-Match": `"${revision}"`,
      ...extra,
    },
    body: JSON.stringify(progress),
  });

test("every personal API requires authentication before touching storage", async () => {
  const h = harness();
  for (const fn of [h.api.me, h.api.progress, h.api.statistics, h.api.export]) {
    const r = await fn();
    expect(r.status).toBe(401);
    expect(r.headers.get("Cache-Control")).toContain("no-store");
  }
  expect((await h.api.update(request(emptyProgress))).status).toBe(401);
  expect(h.calls).toHaveLength(0);
});
test("users can read and export only their own profile, progress and statistics", async () => {
  const h = harness();
  h.as("user_a");
  const a: Progress = {
    ...emptyProgress,
    completed: ["N5-v1"],
    saved: ["N5-v2"],
  };
  expect((await h.api.update(request({ ...a, userId: "user_b" }))).status).toBe(
    200,
  );
  expect(h.records.has("user_a")).toBe(true);
  expect(h.records.has("user_b")).toBe(false);
  h.as("user_b");
  expect((await h.api.progress().then((r) => r.json())).data).toBeNull();
  expect((await h.api.statistics().then((r) => r.json())).data).toBeNull();
  const own = await h.api.export().then((r) => r.json());
  expect(own.profile.id).toBe("user_b");
  expect(own.progress).toBeNull();
  expect(JSON.stringify(own)).not.toContain("N5-v1");
  h.as("user_a");
  const exported = await h.api.export();
  expect(exported.headers.get("Content-Disposition")).toContain("attachment");
  const data = await exported.json();
  expect(data.progress.completed).toEqual(["N5-v1"]);
  expect(data.statistics.completed).toBe(1);
  expect(data.profile.id).toBe("user_a");
});
test("stale writes cannot overwrite another device; revision and validation are enforced", async () => {
  const h = harness();
  h.as("user_a");
  const first = await h.api.progress();
  expect(first.headers.get("ETag")).toBe('"0"');
  const save = await h.api.update(request(emptyProgress));
  expect(save.headers.get("ETag")).toBe('"1"');
  expect(
    (await h.api.update(request({ ...emptyProgress, level: "N4" }, 0))).status,
  ).toBe(409);
  expect(
    (
      await h.api.update(
        request({ ...emptyProgress, completed: ["unknown"] }, 1),
      )
    ).status,
  ).toBe(400);
  const missing = request(emptyProgress, 1);
  missing.headers.delete("if-match");
  expect((await h.api.update(missing)).status).toBe(428);
  const success = await h.api.update(
    request({ ...emptyProgress, level: "N4" }, 1),
  );
  expect(success.status).toBe(200);
  expect((await h.api.progress().then((r) => r.json())).data.level).toBe("N4");
});
test("cookie writes need a same-origin header; token clients may omit Origin", async () => {
  const h = harness();
  h.as("user_a");
  const cookie = request(emptyProgress);
  cookie.headers.delete("authorization");
  expect((await h.api.update(cookie)).status).toBe(403);
  expect(
    (
      await h.api.update(
        request(emptyProgress, 0, { Origin: "https://untrusted.example" }),
      )
    ).status,
  ).toBe(403);
  expect((await h.api.update(request(emptyProgress))).status).toBe(200);
});
test("guest, account A and account B have distinct browser and server storage keys", () => {
  expect(
    new Set([progressKey(null), progressKey("user_a"), progressKey("user_b")])
      .size,
  ).toBe(3);
  expect(accountStorageKey("user_a")).not.toBe(accountStorageKey("user_b"));
  expect(accountStorageKey("../../escape")).not.toContain("..");
  const cache = { progress: emptyProgress, revision: 2, dirty: true };
  expect(readAccountCache(JSON.stringify(cache))).toEqual(cache);
  expect(() =>
    readAccountCache(JSON.stringify({ ...cache, revision: -1 })),
  ).toThrow();
});

test("read-only keys can export their account but cannot write; read-write keys retain owner isolation", async () => {
  const read = harness("read", "api-key");
  read.as("user_a");
  for (const fn of [
    read.api.me,
    read.api.progress,
    read.api.statistics,
    read.api.export,
  ])
    expect((await fn()).status).toBe(200);
  expect((await read.api.update(request(emptyProgress))).status).toBe(403);
  expect(read.records.size).toBe(0);
  const write = harness("read-write", "api-key");
  write.as("user_a");
  const save = request({ ...emptyProgress, userId: "user_b" });
  save.headers.delete("authorization");
  save.headers.set("X-API-Key", "verified-by-auth-layer");
  expect((await write.api.update(save)).status).toBe(200);
  expect([...write.records.keys()]).toEqual(["user_a"]);
});
