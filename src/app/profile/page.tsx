import { Shell } from "@/components/shell";
import { ProfilePanel } from "@/components/profile-panel";
import { requirePlayer } from "@/lib/session";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "@/components/profile-panel.module.css";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export const metadata = { title: "プロフィール" };
export default async function Profile() {
  const player = await requirePlayer();
  const total = await db.character.count();
  return <Shell active="/profile"><div className={styles.screen}><div className={styles.heading}><div><Link href="/" aria-label="ホームに戻る"><ArrowLeft size={21}/></Link><h1>プロフィール</h1></div><span>PLAYER / 04</span></div><ProfilePanel id={player.id} nickname={player.nickname || ""} count={player.characters.length} total={total}/></div></Shell>;
}
