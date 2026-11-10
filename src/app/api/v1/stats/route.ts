import { contentStats } from "@/lib/content";
export function GET() {
  return Response.json(
    {
      data: contentStats(),
      scope:
        "Public content catalog only. Account learning data requires /api/v1/me/statistics.",
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
