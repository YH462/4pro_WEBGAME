"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./admin.module.css";
export function AdminHeader({username}:{username?:string}) {
  const [ready,setReady]=useState(false);useEffect(()=>{setReady(true);},[]);
  const router=useRouter(); const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  return <header className={styles.header}><Link href="/admin" className={styles.brand}>4PRO</Link>{username?<div className={styles.account}><span>{username}</span><button type="button" disabled={!ready||busy} onClick={async()=>{setBusy(true);setError("");try{const response=await fetch("/api/admin/logout",{method:"POST",headers:{"Content-Type":"application/json"},body:"{}"});if(!response.ok)throw new Error("ログアウトできませんでした。");router.replace("/admin/login");router.refresh();}catch{setError("接続を確認して、もう一度お試しください。");}finally{setBusy(false);}}}>{busy?"処理中…":"ログアウト"}</button>{error&&<span role="alert" className={styles.error}>{error}</span>}</div>:<Link href="/" className={styles.button}>ゲームへ戻る</Link>}</header>;
}
