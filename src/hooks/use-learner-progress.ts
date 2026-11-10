"use client";
import { useEffect, useRef, useState, type SetStateAction } from "react";
import { useLearnerSession } from "@/components/account-session";
import {
  emptyProgress,
  parseProgress,
  STORAGE_KEY,
  type Progress,
} from "@/lib/progress";
import {
  progressKey,
  readAccountCache,
  type AccountCache,
} from "@/lib/learner-cache";
export type SyncPhase =
  "guest" | "loading" | "local" | "saving" | "saved" | "error" | "conflict";
type State = {
  identity: string;
  progress: Progress;
  loaded: boolean;
  dirty: boolean;
  revision: number;
  cloudReady: boolean;
  phase: SyncPhase;
  storageError: boolean;
};
export function useLearnerProgress() {
  const session = useLearnerSession(),
    key = progressKey(session.userId);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<State>({
    identity: "",
    progress: emptyProgress,
    loaded: false,
    dirty: false,
    revision: 0,
    cloudReady: false,
    phase: "loading",
    storageError: false,
  });
  const inFlight = useRef<string | null>(null);
  useEffect(() => {
    if (!session.ready) return;
    let cancelled = false;
    let progress = emptyProgress,
      cache: AccountCache | null = null,
      storageError = false;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        if (session.userId) {
          cache = readAccountCache(raw);
          progress = cache.progress;
        } else progress = parseProgress(JSON.parse(raw));
      }
    } catch {
      storageError = true;
    }
    const initial: State = {
      identity: key,
      progress,
      loaded: !session.userId,
      dirty: cache?.dirty ?? false,
      revision: cache?.revision ?? 0,
      cloudReady: false,
      phase: session.userId ? "loading" : "guest",
      storageError,
    };
    setState(initial);
    if (session.userId) {
      void fetch("/api/v1/me/progress", { cache: "no-store" })
        .then(async (response) => {
          if (!response.ok) throw Error("Account unavailable");
          const data = await response.json();
          if (!Number.isSafeInteger(data.revision) || data.revision < 0)
            throw Error("Invalid account revision");
          const remote = data.data ? parseProgress(data.data) : emptyProgress;
          if (cancelled) return;
          if (cache?.dirty && cache.revision !== data.revision) {
            setState({ ...initial, loaded: true, phase: "conflict" });
            return;
          }
          setState({
            ...initial,
            loaded: true,
            progress: cache?.dirty ? cache.progress : remote,
            revision: data.revision,
            cloudReady: true,
            phase: cache?.dirty ? "local" : data.data ? "saved" : "local",
          });
        })
        .catch(() => {
          if (!cancelled)
            setState({ ...initial, loaded: true, phase: "error" });
        });
    }
    return () => {
      cancelled = true;
    };
  }, [session.ready, session.userId, key, retry]);
  useEffect(() => {
    if (!state.loaded || state.identity !== key) return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify(
          session.userId
            ? {
                progress: state.progress,
                revision: state.revision,
                dirty: state.dirty,
              }
            : state.progress,
        ),
      );
    } catch {
      setState((previous) =>
        previous.storageError ? previous : { ...previous, storageError: true },
      );
    }
  }, [
    state.progress,
    state.revision,
    state.dirty,
    state.loaded,
    state.identity,
    key,
    session.userId,
  ]);
  useEffect(() => {
    if (
      !session.userId ||
      !state.loaded ||
      state.identity !== key ||
      !state.cloudReady ||
      !state.dirty
    )
      return;
    const timer = setTimeout(() => {
      if (inFlight.current === key) return;
      inFlight.current = key;
      const submitted = state.progress,
        revision = state.revision;
      setState((previous) => ({ ...previous, phase: "saving" }));
      void fetch("/api/v1/me/progress", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "If-Match": `"${revision}"`,
        },
        body: JSON.stringify(submitted),
      })
        .then(async (response) => {
          if (response.status === 409) {
            setState((previous) =>
              previous.identity === key
                ? { ...previous, cloudReady: false, phase: "conflict" }
                : previous,
            );
            return;
          }
          if (!response.ok) throw Error("Sync failed");
          const data = await response.json();
          if (
            !Number.isSafeInteger(data.revision) ||
            data.revision !== revision + 1
          )
            throw Error("Invalid sync response");
          setState((previous) =>
            previous.identity === key
              ? {
                  ...previous,
                  revision: data.revision,
                  dirty: previous.progress !== submitted,
                  phase: previous.progress === submitted ? "saved" : "local",
                }
              : previous,
          );
        })
        .catch(() => {
          setState((previous) =>
            previous.identity === key
              ? { ...previous, cloudReady: false, phase: "error" }
              : previous,
          );
        })
        .finally(() => {
          if (inFlight.current === key) inFlight.current = null;
        });
    }, 800);
    return () => clearTimeout(timer);
  }, [
    session.userId,
    key,
    state.identity,
    state.progress,
    state.revision,
    state.loaded,
    state.dirty,
    state.cloudReady,
  ]);
  useEffect(() => {
    const online = () => setRetry((value) => value + 1);
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, []);
  function setProgress(action: SetStateAction<Progress>) {
    setState((previous) => {
      if (previous.identity !== key || !previous.loaded) return previous;
      const progress =
        typeof action === "function" ? action(previous.progress) : action;
      return {
        ...previous,
        progress,
        dirty: Boolean(session.userId),
        phase:
          previous.phase === "conflict" || previous.phase === "error"
            ? previous.phase
            : session.userId
              ? "local"
              : "guest",
      };
    });
  }
  function retrySync() {
    setRetry((value) => value + 1);
  }
  function loadAccountCopy() {
    try {
      localStorage.removeItem(key);
    } catch {
      return;
    }
    setState((previous) => ({ ...previous, loaded: false }));
    setRetry((value) => value + 1);
  }
  function importGuest() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) throw Error("ยังไม่มีความก้าวหน้าแบบผู้เยี่ยมชม");
    setProgress(parseProgress(JSON.parse(raw)));
  }
  return {
    progress: state.identity === key ? state.progress : emptyProgress,
    setProgress,
    loaded: session.ready && state.identity === key && state.loaded,
    storageError: state.storageError,
    syncPhase: state.phase,
    retrySync,
    loadAccountCopy,
    importGuest,
  };
}
