import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import sources from "../../scripts/raid-motion-sources.json";
import manifest from "../../src/lib/bundled-character-motions.json";

describe("consolidated motion sources", () => {
  it("stores each unique original once, with verified provenance and no missing selected sources", async () => {
    const root = "3Dmodels/モーション統合/";
    const inventory = JSON.parse(await readFile(root + "inventory.json", "utf8"));
    expect(inventory.inputs).toBe(46); expect(inventory.unique).toBe(30); expect(inventory.duplicates).toBe(16);
    expect(new Set(inventory.files.map((file: {sha256:string})=>file.sha256)).size).toBe(30);
    for (const file of inventory.files) {
      expect(file.path).not.toContain("..");
      const bytes = await readFile(root + file.path);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(file.sha256);
      expect(bytes.length).toBe(file.bytes); expect(file.origins.length).toBeGreaterThan(0);
    }
    for (const source of sources) for (const action of ["attack", "heal"] as const) {
      const sourcePath = (source as {attack?:string;heal?:string})[action];
      if (sourcePath) expect(inventory.files.some((file:{path:string})=>file.path===sourcePath)).toBe(true);
    }
  });

  it("does not advertise a single-frame healing pose as an authored animation", async () => {
    const bytes = await readFile("3Dmodels/モーション統合/temp-07/heal.glb");
    const doc = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
    expect(doc.animations.length).toBeGreaterThan(0);
    for (const clip of doc.animations) for (const sampler of clip.samplers) expect(doc.accessors[sampler.input].count).toBe(1);
    expect(manifest["temp-07"].motions).toHaveProperty("attack");
    expect(manifest["temp-07"].motions).not.toHaveProperty("heal");
  });
  it("keeps the S attack whose animated helper has no visible geometry out of the motion catalog", async () => {
    const bytes = await readFile("3Dmodels/モーション統合/flame-dragon/attack.glb");
    const doc = JSON.parse(bytes.toString("utf8", 20, 20 + bytes.readUInt32LE(12)));
    const joints = new Set(doc.skins.flatMap((skin:{joints:number[]})=>skin.joints));
    const visible = (index:number):boolean => doc.nodes[index].mesh !== undefined || joints.has(index) || (doc.nodes[index].children ?? []).some(visible);
    for (const clip of doc.animations) for (const channel of clip.channels) expect(visible(channel.target.node)).toBe(false);
    expect(manifest["flame-dragon"].motions).not.toHaveProperty("attack");
    expect(manifest["flame-dragon"].motions).toHaveProperty("heal");
  });
});
