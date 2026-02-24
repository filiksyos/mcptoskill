import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getProvider } from "../_providers.js";
import { redisSet } from "../_redis.js";

function base64UrlEncode(buf: Uint8Array): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function generateCodeVerifier(): string {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const enc = new TextEncoder();
  const hash = await globalThis.crypto.subtle.digest("SHA-256", enc.encode(verifier));
  return base64UrlEncode(new Uint8Array(hash));
}

async function registerMcpClient(
  registrationEndpoint: string,
  redirectUri: string
): Promise<{ client_id: string }> {
  const res = await fetch(registrationEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_name: "mcptoskill",
      client_uri: "https://mcptoskill.com",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Client registration failed: ${res.status} ${body}`);
  }
  const data = (await res.json()) as { client_id: string };
  return data;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const id = req.query.provider as string;
  const provider = getProvider(id);
  if (!provider) {
    res.status(400).send("Unknown provider");
    return;
  }

  const state = globalThis.crypto.randomUUID();
  const redirectUri = "https://mcptoskill.com/api/auth/callback/" + id;

  if (provider.mcpOAuth) {
    // MCP OAuth: discovery, dynamic registration, PKCE
    const metaRes = await fetch("https://mcp.notion.com/.well-known/oauth-authorization-server");
    if (!metaRes.ok) throw new Error("OAuth discovery failed");
    const meta = (await metaRes.json()) as {
      authorization_endpoint: string;
      token_endpoint: string;
      registration_endpoint?: string;
    };
    const client = await registerMcpClient(
      meta.registration_endpoint ?? "https://mcp.notion.com/register",
      redirectUri
    );
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    await redisSet(
      "state:" + state,
      { provider: id, code_verifier: codeVerifier, client_id: client.client_id },
      600
    );
    const params = new URLSearchParams({
      response_type: "code",
      client_id: client.client_id,
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    const authorizationUrl = meta.authorization_endpoint + "?" + params.toString();
    res.redirect(302, authorizationUrl);
    return;
  }

  // Standard OAuth
  await redisSet("state:" + state, { provider: id }, 600);
  const params = new URLSearchParams({
    client_id: process.env[provider.clientIdEnv] ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  if (provider.scopes.length > 0) {
    params.set("scope", provider.scopes.join(" "));
  }
  const authorizationUrl = provider.authUrl + "?" + params.toString();

  res.redirect(302, authorizationUrl);
}
