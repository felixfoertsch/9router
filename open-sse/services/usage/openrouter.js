import { proxyAwareFetch } from "../../utils/proxyFetch.js";
import { U } from "./shared.js";

const USAGE_URL = U("openrouter").url;

export async function getOpenRouterUsage(apiKey = null, proxyOptions = null) {
  if (!apiKey || typeof apiKey !== "string" || !apiKey.trim()) {
    return { message: "OpenRouter API key not available. Add a key to view usage." };
  }

  try {
    const response = await proxyAwareFetch(
      USAGE_URL,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          Accept: "application/json",
        },
      },
      proxyOptions,
    );
    if (!response.ok) return { message: `OpenRouter usage API error (${response.status}).` };

    const data = await response.json().catch(() => null);
    const quota = data?.data?.free_model_daily_requests;
    const used = Number(quota?.used);
    const total = Number(quota?.limit);
    const remaining = Number(quota?.remaining);
    if (![used, total, remaining].every(Number.isFinite) || total <= 0) {
      return { message: "OpenRouter usage response did not contain free-model quota data." };
    }

    return {
      plan: "OpenRouter",
      quotas: {
        "Free models daily": {
          used,
          total,
          remaining,
          remainingPercentage: Math.max(0, Math.min(100, (remaining / total) * 100)),
          resetAt: null,
          unlimited: false,
        },
      },
    };
  } catch (error) {
    return { message: `OpenRouter error: ${error.message}` };
  }
}
