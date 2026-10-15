import { Shell } from "@/components/shell";
import { ProfilePanel } from "@/components/profile-panel";
import { requirePlayer } from "@/lib/session";
export const dynamic = "force-dynamic";
export const metadata = { title: "プロフィール" };
export default async function Profile() {
  const player = await requirePlayer();
  return <Shell active="/profile"><div className="profile-screen"><div className="screen-heading"><div><span className="eyebrow">YOUR ADVENTURE LOG</span><h1>プロフィール</h1></div><span className="screen-code">PLAYER / 04</span></div><ProfilePanel id={player.id} nickname={player.nickname || ""} count={player.characters.length}/></div></Shell>;
}
