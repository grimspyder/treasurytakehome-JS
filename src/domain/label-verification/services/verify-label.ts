/**
 * Verification service — the orchestrator of Stage B (deterministic rules).
 *
 * It receives the user's expected application data and the model's extracted
 * label information, runs the field comparisons and the government warning
 * rule, and produces a single human-readable summary with an overall status.
 */

import {
  AlcoholLabelApplicationData,
  ExtractedAlcoholLabelInformation,
  GovernmentWarningVisualEvidence,
  LabelVerificationSummary,
  OverallVerificationStatus,
  VerificationCheckRow,
  VerificationStatus,
} from "../models/types";
import { verifyGovernmentWarning } from "../rules/government-warning";
import { verifySimpleFields } from "../rules/field-comparisons";

/**
 * Assemble the government-warning visual evidence object expected by the rule.
 */
function buildGovernmentWarningEvidence(
  extracted: ExtractedAlcoholLabelInformation
): GovernmentWarningVisualEvidence {
  return {
    headingAppearsBold: extracted.governmentWarningHeadingAppearsBold,
    headingAppearsAllCaps: extracted.governmentWarningHeadingAppearsAllCaps,
    warningAppearsSeparateFromOtherInformation:
      extracted.warningAppearsSeparateFromOtherInformation,
    warningAppearsLegible: extracted.warningAppearsLegible,
  };
}

function isReviewWorthy(status: VerificationStatus): boolean {
  return status === "needs-review" || status === "unable-to-determine";
}

/**
 * Determine the top-level overall status from all field statuses.
 */
function resolveOverallStatus(
  fieldStatuses: VerificationStatus[],
  governmentWarningStatus: VerificationStatus
): OverallVerificationStatus {
  const allStatuses = [...fieldStatuses, governmentWarningStatus];
  if (allStatuses.some((status) => status === "mismatch")) {
    return "mismatches-found";
  }
  if (allStatuses.some(isReviewWorthy)) {
    return "needs-review";
  }
  return "ready";
}

/** Convert a field verification result into a UI row. */
function toCheckRow(result: {
  fieldName?: string;
  expected?: string;
  found?: string;
  status: VerificationStatus;
  reason?: string;
}): VerificationCheckRow {
  return {
    id: result.fieldName ?? "check",
    label: result.fieldName ?? "Check",
    status: result.status,
    expected: result.expected,
    found: result.found,
    reason: result.reason,
  };
}

/** Build the government warning UI row with its sub-checks. */
function buildGovernmentWarningRow(
  governmentWarningResult: Awaited<ReturnType<typeof verifyGovernmentWarning>>
): VerificationCheckRow {
  const detailChecks = [
    {
      label: "Wording",
      status: governmentWarningResult.requiredWordingStatus,
    },
    {
      label: "Heading capitalization",
      status: governmentWarningResult.headingCapitalizationStatus,
    },
    {
      label: "Heading bold",
      status: governmentWarningResult.headingBoldStatus,
    },
    {
      label: "Presence",
      status: governmentWarningResult.presenceStatus,
    },
    {
      label: "Legibility",
      status: governmentWarningResult.legibilityStatus,
    },
    {
      label: "Separation from other info",
      status: governmentWarningResult.separationStatus,
    },
  ];
  return {
    id: "Government Health Warning",
    label: "Government Health Warning",
    status: governmentWarningResult.status,
    expected: governmentWarningResult.expected,
    found: governmentWarningResult.found,
    reason: governmentWarningResult.reason,
    detail: detailChecks,
  };
}

/**
 * Run full verification of a label against expected application data.
 * Pure and deterministic; does not touch the network or the AI provider.
 */
export function verifyLabel(
  applicationData: AlcoholLabelApplicationData,
  extracted: ExtractedAlcoholLabelInformation
): LabelVerificationSummary {
  const simpleFieldResults = verifySimpleFields(applicationData, extracted);

  const governmentWarningResult = verifyGovernmentWarning(
    {
      governmentWarningText: extracted.governmentWarningText,
      governmentWarningHeadingText: extracted.governmentWarningHeadingText,
    },
    buildGovernmentWarningEvidence(extracted),
    extracted.imageQuality
  );

  const simpleStatuses = simpleFieldResults.map((result) => result.status);
  const overallStatus = resolveOverallStatus(
    simpleStatuses,
    governmentWarningResult.status
  );

  const checks: VerificationCheckRow[] = [
    ...simpleFieldResults.map(toCheckRow),
    buildGovernmentWarningRow(governmentWarningResult),
  ];

  const imageQualityReason =
    extracted.imageQuality === "poor" || extracted.imageQuality === "insufficient"
      ? "Some image detail could not be read confidently. Please review the label manually or upload a clearer image."
      : undefined;

  const uncertainties =
    extracted.uncertainties && extracted.uncertainties.length > 0
      ? extracted.uncertainties
      : undefined;

  return {
    overallStatus,
    imageQuality: extracted.imageQuality,
    imageQualityReason,
    checks,
    governmentWarningReason: governmentWarningResult.reason,
    extractionConfidence: extracted.overallExtractionConfidence,
    uncertainties,
    disclaimer:
      "This prototype assists human review and does not replace official TTB compliance determination.",
  };
}