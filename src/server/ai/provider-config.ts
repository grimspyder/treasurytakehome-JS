/**
 * Server-side configuration for the AI provider.
 *
 * Reads environment variables once at module load so the chosen provider and
 * model are not scattered throughout the code. All values must stay
 * server-side; none are ever exposed to client JavaScript.
 */

export type AiProviderKind =
  | "openai-compatible"
  | "azure-openai"
  | "gemini"
  | "none";

export interface AiProviderConfig {
  provider: Exclude<AiProviderKind, "none">;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}

const DEFAULT_TIMEOUT_MS = 30_000;

function readOptional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

function missing(name: string): string {
  return `${name} is not set. Configure the AI provider environment variables (see README).`;
}

/** Build the provider configuration from environment variables. */
export function loadProviderConfig(): AiProviderConfig {
  const provider = (readOptional("AI_PROVIDER") ?? "openai-compatible") as AiProviderKind;
  if (provider === "none") {
    throw new Error(
      "AI_PROVIDER is set to 'none'. Set it to openai-compatible, azure-openai, or gemini."
    );
  }

  const baseUrl = readOptional("AI_BASE_URL");
  const apiKey = readOptional("AI_API_KEY");
  const model = readOptional("AI_MODEL");
  const timeoutRaw = readOptional("AI_TIMEOUT_MS");

  if (!apiKey) {
    throw new Error(missing("AI_API_KEY"));
  }

  if (provider === "openai-compatible") {
    if (!baseUrl) {
      throw new Error(missing("AI_BASE_URL"));
    }
  }

  if (!model) {
    throw new Error(missing("AI_MODEL"));
  }

  return {
    provider,
    baseUrl:
      baseUrl ??
      (provider === "azure-openai"
        ? "https://YOUR_RESOURCE.openai.azure.com/openai/deployments/YOUR_DEPLOYMENT"
        : "https://generativelanguage.googleapis.com/v1beta"),
    apiKey,
    model,
    timeoutMs: timeoutRaw ? Number(timeoutRaw) : DEFAULT_TIMEOUT_MS,
  };
}