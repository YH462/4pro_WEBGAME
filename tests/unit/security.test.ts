import { describe, expect, it } from "vitest";
import { parseConfig } from "../../src/lib/config";
import { nicknameSchema } from "../../src/lib/validation";
import { newToken, tokenHash, validToken } from "../../src/lib/tokens";
import { characters, departments } from "../../src/lib/master-data";
describe("session and transport security", () => {
  it("issues unpredictable 256-bit tokens and stores only a SHA-256 hash", () => {
    const tokens = Array.from({ length: 500 }, newToken);
    expect(new Set(tokens).size).toBe(500);
    for (const token of tokens) { expect(validToken(token)).toBe(true); expect(tokenHash(token)).toHaveLength(64); expect(tokenHash(token)).not.toContain(token); }
    expect(validToken("forged-id")).toBe(false);
    expect(tokenHash("same")).toBe(tokenHash("same"));
  });
  it("requires HTTPS outside explicitly enabled loopback", () => {
    expect(() => parseConfig({ APP_URL: "http://192.168.0.2:3000", ALLOW_INSECURE_LOCAL_HTTP: "true" })).toThrow();
    expect(() => parseConfig({ APP_URL: "http://localhost:3000" })).toThrow();
    expect(() => parseConfig({ APP_URL: "ftp://localhost", ALLOW_INSECURE_LOCAL_HTTP: "true" })).toThrow();
    expect(parseConfig({ APP_URL: "https://event.example" }).secureCookie).toBe(true);
    expect(parseConfig({ APP_URL: "http://localhost:3000", ALLOW_INSECURE_LOCAL_HTTP: "true" }).secureCookie).toBe(false);
  });
  it("disables simulator in production and on non-loopback hosts", () => {
    expect(parseConfig({ APP_URL: "https://event.example", ENABLE_DEV_SIMULATOR: "true" }).simulator).toBe(false);
    expect(parseConfig({ APP_URL: "https://localhost", ENABLE_DEV_SIMULATOR: "true", NODE_ENV: "production" }).simulator).toBe(false);
    expect(parseConfig({ APP_URL: "https://localhost", ENABLE_DEV_SIMULATOR: "true" }).simulator).toBe(true);
  });
  it("rejects invalid session lifetimes", () => {
    for (const value of ["0", "366", "NaN", "1.5"]) expect(() => parseConfig({ APP_URL: "https://event.example", SESSION_DAYS: value })).toThrow();
  });
});
describe("nickname input", () => {
  it("allows anonymous guests and trims optional names", () => {
    expect(nicknameSchema.parse({}).nickname).toBe("");
    expect(nicknameSchema.parse({ nickname: "  よつば  " }).nickname).toBe("よつば");
  });
  it("rejects oversize, control characters and client-supplied IDs or stats", () => {
    for (const input of [{ nickname: "a".repeat(21) }, { nickname: "a\u0000b" }, { nickname: "hi", id: "forged" }, { nickname: "hi", hp: 999 }]) expect(nicknameSchema.safeParse(input).success).toBe(false);
  });
});
describe("initial master data", () => {
  it("has 12 unique characters with seven stable non-department slots", () => {
    expect(characters).toHaveLength(12);
    expect(new Set(characters.map((character) => character.id)).size).toBe(12);
    const drafts = characters.filter((character) => character.id.startsWith("temp-"));
    expect(drafts).toHaveLength(7);
    expect(drafts.every((character) => character.departmentId === null && character.baseHp > 0)).toBe(true);
    expect(drafts.filter(character=>"isDraft" in character&&character.isDraft).map(character=>character.id)).toEqual(["temp-12"]);
  });
  it("maps four normal characters one-to-one to departments", () => {
    const normal = characters.filter((character) => !character.isLegendary && character.departmentId);
    expect(normal).toHaveLength(4);
    expect(new Set(normal.map((character) => character.departmentId))).toEqual(new Set(departments.map((department) => department.id)));
  });
  it("matches all requested baseline stats including the legend", () => {
    expect(characters.slice(0, 5).map((character) => [character.baseHp, character.baseAttack, character.baseDefense, character.baseSpeed])).toEqual([[170, 27, 38, 15], [125, 33, 22, 30], [120, 40, 20, 25], [135, 29, 23, 23], [155, 36, 30, 26]]);
    expect(characters.filter((character) => character.isLegendary).map((character) => character.name)).toEqual(["4プロ"]);
  });
});
