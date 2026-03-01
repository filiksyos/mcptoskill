import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redisGet, redisDel } from "../_redis.js";

interface SkillKeyRecord {
  access_token: string;
  refresh_token: string | null;
  expires_in: number | null;
  token_endpoint: string;
  client_id: string;
  mcp_url: string;
  provider: string;
  mcp_oauth: boolean;
  token_encoding: "basic" | "none";
  resource_url: string | null;
  workspace_name: string | null;
  created_at: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const skillKey = req.query.skill_key as string;
  const record = await redisGet<SkillKeyRecord>(`sk:${skillKey}`);

  res.setHeader("Content-Type", "application/json");

  if (record) {
    await redisDel("sk:" + skillKey);
    res.status(200).json({
      access_token: record.access_token,
      refresh_token: record.refresh_token ?? null,
      expires_in: record.expires_in ?? null,
      token_endpoint: record.token_endpoint ?? null,
      client_id: record.client_id ?? null,
      mcp_url: record.mcp_url,
      provider: record.provider,
      mcp_oauth: record.mcp_oauth ?? false,
      token_encoding: record.token_encoding ?? "none",
      resource_url: record.resource_url ?? null,
      workspace_name: record.workspace_name,
    });
    return;
  }

  res.status(404).json({ error: "not_found" });
}
