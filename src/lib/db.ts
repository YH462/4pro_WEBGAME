import { PrismaClient } from "@prisma/client";
const globalDb = globalThis as unknown as { fourproDb?: PrismaClient };
export const db = globalDb.fourproDb ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalDb.fourproDb = db;
