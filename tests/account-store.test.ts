import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("development account storage isolates records and atomically rejects simultaneous stale saves", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "kotoba-account-test-"));
  const modulePath = path.resolve("src/lib/account-store.ts");
  const contentPath = path.resolve("src/lib/progress.ts");
  const script = `const {readAccount,writeAccount,RevisionConflict}=await import(${JSON.stringify(modulePath)}); const {emptyProgress}=await import(${JSON.stringify(contentPath)}); const assert=(await import('node:assert/strict')).default;
 assert.equal(await readAccount('user_b'),null);
 const results=await Promise.allSettled([writeAccount('user_a',{...emptyProgress,completed:['N5-v1']},0),writeAccount('user_a',{...emptyProgress,completed:['N5-v2']},0)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason instanceof RevisionConflict).length,1);
 const saved=await readAccount('user_a');assert.equal(saved.revision,1);assert.equal(saved.progress.completed.length,1);assert.equal(await readAccount('user_b'),null);
 await writeAccount('user_b',{...emptyProgress,level:'N3'},0);assert.equal((await readAccount('user_b')).progress.level,'N3');assert.equal((await readAccount('user_a')).progress.level,'N5');
 console.log('Account storage isolation and revision checks passed');`;
  try {
    const child = Bun.spawn(["bun", "-e", script], {
      cwd: temporary,
      env: {
        ...process.env,
        NODE_ENV: "test",
        UPSTASH_REDIS_REST_URL: "",
        UPSTASH_REDIS_REST_TOKEN: "",
      },
      stdout: "pipe",
      stderr: "pipe",
    });
    const [output, error, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(error).toBe("");
    expect(exitCode).toBe(0);
    expect(output).toContain("checks passed");
  } finally {
    await rm(temporary, { recursive: true });
  }
});
