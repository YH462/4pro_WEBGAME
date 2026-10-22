import "dotenv/config";
import { db } from "../src/lib/db";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { config } from "../src/lib/config";
import { issueAcquisitionTag } from "../src/lib/acquisition-tags";
import { departments } from "../src/lib/master-data";

const [action, argument, baseUrl] = process.argv.slice(2);
const cfg = config();
try {
  if (action === "issue" || action === "issue-character") {
    if (!argument) throw new Error("Specify a department or character ID.");
    if (action === "issue" && !departments.some((department) => department.id === argument)) throw new Error("Department: mechanical | electrical | control | civil");
    const origin = baseUrl ?? cfg.origin;
    const character=action==="issue" ? await db.character.findUniqueOrThrow({where:{departmentId:argument}}) : await db.character.findUniqueOrThrow({where:{id:argument}});
    const tag=await issueAcquisitionTag(character.id,origin),url=tag.url;
    const folder = path.resolve(".local/nfc");
    try {
      await mkdir(folder, { recursive: true });
      await writeFile(path.join(folder, `${tag.id}.json`), JSON.stringify({ tagId: tag.id, characterId: character.id, url }, null, 2), { flag: "wx" });
      await writeFile(path.join(folder, `${tag.id}.svg`), await QRCode.toString(url, { type: "svg", margin: 4, errorCorrectionLevel: "M" }), { flag: "wx" });
    } catch (error) {
      await db.acquisitionTag.update({ where: { id: tag.id }, data: { enabled: false } });
      throw error;
    }
    console.log(`Tag ID: ${tag.id}\nCharacter: ${character.id}\nNDEF URL: ${url}\nURL and QR: ${folder}`);
    if (new URL(url).protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) console.log("Development URL: finalize a stable HTTPS origin before writing festival tags. localhost cannot be reached from a phone.");
  } else if (action === "list") {
    console.table(await db.acquisitionTag.findMany({ where: { eventId: cfg.EVENT_ID }, select: { id: true, departmentId: true, characterId:true, enabled: true, createdAt: true }, orderBy: { createdAt: "asc" } }));
  } else if (action === "disable" && argument) {
    const result = await db.acquisitionTag.updateMany({ where: { id: argument, eventId: cfg.EVENT_ID }, data: { enabled: false } });
    if (!result.count) throw new Error("Tag not found in this event.");
    console.log("Tag disabled. Existing ownership is preserved.");
  } else throw new Error("Usage: npm run nfc:tags -- issue DEPARTMENT_ID [ORIGIN] | issue-character CHARACTER_ID [ORIGIN] | list | disable TAG_ID");
} finally { await db.$disconnect(); }
