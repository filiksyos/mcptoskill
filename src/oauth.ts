import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createInterface } from "node:readline";
import { getProvider } from "./providers.js";

const REDIRECT_URI = "http://localhost:3000/callback";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const OAUTH_STATE_PATH = join(homedir(), ".openclaw", "mcptoskill", "oauth-state.json");

export interface SkillKeyResponse {
  access_token: string;
  refresh_token: string | null;
  expires_in: number | null;
  token_endpoint: string | null;
  client_id: string | null;
  client_secret?: string;
  mcp_url: string;
  provider: string;
  mcp_oauth: boolean;
  token_encoding: "basic" | "none";
  resource_url: string | null;
  workspace_name: string | null;
}

interface OAuthState {
  state: string;
  code_verifier: string;
  provider: string;
  client_id?: string;
  token_endpoint?: string;
  resource_url?: string;
  client_secret?: string;
  created_at: number;
}

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
): Promise<{ client_id: string; client_secret?: string }> {
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
  const data = (await res.json()) as { client_id: string; client_secret?: string };
  return data;
}

async function loadState(): Promise<OAuthState | null> {
  try {
    const raw = await readFile(OAUTH_STATE_PATH, "utf8");
    const state = JSON.parse(raw) as OAuthState;
    const age = Date.now() - state.created_at;
    if (age > STATE_TTL_MS) {
      await unlink(OAUTH_STATE_PATH).catch(() => {});
      return null;
    }
    return state;
  } catch {
    return null;
  }
}

async function saveState(state: OAuthState): Promise<void> {
  await mkdir(join(homedir(), ".openclaw", "mcptoskill"), { recursive: true });
  await writeFile(OAUTH_STATE_PATH, JSON.stringify(state, null, 2) + "\n", "utf8");
}

async function deleteState(): Promise<void> {
  await unlink(OAUTH_STATE_PATH).catch(() => {});
}

function promptForUrl(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin });
    rl.question("", (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function runLocalOAuth(
  providerId: string,
  skillName: string,
  mcpUrl: string
): Promise<SkillKeyResponse> {
  const provider = getProvider(providerId);
  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  const state = globalThis.crypto.randomUUID();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  let authUrl: string;
  let tokenEndpoint: string;
  let clientId: string;
  let clientSecret: string | undefined;

  if (provider.mcpOAuth && provider.discoveryUrl) {
    const metaRes = await fetch(provider.discoveryUrl);
    if (!metaRes.ok) {
      const body = await metaRes.text();
      throw new Error(
        `OAuth discovery failed: ${metaRes.status} for ${provider.discoveryUrl} - ${body.slice(0, 200)}`
      );
    }
    const meta = (await metaRes.json()) as {
      authorization_endpoint: string;
      token_endpoint: string;
      registration_endpoint?: string;
    };
    if (!meta.registration_endpoint) {
      throw new Error("OAuth discovery missing registration_endpoint");
    }
    const client = await registerMcpClient(meta.registration_endpoint, REDIRECT_URI);
    clientId = client.client_id;
    clientSecret = client.client_secret;
    tokenEndpoint = meta.token_endpoint;

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    if (provider.resourceUrl) {
      params.set("resource", provider.resourceUrl);
    }
    authUrl = meta.authorization_endpoint + "?" + params.toString();

    await saveState({
      state,
      code_verifier: codeVerifier,
      provider: providerId,
      client_id: clientId,
      client_secret: clientSecret,
      token_endpoint: tokenEndpoint,
      resource_url: provider.resourceUrl,
      created_at: Date.now(),
    });
  } else {
    clientId = process.env[provider.clientIdEnv] ?? "";
    clientSecret = process.env[provider.clientSecretEnv] ?? "";
    tokenEndpoint = provider.tokenUrl;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    if (provider.scopes.length > 0) {
      params.set("scope", provider.scopes.join(" "));
    }
    authUrl = provider.authUrl + "?" + params.toString();

    await saveState({
      state,
      code_verifier: codeVerifier,
      provider: providerId,
      client_secret: clientSecret,
      created_at: Date.now(),
    });
  }

  console.log("");
  console.log("Open this URL in your browser:");
  console.log(authUrl);
  console.log("");
  console.log("After completing OAuth, copy the URL from your browser's address bar and paste it here:");

  const pasted = await promptForUrl();
  if (!pasted) {
    await deleteState();
    throw new Error("No URL pasted. OAuth cancelled.");
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(pasted);
  } catch {
    await deleteState();
    throw new Error("Invalid URL pasted. Please paste the full redirect URL.");
  }

  const code = parsedUrl.searchParams.get("code");
  const returnedState = parsedUrl.searchParams.get("state");

  if (!code || !returnedState) {
    await deleteState();
    throw new Error("URL missing code or state. Please paste the full redirect URL from your browser.");
  }

  const storedState = await loadState();
  if (!storedState || storedState.state !== returnedState) {
    await deleteState();
    throw new Error("Invalid or expired state. Please run the command again and complete OAuth within 10 minutes.");
  }

  const tokenUrl = storedState.token_endpoint ?? tokenEndpoint;
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    client_id: storedState.client_id ?? clientId,
    code_verifier: storedState.code_verifier,
  });
  if (storedState.resource_url) {
    tokenBody.set("resource", storedState.resource_url);
  }

  if (storedState.client_secret) {
    headers["Authorization"] =
      "Basic " + Buffer.from(`${clientId}:${storedState.client_secret}`).toString("base64");
  }

  const tokenRes = await fetch(tokenUrl, {
    method: "POST",
    headers,
    body: tokenBody.toString(),
  });

  await deleteState();

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    throw new Error(`Token exchange failed: ${tokenRes.status} ${errBody.slice(0, 300)}`);
  }

  const tokenData = (await tokenRes.json()) as Record<string, unknown>;
  const access_token = tokenData[provider.tokenField];
  if (!access_token || typeof access_token !== "string") {
    throw new Error("Token exchange: missing access_token in response");
  }

  const refresh_token =
    typeof tokenData.refresh_token === "string" ? tokenData.refresh_token : null;
  const expires_in =
    typeof tokenData.expires_in === "number" ? tokenData.expires_in : null;

  let workspace_name: string | null = null;
  if (provider.workspaceNameField) {
    const val = tokenData[provider.workspaceNameField];
    workspace_name = typeof val === "string" ? val : null;
  }

  const result: SkillKeyResponse = {
    access_token,
    refresh_token,
    expires_in,
    token_endpoint: tokenUrl,
    client_id: clientId,
    mcp_url: provider.mcpUrl,
    provider: providerId,
    mcp_oauth: !!provider.mcpOAuth,
    token_encoding: provider.tokenEncoding,
    resource_url: provider.resourceUrl ?? null,
    workspace_name,
  };

  if (clientSecret) {
    result.client_secret = clientSecret;
  }

  return result;
}
