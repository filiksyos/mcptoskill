import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getProvider } from "../../_providers.js";
import { redisGet, redisDel, redisSet } from "../../_redis.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  try {
    const id = req.query.provider as string;
    const code = req.query.code as string;
    const state = req.query.state as string;

    const provider = getProvider(id);
    if (!provider) {
      res.redirect(302, "/?error=unknown_provider");
      return;
    }

    const stored = await redisGet<{
      provider: string;
      code_verifier?: string;
      client_id?: string;
    }>("state:" + state);
    if (!stored) {
      res.redirect(302, "/?error=invalid_state");
      return;
    }

    await redisDel("state:" + state);

    const redirectUri = "https://mcptoskill.com/api/auth/callback/" + id;

    let clientId: string;
    let clientSecret: string;
    let tokenBody: URLSearchParams;
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    if (provider.mcpOAuth && stored.code_verifier && stored.client_id) {
      // MCP OAuth: PKCE, no client_secret
      clientId = stored.client_id;
      tokenBody = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        code_verifier: stored.code_verifier,
      });
    } else {
      clientId = process.env[provider.clientIdEnv] ?? "";
      clientSecret = process.env[provider.clientSecretEnv] ?? "";
      tokenBody = new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      });
      if (provider.tokenEncoding === "none") {
        tokenBody.set("client_id", clientId);
        tokenBody.set("client_secret", clientSecret);
      }
      if (provider.tokenEncoding === "basic") {
        headers["Authorization"] =
          "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      }
    }

    const tokenRes = await fetch(provider.tokenUrl, {
      method: "POST",
      headers,
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      res.redirect(302, "/?error=token_exchange_failed");
      return;
    }

    const tokenData = (await tokenRes.json()) as Record<string, unknown>;
    const access_token = tokenData[provider.tokenField];
    if (!access_token) {
      res.redirect(302, "/?error=token_exchange_failed");
      return;
    }

    let workspace_name: string | null = null;
    if (provider.workspaceNameField === null) {
      workspace_name = null;
    } else if (provider.workspaceNameField.includes(".")) {
      const parts = provider.workspaceNameField.split(".");
      let current: unknown = tokenData;
      for (const part of parts) {
        if (current && typeof current === "object" && part in current) {
          current = (current as Record<string, unknown>)[part];
        } else {
          current = null;
          break;
        }
      }
      workspace_name =
        typeof current === "string" ? current : null;
    } else {
      const val = tokenData[provider.workspaceNameField];
      workspace_name = typeof val === "string" ? val : null;
    }

    const bytes = new Uint8Array(8);
    globalThis.crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const skillKey = "sk_live_" + hex;

    await redisSet("sk:" + skillKey, {
      access_token,
      provider: id,
      mcp_url: provider.mcpUrl,
      workspace_name,
      created_at: new Date().toISOString(),
    });

    const redirectUrl =
      "/?key=" +
      skillKey +
      "&provider=" +
      id +
      "&name=" +
      encodeURIComponent(workspace_name ?? "");

    res.redirect(302, redirectUrl);
  } catch {
    res.redirect(302, "/?error=token_exchange_failed");
  }
}
