import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { config } from "./config";
import { db } from "./db";
import { developmentOriginAllowed } from "./local-network";
export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
export async function api(action: () => Promise<NextResponse>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    if (error instanceof ZodError) return json({ error: error.issues[0]?.message || "入力を確認してください。" }, 400);
    console.error("API error", error instanceof Error ? error.name : "unknown");
    return json({ error: "サーバーに接続できません。時間をおいて再度お試しください。" }, 503);
  }
}
export function checkOrigin(request: Request) {
  const cfg = config();
  const origin = request.headers.get("origin");
  if (origin !== cfg.origin && !developmentOriginAllowed(origin, cfg.APP_URL, cfg.simulator && cfg.ALLOW_INSECURE_LOCAL_HTTP === "true")) throw new HttpError(403, "この操作は会場アプリから実行してください。");
  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new HttpError(415, "JSON形式で送信してください。");
}
export async function readJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "入力がありません。");
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 4096) { await reader.cancel(); throw new HttpError(413, "入力が長すぎます。"); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown; }
  catch { throw new HttpError(400, "JSON形式を確認してください。"); }
}
// Shared DB counters work across Node processes. No trust in client-supplied IP headers.
export async function rateLimit(key: string, limit: number, seconds = 60) {
  const rows = await db.$queryRaw<{ hits: number }[]>`
    INSERT INTO "RateLimitBucket" ("key", "hits", "expiresAt")
    VALUES (${key}, 1, timezone('UTC', now()) + ${seconds} * interval '1 second')
    ON CONFLICT ("key") DO UPDATE SET
      "hits" = CASE WHEN "RateLimitBucket"."expiresAt" <= timezone('UTC', now()) THEN 1 ELSE "RateLimitBucket"."hits" + 1 END,
      "expiresAt" = CASE WHEN "RateLimitBucket"."expiresAt" <= timezone('UTC', now()) THEN timezone('UTC', now()) + ${seconds} * interval '1 second' ELSE "RateLimitBucket"."expiresAt" END
    RETURNING "hits"`;
  if (rows[0].hits > limit) throw new HttpError(429, "操作が続いています。少し待ってからお試しください。");
}
