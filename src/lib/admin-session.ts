import { cookies } from "next/headers";
import { db } from "./db";
import { config } from "./config";
import { tokenHash, validToken } from "./tokens";
import { HttpError } from "./http-error";
export const ADMIN_COOKIE = "fourpro_admin";
export const ADMIN_SESSION_SECONDS = 8*60*60;
export async function currentAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token || !validToken(token)) return null;
  const session = await db.adminSession.findUnique({ where:{tokenHash:tokenHash(token)},include:{admin:true} });
  if (!session || session.expiresAt <= new Date() || !session.admin.enabled) return null;
  return { id:session.admin.id,username:session.admin.username };
}
export async function requireAdmin() {
  const admin = await currentAdmin();
  if (!admin) throw new HttpError(401,"管理者としてログインしてください。");
  return admin;
}
export const adminCookieOptions = () => ({ httpOnly:true,secure:config().secureCookie,sameSite:"strict" as const,path:"/",maxAge:ADMIN_SESSION_SECONDS });
