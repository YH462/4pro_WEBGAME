"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Speech } from "lucide-react";
import { RaidNarration } from "@/lib/raid-narration";
import type { RaidGameVoiceState } from "@/lib/raid-game-voice";
import styles from "./raid-music-control.module.css";

export function RaidNarrationControl({ roomId, seconds, battle, onPlaying }: { roomId?: string; seconds?: number; battle?: RaidGameVoiceState; onPlaying: (playing: boolean) => void }) {
  const narration = useRef<RaidNarration | null>(null), attempt = useRef(0);
  const [status, setStatus] = useState<"off" | "loading" | "on">("off");
  const [error, setError] = useState("");
  const failed = useCallback(() => {
    attempt.current++; void narration.current?.setEnabled(false);
    setStatus("off"); setError("説明音声を再生できません。もう一度オンにしてください。");
  }, []);
  useEffect(() => { void narration.current?.setCue(roomId, seconds).catch(failed); }, [roomId, seconds, failed]);
  useEffect(() => { void narration.current?.setBattle(battle).catch(failed); }, [battle, failed]);
  useEffect(() => {
    const visibility = () => { void narration.current?.visibilityChanged().catch(failed); };
    document.addEventListener("visibilitychange", visibility);
    return () => { document.removeEventListener("visibilitychange", visibility); attempt.current++; narration.current?.dispose(); narration.current = null; };
  }, [failed]);
  const toggle = async () => {
    const current = ++attempt.current, enable = status === "off";
    setError(""); setStatus(enable ? "loading" : "off");
    try {
      narration.current ??= new RaidNarration(onPlaying);
      await narration.current.setCue(roomId, seconds);
      await narration.current.setBattle(battle);
      const enabled = await narration.current.setEnabled(enable);
      if (current === attempt.current) setStatus(enabled ? "on" : "off");
    } catch { if (current === attempt.current) failed(); }
  };
  return <><button type="button" className={styles.button} aria-label={`説明音声を${status === "off" ? "オン" : "オフ"}にする`} aria-pressed={status !== "off"} aria-busy={status === "loading"} onClick={() => void toggle()}><Speech/><span>説明音声 {status === "loading" ? "読込中" : status === "on" ? "オン" : "オフ"}</span></button>{error && <span className={styles.error} role="alert">{error}</span>}</>;
}
