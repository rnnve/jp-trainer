import { expect, test } from "bun:test";
import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import ApiKeyManager from "../src/components/api-key-manager";
import { LearnerSessionContext } from "../src/components/account-session";
import {
  keyMetadata,
  newKeyMaterial,
  type StoredApiKey,
} from "../src/lib/api-key-crypto";
(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
test("key manager rotates with the listed version, hides revoked secrets and clears credentials on account switch", async () => {
  const originalFetch = globalThis.fetch;
  let renderer!: ReactTestRenderer;
  let version = 1;
  const calls: { url: string; init?: RequestInit }[] = [];
  const m = newKeyMaterial(),
    now = Date.now();
  const record: StoredApiKey = {
    id: m.id,
    userId: "user_a",
    name: "Script",
    scope: "read",
    prefix: m.prefix,
    secretHash: m.secretHash,
    version: 1,
    createdAt: now,
    expiresAt: now + 86400000,
    rotatedAt: null,
    revokedAt: null,
  };
  const secrets = ["first-secret", "rotated-secret"];
  globalThis.fetch = (async (url, init) => {
    calls.push({ url: String(url), init });
    if (init?.method === "POST") {
      if (String(url).endsWith("/rotate")) {
        expect((init.headers as Record<string, string>)["If-Match"]).toBe(
          '"1"',
        );
        version = 2;
      }
      return Response.json({
        data: keyMetadata({
          ...record,
          id:
            version === 2 && !String(url).endsWith("/rotate")
              ? newKeyMaterial().id
              : record.id,
          version,
        }),
        key: secrets[version - 1],
      });
    }
    if (init?.method === "DELETE") return Response.json({ revoked: true });
    return Response.json({ data: [] });
  }) as typeof fetch;
  const update = async (userId: string | null) => {
    await act(async () => {
      const element = (
        <LearnerSessionContext.Provider
          value={{ ready: true, configured: true, userId }}
        >
          <ApiKeyManager />
        </LearnerSessionContext.Provider>
      );
      if (renderer) renderer.update(element);
      else renderer = create(element);
    });
  };
  const flush = async () => {
    await act(async () => {
      await Bun.sleep(0);
    });
  };
  try {
    await update(null);
    expect(calls).toHaveLength(0);
    await update("user_a");
    await flush();
    await act(async () => {
      renderer.root
        .findAllByType("input")
        .find((n) => n.props.placeholder)
        ?.props.onChange({ target: { value: "Script" } });
    });
    await act(async () => {
      renderer.root.findByType("form").props.onSubmit({ preventDefault() {} });
    });
    await flush();
    expect(JSON.stringify(renderer.toJSON())).toContain("first-secret");
    await act(async () => {
      renderer.root
        .findByProps({ "aria-label": "หมุนเวียนคีย์ Script" })
        .props.onClick();
    });
    await flush();
    expect(JSON.stringify(renderer.toJSON())).toContain("rotated-secret");
    expect(JSON.stringify(renderer.toJSON())).not.toContain("first-secret");
    await act(async () => {
      renderer.root
        .findByProps({ "aria-label": "ยกเลิกคีย์ Script" })
        .props.onClick();
    });
    await flush();
    expect(JSON.stringify(renderer.toJSON())).not.toContain("rotated-secret");
    await act(async () => {
      renderer.root
        .findAllByType("input")
        .find((n) => n.props.placeholder)
        ?.props.onChange({ target: { value: "Second" } });
    });
    await act(async () => {
      renderer.root.findByType("form").props.onSubmit({ preventDefault() {} });
    });
    await flush();
    expect(JSON.stringify(renderer.toJSON())).toContain("rotated-secret");
    await update("user_b");
    await flush();
    expect(JSON.stringify(renderer.toJSON())).not.toContain("rotated-secret");
  } finally {
    if (renderer) await act(async () => renderer.unmount());
    globalThis.fetch = originalFetch;
  }
});
