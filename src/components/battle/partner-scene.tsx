"use client";
import { useEffect, useRef, useState } from "react";
import type { createRaidPartnerArena } from "@/lib/raid-partner-arena";
import { CharacterArt } from "../character-art";
import styles from "./raid-mobile.module.css";

export function PartnerScene({ element, characterId, imageUrl }: { element: string; characterId: string; imageUrl?:string|null }) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const [view,setView]=useState({ element:"", mode:"loading" });
  const mode=imageUrl?"image":view.element===element ? view.mode : "loading";
  useEffect(() => {
    if(imageUrl)return;
    let disposed=false, observer: ResizeObserver | undefined, arena: ReturnType<typeof createRaidPartnerArena> | undefined;
    const target=canvas.current!;
    const lost=(event:Event) => { event.preventDefault(); target.removeEventListener("webglcontextlost",lost); observer?.disconnect(); arena?.dispose(); arena=undefined; if(!disposed) setView({element,mode:"fallback"}); };
    target.addEventListener("webglcontextlost",lost);
    void import("@/lib/raid-partner-arena").then(({createRaidPartnerArena}) => {
      if(disposed) return;
      try {
        arena=createRaidPartnerArena(target,element);
        observer=new ResizeObserver(([entry])=>arena?.resize(entry.contentRect.width,entry.contentRect.height)); observer.observe(target);
        const rect=target.getBoundingClientRect(); arena.resize(rect.width,rect.height); setView({element,mode:"webgl"});
      } catch { arena?.dispose(); arena=undefined; setView({element,mode:"fallback"}); }
    }).catch(()=>{ if(!disposed) setView({element,mode:"fallback"}); });
    return () => { disposed=true; target.removeEventListener("webglcontextlost",lost); observer?.disconnect(); arena?.dispose(); };
  },[element,imageUrl]);
  return <div className={styles.partnerModel} data-renderer={mode} data-facing="front" data-character-id={characterId}>
    <div className={styles.partnerFallback}><CharacterArt element={element} imageUrl={imageUrl} portrait/></div><canvas ref={canvas} key={`${element}:${imageUrl??"model"}`} aria-hidden="true"/>
  </div>;
}
