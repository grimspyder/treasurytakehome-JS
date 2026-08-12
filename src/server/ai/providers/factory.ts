/**
 * Provider factory — returns the configured LabelAnalysisProvider instance.
 *
 * Keeps provider construction in one place so the API routes only depend on the
 * LabelAnalysisProvider interface (Ports and Adapters). Azure OpenAI and Gemini
 * adapters reuse the same request/response shape where possible.
 */

import { LabelAnalysisProvider } from "./label-analysis-provider";
import { OpenAICompatibleLabelAnalysisProvider } from "./openai-compatible-provider";
import { AzureOpenAILabelAnalysisProvider } from "./azure-openai-provider";
import { GeminiLabelAnalysisProvider } from "./gemini-provider";
import { AiProviderConfig } from "../provider-config";

export function createLabelAnalysisProvider(
  config: AiProviderConfig
): LabelAnalysisProvider {
  switch (config.provider) {
    case "openai-compatible":
      return new OpenAICompatibleLabelAnalysisProvider({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        timeoutMs: config.timeoutMs,
      });
    case "azure-openai":
      return new AzureOpenAILabelAnalysisProvider({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        timeoutMs: config.timeoutMs,
      });
    case "gemini":
      return new GeminiLabelAnalysisProvider({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        timeoutMs: config.timeoutMs,
      });
    default:
      throw new Error(`Unsupported AI provider: ${String(config.provider)}`);
  }
}