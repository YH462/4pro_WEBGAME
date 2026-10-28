import * as THREE from "three";

/** Blender exports one clip per object/bone action. Play them together, with
 * their relative timing intact, rather than choosing only the first object. */
export function combineCharacterMotion(clips: readonly THREE.AnimationClip[]) {
  const tracks = [...new Map(clips.flatMap(clip => clip.tracks).map(track => [track.name, track])).values()];
  const moving = tracks.filter(track => {
    const width = track.getValueSize();
    return track.times.length > 1 && track.values.some((value, index) => Math.abs(value - track.values[index % width]) > 1e-6);
  });
  if (!moving.length) throw new Error("The motion has no animated tracks.");
  const start = Math.min(...moving.map(track => track.times[0]));
  const end = Math.max(...moving.map(track => track.times[track.times.length - 1]));
  if (!(end > start)) throw new Error("Invalid motion duration.");
  const shifted = tracks.map(track => {
    const copy = track.clone().shift(-start);
    // A constant object's sole key can precede the animated portion.
    if (copy.times.length === 1) copy.times[0] = 0;
    return copy.trim(0, end - start);
  });
  return new THREE.AnimationClip("raid-action", end - start, shifted);
}
