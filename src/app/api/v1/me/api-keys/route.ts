import { keyApi } from "@/lib/api-key-api";
export const runtime = "nodejs";
export const GET = keyApi.list;
export const POST = keyApi.create;
