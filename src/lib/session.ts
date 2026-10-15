import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "./db";
import { config } from "./config";
import { SESSION_COOKIE, tokenHash, validToken } from "./tokens";
export async function currentPlayer() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !validToken(token)) return null;
  const session = await db.guestSession.findUnique({ where: { tokenHash: tokenHash(token) }, include: { player: { include: { event: true, characters: { include: { character: true } } } } } });
  if (!session || session.expiresAt <= new Date() || session.player.eventId !== config().EVENT_ID) return null;
  return session.player;
}
export async function requirePlayer() {
  const player = await currentPlayer();
  if (!player) redirect("/start");
  return player;
}
export function sessionCookieOptions() {
  const cfg = config();
  return { httpOnly: true, secure: cfg.secureCookie, sameSite: "lax" as const, path: "/", maxAge: cfg.SESSION_DAYS * 86400 };
}
