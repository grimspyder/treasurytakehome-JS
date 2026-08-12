/**
 * Domain types for alcohol label verification.
 *
 * These types describe the two inputs to verification (what the application
 * says the label should contain, and what the vision model extracted from the
 * label image) and the verification results produced by comparing them.
 */

/** Result status for a single field check. */
export type VerificationStatus =
  | "matches"
  | "mismatch"
  | "needs-review"
  | "unable-to-determine";

/** Top-level outcome for a label verification. */
export type OverallVerificationStatus =
  | "ready"
  | "needs-review"
  | "mismatches-found";

/** The "expected" application information the user supplies for a label. */
export interface AlcoholLabelApplicationData {
  brandName?: string;
  classOrTypeDesignation?: string;
  alcoholByVolume?: string;
  proof?: string;
  netContents?: string;
  producerOrBottlerName?: string;
  producerOrBottlerAddress?: string;
  countryOfOrigin?: string;
  beverageCategory?: "distilled-spirits" | "wine" | "malt-beverage" | "unknown";
}

/** Image quality assessment returned by the vision model. */
export type ImageQuality =
  | "good"
  | "usable"
  | "poor"
  | "insufficient";

/**
 * The structured information the vision model extracts from a label image,
 * plus visual evidence about the government warning. Validated at runtime with
 * Zod before it is trusted.
 */
export interface ExtractedAlcoholLabelInformation {
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
  governmentWarningHeadingAppearsBold?: boolean;
  governmentWarningHeadingAppearsAllCaps?: boolean;
  warningAppearsSeparateFromOtherInformation?: boolean;
  warningAppearsLegible?: boolean;
  detectedBeverageCategory?: "distilled-spirits" | "wine" | "malt-beverage" | "unknown";
  imageQuality: ImageQuality;
  fieldConfidenceScores?: Record<string, number>;
  overallExtractionConfidence?: number;
  uncertainties?: string[];
}

/** The visual evidence collected about the government warning heading. */
export interface GovernmentWarningVisualEvidence {
  headingAppearsBold?: boolean;
  headingAppearsAllCaps?: boolean;
  warningAppearsSeparateFromOtherInformation?: boolean;
  warningAppearsLegible?: boolean;
}

/** Result of a single field comparison. */
export interface LabelFieldVerificationResult {
  fieldName: string;
  expected?: string;
  found?: string;
  status: VerificationStatus;
  reason?: string;
}

/** Result of the government warning check (multi-part). */
export interface GovernmentWarningVerificationResult {
  fieldName: string;
  status: VerificationStatus;
  requiredWordingStatus: VerificationStatus;
  headingCapitalizationStatus: VerificationStatus;
  headingBoldStatus: VerificationStatus;
  presenceStatus: VerificationStatus;
  legibilityStatus: VerificationStatus;
  separationStatus: VerificationStatus;
  expected?: string;
  found?: string;
  reason?: string;
}

/** A single perceivable check in the results UI. */
export interface VerificationCheckRow {
  id: string;
  label: string;
  status: VerificationStatus;
  expected?: string;
  found?: string;
  reason?: string;
  detail?: Array<{ label: string; status: VerificationStatus; note?: string }>;
}

/** The full result of a single label verification. */
export interface LabelVerificationSummary {
  overallStatus: OverallVerificationStatus;
  imageQuality: ImageQuality;
  imageQualityReason?: string;
  checks: VerificationCheckRow[];
  governmentWarningReason?: string;
  extractionConfidence?: number;
  uncertainties?: string[];
  durations?: VerificationDurations;
  disclaimer: string;
}

/** Timed breakdown of a verification request. */
export interface VerificationDurations {
  imagePreparationDuration?: number;
  serverRequestDuration?: number;
  aiInferenceDuration?: number;
  validationDuration?: number;
  totalUserPerceivedDuration?: number;
}

/** Per-field expected/found that the UI needs to render a comparison. */
export interface FieldComparisonInput {
  fieldName: string;
  expected?: string;
  found?: string;
}

/** States a single batch item can be in. */
export type BatchItemStatus =
  | "pending"
  | "processing"
  | "completed"
  | "needs-review"
  | "failed";

/** A single item in a batch verification run. */
export interface BatchVerificationItem {
  id: string;
  fileName: string;
  status: BatchItemStatus;
  imageDataUrl?: string;
  applicationData?: AlcoholLabelApplicationData;
  result?: LabelVerificationSummary;
  error?: string;
  startedAt?: number;
  completedAt?: number;
}