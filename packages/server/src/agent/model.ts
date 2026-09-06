import { getModel, type Model } from "@mariozechner/pi-ai";
import type { ModelSettings } from "../store/repos.js";

const STUB_MODEL: Model<"openai-completions"> = {
  id: "quantum-stub",
  name: "Quantum local coach",
  api: "openai-completions",
  provider: "quantum-stub",
  baseUrl: "http://127.0.0.1/unused",
  reasoning: false,
  input: ["text"],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 32000,
  maxTokens: 4096,
};

export function stubModel(): Model<"openai-completions"> {
  return STUB_MODEL;
}

export function modelFromSettings(settings: ModelSettings): Model<"openai-completions"> | Model<string> {
  if (!settings.apiKey) return stubModel();

  try {
    const known = getModel(settings.provider as never, settings.modelId as never);
    if (settings.baseUrl) {
      return { ...known, baseUrl: settings.baseUrl };
    }
    return known;
  } catch {
    return {
      id: settings.modelId || "custom-model",
      name: settings.modelId || "custom",
      api: "openai-completions",
      provider: settings.provider || "custom",
      baseUrl: settings.baseUrl || "https://api.openai.com/v1",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 8192,
    };
  }
}
