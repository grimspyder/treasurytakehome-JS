/**
 * OpenAI-compatible vision provider adapter.
 *
 * Talks to any endpoint that speaks the OpenAI Chat Completions protocol with
 * image support (OpenAI, Azure OpenAI, OpenRouter, local vLLM etc.). The prompt
 * and output parsing are shared across adapters; this class only handles the
 * HTTP transport for the OpenAI Chat Completions request/response shape.
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

interface OpenAICompatibleProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

/** Build the expected-application-data text block for the user message. */
function buildExpectedDataBlock(
  request: LabelAnalysisRequest
): Array<{ type: "text"; text: string }> {
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

  return [
    {
      type: "text",
      text: `Application (expected) data for this label:\n${expectedBlock}\n\nNow read the attached label image and extract the fields as instructed.`,
    },
  ];
}

/** Extract the assistant text content from an OpenAI-style response. */
function extractAssistantText(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        part && typeof part === "object" && "text" in part
          ? String((part as { text?: unknown }).text ?? "")
          : ""
      )
      .join("");
  }
  return "";
}

export class OpenAICompatibleLabelAnalysisProvider
  implements LabelAnalysisProvider
{
  readonly name = "openai-compatible";

  private readonly config: OpenAICompatibleProviderConfig;

  constructor(config: OpenAICompatibleProviderConfig) {
    this.config = config;
  }

  async analyzeLabel(
    request: LabelAnalysisRequest
  ): Promise<StructuredLabelAnalysis> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs
    );

    let rawResponse: Response;
    try {
      rawResponse = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                ...buildExpectedDataBlock(request),
                { type: "image_url", image_url: { url: request.imageDataUrl } },
              ],
            },
          ],
          max_tokens: 2200,
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

    const choices = (
      payload as {
        choices?: Array<{ message?: { content?: unknown } }>;
      }
    ).choices;
    const assistantContent = choices?.[0]?.message?.content;

    if (typeof assistantContent === "undefined") {
      throw new LabelAnalysisError(
        "malformed-response",
        "The AI service response was missing its content."
      );
    }

    const rawText = extractAssistantText(assistantContent);
    if (!rawText.trim()) {
      throw new LabelAnalysisError(
        "malformed-response",
        "The AI service returned an empty response."
      );
    }

    return parseModelOutput(rawText);
  }
}