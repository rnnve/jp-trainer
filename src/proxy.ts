import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  NextResponse,
  type NextRequest,
  type NextFetchEvent,
} from "next/server";
import { authorizedParties, clerkConfigured } from "@/lib/auth-policy";
import { applicationKeyHeader } from "@/lib/api-key-crypto";

// Clerk authenticates requests; only account API handlers require a session.
// The trainer stays public, including when Clerk keys are not configured.
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!clerkConfigured()) return NextResponse.next();
  const path = request.nextUrl.pathname;
  // Application keys are verified inside the resource handler, not by Clerk as JWTs.
  if (
    (path === "/api/v1/me" || path.startsWith("/api/v1/me/")) &&
    applicationKeyHeader(request.headers)
  )
    return NextResponse.next();
  return clerkMiddleware({ authorizedParties: authorizedParties() })(
    request,
    event,
  );
}
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
