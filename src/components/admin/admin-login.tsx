"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";
export function AdminLogin({destination="/admin"}:{destination?:"/admin"|"/raid/screen"}) {
  const router=useRouter(); const [ready,setReady]=useState(false),[busy,setBusy]=useState(false),[username,setUsername]=useState(""),[password,setPassword]=useState(""),[error,setError]=useState("");
  useEffect(()=>{setReady(true);},[]);
  return <section className={styles.login}><h1>管理者ログイン</h1><form className={styles.form} onSubmit={async(event)=>{event.preventDefault();if(busy)return;setBusy(true);setError("");try{const response=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})});const data=await response.json();if(!response.ok)throw new Error(data.error||"ログインできませんでした。");setPassword("");router.replace(destination);router.refresh();}catch(reason){setPassword("");setError(reason instanceof Error?reason.message:"接続を確認してください。");}finally{setBusy(false);}}}><label htmlFor="admin-username">ユーザー名<input id="admin-username" autoComplete="username" required maxLength={32} value={username} onChange={(event)=>setUsername(event.target.value)} disabled={!ready||busy}/></label><label htmlFor="admin-password">パスワード<input id="admin-password" type="password" autoComplete="current-password" required maxLength={128} value={password} onChange={(event)=>setPassword(event.target.value)} disabled={!ready||busy}/></label><button type="submit" className={`${styles.button} ${styles.primary}`} disabled={!ready||busy}>{busy?"ログインしています…":"ログイン"}</button><p className={`${styles.status} ${styles.error}`} role="alert">{error}</p></form></section>;
}
