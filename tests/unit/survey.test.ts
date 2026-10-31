import { describe, expect, it } from "vitest";
import { surveyHref } from "../../src/lib/survey";

describe("survey destination", () => {
  it("accepts an external form and leaves unconfigured destinations unavailable", () => {
    expect(surveyHref(" https://forms.cloud.microsoft/r/example ")).toBe("https://forms.cloud.microsoft/r/example");
    for (const value of [undefined, "", "not a URL", "javascript:alert(1)", "https://user:pass@example.com"]) expect(surveyHref(value)).toBeNull();
  });
});
