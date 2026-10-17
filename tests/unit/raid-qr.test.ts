import { describe, expect, it } from "vitest";
import { raidQrDestination } from "../../src/lib/raid-qr";

const origin = "https://event.example";
describe("raid QR navigation", () => {
  it.each(["/battle", `${origin}/battle`, `${origin}/battle/`, `  ${origin}/battle  `])("accepts the local battle URL: %s", (text) => {
    expect(raidQrDestination(text, origin)).toBe("/battle");
  });
  it("preserves future raid parameters but drops fragments", () => {
    expect(raidQrDestination(`${origin}/battle?raid=sample#other`, origin)).toBe("/battle?raid=sample");
  });
  it.each(["", "battle", "not a QR URL", "/profile", "/battle/other", "https://other.example/battle", "http://event.example/battle", "//other.example/battle", "javascript:alert(1)", "data:text/html,test", "https://user:password@event.example/battle", `https://event.example.attacker.example/battle`, `/battle?${"x".repeat(2048)}`])("rejects unrelated or unsafe QR data: %s", (text) => {
    expect(raidQrDestination(text, origin)).toBeNull();
  });
});
