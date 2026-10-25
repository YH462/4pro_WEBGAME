CREATE TABLE "CharacterModel" (
    "id" TEXT NOT NULL,
    "fileName" VARCHAR(120) NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CharacterModel_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Character" ADD COLUMN "modelId" TEXT,
    ADD COLUMN "modelYaw" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN "modelConfigured" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX "Character_modelId_key" ON "Character"("modelId");
ALTER TABLE "Character" ADD CONSTRAINT "Character_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "CharacterModel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
