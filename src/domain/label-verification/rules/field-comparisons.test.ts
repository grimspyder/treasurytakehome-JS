import { it } from "vitest";
import { verifySimpleFields } from "./field-comparisons";

it("class type rum vs gold rum", () => {
  const res = verifySimpleFields(
    { classOrTypeDesignation: "Rum" },
    { classOrTypeDesignation: "GOLD RUM" }
  );
  const ct = res.find((r) => r.fieldName === "Class/Type");
  if (ct?.status !== "matches") {
    throw new Error(
      "expected matches, got " + ct?.status + " (" + ct?.found + ")"
    );
  }
});