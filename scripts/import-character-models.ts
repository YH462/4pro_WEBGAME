import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { importDefaultCharacterModels } from "../src/lib/default-character-models";
const db=new PrismaClient();
try { await importDefaultCharacterModels(db); console.log("Default models imported. Existing staff changes were preserved."); }
finally { await db.$disconnect(); }
