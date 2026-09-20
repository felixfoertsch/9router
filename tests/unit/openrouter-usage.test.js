import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../open-sse/utils/proxyFetch.js", () => ({
  proxyAwareFetch: vi.fn(),
}));

import { proxyAwareFetch } from "../../open-sse/utils/proxyFetch.js";
import { getUsageForProvider } from "../../open-sse/services/usage.js";
import {
  USAGE_APIKEY_PROVIDERS,
  USAGE_SUPPORTED_PROVIDERS,
} from "../../src/shared/constants/providers.js";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("OpenRouter registry usage flags", () => {
  it("is listed for API key quota reporting", () => {
    expect(USAGE_SUPPORTED_PROVIDERS).toContain("openrouter");
    expect(USAGE_APIKEY_PROVIDERS).toContain("openrouter");
  });
});

describe("getUsageForProvider(openrouter)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches authoritative free-model daily quota", async () => {
    proxyAwareFetch.mockResolvedValueOnce(jsonResponse({
      data: {
        free_model_daily_requests: { used: 125, limit: 1000, remaining: 875 },
      },
    }));

    const usage = await getUsageForProvider({
      provider: "openrouter",
      apiKey: "sk-or-test",
    });

    expect(proxyAwareFetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/key",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Authorization: "Bearer sk-or-test" }),
      }),
      null,
    );
    expect(usage.quotas["Free models daily"]).toMatchObject({
      used: 125,
      total: 1000,
      remaining: 875,
      remainingPercentage: 87.5,
    });
  });
});
