import { db } from "@/lib/db";
import { config } from "@/lib/config";
import { api, checkOrigin, HttpError, json, rateLimit, readJson } from "@/lib/http";
import { currentPlayer, sessionCookieOptions } from "@/lib/session";
import { newToken, SESSION_COOKIE, tokenHash } from "@/lib/tokens";
import { nicknameSchema } from "@/lib/validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const input = nicknameSchema.parse(await readJson(request));
    const cfg = config();
    await rateLimit(`guest:${cfg.EVENT_ID}`, 240);
    const existing = await currentPlayer();
    if (existing) return json({ player: { id: existing.id, nickname: existing.nickname } });
    const token = newToken();
    const player = await db.$transaction(async (tx) => {
      // Lock coordinates guest creation with the explicit end/purge CLI.
      const events = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Event" WHERE "id" = ${cfg.EVENT_ID} FOR SHARE`;
      if (events[0]?.status !== "ACTIVE") throw new HttpError(409, "現在はイベント受付期間外です。");
      return tx.player.create({ data: { eventId: cfg.EVENT_ID, nickname: input.nickname || null, sessions: { create: { tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + cfg.SESSION_DAYS * 86400_000) } } } });
    });
    const response = json({ player: { id: player.id, nickname: player.nickname } }, 201);
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  });
}
