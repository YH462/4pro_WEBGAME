"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { createRaidPartnerArena } from "@/lib/raid-partner-arena";
import type { CharacterModelAsset } from "@/lib/character-models";
import { useCharacterModels } from "./use-character-models";
import { CharacterArt } from "../character-art";
import styles from "./raid-mobile.module.css";

export function PartnerScene({ element, characterId, imageUrl, model }: { element: string; characterId: string; imageUrl?:string|null; model?:CharacterModelAsset|null }) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const models = useCharacterModels(model===undefined);
  const resolved = model===undefined ? models?.[characterId]??null : model;
  const asset = useMemo(()=>resolved,[resolved?.url,resolved?.yaw]);
  const catalogReady=model!==undefined||models!==null;
  const imageOnly = Boolean(imageUrl && !asset);
  const sceneKey = `${characterId}:${element}:${imageOnly ? imageUrl : "model"}:${asset?.url??""}:${asset?.yaw??0}`;
  const [view,setView]=useState({ key:"", mode:"loading", model:"loading" });
  const mode=imageOnly?"image":view.key===sceneKey ? view.mode : "loading";
  const modelState=imageOnly?"image":view.key===sceneKey?view.model:"loading";
  const pending=!catalogReady||Boolean(asset)&&modelState==="loading";
  useEffect(() => {
    if(!catalogReady||imageOnly)return;
    let disposed=false, observer: ResizeObserver | undefined, arena: ReturnType<typeof createRaidPartnerArena> | undefined;
    const target=canvas.current!;
    const lost=(event:Event) => { event.preventDefault(); target.removeEventListener("webglcontextlost",lost); observer?.disconnect(); arena?.dispose(); arena=undefined; if(!disposed) setView({key:sceneKey,mode:"fallback",model:"fallback"}); };
    target.addEventListener("webglcontextlost",lost);
    void import("@/lib/raid-partner-arena").then(({createRaidPartnerArena}) => {
      if(disposed) return;
      try {
        arena=createRaidPartnerArena(target,element,characterId,(model)=>{
          if(!disposed) setView({key:sceneKey,mode:"webgl",model});
        },asset);
        observer=new ResizeObserver(([entry])=>arena?.resize(entry.contentRect.width,entry.contentRect.height)); observer.observe(target);
        const rect=target.getBoundingClientRect(); arena.resize(rect.width,rect.height);
        setView({key:sceneKey,mode:"webgl",model:asset?"loading":"procedural"});
      } catch { arena?.dispose(); arena=undefined; setView({key:sceneKey,mode:"fallback",model:"fallback"}); }
    }).catch(()=>{ if(!disposed) setView({key:sceneKey,mode:"fallback",model:"fallback"}); });
    return () => { disposed=true; target.removeEventListener("webglcontextlost",lost); observer?.disconnect(); arena?.dispose(); };
  },[element,characterId,imageOnly,sceneKey,asset,catalogReady]);
  return <div className={styles.partnerModel} data-renderer={mode} data-facing="front" data-character-id={characterId} data-model-url={asset?.url} data-model-state={modelState} aria-busy={pending}>
    {pending?<div className={styles.partnerLoading} role="status"><span aria-hidden="true"/>モデルを読み込み中…</div>:<div className={styles.partnerFallback}><CharacterArt element={element} imageUrl={imageUrl} portrait/></div>}
    <canvas ref={canvas} key={sceneKey} aria-hidden="true" hidden={pending}/>
  </div>;
}
