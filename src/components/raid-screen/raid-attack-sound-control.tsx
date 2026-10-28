"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { RaidAttackSound, type RaidSoundEffect } from "@/lib/raid-attack-sound";
import styles from "./raid-music-control.module.css";

export type RaidAttackSoundHandle = { play: (effect: RaidSoundEffect) => void; stop: () => void };
export function RaidAttackSoundControl({ ref }: { ref: Ref<RaidAttackSoundHandle> }) {
  const sound = useRef<RaidAttackSound | null>(null), attempt = useRef(0);
  const [status, setStatus] = useState<"off" | "loading" | "on">("off");
  const [error, setError] = useState("");
  useImperativeHandle(ref, () => ({ play: effect => sound.current?.play(effect), stop: () => sound.current?.stop() }), []);
  useEffect(() => () => { attempt.current++; sound.current?.dispose(); sound.current = null; }, []);
  const toggle = async () => {
    const current = ++attempt.current, enabled = status === "off";
    setError(""); setStatus(enabled ? "loading" : "off");
    try {
      if (!sound.current) sound.current = new RaidAttackSound();
      const playing = await sound.current.setEnabled(enabled);
      if (current === attempt.current) setStatus(playing ? "on" : "off");
    } catch {
      if (current !== attempt.current) return;
      void sound.current?.setEnabled(false).catch(() => {});
      setStatus("off"); setError("効果音を再生できません。もう一度オンにしてください。");
    }
  };
  return <>
    <button type="button" className={styles.button} aria-pressed={status !== "off"} aria-busy={status === "loading"}
      aria-label={status === "off" ? "効果音をオンにする" : "効果音をオフにする"} onClick={() => void toggle()}>
      {status === "off" ? <VolumeX/> : <Volume2/>}<span>効果音 {status === "on" ? "オン" : status === "loading" ? "準備中" : "オフ"}</span>
    </button>
    {error && <span className={styles.error} role="alert">{error}</span>}
  </>;
}
