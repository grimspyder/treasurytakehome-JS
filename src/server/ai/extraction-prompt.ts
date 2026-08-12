/**
 * Shared prompt construction and model-output parsing for the AI adapters.
 *
 * All adapters (OpenAI-compatible, Azure OpenAI, Gemini) use the same system
 * prompt, the same "expected application data" text block, and the same Zod
 * schema validation. Only the transport (HTTP request/response shape) differs,
 * so it lives in the individual adapters. This keeps the model-communication
 * contract consistent and avoids duplication.
 */

import { LabelAnalysisRequest, LabelAnalysisError } from "./providers/label-analysis-provider";
import { ExtractedLabelSchema } from "./schemas/extracted-label.schema";

/** Prompt optimising the model to conservative, non-guessing output. */
export const ANALYSIS_SYSTEM_PROMPT = `You are a careful TTB alcohol label reader.
Read the text on the label image and return a SINGLE JSON object (no markdown fences) describing what you see.
Only put text you can actually read into the fields. For any field you cannot read confidently, omit it (do not guess).
The text you report should be exactly as printed on the label (preserve case, punctuation, and spacing where readable).
governmentWarningHeadingText: report the exact heading including its capitalization.
governmentWarningText: report the COMPLETE government warning statement EXACTLY as printed, starting the body right after the heading ("(1) According to the Surgeon General..."), including both numbered clauses (1) and (2) word-for-word and full. Do not summarize or truncate it — copy every word. If the entire warning is not readable, still put what you can read and note the rest in uncertainties.
Also report visual evidence booleans about the government warning (heading bold, heading all caps, warning separate from other info, warning legible). For a visual boolean you cannot determine, omit it.
Report imageQuality as one of: good, usable, poor, insufficient.
Report overallExtractionConfidence as a number 0-1 and uncertainties as an array of short strings describing anything you could not read confidently.
Do not add text that is not on the label. If the image is not a readable label, set imageQuality to "insufficient" and return minimal fields.`;

/**
 * Build the user message's expected-application-data text block supplied to the
 * model as context. This helps the model locate the relevant label fields.
 */
export function buildApplicationDataBlock(
  request: LabelAnalysisRequest
): string {
  const application = request.applicationData;
  const lines = [
    ["Brand name", application.brandName],
    ["Class/type designation", application.classOrTypeDesignation],
    ["Alcohol by volume", application.alcoholByVolume],
    ["Proof", application.proof],
    ["Net contents", application.netContents],
    ["Producer/bottler name", application.producerOrBottlerName],
    ["Producer/bottler address", application.producerOrBottlerAddress],
    ["Country of origin", application.countryOfOrigin],
    ["Beverage category", application.beverageCategory],
  ].filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1].trim() !== ""
  );

  if (lines.length === 0) {
    return "(no expected application data provided)";
  }
  return lines.map(([label, value]) => `- ${label}: ${value}`).join("\n");
}

export const EXTRACTION_USER_PROMPT = `Application (expected) data for this label:
%s

Now read the attached label image and extract the fields as instructed.`;

/**
 * Parse the model's textual output into a validated StructuredLabelAnalysis.
 * Tolerates a markdown-fenced JSON response. Throws LabelAnalysisError on any
 * shape violation.
 */
export function parseModelOutput(
  rawText: string
): { extracted: import("./schemas/extracted-label.schema").ExtractedLabelModelOutput } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    const unFenced = rawText.replace(/^```(?:json)?/m, "").replace(/```$/, "");
    try {
      parsed = JSON.parse(unFenced);
    } catch {
      throw new LabelAnalysisError(
        "malformed-response",
        "The AI service returned malformed output that could not be parsed."
      );
    }
  }

  const result = ExtractedLabelSchema.safeParse(parsed);
  if (!result.success) {
    throw new LabelAnalysisError(
      "malformed-response",
      "The AI service returned output that did not match the expected structure."
    );
  }
  return { extracted: result.data };
}

/**
 * Classify a non-2xx provider HTTP status into a typed error kind.
 */
export function errorKindForHttpStatus(
  status: number
): LabelAnalysisError["kind"] {
  if (status === 401 || status === 403) {
    return "invalid-api-key";
  }
  if (status === 429) {
    return "rate-limited";
  }
  if (status === 408 || status === 504) {
    return "timeout";
  }
  if (status >= 500) {
    return "provider-unavailable";
  }
  return "unknown";
}