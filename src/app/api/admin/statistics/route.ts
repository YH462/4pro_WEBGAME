import { requireAdmin } from "@/lib/admin-session";
import { api, HttpError, json } from "@/lib/http";
import { readEventStatistics } from "@/lib/event-statistics-query";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:Request){return api(async()=>{
  await requireAdmin();
  if(new URL(request.url).searchParams.size)throw new HttpError(400,"集計対象は現在のイベントです。");
  return json({statistics:(await readEventStatistics()).dashboard});
});}
