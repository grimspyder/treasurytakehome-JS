/**
 * Port (interface) for the AI analysis provider.
 *
 * This is the "port" side of Ports and Adapters. The domain verification layer
 * depends only on this interface, so the concrete provider (OpenAI-compatible,
 * Azure OpenAI, Gemini) can be swapped without touching the domain or API
 * routes. The provider turns an image + expected application data into a
 * validated StructuredLabelAnalysis, or throws a typed error the API layer can
 * surface to the user.
 */

import { ExtractedLabelModelOutput } from "../schemas/extracted-label.schema";

/** Expected application data used to guide the extraction prompt. */
export interface LabelAnalysisRequest {
  applicationData: {
    brandName?: string;
    classOrTypeDesignation?: string;
    alcoholByVolume?: string;
    proof?: string;
    netContents?: string;
    producerOrBottlerName?: string;
    producerOrBottlerAddress?: string;
    countryOfOrigin?: string;
    beverageCategory?: string;
  };
  /** A data URL of the (optionally resized) label image. */
  imageDataUrl: string;
}

/** The validated, structured result of an AI analysis call. */
export interface StructuredLabelAnalysis {
  extracted: ExtractedLabelModelOutput;
}

/** Categorized error so the API layer can choose a human-friendly message. */
export type LabelAnalysisErrorKind =
  | "invalid-api-key"
  | "timeout"
  | "rate-limited"
  | "provider-unavailable"
  | "malformed-response"
  | "unknown";

export class LabelAnalysisError extends Error {
  readonly kind: LabelAnalysisErrorKind;

  constructor(kind: LabelAnalysisErrorKind, message: string) {
    super(message);
    this.name = "LabelAnalysisError";
    this.kind = kind;
  }
}

/** The provider interface the adapters implement. */
export interface LabelAnalysisProvider {
  readonly name: string;
  /**
   * Analyze a label image and return validated structured extraction.
   * Implementations are responsible for calling the model API, validating the
   * response against the schema, and mapping HTTP/parse failures to
   * LabelAnalysisError.
   */
  analyzeLabel(request: LabelAnalysisRequest): Promise<StructuredLabelAnalysis>;
}