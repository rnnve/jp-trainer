export function clerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    process.env.CLERK_SECRET_KEY,
  );
}
export function safeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^\/hn(?:\/|$)/.test(value) ||
    value.includes("\\") ||
    value.includes("%") ||
    /^\/hn\/(api|login|register)(?:\/|\?|$)/.test(value)
  )
    return "/hn/learn";
  return value;
}
export function authorizedParties(): string[] {
  const urls = (
    process.env.CLERK_AUTHORIZED_PARTIES ??
    process.env.APP_URL ??
    "http://localhost:3000"
  ).split(",");
  return urls.map((value) => new URL(value.trim()).origin);
}
export function sameAppOrigin(
  origin: string | null,
  appUrl = process.env.APP_URL,
): boolean {
  if (!origin || !appUrl) return false;
  try {
    const url = new URL(appUrl);
    return ["http:", "https:"].includes(url.protocol) && origin === url.origin;
  } catch {
    return false;
  }
}
