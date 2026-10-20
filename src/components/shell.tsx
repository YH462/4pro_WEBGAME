import Link from "next/link";
import { BookOpen, House, UserRound, Swords } from "lucide-react";
import { HelpButton } from "./help-button";
import styles from "./navigation.module.css";

const items = [
  { href: "/", label: "ホーム", sub: "HOME", icon: House },
  { href: "/collection", label: "キャラ図鑑", sub: "COLLECTION", icon: BookOpen },
  { href: "/battle", label: "バトル", sub: "CPU BATTLE", icon: Swords },
];

export function Shell({ children, active = "/" }: { children: React.ReactNode; active?: string }) {
  return <div className="app-shell">
    <header className="game-header">
      <Link href="/" className="brand" aria-label="4PRO ホーム"><span className="brand-number">4</span><span className="brand-word">PRO</span><span className="brand-slash" /></Link>
      <span className="header-event">4学科合同プロジェクト</span>
      <div className="header-tools"><HelpButton/><Link href="/profile" className={`profile-link ${active === "/profile" ? "selected" : ""}`} aria-label="プロフィール" title="アカウント"><UserRound size={20}/></Link></div>
    </header>
    <main className="game-main">{children}</main>
    <footer className={styles.footer}>
      <nav className={`command-dock ${styles.navigation}`} aria-label="メインナビゲーション">
        {items.map(({ href, label, sub, icon: Icon }) => (
          <Link key={href} href={href} className={`${styles.hexagon} ${active === href ? styles.active : ""}`} aria-current={active === href ? "page" : undefined}>
            <Icon size={24}/>
            <span>{label}<small>{sub}</small></span>
          </Link>
        ))}
      </nav>
    </footer>
  </div>;
}
