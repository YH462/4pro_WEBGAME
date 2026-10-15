import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { config } from "../src/lib/config";
const [playerId, characterId] = process.argv.slice(2);
if (!config().simulator) throw new Error("Simulator requires development mode, loopback APP_URL and ENABLE_DEV_SIMULATOR=true.");
if (!playerId || !characterId) throw new Error("Usage: npm run simulator:grant -- PLAYER_ID CHARACTER_ID");
const db = new PrismaClient();
try {
  const player = await db.player.findUniqueOrThrow({ where: { id: playerId }, include: { event: true } });
  if (player.eventId !== config().EVENT_ID || player.event.status !== "ACTIVE") throw new Error("Player must belong to the active development event.");
  await db.playerCharacter.upsert({ where: { playerId_characterId: { playerId, characterId } }, update: {}, create: { playerId, characterId } });
  console.log("Development ownership fixture created. NFC/legend unlock rules are implemented in phase 2.");
} finally { await db.$disconnect(); }
