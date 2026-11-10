import { STORAGE_KEY, parseProgress, type Progress } from "./progress";
export type AccountCache = {
  progress: Progress;
  revision: number;
  dirty: boolean;
};
export function progressKey(userId: string | null) {
  return userId ? `kotoba.account.v1:${userId}` : STORAGE_KEY;
}
export function readAccountCache(raw: string): AccountCache {
  const value = JSON.parse(raw) as AccountCache;
  if (
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0 ||
    typeof value.dirty !== "boolean"
  )
    throw Error("Invalid account cache");
  return { ...value, progress: parseProgress(value.progress) };
}
