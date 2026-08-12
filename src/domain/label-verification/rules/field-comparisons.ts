/**
 * Deterministic field comparisons used in Stage B of verification.
 *
 * Where semantics matter (numeric ABV, proof consistency, strict wording) we
 * compare meaning, not strings. Where we cannot be certain, we return
 * Needs Review instead of fabricating a verdict. Every function is deliberately
 * conservative about turning uncertainty into a match.
 */

import {
  LabelFieldVerificationResult,
  VerificationStatus,
} from "../models/types";
import {
  extractAbvPercentage,
  extractProof,
  normalizeAddress,
  normalizeBrandName,
  normalizeClassOrType,
  normalizeCountry,
  normalizeNetContents,
  normalizeProducerName,
} from "../normalization/normalization";

/**
 * Compare nominal fields that tolerate case/whitespace/punctuation differences
 * (brand name, producer name). Genuinely different text must not match, so we
 * require exact equality after normalization.
 */
function compareNominalField(
  expected: string | undefined,
  found: string | undefined,
  normalize: (value: string) => string
): VerificationStatus {
  if (!expected && !found) {
    return "unable-to-determine";
  }
  if (!expected || !found) {
    return "needs-review";
  }
  return normalize(expected) === normalize(found) ? "matches" : "mismatch";
}

function compareNetContentsField(
  expected: string | undefined,
  found: string | undefined
): VerificationStatus {
  if (!expected && !found) {
    return "unable-to-determine";
  }
  if (!expected || !found) {
    return "needs-review";
  }
  return normalizeNetContents(expected) === normalizeNetContents(found)
    ? "matches"
    : "mismatch";
}

function compareAbvField(
  expected: string | undefined,
  found: string | undefined
): VerificationStatus {
  if (!expected && !found) {
    return "unable-to-determine";
  }
  if (!expected || !found) {
    return "needs-review";
  }
  const expectedAbv = extractAbvPercentage(expected);
  const foundAbv = extractAbvPercentage(found);
  if (expectedAbv === null || foundAbv === null) {
    // If we cannot parse the ABV, do not assert a match.
    return "needs-review";
  }
  return Math.abs(expectedAbv - foundAbv) < 0.05 ? "matches" : "mismatch";
}

function compareProofField(
  expected: string | undefined,
  found: string | undefined
): VerificationStatus {
  if (!expected && !found) {
    return "unable-to-determine";
  }
  if (!expected || !found) {
    return "needs-review";
  }
  const expectedProof = extractProof(expected);
  const foundProof = extractProof(found);
  if (expectedProof === null || foundProof === null) {
    return "needs-review";
  }
  return expectedProof === foundProof ? "matches" : "mismatch";
}

function compareClassOrTypeField(
  expected: string | undefined,
  found: string | undefined
): VerificationStatus {
  if (!expected && !found) {
    return "unable-to-determine";
  }
  if (!expected || !found) {
    return "needs-review";
  }
  const expectedNormalized = normalizeClassOrType(expected);
  const foundNormalized = normalizeClassOrType(found);
  if (expectedNormalized === foundNormalized) {
    return "matches";
  }
  // Conservative: a partial overlap (e.g. one uses "Bourbon Whiskey" vs
  // "Kentucky Straight Bourbon Whiskey") is a near-match that deserves a human
  // look rather than a hard mismatch.
  if (
    expectedNormalized.includes(foundNormalized) ||
    foundNormalized.includes(expectedNormalized)
  ) {
    return "needs-review";
  }
  return "mismatch";
}

/**
 * Compare a generic nominal field (used for brand, producer, class/type)
 * with a suitable normalizer.
 */
function compareFieldUsingNormalizer(
  fieldName: string,
  expected: string | undefined,
  found: string | undefined,
  normalize: (value: string) => string
): LabelFieldVerificationResult {
  const status = compareNominalField(expected, found, normalize);
  return {
    fieldName,
    expected,
    found,
    status,
    reason: status === "needs-review" ? "Could not reliably compare this field." : undefined,
  };
}

/**
 * Verify a single ABV field and return a human-readable reason.
 */
function verifyAbvField(
  expected: string | undefined,
  found: string | undefined
): LabelFieldVerificationResult {
  const status = compareAbvField(expected, found);
  const reason =
    status === "needs-review"
      ? "Could not parse the alcohol content to compare numerically."
      : undefined;
  return { fieldName: "Alcohol Content", expected, found, status, reason };
}

/**
 * Compare the class/type field.
 */
function verifyClassOrTypeField(
  expected: string | undefined,
  found: string | undefined
): LabelFieldVerificationResult {
  const status = compareClassOrTypeField(expected, found);
  const reason =
    status === "needs-review"
      ? "The class/type matches only in part. Please review manually."
      : undefined;
  return {
    fieldName: "Class/Type",
    expected,
    found,
    status,
    reason,
  };
}

/**
 * Run all the simple single-field checks and return an ordered list.
 */
export function verifySimpleFields(
  expected: AlcoholLabelApplicationDataLike,
  found: ExtractedLabelInformationLike
): LabelFieldVerificationResult[] {
  return [
    compareFieldUsingNormalizer(
      "Brand Name",
      expected.brandName,
      found.brandName,
      normalizeBrandName
    ),
    verifyAbvField(expected.alcoholByVolume, found.alcoholByVolume),
    verifyProofField(expected.proof, found.proof),
    verifyClassOrTypeField(
      expected.classOrTypeDesignation,
      found.classOrTypeDesignation
    ),
    verifyNetContentsField(expected.netContents, found.netContents),
    compareFieldUsingNormalizer(
      "Producer/Bottler Name",
      expected.producerOrBottlerName,
      found.producerOrBottlerName,
      normalizeProducerName
    ),
    compareFieldUsingNormalizer(
      "Producer/Bottler Address",
      expected.producerOrBottlerAddress,
      found.producerOrBottlerAddress,
      normalizeAddress
    ),
    compareFieldUsingNormalizer(
      "Country of Origin",
      expected.countryOfOrigin,
      found.countryOfOrigin,
      normalizeCountry
    ),
  ];
}

function verifyProofField(
  expected: string | undefined,
  found: string | undefined
): LabelFieldVerificationResult {
  const status = compareProofField(expected, found);
  const reason =
    status === "needs-review"
      ? "Could not parse the proof to compare numerically."
      : undefined;
  return { fieldName: "Proof", expected, found, status, reason };
}

function verifyNetContentsField(
  expected: string | undefined,
  found: string | undefined
): LabelFieldVerificationResult {
  const status = compareNetContentsField(expected, found);
  const reason =
    status === "needs-review"
      ? "Could not reliably compare the net contents."
      : undefined;
  return { fieldName: "Net Contents", expected, found, status, reason };
}

/**
 * A subset of application data used by the field comparators.
 */
interface AlcoholLabelApplicationDataLike {
  brandName?: string;
  classOrTypeDesignation?: string;
  alcoholByVolume?: string;
  proof?: string;
  netContents?: string;
  producerOrBottlerName?: string;
  producerOrBottlerAddress?: string;
  countryOfOrigin?: string;
}

/**
 * A subset of extracted data used by the field comparators.
 */
interface ExtractedLabelInformationLike {
  brandName?: string;
  classOrTypeDesignation?: string;
  alcoholByVolume?: string;
  proof?: string;
  netContents?: string;
  producerOrBottlerName?: string;
  producerOrBottlerAddress?: string;
  countryOfOrigin?: string;
  governmentWarningText?: string;
  governmentWarningHeadingText?: string;
}