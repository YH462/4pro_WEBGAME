import { boss } from "@/lib/boss";

// Use a portrait of the same GLB for CPU battles and WebGL fallback.
export function EnemyArt() {
  return <svg viewBox="0 0 360 210" aria-hidden="true" className="enemy-fallback-art"><image href={boss.imageUrl} x="20" y="0" width="320" height="210" preserveAspectRatio="xMidYMid meet"/></svg>;
}
