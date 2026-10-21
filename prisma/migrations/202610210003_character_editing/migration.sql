CREATE TABLE "CharacterImage" (
  "id" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CharacterImage_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Character" ADD COLUMN "isDraft" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Character" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Character" ADD COLUMN "imageId" TEXT;
UPDATE "Character" SET "isDraft" = true WHERE "id" ~ '^temp-[0-9]+$';
CREATE UNIQUE INDEX "Character_imageId_key" ON "Character"("imageId");
ALTER TABLE "Character" ADD CONSTRAINT "Character_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "CharacterImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
