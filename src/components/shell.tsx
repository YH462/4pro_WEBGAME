import Link from "next/link";
import { BookOpen, House, UserRound, Swords, ShieldCheck } from "lucide-react";
import { HelpButton } from "./help-button";
import styles from "./navigation.module.css";
import { AdminMenu } from "./admin/admin-menu";

const items = [
  { href: "/", label: "ホーム", icon: House },
  { href: "/collection", label: "キャラ図鑑", icon: BookOpen },
  { href: "/battle", label: "バトル", icon: Swords },
];

export function Shell({ children, active = "/", preview = false }: { children: React.ReactNode; active?: string; preview?: boolean }) {
  const navigation=preview?[
    {href:"/admin/preview",label:"ホーム",icon:House},
    {href:"/admin/preview/collection",label:"キャラ図鑑",icon:BookOpen},
    {href:"/admin",label:"管理画面",icon:ShieldCheck},
  ]:items;
  return <div className="app-shell">
    <header className="game-header">
      <Link href={preview?"/admin/preview":"/"} className="brand" aria-label="4PRO ホーム"><span className="brand-number">4</span><span className="brand-word">PRO</span><span className="brand-slash" /></Link>

      <div className="header-tools">{preview?<><span className={styles.previewLabel}>全キャラ表示</span><AdminMenu compact/></>:<><HelpButton/><Link href="/profile" className={`profile-link ${active === "/profile" ? "selected" : ""}`} aria-label="プロフィール" title="アカウント"><UserRound size={20}/></Link></>}</div>
    </header>
    <main className="game-main">{children}</main>
    <footer className={styles.footer}>
      <nav className={`command-dock ${styles.navigation}`} aria-label="メインナビゲーション">
        {navigation.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={`${styles.hexagon} ${active === href ? styles.active : ""}`} aria-current={active === href ? "page" : undefined}>
            <Icon size={24}/>
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </footer>
  </div>;
}
