/**
 * Google Gemini vision provider adapter.
 *
 * Gemini uses the REST `models/{model}:generateContent` endpoint with `inlineData`
 * parts (base64) for images instead of the OpenAI Chat Completions shape. We
 * reuse the same shared system prompt and schema validation; only the transport
 * differs. The image data URL is split into its MIME type and base64 body for
 * the `inlineData` part.
 */

import {
  LabelAnalysisError,
  LabelAnalysisProvider,
  LabelAnalysisRequest,
  StructuredLabelAnalysis,
} from "./label-analysis-provider";
import {
  ANALYSIS_SYSTEM_PROMPT,
  errorKindForHttpStatus,
  parseModelOutput,
} from "../extraction-prompt";

interface GeminiProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

/** Extract the base64 body and MIME type from a data URL. */
function splitDataUrl(dataUrl: string): { mimeType: string; base64: string } {
  const match = dataUrl.match(
    /^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/i
  );
  if (!match) {
    throw new LabelAnalysisError(
      "unknown",
      "The label image could not be encoded for the AI provider."
    );
  }
  return { mimeType: match[1], base64: match[2] };
}

/** Build the application-expected-data text block for the user message. */
function buildExpectedDataBlock(
  request: LabelAnalysisRequest
): { text: string } {
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

  const expectedBlock =
    lines.length === 0
      ? "(no expected application data provided)"
      : lines.map(([label, value]) => `- ${label}: ${value}`).join("\n");

  return {
    text: `Application (expected) data for this label:\n${expectedBlock}\n\nNow read the attached label image and extract the fields as instructed.`,
  };
}

/** Extract the concatenated text from a Gemini generateContent response. */
function extractGeminiText(payload: unknown): string | undefined {
  const candidates = (payload as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  }).candidates;
  const parts = candidates?.[0]?.content?.parts;
  if (!parts) {
    return undefined;
  }
  return parts.map((part) => part.text ?? "").join("");
}

export class GeminiLabelAnalysisProvider
  implements LabelAnalysisProvider
{
  readonly name = "gemini";

  private readonly config: GeminiProviderConfig;

  constructor(config: GeminiProviderConfig) {
    this.config = config;
  }

  async analyzeLabel(
    request: LabelAnalysisRequest
  ): Promise<StructuredLabelAnalysis> {
    const { mimeType, base64 } = splitDataUrl(request.imageDataUrl);

    const trimmedBaseUrl = this.config.baseUrl.replace(/\/$/, "");
    const endpoint = `${trimmedBaseUrl}/models/${this.config.model}:generateContent?key=${encodeURIComponent(this.config.apiKey)}`;

    const controller = new AbortController();
    const timeoutHandle = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs
    );

    let rawResponse: Response;
    try {
      rawResponse = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: ANALYSIS_SYSTEM_PROMPT,
                },
                {
                  text: buildExpectedDataBlock(request).text,
                },
                {
                  inlineData: { mimeType, data: base64 },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new LabelAnalysisError(
          "timeout",
          "The AI service took too long to respond."
        );
      }
      throw new LabelAnalysisError(
        "provider-unavailable",
        "Could not reach the AI service."
      );
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!rawResponse.ok) {
      throw new LabelAnalysisError(
        errorKindForHttpStatus(rawResponse.status),
        `The AI service returned an error (${rawResponse.status}).`
      );
    }

    let payload: unknown;
    try {
      payload = await rawResponse.json();
    } catch {
      throw new LabelAnalysisError(
        "malformed-response",
        "The AI service returned an unreadable response."
      );
    }

    const rawText = extractGeminiText(payload);
    if (!rawText || !rawText.trim()) {
      throw new LabelAnalysisError(
        "malformed-response",
        "The AI service returned an empty response."
      );
    }

    return parseModelOutput(rawText);
  }
}