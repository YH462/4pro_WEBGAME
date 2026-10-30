import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-session";
import { api, HttpError } from "@/lib/http";
import { readEventStatistics } from "@/lib/event-statistics-query";
import { japaneseDate } from "@/lib/event-statistics";
import { csvZip, exportStatistics, statisticsFiles, type StatisticsFile } from "@/lib/statistics-csv";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export async function GET(request:Request){return api(async()=>{
  await requireAdmin();
  const params=new URL(request.url).searchParams,file=params.get("file")??"all";
  if([...params.keys()].some(key=>key!=="file")||params.getAll("file").length>1||file!=="all"&&!statisticsFiles.includes(file as StatisticsFile))throw new HttpError(400,"出力ファイルを確認してください。");
  const snapshot=await readEventStatistics(),files=exportStatistics(snapshot),zip=file==="all";
  const stamp=japaneseDate(snapshot.dashboard.generatedAt).slice(0,19).replace(/[-:T]/g,"");
  const stem=`4pro-${snapshot.dashboard.event.id.replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,70)}-${stamp}`;
  const named=Object.fromEntries(statisticsFiles.map(key=>[`${stem}-${key}.csv`,files[key]]));
  const data=zip?csvZip(named):files[file as StatisticsFile],filename=zip?`${stem}.zip`:`${stem}-${file}.csv`;
  return new NextResponse(new Uint8Array(data),{headers:{"Content-Type":zip?"application/zip":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="${filename}"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
});}
