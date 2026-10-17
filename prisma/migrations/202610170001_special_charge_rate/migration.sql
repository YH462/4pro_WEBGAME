-- Add a separate setting rather than reinterpret existing speed values.
-- NULL means the character's special-gauge charge rate is not decided yet.
ALTER TABLE "Character" ADD COLUMN "baseSpecialChargeRate" INTEGER;
ALTER TABLE "PlayerCharacter" ADD COLUMN "specialChargeRateGrowth" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Character" ADD CONSTRAINT "Character_nonnegative_special_charge_rate"
  CHECK ("baseSpecialChargeRate" IS NULL OR "baseSpecialChargeRate" >= 0);
ALTER TABLE "PlayerCharacter" ADD CONSTRAINT "PlayerCharacter_nonnegative_special_charge_growth"
  CHECK ("specialChargeRateGrowth" >= 0);
