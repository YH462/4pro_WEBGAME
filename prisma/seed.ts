import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { characters, departments } from "../src/lib/master-data";
const db = new PrismaClient();
try {
  await db.$transaction(async (tx) => {
    await tx.event.upsert({ where: { id: process.env.EVENT_ID || "local-exhibition" }, update: {}, create: { id: process.env.EVENT_ID || "local-exhibition", name: "4学科合同プロジェクト 展示周遊" } });
    // Re-running the seed preserves staff-edited master data and event status.
    for (const department of departments) await tx.department.upsert({ where: { id: department.id }, update: {}, create: department });
    for (const character of characters) {
      await tx.character.upsert({ where: { id: character.id }, update: {}, create: character });
      await tx.skill.upsert({ where: { characterId_slot: { characterId: character.id, slot: 1 } }, update: {}, create: { id: `${character.id}-1`, characterId: character.id, slot: 1, name: "必殺技（仕様確認待ち）" } });
    }
  });
  console.log("Seed complete: event, 4 departments, 5 characters, 1 special move per character.");
} finally { await db.$disconnect(); }
