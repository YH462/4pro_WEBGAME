import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { importDefaultCharacterModels } from "../src/lib/default-character-models";
const db=new PrismaClient();
const onlyId=process.argv.find(arg=>arg.startsWith("--id="))?.slice(5);
try { await importDefaultCharacterModels(db,onlyId); console.log("Default models imported. Existing staff changes were preserved."); }
finally { await db.$disconnect(); }
