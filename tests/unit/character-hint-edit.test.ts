import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { characterHintEditSchema, maxHintImageBytes, type CharacterHintEditInput } from "../../src/lib/character-hint-input";
import { optimizeHintImage } from "../../src/lib/character-hint-image";
import { readCharacterHintEdit } from "../../src/lib/character-hint-edit";

const input: CharacterHintEditInput = { location: "4プロ会場", text: "目印を探してね。\n入口の近くです。", revision: 0, images: { overview: { action: "keep", alt: "" }, detail: { action: "keep", alt: "" }, map: { action: "keep", alt: "" } } };
describe("admin hint input and lightweight images", () => {
  it("rejects unrelated character settings, invalid actions and oversized text", () => {
    for (const change of [{ name: "別のキャラ" }, { departmentId: "civil" }, { baseHp: 1 }, { revision: -1 }, { location: "a".repeat(201) }, { location: "場所\n改行" }, { location: "bad\u0000" }, { text: "a".repeat(1001) }, { text: "bad\u0000" }, { images: { overview: { action: "url", alt: "" } } }]) expect(characterHintEditSchema.safeParse({ ...input, ...change }).success).toBe(false);
    expect(characterHintEditSchema.parse({ ...input, location: "  4プロ会場  " }).location).toBe("4プロ会場");
    expect(characterHintEditSchema.parse({ ...input, text: `  ${input.text}  ` }).text).toBe(input.text);
  });
  it("rotates photos, reduces dimensions and strips camera metadata", async () => {
    const original = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#72a4c0" } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    const output = await optimizeHintImage(new File([original], "camera.jpg", { type: "image/jpeg" }), "overview");
    const meta = await sharp(output.data).metadata();
    expect([output.width, output.height]).toEqual([800, 1600]);
    expect(meta.format).toBe("webp"); expect(meta.exif).toBeUndefined(); expect(meta.orientation).toBeUndefined();
    expect(output.byteLength).toBeLessThan(original.length);
  });
  it("retains the entire horizontal map at a higher resolution and never enlarges small images", async () => {
    const large = await sharp({ create: { width: 3600, height: 900, channels: 3, background: "#f0f5f8" } }).png().toBuffer();
    const map = await optimizeHintImage(new File([large], "map.png", { type: "image/png" }), "map");
    expect([map.width, map.height]).toEqual([2400, 600]);
    const small = await sharp({ create: { width: 320, height: 240, channels: 3, background: "#6b9cb8" } }).png().toBuffer();
    const photo = await optimizeHintImage(new File([small], "small.png", { type: "image/png" }), "detail");
    expect([photo.width, photo.height]).toEqual([320, 240]);
  });
  it("rejects active formats, MIME mismatches and oversized uploads", async () => {
    await expect(optimizeHintImage(new File(["<svg/>"], "map.svg", { type: "image/svg+xml" }), "map")).rejects.toMatchObject({ status: 415 });
    const png = await sharp({ create: { width: 10, height: 10, channels: 3, background: "white" } }).png().toBuffer();
    await expect(optimizeHintImage(new File([png], "fake.jpg", { type: "image/jpeg" }), "overview")).rejects.toMatchObject({ status: 400 });
    await expect(optimizeHintImage(new File([new Uint8Array(maxHintImageBytes + 1)], "big.png", { type: "image/png" }), "overview")).rejects.toMatchObject({ status: 413 });
  });
  it("parses multipart input while rejecting duplicate fields and files without a replace action", async () => {
    const request = (form: FormData) => new Request("http://localhost/api/admin/characters/id/hint", { method: "PATCH", body: form });
    const valid = new FormData(); valid.set("data", JSON.stringify(input));
    expect((await readCharacterHintEdit(request(valid))).input).toEqual(input);
    const duplicate = new FormData(); duplicate.append("data", JSON.stringify(input)); duplicate.append("data", JSON.stringify(input));
    await expect(readCharacterHintEdit(request(duplicate))).rejects.toMatchObject({ status: 400 });
    const unexpected = new FormData(); unexpected.set("data", JSON.stringify(input)); unexpected.set("overview", new File(["test"], "image.jpg", { type: "image/jpeg" }));
    await expect(readCharacterHintEdit(request(unexpected))).rejects.toMatchObject({ status: 400 });
  });
});
