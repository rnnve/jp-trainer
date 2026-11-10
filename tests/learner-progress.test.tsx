import { expect, test } from "bun:test";
import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { LearnerSessionContext } from "../src/components/account-session";
import { useLearnerProgress } from "../src/hooks/use-learner-progress";
import { emptyProgress, STORAGE_KEY, type Progress } from "../src/lib/progress";
import { progressKey } from "../src/lib/learner-cache";

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
function environment() {
  const originalWindow = globalThis.window,
    originalStorage = globalThis.localStorage,
    originalFetch = globalThis.fetch;
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
    key: (index) => [...data.keys()][index] ?? null,
  };
  Object.defineProperty(globalThis, "window", {
    value: new EventTarget(),
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
    writable: true,
  });
  return {
    storage,
    restore() {
      Object.defineProperty(globalThis, "window", {
        value: originalWindow,
        configurable: true,
        writable: true,
      });
      Object.defineProperty(globalThis, "localStorage", {
        value: originalStorage,
        configurable: true,
        writable: true,
      });
      globalThis.fetch = originalFetch;
    },
  };
}
async function flush() {
  await act(async () => {
    await Bun.sleep(0);
  });
}
async function waitFor(check: () => boolean) {
  for (let i = 0; i < 300; i++) {
    if (check()) return;
    await act(async () => {
      await Bun.sleep(10);
    });
  }
  throw Error("Hook state did not settle");
}
function harness() {
  let latest!: ReturnType<typeof useLearnerProgress>,
    renderer!: ReactTestRenderer;
  function Capture() {
    latest = useLearnerProgress();
    return null;
  }
  const update = async (userId: string | null) => {
    await act(async () => {
      const element = (
        <LearnerSessionContext.Provider
          value={{ ready: true, configured: true, userId }}
        >
          <Capture />
        </LearnerSessionContext.Provider>
      );
      if (renderer) renderer.update(element);
      else renderer = create(element);
    });
    await flush();
  };
  return {
    get latest() {
      return latest;
    },
    update,
    async close() {
      if (renderer) await act(async () => renderer.unmount());
    },
  };
}

test("guests save locally without any account API calls", async () => {
  const e = environment(),
    h = harness();
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    throw Error("Guest must not call account APIs");
  }) as unknown as typeof fetch;
  try {
    await h.update(null);
    expect(h.latest.loaded).toBe(true);
    await act(async () =>
      h.latest.setProgress({ ...emptyProgress, completed: ["N5-v1"] }),
    );
    expect(JSON.parse(e.storage.getItem(STORAGE_KEY)!).completed).toEqual([
      "N5-v1",
    ]);
    expect(calls).toBe(0);
    await h.update(null);
    expect(h.latest.progress.completed).toEqual(["N5-v1"]);
  } finally {
    await h.close();
    e.restore();
  }
});
test("switching identities never mixes guest, account A and account B progress", async () => {
  const e = environment(),
    h = harness();
  let current = "user_a";
  const records: Record<string, { data: Progress; revision: number }> = {
    user_a: {
      data: { ...emptyProgress, level: "N4", completed: ["N4-v1"] },
      revision: 1,
    },
    user_b: {
      data: { ...emptyProgress, level: "N3", completed: ["N3-v1"] },
      revision: 1,
    },
  };
  e.storage.setItem(
    STORAGE_KEY,
    JSON.stringify({ ...emptyProgress, completed: ["N5-v1"] }),
  );
  globalThis.fetch = (async (_url, options) => {
    if (options?.method === "PUT") {
      const progress = JSON.parse(options.body as string);
      records[current] = {
        data: progress,
        revision: records[current].revision + 1,
      };
      return Response.json({ revision: records[current].revision });
    }
    return Response.json(records[current]);
  }) as typeof fetch;
  try {
    await h.update(null);
    expect(h.latest.progress.completed).toEqual(["N5-v1"]);
    await h.update("user_a");
    expect(h.latest.progress.completed).toEqual(["N4-v1"]);
    await act(async () =>
      h.latest.setProgress((p) => ({ ...p, saved: ["N4-v2"] })),
    );
    await waitFor(() => h.latest.syncPhase === "saved");
    expect(records.user_a.data.saved).toEqual(["N4-v2"]);
    current = "user_b";
    await h.update("user_b");
    expect(h.latest.progress.completed).toEqual(["N3-v1"]);
    expect(h.latest.progress.saved).toEqual([]);
    await h.update(null);
    expect(h.latest.progress.completed).toEqual(["N5-v1"]);
    expect(h.latest.progress.saved).toEqual([]);
    expect(e.storage.getItem(progressKey("user_a"))).not.toContain("N3-v1");
  } finally {
    await h.close();
    e.restore();
  }
});
test("revision conflicts preserve local edits until the learner explicitly reloads account data", async () => {
  const e = environment(),
    h = harness();
  let remote = { data: { ...emptyProgress }, revision: 0 };
  globalThis.fetch = (async (_url, options) =>
    options?.method === "PUT"
      ? new Response("{}", { status: 409 })
      : Response.json(remote)) as typeof fetch;
  try {
    await h.update("user_a");
    await act(async () =>
      h.latest.setProgress((p) => ({ ...p, completed: ["N5-v1"] })),
    );
    remote = { data: { ...emptyProgress, completed: ["N5-v2"] }, revision: 1 };
    await waitFor(() => h.latest.syncPhase === "conflict");
    expect(h.latest.progress.completed).toEqual(["N5-v1"]);
    await act(async () => h.latest.retrySync());
    await flush();
    expect(h.latest.syncPhase).toBe("conflict");
    expect(h.latest.progress.completed).toEqual(["N5-v1"]);
    await act(async () => h.latest.loadAccountCopy());
    await flush();
    expect(h.latest.progress.completed).toEqual(["N5-v2"]);
    expect(h.latest.syncPhase).toBe("saved");
  } finally {
    await h.close();
    e.restore();
  }
});
test("unsynced account cache survives a storage outage and resumes after retry", async () => {
  const e = environment(),
    h = harness();
  let available = false;
  e.storage.setItem(
    progressKey("user_a"),
    JSON.stringify({
      progress: { ...emptyProgress, completed: ["N5-v1"] },
      revision: 1,
      dirty: true,
    }),
  );
  globalThis.fetch = (async (_url, options) => {
    if (!available) throw Error("Offline");
    return Response.json(
      options?.method === "PUT"
        ? { revision: 2 }
        : { data: emptyProgress, revision: 1 },
    );
  }) as typeof fetch;
  try {
    await h.update("user_a");
    expect(h.latest.syncPhase).toBe("error");
    expect(h.latest.progress.completed).toEqual(["N5-v1"]);
    available = true;
    await act(async () => h.latest.retrySync());
    await waitFor(() => h.latest.syncPhase === "saved");
    expect(h.latest.progress.completed).toEqual(["N5-v1"]);
    expect(JSON.parse(e.storage.getItem(progressKey("user_a"))!).dirty).toBe(
      false,
    );
  } finally {
    await h.close();
    e.restore();
  }
});
