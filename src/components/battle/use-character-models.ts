"use client";
import { useEffect, useState } from "react";
import type { CharacterModelCatalog } from "@/lib/character-models";
let cached: CharacterModelCatalog | null = null, fetched = 0, pending: Promise<CharacterModelCatalog> | null = null;
async function load() {
  if (cached && Date.now() - fetched < 1000) return cached;
  if (!pending) pending = fetch("/api/character-models", { cache: "no-store" }).then(async (response) => {
    if (!response.ok) throw new Error("モデル情報を取得できません。");
    const { models } = await response.json();
    if (JSON.stringify(models) !== JSON.stringify(cached)) cached = models;
    fetched = Date.now(); return cached!;
  }).finally(() => { pending = null; });
  return pending;
}
export function refreshCharacterModels() { fetched = 0; window.dispatchEvent(new Event("character-models-changed")); }
export function useCharacterModels(enabled = true) {
  const [models, setModels] = useState<CharacterModelCatalog | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    const refresh = () => { void load().then((value) => { if (!disposed) setModels(value); }).catch(() => { if (!disposed) setModels((value) => value ?? {}); }); };
    const changed = () => { fetched=0; refresh(); };
    refresh(); const timer = window.setInterval(()=>{if(!document.hidden)refresh();}, 15000);
    window.addEventListener("focus", changed); window.addEventListener("character-models-changed", changed); document.addEventListener("visibilitychange", changed);
    return () => { disposed = true; clearInterval(timer); window.removeEventListener("focus", changed); window.removeEventListener("character-models-changed", changed); document.removeEventListener("visibilitychange", changed); };
  }, [enabled]);
  return models;
}
