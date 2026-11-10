import { keyApi } from "@/lib/api-key-api";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ keyId: string }> },
) {
  return keyApi.rotate(request, (await params).keyId);
}
