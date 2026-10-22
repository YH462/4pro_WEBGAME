CREATE TABLE "AcquisitionTag" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcquisitionTag_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcquisitionTag_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AcquisitionTag_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AcquisitionTag_tokenHash_key" ON "AcquisitionTag"("tokenHash");
CREATE INDEX "AcquisitionTag_eventId_idx" ON "AcquisitionTag"("eventId");
CREATE TABLE "AcquisitionLog" (
  "id" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "granted" BOOLEAN NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcquisitionLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcquisitionLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AcquisitionLog_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "AcquisitionTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AcquisitionLog_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AcquisitionLog_playerId_tagId_key" ON "AcquisitionLog"("playerId", "tagId");
CREATE INDEX "AcquisitionLog_tagId_idx" ON "AcquisitionLog"("tagId");
CREATE INDEX "AcquisitionLog_characterId_idx" ON "AcquisitionLog"("characterId");
