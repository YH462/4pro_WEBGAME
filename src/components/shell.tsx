import Link from "next/link";
import { BookOpen, House, UserRound, Swords, ArrowUpRight } from "lucide-react";
import { HelpButton } from "./help-button";

const items = [
  { href: "/", label: "ホーム", sub: "HOME", icon: House },
  { href: "/collection", label: "キャラ図鑑", sub: "COLLECTION", icon: BookOpen },
  { href: "/battle", label: "バトル", sub: "CO-OP RAID", icon: Swords },
];

export function Shell({ children, active = "/" }: { children: React.ReactNode; active?: string }) {
  return <div className="app-shell">
    <header className="game-header">
      <Link href="/" className="brand" aria-label="4PRO ホーム"><span className="brand-number">4</span><span className="brand-word">PRO<small>EXHIBITION QUEST</small></span><span className="brand-slash" /></Link>
      <span className="header-event">4学科合同プロジェクト<span>展示をめぐる、協力する。</span></span>
      <div className="header-tools"><HelpButton/><Link href="/profile" className={`profile-link ${active === "/profile" ? "selected" : ""}`} aria-label="プロフィール"><UserRound size={20}/><span>マイページ</span></Link></div>
    </header>
    <main className="game-main">{children}</main>
    <footer className="game-footer"><div className="footer-caption"><span className="signal-dot"/> FOUR DEPARTMENTS.<br/><strong>ONE TEAM.</strong></div><nav className="command-dock" aria-label="メインナビゲーション">{items.map(({ href, label, sub, icon: Icon }) => <Link key={href} href={href} className={`dock-item ${active === href ? "active" : ""}`} aria-current={active === href ? "page" : undefined}><Icon size={23}/><span>{label}<small>{sub}</small></span><ArrowUpRight className="dock-arrow" size={16}/></Link>)}</nav><span className="footer-edition">4学科合同 展示周遊<br/><strong>EXPLORE / COLLECT / RAID</strong></span></footer>
  </div>;
}
