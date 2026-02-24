import type { VercelRequest, VercelResponse } from "@vercel/node";
import { redisGet, redisDel } from "../_redis.js";

interface SkillKeyRecord {
  access_token: string;
  mcp_url: string;
  provider: string;
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
      mcp_url: record.mcp_url,
      provider: record.provider,
      workspace_name: record.workspace_name,
    });
    return;
  }

  res.status(404).json({ error: "not_found" });
}
