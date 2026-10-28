export const bossVariants = {
  red: "/models/bosses/des-dragoon-red.glb",
  blue: "/models/bosses/des-dragoon-blue.glb",
  green: "/models/bosses/des-dragoon-green.glb",
  yellow: "/models/bosses/des-dragoon-yellow.glb",
} as const;

export const boss = {
  name: "デスドラグーン",
  modelUrl: bossVariants.red,
  imageUrl: "/models/bosses/des-dragoon-red.webp",
  yaw: 0,
  motions: { attack: { url: "/models/motions/des-dragoon-red-attack.glb", yaw: 0 } },
} as const;
