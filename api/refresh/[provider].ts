import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getProvider } from "../_providers.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  const id = req.query.provider as string;
  const provider = getProvider(id);
  if (!provider) {
    res.status(400).json({ error: "unknown_provider" });
    return;
  }

  if (provider.mcpOAuth) {
    res.status(400).json({
      error: "not_needed",
      message: "mcpOAuth providers can refresh client-side",
    });
    return;
  }

  const { refresh_token } = req.body as { refresh_token?: string };
  if (!refresh_token) {
    res.status(400).json({ error: "missing_refresh_token" });
    return;
  }

  const clientId = process.env[provider.clientIdEnv] ?? "";
  const clientSecret = process.env[provider.clientSecretEnv] ?? "";

  const tokenBody = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (provider.tokenEncoding === "basic") {
    headers["Authorization"] =
      "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  } else {
    tokenBody.set("client_id", clientId);
    tokenBody.set("client_secret", clientSecret);
  }

  try {
    const tokenRes = await fetch(provider.tokenUrl, {
      method: "POST",
      headers,
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error(
        `Refresh failed for ${id}: ${tokenRes.status} ${tokenRes.statusText}`,
        errBody.slice(0, 500)
      );
      res.status(502).json({ error: "refresh_failed" });
      return;
    }

    const tokenData = (await tokenRes.json()) as Record<string, unknown>;

    res.setHeader("Content-Type", "application/json");
    res.status(200).json({
      access_token: tokenData.access_token ?? null,
      refresh_token: tokenData.refresh_token ?? null,
      expires_in:
        typeof tokenData.expires_in === "number"
          ? tokenData.expires_in
          : null,
    });
  } catch {
    res.status(502).json({ error: "refresh_failed" });
  }
}
