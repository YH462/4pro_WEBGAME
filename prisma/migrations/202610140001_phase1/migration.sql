-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'ACTIVE',
    "endedAt" TIMESTAMP(3),
    "purgeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "nickname" VARCHAR(20),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GuestSession" (
    "id" TEXT NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "playerId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "element" TEXT NOT NULL,
    "departmentId" TEXT,
    "isLegendary" BOOLEAN NOT NULL DEFAULT false,
    "baseHp" INTEGER NOT NULL,
    "baseAttack" INTEGER NOT NULL,
    "baseDefense" INTEGER NOT NULL,
    "baseSpeed" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "effect" JSONB,

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerCharacter" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hpGrowth" INTEGER NOT NULL DEFAULT 0,
    "attackGrowth" INTEGER NOT NULL DEFAULT 0,
    "defenseGrowth" INTEGER NOT NULL DEFAULT 0,
    "speedGrowth" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PlayerCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Player_eventId_idx" ON "Player"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestSession_tokenHash_key" ON "GuestSession"("tokenHash");

-- CreateIndex
CREATE INDEX "GuestSession_expiresAt_idx" ON "GuestSession"("expiresAt");

-- CreateIndex
CREATE INDEX "GuestSession_playerId_idx" ON "GuestSession"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_sortOrder_key" ON "Department"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Character_departmentId_key" ON "Character"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Character_sortOrder_key" ON "Character"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_characterId_slot_key" ON "Skill"("characterId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerCharacter_playerId_characterId_key" ON "PlayerCharacter"("playerId", "characterId");

-- CreateIndex
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestSession" ADD CONSTRAINT "GuestSession_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCharacter" ADD CONSTRAINT "PlayerCharacter_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerCharacter" ADD CONSTRAINT "PlayerCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain constraints complement API validation.
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_slot_range" CHECK ("slot" BETWEEN 1 AND 3);
ALTER TABLE "Character" ADD CONSTRAINT "Character_positive_stats" CHECK ("baseHp" > 0 AND "baseAttack" > 0 AND "baseDefense" > 0 AND "baseSpeed" > 0);
ALTER TABLE "PlayerCharacter" ADD CONSTRAINT "PlayerCharacter_nonnegative_growth" CHECK ("hpGrowth" >= 0 AND "attackGrowth" >= 0 AND "defenseGrowth" >= 0 AND "speedGrowth" >= 0);
ALTER TABLE "Event" ADD CONSTRAINT "Event_end_dates" CHECK (("status" = 'ACTIVE' AND "endedAt" IS NULL AND "purgeAt" IS NULL) OR ("status" = 'ENDED' AND "endedAt" IS NOT NULL AND "purgeAt" IS NOT NULL AND "purgeAt" >= "endedAt"));
