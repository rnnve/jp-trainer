import { keyApi } from "@/lib/api-key-api";
export const runtime = "nodejs";
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ keyId: string }> },
) {
  return keyApi.revoke(request, (await params).keyId);
}
