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
  // The heading "GOVERNMENT WARNING" and the body may be returned as separate
  // fields, so the colon that separates them in the canonical text can end up
  // either present or absent. Since a colon appears nowhere else in the warning
  // body, stripping colons from both sides makes the comparison robust without
  // losing any meaningful character.
  return normalizeWhitespace(withNormalizedQuotes).replace(/:/g, "").toLowerCase();
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
 *
 * Because vision models sometimes truncate a long warning rather than report a
 * real violation, an incomplete-but-substantially-matching body is returned as
 * Needs Review (we cannot prove the label is wrong, only that we could not
 * confirm the full wording). A clearly short or divergent body is a mismatch.
 */
function compareRequiredWording(
  extractedWarningText: string | undefined,
  headingText: string | undefined
): VerificationStatus {
  if (!extractedWarningText && !headingText) {
    return "unable-to-determine";
  }
  // The canonical warning is "GOVERNMENT WARNING: (1) ... " with the heading
  // first, so concatenate heading before body for the includes comparison.
  const combined = [headingText, extractedWarningText]
    .filter(Boolean)
    .join(" ");
  const normalizedExtracted = normalizeWarningText(combined);
  const normalizedRequired = normalizeWarningText(REQUIRED_GOVERNMENT_WARNING);

  if (normalizedExtracted.includes(normalizedRequired)) {
    return "matches";
  }

  // The heading is validated separately (compareHeadingCapitalization), so for
  // detecting a plausible truncation we compare the body only. Remove the
  // leading "government warning" from both sides and check how much of the
  // required body the extracted text reproduces from the start.
  const requiredBody = normalizedRequired.replace(/^government warning/, "").trim();
  // Extract the extracted text's body: drop a leading "government warning" if
  // present, then compare its prefix against the required body.
  const extractedBody = normalizedExtracted
    .replace(/^government warning/, "")
    .trim();

  let sharedPrefixLength = 0;
  const limit = Math.min(extractedBody.length, requiredBody.length);
  while (
    sharedPrefixLength < limit &&
    extractedBody[sharedPrefixLength] === requiredBody[sharedPrefixLength]
  ) {
    sharedPrefixLength++;
  }

  // A long shared prefix means the model likely truncated the tail rather than
  // reporting a genuinely different warning. 0.35 is a conservative bar: a copy
  // that reproduces at least a third of the required body verbatim from the
  // start is far more plausibly a truncated read than a real alternate wording.
  const bodyPrefixRatio = sharedPrefixLength / requiredBody.length;
  if (bodyPrefixRatio >= 0.35) {
    return "needs-review";
  }

  return "mismatch";
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

  const capitalizationStatus = compareHeadingCapitalization(
    extracted.governmentWarningHeadingText
  );

  const visual = combineVisualEvidence(evidence);

  const presenceStatus: VerificationStatus =
    extracted.governmentWarningText || extracted.governmentWarningHeadingText
      ? "matches"
      : "unable-to-determine";

  // Hallucination guard: if the model reports the warning text but NONE of the
  // visual-evidence booleans (bold, separation, legibility) are reported, the
  // model likely recited the canonical warning from training memory rather than
  // actually reading it on the label. In that case we cannot confirm the warning
  // is physically present, so we downgrade a wording "match" to needs-review.
  const allVisualEvidenceMissing =
    visual.headingBoldStatus === "unable-to-determine" &&
    visual.separationStatus === "unable-to-determine" &&
    visual.legibilityStatus === "unable-to-determine";

  const adjustedWordingStatus: VerificationStatus =
    wordingStatus === "matches" && allVisualEvidenceMissing
      ? "needs-review"
      : wordingStatus;

  // If the image is too poor to read the warning, we cannot certify wording
  // or formatting; surface Needs Review.
  const poorImageForcesReview =
    imageQuality === "poor" || imageQuality === "insufficient";

  const statuses = [
    adjustedWordingStatus,
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
    { label: "Wording", status: adjustedWordingStatus },
    { label: "Heading capitalization", status: capitalizationStatus },
    { label: "Heading bold", status: visual.headingBoldStatus },
    { label: "Presence", status: presenceStatus },
    { label: "Legibility", status: visual.legibilityStatus },
    { label: "Separation from other info", status: visual.separationStatus },
  ];

  const hallucinationReason =
    adjustedWordingStatus === "needs-review" && allVisualEvidenceMissing
      ? "The AI found matching warning text but could not confirm visual evidence (bold, separation, legibility) that the warning is actually on this label. Please review the label manually."
      : undefined;

  return {
    fieldName: "Government Health Warning",
    status: overallStatus,
    requiredWordingStatus: adjustedWordingStatus,
    headingCapitalizationStatus: capitalizationStatus,
    headingBoldStatus: visual.headingBoldStatus,
    presenceStatus,
    legibilityStatus: visual.legibilityStatus,
    separationStatus: visual.separationStatus,
    expected: REQUIRED_GOVERNMENT_WARNING,
    found: extracted.governmentWarningText ?? extracted.governmentWarningHeadingText,
    reason: poorImageForcesReview
      ? "The image quality is too low to reliably read the government warning. Please review manually or upload a clearer image."
      : hallucinationReason ?? buildGovernmentWarningReason(parts),
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
