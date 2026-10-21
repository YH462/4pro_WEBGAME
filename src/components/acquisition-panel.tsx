"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, Check, LoaderCircle, Sparkles } from "lucide-react";
import type { AcquisitionResult } from "@/lib/acquisition";
import { CharacterArt } from "./character-art";
import styles from "./acquisition.module.css";

export function AcquisitionPanel({ token, department, character, owned }: { token: string; department: string; character: AcquisitionResult["character"]; owned: boolean }) {
  const router = useRouter();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AcquisitionResult | null>(null);
  const done = owned || Boolean(result);
  async function acquire() {
    if (locked.current || done) return;
    locked.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/acquisitions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      const data = await response.json();
      if (response.status === 401) { router.replace(`/start?next=acquire&tag=${token}`); return; }
      if (!response.ok) throw new Error(data.error || "獲得できませんでした。もう一度お試しください。");
      setResult(data); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "接続を確認して、もう一度お試しください。"); }
    finally { locked.current = false; setBusy(false); }
  }
  return <section className={styles.page}>
    <div className="screen-heading"><h1>展示のパートナー</h1><span className={styles.department}>{department}</span></div>
    <div className={styles.card}>
      <span className={styles.eyebrow}>{done ? "YOUR NEW PARTNER" : "PARTNER FOUND"}</span>
      <div className={styles.art} role="img" aria-label={character.name}><CharacterArt element={character.element} portrait/></div>
      <h2>{character.name}</h2>
      <p role="status">{result?.acquired ? "新しいパートナーが仲間になりました！" : done ? "このパートナーは獲得済みです。" : `${department}のパートナーを仲間にしよう！`}</p>
      {result && <p className={styles.progress}>4学科のパートナー <b>{result.departmentCount} / 4</b></p>}
      {result?.legend && <div className={styles.legend} role="status"><Sparkles size={24}/><div><strong>4学科コンプリート！</strong><p>{result.legend.name}が仲間になりました！</p></div></div>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {done ? <><Link href={`/collection/${character.id}`} className="button primary"><Check size={19}/>パートナーを見る</Link><Link href="/collection" className="button"><BookOpen size={19}/>キャラ図鑑へ</Link></> : <button type="button" className="button primary" disabled={busy} onClick={() => void acquire()}>{busy ? <LoaderCircle className="spin" size={19}/> : <Sparkles size={19}/>} {busy ? "仲間にしています…" : "仲間にする"}</button>}
      <Link href="/" className={styles.home}>展示マップへ戻る</Link>
    </div>
  </section>;
}
