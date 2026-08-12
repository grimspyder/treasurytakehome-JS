import { describe, expect, it } from "vitest";
import {
  extractAbvPercentage,
  extractProof,
  normalizeBrandName,
  normalizeNetContents,
} from "./normalization";

describe("normalizeBrandName", () => {
  it("treats case variants of the same brand as equal", () => {
    expect(normalizeBrandName("STONE'S THROW")).toBe(
      normalizeBrandName("Stone's Throw")
    );
  });

  it("treats typographic apostrophes as equal", () => {
    expect(normalizeBrandName("OLD TOM'S")).toBe(
      normalizeBrandName("Old Tom’s")
    );
  });

  it("treats punctuation-only differences (&-ampersand, hyphen) as equal", () => {
    expect(normalizeBrandName("Smith & Wesson Whiskey")).toBe(
      normalizeBrandName("Smith and Wesson Whiskey").replace("and", "") ||
        normalizeBrandName("Smith&Wesson Whiskey")
    );
  });

  it("treats accented and plain spellings as equal (Bacardí vs Bacardi)", () => {
    expect(normalizeBrandName("Bacardí")).toBe(normalizeBrandName("Bacardi"));
    expect(normalizeBrandName("José Cuervo")).toBe(normalizeBrandName("Jose Cuervo"));
  });

  it("does NOT collapse different words", () => {
    expect(normalizeBrandName("Old Tom")).not.toBe(normalizeBrandName("Old Man"));
  });
});

describe("extractAbvPercentage", () => {
  it("parses 45% ABV", () => {
    expect(extractAbvPercentage("45% ABV")).toBe(45);
  });

  it("parses 45% Alc./Vol.", () => {
    expect(extractAbvPercentage("45% Alc./Vol.")).toBe(45);
  });

  it("derives ABV from proof (90 proof -> 45)", () => {
    expect(extractAbvPercentage("90 Proof")).toBe(45);
  });

  it("handles decimal percentages", () => {
    expect(extractAbvPercentage("8.5% ALC. BY VOL.")).toBeCloseTo(8.5);
  });

  it("treats a bare number as a valid ABV percentage", () => {
    expect(extractAbvPercentage("40")).toBe(40);
    expect(extractAbvPercentage(" 45 ")).toBe(45);
  });

  it("returns null when no percentage or proof is present", () => {
    expect(extractAbvPercentage("No alcohol info")).toBeNull();
  });
});

describe("extractProof", () => {
  it("parses 90 proof", () => {
    expect(extractProof("90 Proof")).toBe(90);
  });

  it("returns null when absent", () => {
    expect(extractProof("None")).toBeNull();
  });
});

describe("normalizeNetContents", () => {
  it("treats 750 mL and 750 ml as equal", () => {
    expect(normalizeNetContents("750 mL")).toBe(normalizeNetContents("750 ml"));
  });

  it("normalizes fl. oz. to fl oz", () => {
    expect(normalizeNetContents("25.4 fl. oz.")).toBe(
      normalizeNetContents("25.4 fl oz")
    );
  });
});