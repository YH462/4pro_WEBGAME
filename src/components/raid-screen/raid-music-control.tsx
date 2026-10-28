"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { RaidMusic, type RaidMusicTrack } from "@/lib/raid-music";
import styles from "./raid-music-control.module.css";

export function RaidMusicControl({ track }: { track: RaidMusicTrack }) {
  const music = useRef<RaidMusic | null>(null);
  const attempt = useRef(0);
  const [status, setStatus] = useState<"off" | "loading" | "on">("off");
  const [error, setError] = useState("");
  useEffect(() => { music.current?.setTrack(track); }, [track]);
  useEffect(() => () => { attempt.current++; music.current?.dispose(); music.current = null; }, []);
  const toggle = async () => {
    const current = ++attempt.current, enable = status === "off";
    setError(""); setStatus(enable ? "loading" : "off");
    try {
      if (!music.current) music.current = new RaidMusic(track);
      const playing = await music.current.setEnabled(enable);
      if (current === attempt.current) setStatus(playing ? "on" : "off");
    } catch {
      if (current !== attempt.current) return;
      void music.current?.setEnabled(false);
      setStatus("off"); setError("BGMを再生できません。もう一度オンにしてください。");
    }
  };
  return <>
    <button type="button" className={styles.button} aria-pressed={status !== "off"} aria-busy={status === "loading"}
      aria-label={status === "off" ? "BGMをオンにする" : "BGMをオフにする"} onClick={() => void toggle()}>
      {status === "off" ? <VolumeX/> : <Volume2/>}<span>BGM {status === "loading" ? "読込中" : status === "on" ? "オン" : "オフ"}</span>
    </button>
    {error && <span className={styles.error} role="alert">{error}</span>}
  </>;
}
