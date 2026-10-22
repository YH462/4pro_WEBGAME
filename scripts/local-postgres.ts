import "dotenv/config";
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const url = new URL(process.env.DATABASE_URL || "postgresql://fourpro:local_fourpro@127.0.0.1:5432/fourpro");
if (url.hostname !== "127.0.0.1") throw new Error("Local helper requires DATABASE_URL host 127.0.0.1.");
const databaseDir = resolve(".local/postgres");
const pg = new EmbeddedPostgres({ databaseDir, user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), port: Number(url.port || 5432), persistent: true, authMethod: "scram-sha-256", initdbFlags: ["--encoding=UTF8", "--locale=C"], postgresFlags: ["-h", "127.0.0.1"], onLog: () => {}, onError: (error) => console.error(error) });
if (!existsSync(resolve(databaseDir, "PG_VERSION"))) await pg.initialise();
await pg.start();
const name = url.pathname.slice(1);
const client = pg.getPgClient("postgres", "127.0.0.1");
await client.connect();
try {
  const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
  if (!existing.rowCount) await pg.createDatabase(name);
} finally { await client.end(); }
console.log(`Local PostgreSQL ready at 127.0.0.1:${url.port || 5432}. Keep this terminal open. Ctrl+C stops it; data is preserved.`);
const stop = async () => { await pg.stop(); process.exit(0); };
process.once("SIGINT", stop); process.once("SIGTERM", stop);
setInterval(() => {}, 60_000);
