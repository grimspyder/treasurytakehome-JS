/**
 * Zod runtime schema for validating the AI provider's structured output.
 *
 * The model may return anything; we never trust it blindly (AI-007). This
 * schema enforces the shape and types before the domain layer sees the data.
 * `z.lazy`/optional handling keeps it strict about unknown fields while
 * allowing the model to omit optional label fields.
 */

import { z } from "zod";

export const ImageQualitySchema = z.enum([
  "good",
  "usable",
  "poor",
  "insufficient",
]);

export const BeverageCategorySchema = z.enum([
  "distilled-spirits",
  "wine",
  "malt-beverage",
  "unknown",
]);

/**
 * The structured extraction the model is expected to return. Every label field
 * is optional because a given label may not present it or the model may fail to
 * read it; the deterministic layer turns absence/uncertainty into
 * "needs-review" rather than assuming.
 */
export const ExtractedLabelSchema = z
  .object({
    brandName: z.string().optional(),
    classOrTypeDesignation: z.string().optional(),
    alcoholByVolume: z.string().optional(),
    proof: z.string().optional(),
    netContents: z.string().optional(),
    producerOrBottlerName: z.string().optional(),
    producerOrBottlerAddress: z.string().optional(),
    countryOfOrigin: z.string().optional(),
    governmentWarningText: z.string().optional(),
    governmentWarningHeadingText: z.string().optional(),
    governmentWarningHeadingAppearsBold: z.boolean().optional(),
    governmentWarningHeadingAppearsAllCaps: z.boolean().optional(),
    warningAppearsSeparateFromOtherInformation: z.boolean().optional(),
    warningAppearsLegible: z.boolean().optional(),
    detectedBeverageCategory: BeverageCategorySchema.optional(),
    imageQuality: ImageQualitySchema,
    fieldConfidenceScores: z.record(z.string(), z.number()).optional(),
    overallExtractionConfidence: z.number().optional(),
    uncertainties: z.array(z.string()).optional(),
  })
  .strip();

/** The shape the provider is asked to return (for prompt construction). */
export type ExtractedLabelModelOutput = z.infer<typeof ExtractedLabelSchema>;