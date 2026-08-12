import { describe, expect, it } from "vitest";
import { verifyGovernmentWarning } from "./government-warning";

const COMPLETE_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not " +
  "drink alcoholic beverages during pregnancy because of the risk of birth " +
  "defects. (2) Consumption of alcoholic beverages impairs your ability to " +
  "drive a car or operate machinery, and may cause health problems.";

const TRUNCATED_WARNING =
  "(1) According to the Surgeon General, women should not drink alcoholic " +
  "beverages during pregnancy because of the risk of";

describe("verifyGovernmentWarning", () => {
  it("marks a complete matching warning as matches", () => {
    const result = verifyGovernmentWarning(
      {
        governmentWarningText:
          "(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
        governmentWarningHeadingText: "GOVERNMENT WARNING",
      },
      {
        headingAppearsBold: true,
        headingAppearsAllCaps: true,
        warningAppearsSeparateFromOtherInformation: true,
        warningAppearsLegible: true,
      },
      "good"
    );
    expect(result.status).toBe("matches");
    expect(result.requiredWordingStatus).toBe("matches");
  });

  it("flags a missing required phrase as mismatch", () => {
    const result = verifyGovernmentWarning(
      {
        governmentWarningText:
          "(1) Some other warning text that does not match the required statement at all and is completely wrong and unrelated to what is required.",
        governmentWarningHeadingText: "GOVERNMENT WARNING",
      },
      {},
      "good"
    );
    expect(result.requiredWordingStatus).toBe("mismatch");
  });

  it("flags incorrect heading capitalization as mismatch", () => {
    const result = verifyGovernmentWarning(
      {
        governmentWarningHeadingText: "Government Warning",
        governmentWarningText:
          "(1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.",
      },
      {},
      "good"
    );
    expect(result.headingCapitalizationStatus).toBe("mismatch");
  });

  it("returns needs-review when the model truncated an otherwise-matching warning", () => {
    const result = verifyGovernmentWarning(
      {
        governmentWarningHeadingText: "GOVERNMENT WARNING",
        governmentWarningText: TRUNCATED_WARNING,
      },
      {},
      "good"
    );
    expect(result.requiredWordingStatus).toBe("needs-review");
  });

  it("returns needs-review when the image is too poor to read", () => {
    const result = verifyGovernmentWarning(
      {
        governmentWarningText: COMPLETE_WARNING,
        governmentWarningHeadingText: "GOVERNMENT WARNING",
      },
      {},
      "insufficient"
    );
    expect(result.status).toBe("needs-review");
  });
});