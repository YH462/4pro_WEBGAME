import { db } from "@/lib/db";
import { api, json } from "@/lib/http";
export async function GET() { return api(async () => { await db.$queryRaw`SELECT 1`; return json({ status: "ok", database: "connected" }); }); }
