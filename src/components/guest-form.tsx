"use client";
import { useId, useState, type Ref } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle, X } from "lucide-react";
export function GuestForm({ initialNickname = "", mode = "start", className = "", inputRef }: { initialNickname?: string; mode?: "start" | "edit"; className?: string; inputRef?: Ref<HTMLInputElement> }) {
  const router = useRouter();
  const [nickname, setNickname] = useState(initialNickname);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inputId = useId();
  return <form className={`guest-form ${className}`} onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch(mode === "start" ? "/api/guest" : "/api/me", { method: mode === "start" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "保存できませんでした。");
      if (mode === "start") { router.replace("/"); router.refresh(); }
      else { setMessage("ニックネームを保存しました。"); router.refresh(); }
    } catch (error) { setMessage(error instanceof Error ? error.message : "接続を確認してください。"); }
    finally { setBusy(false); }
  }}><label htmlFor={inputId}>ニックネーム <span>任意</span></label><div className="nickname-input"><input ref={inputRef} id={inputId} name="nickname" autoComplete="nickname" maxLength={20} placeholder="例：よつば" value={nickname} disabled={busy} onChange={(event) => { setNickname(event.target.value); setMessage(""); }}/>{mode === "edit" && nickname && <button type="button" className="nickname-clear" aria-label="ニックネームをクリア" disabled={busy} onClick={() => { setNickname(""); setMessage(""); }}><X size={17}/></button>}</div><p className="field-help">空欄のままでも参加できます。あとから変更できます。</p><button className="button primary" disabled={busy}>{busy ? <LoaderCircle className="spin" size={18}/> : null}{mode === "start" ? "ゲストではじめる" : "変更を保存"}<ArrowRight size={17}/></button><p role="status" className="form-status">{message}</p></form>;
}
