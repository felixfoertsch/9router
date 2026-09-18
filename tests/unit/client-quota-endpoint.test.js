import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getProviderConnections: vi.fn(),
  getConnectionUsage: vi.fn(),
}));

vi.mock("@/lib/localDb", () => ({
  getProviderConnections: mocks.getProviderConnections,
}));

vi.mock("@/app/api/usage/[connectionId]/route.js", () => ({
  getConnectionUsage: mocks.getConnectionUsage,
}));

describe("client quota endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns bounded quotas for active routed accounts in stable order", async () => {
    mocks.getProviderConnections.mockResolvedValue([
      {
        id: "conn-b",
        provider: "opencode-go",
        authType: "apikey",
        name: "Go account",
        apiKey: "provider-secret",
        isActive: true,
        priority: 2,
      },
      {
        id: "conn-disabled",
        provider: "codex",
        authType: "oauth",
        email: "disabled@example.com",
        accessToken: "oauth-secret",
        isActive: false,
      },
      {
        id: "conn-a",
        provider: "codex",
        authType: "oauth",
        email: "user@example.com",
        accessToken: "oauth-secret",
        isActive: true,
        priority: 1,
      },
      {
        id: "conn-unsupported",
        provider: "openrouter",
        authType: "apikey",
        apiKey: "provider-secret",
        isActive: true,
      },
    ]);
    mocks.getConnectionUsage
      .mockResolvedValueOnce({
        plan: "plus",
        quotas: {
          weekly: { used: 25, total: 100, remaining: 75, resetAt: "2026-09-20T00:00:00.000Z", unlimited: false },
          session: { remainingPercentage: 40, resetAt: null },
        },
      })
      .mockResolvedValueOnce({ message: "Usage temporarily unavailable" });

    const { GET } = await import("../../src/app/api/v1/usage/route.js");
    const response = await GET(new Request("http://localhost/api/v1/usage"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accounts: [
        {
          id: "conn-a",
          provider: "codex",
          identity: "user@example.com",
          status: "ok",
          quotas: [
            { name: "session", remainingPercentage: 40, resetAt: null, status: "available" },
            { name: "weekly", remainingPercentage: 75, resetAt: "2026-09-20T00:00:00.000Z", status: "available" },
          ],
        },
        {
          id: "conn-b",
          provider: "opencode-go",
          identity: "Go account",
          status: "unavailable",
          quotas: [],
        },
      ],
    });
    expect(mocks.getConnectionUsage).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(await (await GET(new Request("http://localhost/api/v1/usage"))).json())).not.toContain("secret");
  });

  it("isolates an upstream failure to its account", async () => {
    mocks.getProviderConnections.mockResolvedValue([
      { id: "conn-a", provider: "codex", authType: "oauth", name: "A", isActive: true },
    ]);
    mocks.getConnectionUsage.mockRejectedValue(new Error("upstream included provider-secret"));

    const { GET } = await import("../../src/app/api/v1/usage/route.js");
    const response = await GET(new Request("http://localhost/api/v1/usage"));

    expect(await response.json()).toEqual({
      accounts: [{ id: "conn-a", provider: "codex", identity: "A", status: "error", quotas: [] }],
    });
  });
});
