import { z } from "zod";
import { requireAdmin } from "@/lib/admin-session";
import { api, HttpError, json, rateLimit } from "@/lib/http";
import { config } from "@/lib/config";
import { withProductionRaid } from "@/lib/production-raid";
import { raidReceptionQr } from "@/lib/raid-entry-image";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return api(async () => {
    const admin = await requireAdmin(); await rateLimit(`raid-entry:${admin.id}`, 60);
    const roomId = z.uuid().parse(new URL(request.url).searchParams.get("roomId"));
    await withProductionRaid(room => {
      const state = room.snapshot();
      if (state.roomId !== roomId || state.round.phase !== "lobby") throw new HttpError(409, "このレイドの参加受付は終了しました。");
    });
    return json({ target: await raidReceptionQr(config().origin, roomId) });
  });
}
