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
      for (const slot of [1, 2, 3]) await tx.skill.upsert({ where: { id: `${character.id}-${slot}` }, update: {}, create: { id: `${character.id}-${slot}`, characterId: character.id, slot, name: `固有技 ${slot}（仕様確認待ち）` } });
    }
  });
  console.log("Seed complete: event, 4 departments, 5 characters, 15 pending skill slots.");
} finally { await db.$disconnect(); }
