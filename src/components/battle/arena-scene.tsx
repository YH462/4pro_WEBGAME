"use client";
import { useEffect, useRef, useState } from "react";
import type { createBattleArena } from "@/lib/battle-arena";
import { EnemyArt } from "./enemy-art";
import { boss } from "@/lib/boss";

export function ArenaScene({ animationId, caption = "EXHIBITION RAID / TEST ARENA", framing = "default" }: { animationId: number; caption?: string; framing?: "default" | "raid" }) {
  const root = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const arena = useRef<ReturnType<typeof createBattleArena> | null>(null);
  const [mode, setMode] = useState("loading");
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    const target = canvas.current;
    const lost = (event: Event) => {
      event.preventDefault();
      observer?.disconnect();
      target?.removeEventListener("webglcontextlost", lost);
      arena.current?.dispose();
      arena.current = null;
      setMode("fallback");
    };
    target?.addEventListener("webglcontextlost", lost);
    void import("@/lib/battle-arena").then(({ createBattleArena }) => {
      if (cancelled || !target || !root.current) return;
      try {
        arena.current = createBattleArena(target, { framing });
        observer = new ResizeObserver(([entry]) => arena.current?.resize(entry.contentRect.width, entry.contentRect.height));
        observer.observe(root.current);
        arena.current.resize(root.current.clientWidth, root.current.clientHeight);
        const activeArena = arena.current;
        void activeArena.ready.then(() => { if (!cancelled && arena.current === activeArena) setMode("webgl"); }).catch(() => {
          if (cancelled || arena.current !== activeArena) return;
          observer?.disconnect(); activeArena.dispose(); arena.current = null; setMode("fallback");
        });
      } catch { arena.current?.dispose(); arena.current = null; setMode("fallback"); }
    }).catch(() => { if (!cancelled) setMode("fallback"); });
    return () => {
      cancelled = true;
      observer?.disconnect();
      target?.removeEventListener("webglcontextlost", lost);
      arena.current?.dispose();
      arena.current = null;
    };
  }, [framing]);
  useEffect(() => { if (animationId > 0) arena.current?.attack(); }, [animationId]);
  return <div className={`arena-scene arena-${mode}`} ref={root} data-renderer={mode}><EnemyArt/><canvas ref={canvas} aria-label={`立体の${boss.name}`} role="img"/><span className="arena-floor-label">{caption}</span></div>;
}
