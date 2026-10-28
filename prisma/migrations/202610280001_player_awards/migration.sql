CREATE TABLE "RaidReward" (
  "id" TEXT NOT NULL,
  "raidResultId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RaidReward_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RaidReward_positive_points" CHECK ("points" > 0),
  CONSTRAINT "RaidReward_raidResultId_fkey" FOREIGN KEY ("raidResultId") REFERENCES "RaidResult"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RaidReward_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RaidReward_raidResultId_key" ON "RaidReward"("raidResultId");
CREATE INDEX "RaidReward_playerId_awardedAt_idx" ON "RaidReward"("playerId", "awardedAt");

CREATE TABLE "PlayerAchievement" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "code" VARCHAR(64) NOT NULL,
  "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlayerAchievement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlayerAchievement_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlayerAchievement_playerId_code_key" ON "PlayerAchievement"("playerId", "code");
CREATE INDEX "PlayerAchievement_playerId_earnedAt_idx" ON "PlayerAchievement"("playerId", "earnedAt");
