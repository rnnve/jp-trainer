// Build first. No mock login bypass is installed in the application.
import assert from "node:assert/strict";
const base = "http://localhost:3101";
const child = Bun.spawn(["bun", "run", "start", "--port", "3101"], {
  env: {
    ...process.env,
    APP_URL: base,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
    CLERK_SECRET_KEY: "",
    UPSTASH_REDIS_REST_URL: "",
    UPSTASH_REDIS_REST_TOKEN: "",
  },
  stdout: "pipe",
  stderr: "pipe",
});
const stdout = new Response(child.stdout).text(),
  stderr = new Response(child.stderr).text();
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base, { redirect: "manual" })).status === 200) {
        ready = true;
        break;
      }
    } catch {}
    await Bun.sleep(100);
  }
  assert(ready, "Production test server unavailable");
  for (const section of [
    "learn",
    "library",
    "flashcards",
    "practice",
    "conversations",
    "statistics",
    "books",
    "settings",
    "api",
  ]) {
    const response = await fetch(base + "/hn/" + section, {
      redirect: "manual",
    });
    assert.equal(response.status, 200, section);
    assert.notEqual(response.headers.get("location"), "/hn/login");
  }
  assert.equal(
    (await fetch(base + "/hn", { redirect: "manual" })).headers.get("location"),
    "/hn/learn",
  );
  for (const path of [
    "/api/v1/me",
    "/api/v1/me/progress",
    "/api/v1/me/statistics",
    "/api/v1/me/export",
  ]) {
    for (const authorization of [
      "",
      "Bearer forged-token",
      "Bearer kt_invalid",
    ]) {
      const response = await fetch(base + path, {
        headers: authorization ? { Authorization: authorization } : {},
      });
      assert.equal(response.status, 401, path);
      assert(response.headers.get("cache-control")?.includes("no-store"));
      assert.equal(response.headers.get("access-control-allow-origin"), null);
    }
  }
  for (const path of ["/api/v1/me", "/api/v1/me/export"]) {
    const invalid = await fetch(base + path, {
      headers: { "X-API-Key": "invalid" } as Record<string, string>,
    });
    assert.equal(invalid.status, 401);
  }
  const keyId = "a".repeat(32);
  for (const [path, method] of [
    ["/api/v1/me/api-keys", "GET"],
    ["/api/v1/me/api-keys", "POST"],
    [`/api/v1/me/api-keys/${keyId}`, "DELETE"],
    [`/api/v1/me/api-keys/${keyId}/rotate`, "POST"],
  ]) {
    assert.equal((await fetch(base + path, { method })).status, 401);
    for (const headers of [
      { "X-API-Key": "invalid" } as Record<string, string>,
      { Authorization: "Bearer kt_invalid" },
    ]) {
      const response = await fetch(base + path, { method, headers });
      assert.equal(response.status, 403);
      assert(response.headers.get("cache-control")?.includes("no-store"));
      assert.equal(response.headers.get("access-control-allow-origin"), null);
    }
  }
  const write = await fetch(base + "/api/v1/me/progress", {
    method: "PUT",
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      "If-Match": '"0"',
    },
    body: "{}",
  });
  assert.equal(write.status, 401);
  const publicStats = await fetch(base + "/api/v1/stats");
  assert.equal(publicStats.headers.get("access-control-allow-origin"), "*");
  const stats = await publicStats.json();
  assert.equal(stats.data.total, 50);
  assert(!("learning" in stats));
  assert.equal(
    (await fetch(base + "/hn/api/statistics", { method: "PUT" })).status,
    410,
  );
  assert.equal((await fetch(base + "/hn/api/auth/session")).status, 410);
  for (const path of ["/hn/login", "/hn/register"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    assert((await response.text()).includes("ผู้เยี่ยมชม"));
  }
  const legacy = await fetch(base + "/library?q=test", { redirect: "manual" });
  assert.equal(legacy.headers.get("location"), "/hn/library?q=test");
  console.log(
    "Access checks passed: all trainer pages public; account APIs reject missing/forged authentication with private no-store and no public CORS; public catalog remains public; old owner publishing/Auth.js retired; guest login/register fallback works.",
  );
} finally {
  child.kill();
  await child.exited;
  await stdout;
  await stderr;
}
