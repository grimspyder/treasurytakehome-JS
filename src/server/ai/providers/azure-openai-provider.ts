/**
 * Azure OpenAI vision provider adapter.
 *
 * Azure OpenAI exposes an OpenAI-compatible Chat Completions endpoint at
 * `${baseUrl}/openai/deployments/${deployment}/chat/completions?api-version=...`
 * and uses `api-key` header instead of a Bearer token. We reuse the same prompt
 * and schema validation from the shared extraction module. This keeps the
 * prototype Azure-forward (matching the stakeholder's Azure infrastructure)
 * while remaining swappable.
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

interface AzureOpenAIProviderConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

/**
 * Extract the deployment name and API version from the configured model/base
 * URL. Supports both a full Azure URL and a compact `deployment@api-version`
 * form. Falls back to a reasonable default when not fully specified.
 */
function resolveAzureEndpoint(
  baseUrl: string,
  model: string
): { endpoint: string; apiVersion: string } {
  let deployment = model;
  let apiVersion = "2024-02-01";
  if (model.includes("@")) {
    const [deploymentName, version] = model.split("@");
    deployment = deploymentName;
    apiVersion = version;
  }
  if (baseUrl.includes("/openai/deployments/")) {
    return { endpoint: baseUrl, apiVersion };
  }
  const trimmed = baseUrl.replace(/\/$/, "");
  return { endpoint: `${trimmed}/openai/deployments/${deployment}`, apiVersion };
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

export class AzureOpenAILabelAnalysisProvider
  implements LabelAnalysisProvider
{
  readonly name = "azure-openai";

  private readonly config: AzureOpenAIProviderConfig;

  constructor(config: AzureOpenAIProviderConfig) {
    this.config = config;
  }

  async analyzeLabel(
    request: LabelAnalysisRequest
  ): Promise<StructuredLabelAnalysis> {
    const resolved = resolveAzureEndpoint(this.config.baseUrl, this.config.model);
    const separator = "separator" in resolved ? resolved.separator : "?";
    const endpoint = `${(resolved as { endpoint: string }).endpoint}${separator}api-version=${(resolved as { apiVersion: string }).apiVersion}`;

    const controller = new AbortController();
    const timeoutHandle = setTimeout(
      () => controller.abort(),
      this.config.timeoutMs
    );

    let rawResponse: Response;
    try {
      rawResponse = await fetch(`${endpoint}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": this.config.apiKey,
        },
        body: JSON.stringify({
          model: this.config.model.split("@")[0],
          temperature: 0,
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