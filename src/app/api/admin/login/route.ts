import { cookies } from "next/headers";
import { z } from "zod";
import { api, checkOrigin, HttpError, json, rateLimit, readJson } from "@/lib/http";
import { db } from "@/lib/db";
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, adminCookieOptions } from "@/lib/admin-session";
import { dummyAdminHash, verifyAdminPassword } from "@/lib/admin-password";
import { newToken, tokenHash, validToken } from "@/lib/tokens";
const inputSchema=z.strictObject({username:z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{2,31}$/),password:z.string().min(1).max(128)});
export const runtime="nodejs";
export async function POST(request:Request) {
  return api(async()=>{
    checkOrigin(request);
    const input=inputSchema.parse(await readJson(request));
    await rateLimit("admin-login:global",120);
    await rateLimit(`admin-login:${tokenHash(input.username)}`,10);
    const admin=await db.adminUser.findUnique({where:{username:input.username}});
    const valid=await verifyAdminPassword(input.password,admin?.passwordHash??dummyAdminHash);
    if(!valid || !admin?.enabled) throw new HttpError(401,"ユーザー名またはパスワードが違います。");
    const previous=(await cookies()).get(ADMIN_COOKIE)?.value;
    const token=newToken();
    // Password rotation / account disabling takes the same row lock and revokes sessions.
    await db.$transaction(async(tx)=>{
      const rows=await tx.$queryRaw<{passwordHash:string;enabled:boolean}[]>`SELECT "passwordHash", "enabled" FROM "AdminUser" WHERE "id" = ${admin.id} FOR UPDATE`;
      if(!rows[0]?.enabled || rows[0].passwordHash!==admin.passwordHash) throw new HttpError(401,"もう一度ログインしてください。");
      if(previous && validToken(previous)) await tx.adminSession.deleteMany({where:{tokenHash:tokenHash(previous)}});
      await tx.adminSession.deleteMany({where:{adminId:admin.id,expiresAt:{lte:new Date()}}});
      await tx.adminSession.create({data:{adminId:admin.id,tokenHash:tokenHash(token),expiresAt:new Date(Date.now()+ADMIN_SESSION_SECONDS*1000)}});
    });
    const response=json({admin:{username:admin.username}});
    response.cookies.set(ADMIN_COOKIE,token,adminCookieOptions());
    return response;
  });
}
