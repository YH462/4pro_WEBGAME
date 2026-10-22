ALTER TABLE "AcquisitionTag" ALTER COLUMN "departmentId" DROP NOT NULL;
ALTER TABLE "AcquisitionTag" ADD COLUMN "characterId" TEXT;
ALTER TABLE "AcquisitionTag" ADD CONSTRAINT "AcquisitionTag_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcquisitionTag" ADD CONSTRAINT "AcquisitionTag_one_target" CHECK (("departmentId" IS NOT NULL AND "characterId" IS NULL) OR ("departmentId" IS NULL AND "characterId" IS NOT NULL));
CREATE INDEX "AcquisitionTag_characterId_idx" ON "AcquisitionTag"("characterId");
CREATE TABLE "AdminUser" (
  "id" TEXT NOT NULL,
  "username" VARCHAR(32) NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");
CREATE TABLE "AdminSession" (
  "id" TEXT NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "adminId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
