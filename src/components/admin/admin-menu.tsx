"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BarChart3, BookOpen, LogOut, Monitor, Settings2, ShieldCheck } from "lucide-react";
import styles from "./admin-menu.module.css";

const destinations=[
  {href:"/admin",label:"キャラクター管理",icon:Settings2},
  {href:"/admin/statistics",label:"統計・CSV",icon:BarChart3},
  {href:"/admin/preview",label:"全キャラ表示",icon:BookOpen},
  {href:"/raid/screen",label:"会場スクリーン",icon:Monitor},
];
export function AdminMenu({compact=false,up=false}:{compact?:boolean;up?:boolean}){
  const pathname=usePathname(),router=useRouter(),details=useRef<HTMLDetailsElement>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  useEffect(()=>{details.current?.removeAttribute("open");},[pathname]);
  return <details ref={details} className={`${styles.menu} ${compact?styles.compact:""} ${up?styles.up:""}`}>
    <summary aria-label="管理メニュー"><ShieldCheck size={20}/><span>管理メニュー</span></summary>
    <div className={styles.panel}><nav aria-label="管理画面の切り替え">{destinations.map(({href,label,icon:Icon})=>{
      const selected=href==="/admin"?pathname==="/admin"||pathname.startsWith("/admin/characters/"):pathname.startsWith(href);
      return <Link href={href} key={href} aria-current={selected?"page":undefined} onClick={()=>details.current?.removeAttribute("open")}><Icon size={19}/>{label}</Link>;
    })}</nav><button type="button" disabled={busy} onClick={async()=>{
      setBusy(true);setError("");
      try{const response=await fetch("/api/admin/logout",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});if(!response.ok)throw new Error("ログアウトできませんでした。");router.replace("/admin/login");router.refresh();}
      catch{setError("接続を確認して、もう一度お試しください。");}
      finally{setBusy(false);}
    }}><LogOut size={19}/>{busy?"ログアウト中…":"ログアウト"}</button>{error&&<p role="alert">{error}</p>}</div>
  </details>;
}
