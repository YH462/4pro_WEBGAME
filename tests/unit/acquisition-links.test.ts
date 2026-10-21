import { describe, expect, it } from "vitest";
import { acquisitionUrl, startDestination, validAcquisitionToken } from "../../src/lib/acquisition-links";

describe("NFC acquisition links", () => {
  const token = "a".repeat(43);
  it("builds the same acquisition URL for NDEF and QR", () => {
    expect(acquisitionUrl(token, "https://festival.example")).toBe(`https://festival.example/acquire/${token}`);
    expect(acquisitionUrl(token, "http://192.168.0.237:3000")).toBe(`http://192.168.0.237:3000/acquire/${token}`);
  });
  it("only permits a validated local return destination after guest entry", () => {
    expect(startDestination({ next: "acquire", tag: token })).toBe(`/acquire/${token}`);
    expect(startDestination({ next: "local-raid" })).toBe("/battle/raid?sync=local");
    for (const input of [{ next:"https://evil.example" }, { next:"acquire",tag:"//evil.example" }, { next:"acquire",tag:[token] }, { next:["acquire"],tag:token }]) expect(startDestination(input)).toBe("/");
  });
  it("rejects malformed codes and non-origin URL input", () => {
    for (const value of [undefined, "", "a".repeat(42), "a".repeat(44), "x/".repeat(21)+"x", [token]]) expect(validAcquisitionToken(value)).toBe(false);
    expect(() => acquisitionUrl("../invalid", "https://festival.example")).toThrow();
    for (const origin of ["javascript:alert(1)", "ftp://example.test", "https://u:p@example.test", "https://example.test/path", "https://example.test/?x=1", "https://example.test/#x"]) expect(() => acquisitionUrl(token, origin)).toThrow();
  });
});
