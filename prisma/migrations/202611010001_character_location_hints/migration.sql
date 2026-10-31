CREATE TABLE "CharacterLocationHint" (
  "characterId" TEXT NOT NULL,
  "text" VARCHAR(1000) NOT NULL DEFAULT '',
  "revision" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CharacterLocationHint_pkey" PRIMARY KEY ("characterId")
);
CREATE TABLE "CharacterHintImage" (
  "id" TEXT NOT NULL,
  "characterId" TEXT NOT NULL,
  "kind" VARCHAR(16) NOT NULL,
  "alt" VARCHAR(200) NOT NULL,
  "contentType" TEXT NOT NULL DEFAULT 'image/webp',
  "data" BYTEA NOT NULL,
  "byteLength" INTEGER NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  CONSTRAINT "CharacterHintImage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CharacterHintImage_characterId_kind_key" ON "CharacterHintImage"("characterId", "kind");
ALTER TABLE "CharacterLocationHint" ADD CONSTRAINT "CharacterLocationHint_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CharacterHintImage" ADD CONSTRAINT "CharacterHintImage_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "CharacterLocationHint"("characterId") ON DELETE CASCADE ON UPDATE CASCADE;
