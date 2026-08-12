/**
 * Server-side verification service.
 *
 * Orchestrates the full single-label pipeline:
 *   validate/read request → prepare image → AI extraction → deterministic
 *   verification → human-readable summary, with timings and typed error
 *   handling. The API route calls this; the UI calls the API route.
 *
 * Keeps provider construction, image prep, and domain verification in one
 * place so the route stays thin and testable.
 */

import { verifyLabel } from "../../../domain/label-verification/services/verify-label";
import {
  AlcoholLabelApplicationData,
  LabelVerificationSummary,
} from "../../../domain/label-verification/models/types";
import { prepareLabelImage } from "../../../server/image-prep/prepare-image";
import { createLabelAnalysisProvider } from "../../../server/ai/providers/factory";
import { loadProviderConfig } from "../../../server/ai/provider-config";
import { LabelAnalysisError } from "../../../server/ai/providers/label-analysis-provider";
import { performance } from "node:perf_hooks";

/** Result of a successful verification call. */
export interface VerificationOutput {
  summary: LabelVerificationSummary;
  providerUsed: string;
  modelUsed: string;
}

/** Convert a LabelAnalysisError kind to a stable string the UI can show. */
export function verificationErrorMessage(error: unknown): {
  message: string;
  code: string;
  detail?: string;
} {
  if (error instanceof LabelAnalysisError) {
    switch (error.kind) {
      case "invalid-api-key":
        return {
          message:
            "The AI service rejected the API key. Please check the server configuration.",
          code: "invalid-api-key",
          detail: error.message,
        };
      case "timeout":
        return {
          message:
            "The AI service took too long to respond. Your image is still available. Please try again.",
          code: "timeout",
          detail: error.message,
        };
      case "rate-limited":
        return {
          message:
            "The AI service is rate-limited right now. Please try again in a moment.",
          code: "rate-limited",
          detail: error.message,
        };
      case "provider-unavailable":
        return {
          message:
            "The AI service is temporarily unavailable. Please try again in a moment.",
          code: "provider-unavailable",
          detail: error.message,
        };
      case "malformed-response":
        return {
          message:
            "The AI service returned an unexpected result. Please try again.",
          code: "malformed-response",
          detail: error.message,
        };
      default:
        return {
          message:
            "We couldn't analyze this label because of an unexpected AI service error. Please try again.",
          code: "ai-error",
          detail: error.message,
        };
    }
  }
  // Non-AI errors (image prep, validation) — surface directly.
  const message = error instanceof Error ? error.message : "An unknown error occurred.";
  return { message, code: "request-error" };
}

/**
 * Verify a single label end-to-end.
 *
 * @param imageBuffer       Raw uploaded image bytes.
 * @param mimeType          Declared MIME type of the upload.
 * @param applicationData   The expected application data.
 * @param now               Optional clock for deterministic tests.
 */
export async function verifySingleLabel(
  imageBuffer: Buffer,
  mimeType: string,
  applicationData: AlcoholLabelApplicationData
): Promise<VerificationOutput> {
  // Stage 0 — prepare image (timed).
  const prepareStart = performance.now();
  let preparedImage: Awaited<ReturnType<typeof prepareLabelImage>>;
  try {
    preparedImage = await prepareLabelImage(imageBuffer, mimeType);
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : "The image could not be processed."
    );
  }
  const imagePreparationDuration = performance.now() - prepareStart;

  // Stage 1 — AI extraction (timed).
  const providerConfig = loadProviderConfig();
  const provider = createLabelAnalysisProvider(providerConfig);

  const aiStart = performance.now();
  let structuredAnalysis: Awaited<ReturnType<typeof provider.analyzeLabel>>;
  try {
    structuredAnalysis = await provider.analyzeLabel({
      applicationData,
      imageDataUrl: preparedImage.dataUrl,
    });
  } finally {
    // provider.analyzeLabel throws typed errors; durations measured even on
    // failure so the API layer can report how long the AI call took.
  }
  const aiInferenceDuration = performance.now() - aiStart;

  // Stage 2 — deterministic verification (timed).
  const validationStart = performance.now();
  const summary = verifyLabel(applicationData, structuredAnalysis.extracted);
  const validationDuration = performance.now() - validationStart;

  const formattedSummary: LabelVerificationSummary = {
    ...summary,
    durations: {
      imagePreparationDuration: Math.round(imagePreparationDuration),
      aiInferenceDuration: Math.round(aiInferenceDuration),
      validationDuration: Math.round(validationDuration),
    },
  };

  return {
    summary: formattedSummary,
    providerUsed: providerConfig.provider,
    modelUsed: providerConfig.model,
  };
}

/**
 * Shared error logging helper — logs category + durations without leaking
 * image data or credentials.
 */
export function logVerificationFailure(
  requestId: string,
  category: string,
  durationMs: number,
  detail?: string
): void {
  console.error(
    JSON.stringify({
      event: "verification_failed",
      requestId,
      category,
      durationMs: Math.round(durationMs),
      detail: detail || undefined,
    })
  );
}