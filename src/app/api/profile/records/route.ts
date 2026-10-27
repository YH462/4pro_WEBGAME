import { currentPlayer } from "@/lib/session";
import { api, HttpError, json } from "@/lib/http";
import { playerRecords } from "@/lib/player-records";

export const dynamic = "force-dynamic";
export async function GET() {
  return api(async () => {
    const player = await currentPlayer();
    if (!player) throw new HttpError(401, "ゲストとしてはじめてください。");
    return json({ records: await playerRecords(player.id) });
  });
}
