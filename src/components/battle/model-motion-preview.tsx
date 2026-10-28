"use client";
import { useState } from "react";
import type { CharacterModelAsset } from "@/lib/character-models";
import type { CharacterMotionCue } from "@/lib/character-motion-player";
import { PartnerScene } from "./partner-scene";
import styles from "@/app/models/models.module.css";

export function ModelMotionPreview({ element, characterId, name, model }: { element: string; characterId: string; name: string; model: CharacterModelAsset }) {
  const [motion, setMotion] = useState<CharacterMotionCue | null>(null);
  function play(action: "attack" | "heal") { setMotion({ action, key: `${characterId}:${performance.now()}` }); }
  return <>
    <div className={styles.stage} role="img" aria-label={`${name}の3Dモデル`}><PartnerScene element={element} characterId={characterId} model={model} motion={motion}/></div>
    {model.motions && <div className={styles.motionControls} aria-label={`${name}のモーション確認`}>
      {model.motions.attack && <button type="button" onClick={()=>play("attack")}>攻撃</button>}
      {model.motions.heal && <button type="button" onClick={()=>play("heal")}>回復</button>}
      <button type="button" onClick={()=>setMotion(null)}>停止</button>
    </div>}
  </>;
}
