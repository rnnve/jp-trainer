import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
test("key storage atomically rotates, enforces ownership/limits, revokes and never persists raw tokens", async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), "kotoba-key-test-"));
  const script = `const {insertStoredKey,listStoredKeys,findStoredKey,rotateStoredKey,revokeStoredKey}=await import(${JSON.stringify(path.resolve("src/lib/api-key-store.ts"))});
 const {newKeyMaterial,keyMatches}=await import(${JSON.stringify(path.resolve("src/lib/api-key-crypto.ts"))});
 const assert=(await import('node:assert/strict')).default;
 const {readFile}=await import('node:fs/promises');
 const now=Date.now(),material=newKeyMaterial();
 const key={...material,userId:'user_a',name:'Script',scope:'read',createdAt:now,expiresAt:now+86400000,revokedAt:null,rotatedAt:null,version:1};delete key.token;
 await insertStoredKey(key); assert.equal((await listStoredKeys('user_b')).length,0);
 await assert.rejects(rotateStoredKey('user_b',key.id,1,'a'.repeat(64),now),e=>e.code==='not-found');
 const a=newKeyMaterial(key.id),b=newKeyMaterial(key.id);
 const results=await Promise.allSettled([rotateStoredKey('user_a',key.id,1,a.secretHash,now+1),rotateStoredKey('user_a',key.id,1,b.secretHash,now+1)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='conflict').length,1);
 const rotated=await findStoredKey(key.id);assert.equal(rotated.version,2);assert.equal(rotated.expiresAt,key.expiresAt);assert.equal(rotated.scope,key.scope);assert.equal(keyMatches(material.token,rotated,now+2),false);
 assert.equal([a,b].filter(m=>keyMatches(m.token,rotated,now+2)).length,1);
 await assert.rejects(revokeStoredKey('user_b',key.id,now+2),e=>e.code==='not-found');
 await revokeStoredKey('user_a',key.id,now+2);await revokeStoredKey('user_a',key.id,now+3);
 assert.equal((await findStoredKey(key.id)).revokedAt,now+2);
 await assert.rejects(rotateStoredKey('user_a',key.id,2,a.secretHash,now+3),e=>e.code==='inactive');
 const make=()=>{const m=newKeyMaterial();return {...key,id:m.id,secretHash:m.secretHash,prefix:m.prefix};};
 const inserts=await Promise.allSettled(Array.from({length:11},()=>insertStoredKey(make())));
 assert.equal(inserts.filter(r=>r.status==='fulfilled').length,10);assert.equal(inserts.filter(r=>r.status==='rejected'&&r.reason.code==='limit').length,1);
 const persisted=await readFile('.data/api-keys.json','utf8');for(const m of [material,a,b])assert.equal(persisted.includes(m.token),false);
 const expired={...make(),userId:'expired',expiresAt:now-1};await insertStoredKey(expired);await assert.rejects(rotateStoredKey('expired',expired.id,1,a.secretHash,now),e=>e.code==='inactive');
 console.log('Key storage checks passed');`;
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
    const [output, error, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(error).toBe("");
    expect(code).toBe(0);
    expect(output).toContain("checks passed");
  } finally {
    await rm(temporary, { recursive: true });
  }
});
