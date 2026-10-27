CREATE TABLE "RaidResult" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "characterName" TEXT NOT NULL,
    "bossName" TEXT NOT NULL,
    "won" BOOLEAN NOT NULL,
    "turns" INTEGER NOT NULL CHECK ("turns" > 0),
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RaidResult_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "RaidResult_roomId_playerId_key" ON "RaidResult"("roomId", "playerId");
CREATE INDEX "RaidResult_playerId_finishedAt_idx" ON "RaidResult"("playerId", "finishedAt");
ALTER TABLE "RaidResult" ADD CONSTRAINT "RaidResult_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
