import { getConnectionUsage } from "@/app/api/usage/[connectionId]/route.js";
import { getProviderConnections } from "@/lib/localDb";
import { USAGE_APIKEY_PROVIDERS, USAGE_SUPPORTED_PROVIDERS } from "@/shared/constants/providers";

function isEligible(connection) {
  if (connection.isActive === false || !USAGE_SUPPORTED_PROVIDERS.includes(connection.provider)) return false;
  return connection.authType === "oauth"
    || ((connection.authType === "apikey" || connection.authType === "api_key")
      && USAGE_APIKEY_PROVIDERS.includes(connection.provider));
}

function remainingPercentage(quota) {
  const explicit = Number(quota?.remainingPercentage);
  if (Number.isFinite(explicit)) return Math.max(0, Math.min(100, explicit));
  const total = Number(quota?.total);
  const remaining = Number(quota?.remaining);
  if (Number.isFinite(total) && total > 0 && Number.isFinite(remaining)) {
    return Math.max(0, Math.min(100, (remaining / total) * 100));
  }
  const used = Number(quota?.used);
  if (Number.isFinite(total) && total > 0 && Number.isFinite(used)) {
    return Math.max(0, Math.min(100, ((total - used) / total) * 100));
  }
  return quota?.unlimited === true ? 100 : null;
}

function normalizeQuotas(quotas) {
  if (!quotas || typeof quotas !== "object" || Array.isArray(quotas)) return [];
  return Object.entries(quotas)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, quota]) => ({
      name,
      remainingPercentage: remainingPercentage(quota),
      resetAt: typeof quota?.resetAt === "string" ? quota.resetAt : null,
      status: quota?.unlimited === true ? "unlimited" : "available",
    }));
}

async function accountUsage(connection) {
  const account = {
    id: connection.id,
    provider: connection.provider,
    identity: connection.displayName || connection.email || connection.name || connection.id,
  };
  try {
    const usage = await getConnectionUsage(connection);
    const quotas = normalizeQuotas(usage?.quotas);
    return { ...account, status: quotas.length > 0 ? "ok" : "unavailable", quotas };
  } catch {
    return { ...account, status: "error", quotas: [] };
  }
}

export async function GET() {
  const connections = (await getProviderConnections({ isActive: true }))
    .filter(isEligible)
    .sort((a, b) => {
      const priority = (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER);
      return priority || a.provider.localeCompare(b.provider) || a.id.localeCompare(b.id);
    });
  return Response.json({ accounts: await Promise.all(connections.map(accountUsage)) });
}
