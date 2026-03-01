#!/usr/bin/env node
import { mkdir, writeFile, chmod, readFile, copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { connectAndDiscover } from "./client.js";
import { generate } from "./generator.js";
import type { OAuthTokenInfo } from "./generator.js";

const OPENCLAW_DIR = join(homedir(), ".openclaw");
const OPENCLAW_SKILLS_DIR = join(OPENCLAW_DIR, "skills");
const OPENCLAW_CONFIG = join(OPENCLAW_DIR, "openclaw.json");
const MCPTOSKILL_TOKENS_DIR = join(OPENCLAW_DIR, "mcptoskill", "tokens");

function parseArgs(argv: string[]): {
  url: string;
  name?: string;
  outDir: string;
  headers: Record<string, string>;
  skillKey?: string;
} {
  const args = argv.slice(2);
  const url = args.find((a) => !a.startsWith("--"));
  const nameFlag = args.find((a) => a.startsWith("--name="));
  const outFlag = args.find((a) => a.startsWith("--out="));
  const skillKeyFlag = args.find((a) => a.startsWith("--skill-key="));
  const skillKeyIdx = args.findIndex((a) => a === "--skill-key");
  const headers: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--header" && args[i + 1]) {
      const headerStr = args[++i];
      const colonIdx = headerStr.indexOf(":");
      if (colonIdx > 0) {
        const key = headerStr.slice(0, colonIdx).trim();
        const value = headerStr.slice(colonIdx + 1).trim();
        if (key && value) headers[key] = value;
      } else {
        console.error(`Invalid header format: "${headerStr}". Expected "Key: Value"`);
        process.exit(1);
      }
    }
  }

  if (!url) {
    console.error("Usage: mcptoskill <mcp-server-url> [--name=<skill-name>] [--out=<output-dir>] [--header \"Key: Value\"] [--skill-key=<key>]");
    console.error("");
    console.error("Examples:");
    console.error("  mcptoskill https://mcp.context7.com/mcp");
    console.error("  mcptoskill https://mcp.context7.com/mcp --name=context7 --out=./skills");
    console.error("  mcptoskill https://mcp.supabase.com/mcp?project_ref=XXX --header \"Authorization: Bearer sbp_xxx\"");
    console.error("");
    console.error("Also installs local ./scripts/<skill-name>.sh for integrations.");
    process.exit(1);
  }

  // Support both --skill-key=value and --skill-key value (from website copy)
  const skillKey =
    skillKeyFlag?.split("=")[1] ??
    (skillKeyIdx >= 0 && args[skillKeyIdx + 1] && !args[skillKeyIdx + 1].startsWith("--")
      ? args[skillKeyIdx + 1]
      : undefined);

  return {
    url,
    name: nameFlag?.split("=")[1],
    outDir: outFlag?.split("=")[1] ?? OPENCLAW_SKILLS_DIR,
    headers,
    skillKey,
  };
}

async function updateOpenClawConfig(skillName: string): Promise<void> {
  if (!existsSync(OPENCLAW_DIR)) return;

  let config: Record<string, unknown> = {};
  if (existsSync(OPENCLAW_CONFIG)) {
    try {
      config = JSON.parse(await readFile(OPENCLAW_CONFIG, "utf8")) as Record<string, unknown>;
    } catch {
      // ignore parse errors, start fresh
    }
  }

  const skills = ((config.skills ?? {}) as Record<string, unknown>);
  const entries = ((skills.entries ?? {}) as Record<string, unknown>);
  entries[skillName] = { ...(entries[skillName] as object ?? {}), enabled: true };
  skills.entries = entries;

  const load = ((skills.load ?? {}) as Record<string, unknown>);
  const extraDirs = ((load.extraDirs ?? []) as string[]);
  if (!extraDirs.includes(OPENCLAW_SKILLS_DIR)) {
    extraDirs.push(OPENCLAW_SKILLS_DIR);
    load.extraDirs = extraDirs;
  }
  load.watch = true;
  skills.load = load;
  config.skills = skills;

  await writeFile(OPENCLAW_CONFIG, JSON.stringify(config, null, 2) + "\n", "utf8");
}

interface SkillKeyResponse {
  access_token: string;
  refresh_token: string | null;
  expires_in: number | null;
  token_endpoint: string | null;
  client_id: string | null;
  mcp_url: string;
  provider: string;
  mcp_oauth: boolean;
  token_encoding: "basic" | "none";
  resource_url: string | null;
  workspace_name: string | null;
}

async function saveTokenFile(
  skillName: string,
  data: SkillKeyResponse
): Promise<string> {
  await mkdir(MCPTOSKILL_TOKENS_DIR, { recursive: true });

  const tokenFilePath = join(MCPTOSKILL_TOKENS_DIR, `${skillName}.json`);
  const now = Math.floor(Date.now() / 1000);

  const tokenData = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_in ? now + data.expires_in : null,
    token_endpoint: data.token_endpoint,
    client_id: data.client_id,
    mcp_oauth: data.mcp_oauth,
    token_encoding: data.token_encoding,
    resource_url: data.resource_url,
    provider: data.provider,
    mcp_url: data.mcp_url,
  };

  await writeFile(tokenFilePath, JSON.stringify(tokenData, null, 2) + "\n", "utf8");
  await chmod(tokenFilePath, 0o600);

  return tokenFilePath;
}

async function main() {
  const { url, name, outDir, headers, skillKey } = parseArgs(process.argv);

  let oauthTokenInfo: OAuthTokenInfo | undefined;

  if (skillKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`https://mcptoskill.com/api/token/${skillKey}`, {
        signal: controller.signal,
      });
      if (!res.ok) {
        console.error("Error: skill key not found — visit mcptoskill.com to reconnect");
        process.exit(1);
      }
      const data = (await res.json()) as SkillKeyResponse;
      headers["Authorization"] = `Bearer ${data.access_token}`;

      if (data.refresh_token) {
        oauthTokenInfo = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_in: data.expires_in,
          token_endpoint: data.token_endpoint ?? "",
          client_id: data.client_id ?? "",
          mcp_oauth: data.mcp_oauth ?? false,
          token_encoding: data.token_encoding ?? "none",
          resource_url: data.resource_url ?? null,
          provider: data.provider,
          mcp_url: data.mcp_url,
        };
      }
    } catch {
      console.error("Error: skill key not found — visit mcptoskill.com to reconnect");
      process.exit(1);
    } finally {
      clearTimeout(timeout);
    }
  }

  console.log(`Connecting to ${url} ...`);

  const result = await connectAndDiscover(url, headers);

  console.log(`Found: ${result.serverInfo.name} v${result.serverInfo.version} — ${result.tools.length} tool(s)`);
  for (const t of result.tools) {
    console.log(`  • ${t.name}: ${t.description.slice(0, 80)}${t.description.length > 80 ? "…" : ""}`);
  }

  const skillName = name ?? result.serverInfo.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  let tokenFilePath: string | undefined;
  if (oauthTokenInfo) {
    tokenFilePath = await saveTokenFile(skillName, {
      ...oauthTokenInfo,
      workspace_name: null,
    });
    console.log(`✓ Token saved: ${tokenFilePath}`);
  }

  const { skillName: finalSkillName, skillMd, shellScript } = generate(
    result,
    name,
    oauthTokenInfo ? { ...oauthTokenInfo, tokenFilePath: tokenFilePath! } : undefined,
  );

  const skillDir = join(outDir, finalSkillName);
  const scriptsDir = join(skillDir, "scripts");

  await mkdir(scriptsDir, { recursive: true });

  const skillMdPath = join(skillDir, "SKILL.md");
  const scriptPath = join(scriptsDir, `${finalSkillName}.sh`);

  await writeFile(skillMdPath, skillMd, "utf8");
  await writeFile(scriptPath, shellScript, "utf8");
  await chmod(scriptPath, 0o755);

  const localScriptsDir = join(process.cwd(), "scripts");
  await mkdir(localScriptsDir, { recursive: true });
  const localScriptPath = join(localScriptsDir, `${finalSkillName}.sh`);
  await copyFile(scriptPath, localScriptPath);
  await chmod(localScriptPath, 0o755);
  console.log(`✓ Copied to local workspace: ${localScriptPath}`);

  const isOpenClawInstall = resolve(outDir) === resolve(OPENCLAW_SKILLS_DIR);

  if (isOpenClawInstall) {
    await updateOpenClawConfig(finalSkillName);
    console.log("");
    console.log(`✓ Skill installed: ${finalSkillName}`);
    console.log(`  ${skillDir}/`);
    if (oauthTokenInfo) {
      console.log(`  Token auto-refresh enabled (${oauthTokenInfo.provider})`);
    }
    console.log("");
    console.log("Restart OpenClaw (or wait for auto-reload), then try:");
    console.log(`  "use ${result.serverInfo.name} to ${result.tools[0]?.name?.replace(/-/g, " ") ?? "run a tool"}"`);
  } else {
    console.log("");
    console.log(`Generated skill: ${finalSkillName}`);
    console.log(`  ${skillMdPath}`);
    console.log(`  ${scriptPath}`);
    if (oauthTokenInfo) {
      console.log(`  Token auto-refresh enabled (${oauthTokenInfo.provider})`);
    }
    console.log("");
    console.log("To install in OpenClaw:");
    console.log(`  cp -r ${skillDir} ${OPENCLAW_SKILLS_DIR}/`);
  }

  console.log("");
  console.log("Test the script directly:");
  console.log(`  ${scriptPath} ${result.tools[0]?.name ?? "tool-name"} '{}'`);
}

main().catch((err) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
