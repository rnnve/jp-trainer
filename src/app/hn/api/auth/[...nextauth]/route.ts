// Retired Auth.js endpoints never create or accept an owner-only session.
export function GET() {
  return Response.json(
    {
      error: "GitHub OAuth has been replaced with Clerk.",
      signIn: "/hn/login",
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
export const POST = GET;
