/**
 * Government Health Warning Statement verification.
 *
 * Per 27 CFR Part 16 and the ABLA of 1988 (reviewed 2026-08-12, see
 * docs/TTB-RESEARCH.md), the warning must match exact wording, the heading
 * `GOVERNMENT WARNING` must be in all-caps bold, and the statement must be
 * legible and separate from other information.
 *
 * The verification is deliberately strict here: we do not fuzzy-match away
 * meaningful wording differences. We only normalize what is clearly
 * immaterial (whitespace, trailing punctuation, quote variants), and we treat
 * any uncertainty the model reports as Needs Review rather than guessing.
 */

import { normalizeWhitespace } from "../normalization/normalization";
import {
  GovernmentWarningVisualEvidence,
  GovernmentWarningVerificationResult,
  VerificationStatus,
} from "../models/types";

/** The full required wording, from TTB guidance (27 CFR Part 16). */
export const REQUIRED_GOVERNMENT_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not " +
  "drink alcoholic beverages during pregnancy because of the risk of birth " +
  "defects. (2) Consumption of alcoholic beverages impairs your ability to " +
  "drive a car or operate machinery, and may cause health problems.";

/** The exact heading that must appear in all-caps bold. */
export const REQUIRED_GOVERNMENT_WARNING_HEADING = "GOVERNMENT WARNING";

/**
 * Tolerant whitespace/case normalization for comparing the warning body. We
 * collapse whitespace and trim, and soften typographic quote/hyphen variants,
 * but we do NOT remove or reword anything meaningful.
 */
function normalizeWarningText(value: string): string {
  const withNormalizedQuotes = value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, "-");
  return normalizeWhitespace(withNormalizedQuotes).toLowerCase();
}

function isStatusNeedsReview(status: VerificationStatus): boolean {
  return status === "needs-review" || status === "unable-to-determine";
}

function foldIntoOverall(statuses: VerificationStatus[]): VerificationStatus {
  if (statuses.some((status) => status === "mismatch")) {
    return "mismatch";
  }
  if (statuses.some(isStatusNeedsReview)) {
    return "needs-review";
  }
  return "matches";
}

/**
 * Check whether the extracted text contains a semantically identical warning
 * through normalization that only removes whitespace and typographic variants.
 */
function compareRequiredWording(
  extractedWarningText: string | undefined,
  headingText: string | undefined
): VerificationStatus {
  if (!extractedWarningText && !headingText) {
    return "unable-to-determine";
  }
  const combined = [extractedWarningText, headingText]
    .filter(Boolean)
    .join(" ");
  const normalizedExtracted = normalizeWarningText(combined);
  const normalizedRequired = normalizeWarningText(REQUIRED_GOVERNMENT_WARNING);
  // The extracted text must contain the full required statement. Extra leading
  // number tags like "(1)" are tolerated only if the required wording is fully
  // present.
  return normalizedExtracted.includes(normalizedRequired)
    ? "matches"
    : "mismatch";
}

/**
 * Check that the heading text contains `GOVERNMENT WARNING` in all caps.
 */
function compareHeadingCapitalization(
  headingText: string | undefined
): VerificationStatus {
  if (!headingText) {
    return "unable-to-determine";
  }
  const hasGovernment = /government/i.test(headingText);
  if (!hasGovernment) {
    return "mismatch";
  }
  return /\bGOVERNMENT WARNING\b/.test(headingText) ? "matches" : "mismatch";
}

/**
 * Check the visual evidence: heading bold, separation, legibility.
 * The model reports these directly; if any is uncertain, we return
 * Needs Review rather than asserting a match.
 */
function combineVisualEvidence(
  evidence: GovernmentWarningVisualEvidence | undefined
): {
  headingBoldStatus: VerificationStatus;
  separationStatus: VerificationStatus;
  legibilityStatus: VerificationStatus;
} {
  const requiredChecks: Array<{
    key: "headingBoldStatus" | "separationStatus" | "legibilityStatus";
    value: boolean | undefined;
  }> = [
    {
      key: "headingBoldStatus",
      value: evidence?.headingAppearsBold,
    },
    {
      key: "separationStatus",
      value: evidence?.warningAppearsSeparateFromOtherInformation,
    },
    {
      key: "legibilityStatus",
      value: evidence?.warningAppearsLegible,
    },
  ];
  const result = {
    headingBoldStatus: "unable-to-determine" as VerificationStatus,
    separationStatus: "unable-to-determine" as VerificationStatus,
    legibilityStatus: "unable-to-determine" as VerificationStatus,
  };
  for (const check of requiredChecks) {
    if (check.value === undefined || check.value === null) {
      result[check.key] = "unable-to-determine";
    } else {
      result[check.key] = check.value ? "matches" : "mismatch";
    }
  }
  return result;
}

/**
 * Verify the government warning against the required TTB statement and the
 * model's visual evidence. Returns a multi-part result suitable for display.
 */
export function verifyGovernmentWarning(
  extracted: {
    governmentWarningText?: string;
    governmentWarningHeadingText?: string;
  },
  evidence: GovernmentWarningVisualEvidence | undefined,
  imageQuality: string
): GovernmentWarningVerificationResult {
  const wordingStatus = compareRequiredWording(
    extracted.governmentWarningText,
    extracted.governmentWarningHeadingText
  );

  // A phrasing that clearly misses required words is a hard mismatch; we do
  // not soften it.
  const capitalizationStatus = compareHeadingCapitalization(
    extracted.governmentWarningHeadingText
  );

  const visual = combineVisualEvidence(evidence);

  const presenceStatus: VerificationStatus =
    extracted.governmentWarningText || extracted.governmentWarningHeadingText
      ? "matches"
      : "unable-to-determine";

  // If the image is too poor to read the warning, we cannot certify wording
  // or formatting; surface Needs Review.
  const poorImageForcesReview =
    imageQuality === "poor" || imageQuality === "insufficient";

  const statuses = [
    wordingStatus,
    capitalizationStatus,
    visual.headingBoldStatus,
    visual.separationStatus,
    visual.legibilityStatus,
    presenceStatus,
  ];

  const overallStatus = poorImageForcesReview
    ? "needs-review"
    : foldIntoOverall(statuses);

  const parts: Array<{ label: string; status: VerificationStatus }> = [
    { label: "Wording", status: wordingStatus },
    { label: "Heading capitalization", status: capitalizationStatus },
    { label: "Heading bold", status: visual.headingBoldStatus },
    { label: "Presence", status: presenceStatus },
    { label: "Legibility", status: visual.legibilityStatus },
    { label: "Separation from other info", status: visual.separationStatus },
  ];

  return {
    fieldName: "Government Health Warning",
    status: overallStatus,
    requiredWordingStatus: wordingStatus,
    headingCapitalizationStatus: capitalizationStatus,
    headingBoldStatus: visual.headingBoldStatus,
    presenceStatus,
    legibilityStatus: visual.legibilityStatus,
    separationStatus: visual.separationStatus,
    expected: REQUIRED_GOVERNMENT_WARNING,
    found: extracted.governmentWarningText ?? extracted.governmentWarningHeadingText,
    reason: poorImageForcesReview
      ? "The image quality is too low to reliably read the government warning. Please review manually or upload a clearer image."
      : buildGovernmentWarningReason(parts),
  };
}

function buildGovernmentWarningReason(
  parts: Array<{ label: string; status: VerificationStatus }>
): string | undefined {
  const problems = parts
    .filter((part) => part.status === "mismatch")
    .map((part) => part.label.toLowerCase());
  if (problems.length === 0) {
    return undefined;
  }
  return `The following warning requirement did not match: ${problems.join(
    ", "
  )}.`;
}