import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getProvider } from "../_providers.js";
import { redisSet } from "../_redis.js";

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
  await redisSet("state:" + state, { provider: id }, 600);

  const params = new URLSearchParams({
    client_id: process.env[provider.clientIdEnv] ?? "",
    redirect_uri: "https://mcptoskill.com/api/auth/callback/" + id,
    response_type: "code",
    state,
  });
  if (provider.scopes.length > 0) {
    params.set("scope", provider.scopes.join(" "));
  }
  const authorizationUrl = provider.authUrl + "?" + params.toString();

  res.redirect(302, authorizationUrl);
}
