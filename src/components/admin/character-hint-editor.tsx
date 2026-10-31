"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { hintImageKinds, hintImageLabels, maxHintImageBytes, type CharacterHintEditorData, type HintImageKind, type SavedHintImage } from "@/lib/character-hint-input";
import styles from "./admin.module.css";
import hintStyles from "./character-hint-editor.module.css";

type ImageDraft = { action: "keep" | "replace" | "remove"; alt: string; file: File | null };
const draftFrom = (saved: CharacterHintEditorData) => Object.fromEntries(hintImageKinds.map(kind => [kind, { action: "keep", alt: saved.images[kind]?.alt ?? "", file: null }])) as Record<HintImageKind, ImageDraft>;
const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024)).toLocaleString()} KB`;

function HintImageField({ kind, label, saved, draft, onChange, onError }: { kind: HintImageKind; label: string; saved: SavedHintImage | null; draft: ImageDraft; onChange: (draft: ImageDraft) => void; onError: (message: string) => void }) {
  const [blob, setBlob] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!draft.file) { setBlob(null); return; }
    const url = URL.createObjectURL(draft.file); setBlob(url); return () => URL.revokeObjectURL(url);
  }, [draft.file]);
  const src = draft.action === "remove" ? null : draft.file ? blob : saved?.src;
  return <div className={hintStyles.imageField}>
    <label htmlFor={`hint-${kind}`} className={hintStyles.imageLabel}>{label}</label>
    <div className={hintStyles.preview}>{src ? <img src={src} alt={`${label}の保存内容`}/> : <span>{draft.action === "remove" ? "保存すると削除されます" : "画像は未設定です"}</span>}</div>
    <input ref={input} id={`hint-${kind}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => {
      const file = event.target.files?.[0]; if (!file) return;
      if (file.size > maxHintImageBytes || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        onError("JPEG・PNG・WebPの静止画を1枚8MB以内で選択してください。"); event.target.value = ""; return;
      }
      onError(""); onChange({ ...draft, action: "replace", file });
    }}/>
    <p className={hintStyles.size}>{draft.file ? `選択中：${draft.file.name}（${kb(draft.file.size)}）` : draft.action !== "remove" && saved ? `保存済み：${saved.width} × ${saved.height} px ／ ${kb(saved.byteLength)}` : "画像を選択して保存してください。"}</p>
    <label htmlFor={`hint-alt-${kind}`}>画像の説明<input id={`hint-alt-${kind}`} maxLength={200} value={draft.alt} placeholder="写真の目印など（任意）" onChange={event => onChange({ ...draft, alt: event.target.value })}/></label>
    <div className={styles.actions}>
      {(saved || draft.file) && draft.action !== "remove" && <button type="button" className={styles.button} onClick={() => { if (input.current) input.current.value = ""; onChange({ action: "remove", alt: "", file: null }); }}>{label}を削除</button>}
      {draft.action !== "keep" && <button type="button" className={styles.button} onClick={() => { if (input.current) input.current.value = ""; onChange({ action: "keep", alt: saved?.alt ?? "", file: null }); }}>画像の変更を取り消す</button>}
    </div>
  </div>;
}

export function AdminCharacterHintEditor({ initial }: { initial: CharacterHintEditorData }) {
  const router = useRouter(), locked = useRef(false);
  const [saved, setSaved] = useState(initial), [text, setText] = useState(initial.text), [images, setImages] = useState(() => draftFrom(initial));
  const [location, setLocation] = useState(initial.location);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  const [ready, setReady] = useState(false), [resetKey, setResetKey] = useState(0);
  useEffect(() => setReady(true), []);
  const kinds: readonly HintImageKind[] = saved.singlePhoto ? ["overview"] : hintImageKinds;
  const total = Object.values(saved.images).reduce((sum, image) => sum + (image?.byteLength ?? 0), 0);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (locked.current) return;
    locked.current = true; setBusy(true); setError(""); setMessage("");
    try {
      const data = new FormData();
      data.set("data", JSON.stringify({ location, text, revision: saved.revision, images: Object.fromEntries(hintImageKinds.map(kind => [kind, { action: images[kind].action, alt: images[kind].alt }])) }));
      for (const kind of kinds) if (images[kind].file) data.set(kind, images[kind].file!);
      const response = await fetch(`/api/admin/characters/${encodeURIComponent(saved.characterId)}/hint`, { method: "PATCH", body: data });
      const result = await response.json();
      if (response.status === 401) { router.replace("/admin/login"); throw new Error("ログインの有効期限が切れました。"); }
      if (!response.ok) throw new Error(result.error || "ヒントを保存できませんでした。");
      const next: CharacterHintEditorData = result.hint;
      setSaved(next); setLocation(next.location); setText(next.text); setImages(draftFrom(next)); setResetKey(value => value + 1);
      setMessage("場所のヒントを保存しました。"); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "接続を確認して、もう一度お試しください。"); }
    finally { locked.current = false; setBusy(false); }
  }
  return <section id="location-hint-editor" className={`${styles.panel} ${hintStyles.editor}`} aria-labelledby="location-hint-edit-title">
    <h2 id="location-hint-edit-title">場所のヒントを編集</h2>
    <p className={styles.note}>{saved.singlePhoto ? "このキャラは写真1枚と補足テキストで案内します。" : "遠くからの写真・アップの写真・横長の地図を登録できます。"}</p>
    <p className={styles.note}>JPEG・PNG・WebP、1枚8MBまで。保存時に画像を軽量化します。</p>
    <form onSubmit={event => void save(event)}>
      <fieldset className={hintStyles.fields} disabled={!ready || busy}>
        <label htmlFor="location-hint-place">場所名<input id="location-hint-place" maxLength={200} placeholder="例：○○棟1階・4プロ会場" value={location} onChange={event => { setLocation(event.target.value); setMessage(""); }}/></label>
        <label htmlFor="location-hint-text">補足テキスト<textarea id="location-hint-text" rows={4} maxLength={1000} placeholder="目印や獲得場所の説明を入力してください。" value={text} onChange={event => { setText(event.target.value); setMessage(""); }}/></label>
        <div className={hintStyles.images}>{kinds.map(kind => <HintImageField key={`${resetKey}-${kind}`} kind={kind} label={saved.singlePhoto ? "展示の写真" : hintImageLabels[kind]} saved={saved.images[kind]} draft={images[kind]} onError={setError} onChange={draft => { setImages(current => ({ ...current, [kind]: draft })); setMessage(""); }}/>)}</div>
        <div className={styles.actions}><button type="submit" className={`${styles.button} ${styles.primary}`}>{busy ? "画像を軽量化して保存中…" : "場所のヒントを保存"}</button><a className={styles.button} href={`/admin/preview/collection/${encodeURIComponent(saved.characterId)}/hint`} target="_blank" rel="noopener noreferrer">保存済みのヒントを確認 ↗</a></div>
      </fieldset>
    </form>
    {total > 0 && <p className={styles.note}>保存済み画像の合計：{kb(total)}</p>}
    <p className={styles.error} role="alert">{error}</p><p className={styles.success} role="status">{message}</p>
  </section>;
}
