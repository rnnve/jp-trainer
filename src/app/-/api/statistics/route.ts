// Retire the shared owner statistics writer: account data is private and keyed by Clerk user ID.
export function PUT() {
  return Response.json(
    {
      error:
        "Shared statistics publishing has been retired. Use /api/v1/me/progress and /api/v1/me/statistics.",
    },
    { status: 410, headers: { "Cache-Control": "private, no-store" } },
  );
}
