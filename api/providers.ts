import type { VercelRequest, VercelResponse } from "@vercel/node";
import { PROVIDERS } from "./_providers.js";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  const publicList = PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    mcpUrl: p.mcpUrl,
  }));

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).json(publicList);
}
