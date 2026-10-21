import { z } from "zod";
import { api, checkOrigin, HttpError, json, rateLimit, readJson } from "@/lib/http";
import { currentPlayer } from "@/lib/session";
import { acquireCharacter } from "@/lib/acquisition";
export const runtime = "nodejs";
const inputSchema = z.strictObject({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) });
export async function POST(request: Request) {
  return api(async () => {
    checkOrigin(request);
    const player = await currentPlayer();
    if (!player) throw new HttpError(401, "ゲストとしてはじめてください。");
    await rateLimit(`acquire:${player.id}`, 30);
    const input = inputSchema.parse(await readJson(request));
    return json(await acquireCharacter(player.id, input.token));
  });
}
