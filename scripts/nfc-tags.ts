import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { config } from "../src/lib/config";
import { acquisitionUrl } from "../src/lib/acquisition-links";
import { localNetworkHosts } from "../src/lib/local-network";
import { newToken, tokenHash } from "../src/lib/tokens";
import { departments } from "../src/lib/master-data";

const [action, argument, baseUrl] = process.argv.slice(2);
const cfg = config();
const db = new PrismaClient();
try {
  if (action === "issue") {
    if (!departments.some((department) => department.id === argument)) throw new Error("Department: mechanical | electrical | control | civil");
    const origin = baseUrl ?? cfg.origin;
    const token = newToken(), url = acquisitionUrl(token, origin);
    const localAllowed = cfg.simulator && cfg.ALLOW_INSECURE_LOCAL_HTTP === "true" && new URL(cfg.APP_URL).protocol === "http:" && localNetworkHosts().some((host) => new URL(url).origin === `http://${host}:${new URL(cfg.APP_URL).port || "80"}`);
    if (new URL(url).origin !== cfg.origin && !localAllowed) throw new Error("Use APP_URL, or this PC's LAN origin in enabled local development.");
    const tag = await db.$transaction(async (tx) => {
      const events = await tx.$queryRaw<{ status: string }[]>`SELECT "status" FROM "Event" WHERE "id" = ${cfg.EVENT_ID} FOR SHARE`;
      if (events[0]?.status !== "ACTIVE") throw new Error("Tags can only be issued for the active configured event.");
      const department = await tx.department.findUniqueOrThrow({ where: { id: argument }, include: { character: true } });
      if (!department.character || department.character.isLegendary) throw new Error("Set the department's normal partner first.");
      return tx.acquisitionTag.create({ data: { eventId: cfg.EVENT_ID, departmentId: argument, tokenHash: tokenHash(token) } });
    });
    const folder = path.resolve(".local/nfc");
    try {
      await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, `${tag.id}.json`), JSON.stringify({ tagId: tag.id, departmentId: tag.departmentId, url }, null, 2), { flag: "wx" });
      await writeFile(path.join(folder, `${tag.id}.svg`), await QRCode.toString(url, { type: "svg", margin: 4, errorCorrectionLevel: "M" }), { flag: "wx" });
    } catch (error) {
      await db.acquisitionTag.update({ where: { id: tag.id }, data: { enabled: false } });
      throw error;
    }
    console.log(`Tag ID: ${tag.id}\nDepartment: ${tag.departmentId}\nNDEF URL: ${url}\nURL and QR: ${folder}`);
    if (new URL(url).protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) console.log("Development URL: finalize a stable HTTPS origin before writing festival tags. localhost cannot be reached from a phone.");
  } else if (action === "list") {
    console.table(await db.acquisitionTag.findMany({ where: { eventId: cfg.EVENT_ID }, select: { id: true, departmentId: true, enabled: true, createdAt: true }, orderBy: { createdAt: "asc" } }));
  } else if (action === "disable" && argument) {
    const result = await db.acquisitionTag.updateMany({ where: { id: argument, eventId: cfg.EVENT_ID }, data: { enabled: false } });
    if (!result.count) throw new Error("Tag not found in this event.");
    console.log("Tag disabled. Existing ownership is preserved.");
  } else throw new Error("Usage: npm run nfc:tags -- issue DEPARTMENT_ID [ORIGIN] | list | disable TAG_ID");
} finally { await db.$disconnect(); }
