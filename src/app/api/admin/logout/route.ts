import { cookies } from "next/headers";
import { api, checkOrigin, json } from "@/lib/http";
import { db } from "@/lib/db";
import { ADMIN_COOKIE, adminCookieOptions } from "@/lib/admin-session";
import { tokenHash, validToken } from "@/lib/tokens";
export async function POST(request:Request) {
  return api(async()=>{
    checkOrigin(request);
    const token=(await cookies()).get(ADMIN_COOKIE)?.value;
    if(token && validToken(token)) await db.adminSession.deleteMany({where:{tokenHash:tokenHash(token)}});
    const response=json({ok:true});
    response.cookies.set(ADMIN_COOKIE,"",{...adminCookieOptions(),maxAge:0});
    return response;
  });
}
