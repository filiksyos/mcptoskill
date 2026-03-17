#!/usr/bin/env node
import { mkdir, writeFile, chmod, readFile, copyFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { connectAndDiscover } from "./client.js";
import { generate, type OAuthTokenInfo, type Target } from "./generator.js";
import { getProviderByMcpUrl } from "./providers.js";
import { runLocalOAuth } from "./oauth.js";
import { promptAuth, promptTarget, promptApiKey, type AuthChoice, type TargetChoice } from "./prompts.js";

const OPENCLAW_DIR = join(homedir(), ".openclaw");
const OPENCLAW_SKILLS_DIR = join(OPENCLAW_DIR, "skills");
const OPENCLAW_CONFIG = join(OPENCLAW_DIR, "openclaw.json");
const OPENCLAW_TOKENS_DIR = join(OPENCLAW_DIR, "mcptoskill", "tokens");
const HERMES_SKILLS_DIR = join(homedir(), ".hermes", "skills", "mcptoskill");
const HERMES_TOKENS_DIR = join(homedir(), ".hermes", "mcptoskill", "tokens");

function parseArgs(argv: string[]): {
  url: string;
  name?: string;
  outDir?: string;
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
    console.error("  mcptoskill https://mcp.notion.com/mcp          # prompts for auth & target");
    console.error("  mcptoskill https://mcp.context7.com/mcp --name=context7 --out=./skills");
    console.error("  mcptoskill https://mcp.supabase.com/mcp?project_ref=XXX --header \"Authorization: Bearer sbp_xxx\"");
    console.error("");
    console.error("Run without --header for interactive prompts: auth (OAuth/API key/none) and target (OpenClaw/Hermes/Both).");
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
    outDir: outFlag?.split("=")[1],
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
  client_secret?: string;
  mcp_url: string;
  provider: string;
  mcp_oauth: boolean;
  token_encoding: "basic" | "none";
  resource_url: string | null;
  workspace_name: string | null;
}

async function saveTokenFile(
  skillName: string,
  data: SkillKeyResponse,
  target: Target
): Promise<string> {
  const tokensDir = target === "hermes" ? HERMES_TOKENS_DIR : OPENCLAW_TOKENS_DIR;
  await mkdir(tokensDir, { recursive: true });

  const tokenFilePath = join(tokensDir, `${skillName}.json`);
  const now = Math.floor(Date.now() / 1000);

  const tokenData: Record<string, unknown> = {
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
  if (data.client_secret) {
    tokenData.client_secret = data.client_secret;
  }

  await writeFile(tokenFilePath, JSON.stringify(tokenData, null, 2) + "\n", "utf8");
  await chmod(tokenFilePath, 0o600);

  return tokenFilePath;
}

function getTargets(choice: TargetChoice): Target[] {
  if (choice === "both") return ["openclaw", "hermes"];
  return [choice];
}

function getTokenPathForScript(skillName: string, target: Target): string {
  return target === "hermes"
    ? `$HOME/.hermes/mcptoskill/tokens/${skillName}.json`
    : `$HOME/.openclaw/mcptoskill/tokens/${skillName}.json`;
}

async function main() {
  const { url, name, outDir: customOutDir, headers, skillKey } = parseArgs(process.argv);

  const provider = getProviderByMcpUrl(url);
  const hasOAuthProvider = !!provider;
  const hasHeader = Object.keys(headers).length > 0;

  let authChoice: AuthChoice = "no_auth";
  let oauthData: SkillKeyResponse | undefined;

  if (skillKey) {
    console.warn("--skill-key is deprecated. Use local OAuth instead (no flag needed).");
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
        oauthData = data;
      }
    } catch {
      console.error("Error: skill key not found — visit mcptoskill.com to reconnect");
      process.exit(1);
    } finally {
      clearTimeout(timeout);
    }
  } else {
    authChoice = await promptAuth(hasOAuthProvider, hasHeader);

    if (authChoice === "oauth" && provider) {
      const oauthSkillName = name ?? `${provider.id}-mcp`;
      oauthData = await runLocalOAuth(provider.id, oauthSkillName, url);
      headers["Authorization"] = `Bearer ${oauthData.access_token}`;
    } else if (authChoice === "api_key") {
      const token = await promptApiKey();
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const targetChoice = await promptTarget();
  const targets = getTargets(targetChoice);

  console.log(`Connecting to ${url} ...`);

  const result = await connectAndDiscover(url, headers);

  console.log(`Found: ${result.serverInfo.name} v${result.serverInfo.version} — ${result.tools.length} tool(s)`);
  for (const t of result.tools) {
    console.log(`  • ${t.name}: ${t.description.slice(0, 80)}${t.description.length > 80 ? "…" : ""}`);
  }

  const knownNames: Record<string, string> = {
    "mcp.exa.ai": "exa",
    "exa.ai": "exa",
  };
  const host = (() => {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  const slug = result.serverInfo.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const skillNameOverride = oauthData && provider ? (name ?? `${provider.id}-mcp`) : undefined;
  const skillName =
    skillNameOverride ?? name ?? (knownNames[host] ?? (host.endsWith(".exa.ai") ? "exa" : slug));

  if (customOutDir) {
    const target = targets[0];
    const outDir = customOutDir;
    const tokenFilePath = oauthData
      ? await saveTokenFile(skillName, {
          ...oauthData,
          workspace_name: oauthData.workspace_name ?? null,
        } as SkillKeyResponse, target)
      : undefined;

    const oauthTokenInfo: OAuthTokenInfo | undefined = oauthData
      ? {
          access_token: oauthData.access_token,
          refresh_token: oauthData.refresh_token ?? "",
          expires_in: oauthData.expires_in,
          token_endpoint: oauthData.token_endpoint ?? "",
          client_id: oauthData.client_id ?? "",
          mcp_oauth: oauthData.mcp_oauth ?? false,
          token_encoding: oauthData.token_encoding ?? "none",
          resource_url: oauthData.resource_url ?? null,
          provider: oauthData.provider,
          mcp_url: oauthData.mcp_url,
          tokenFilePath: getTokenPathForScript(skillName, target),
          ...(oauthData.client_secret && { client_secret: oauthData.client_secret }),
        }
      : undefined;

    const { skillName: finalSkillName, skillMd, shellScript } = generate(
      result,
      skillName,
      oauthTokenInfo,
      target,
    );

    const skillDir = join(outDir, finalSkillName);
    const scriptsDir = join(skillDir, "scripts");
    await mkdir(scriptsDir, { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), skillMd, "utf8");
    const scriptPath = join(scriptsDir, `${finalSkillName}.sh`);
    await writeFile(scriptPath, shellScript, "utf8");
    await chmod(scriptPath, 0o755);

    if (tokenFilePath) console.log(`✓ Token saved: ${tokenFilePath}`);
    console.log(`✓ Generated: ${skillDir}/`);
    return;
  }

  for (const target of targets) {
    const outDir = target === "hermes" ? HERMES_SKILLS_DIR : OPENCLAW_SKILLS_DIR;
    const tokenFilePath = oauthData
      ? await saveTokenFile(skillName, {
          ...oauthData,
          workspace_name: oauthData.workspace_name ?? null,
        } as SkillKeyResponse, target)
      : undefined;

    const oauthTokenInfo: OAuthTokenInfo | undefined = oauthData
      ? {
          access_token: oauthData.access_token,
          refresh_token: oauthData.refresh_token ?? "",
          expires_in: oauthData.expires_in,
          token_endpoint: oauthData.token_endpoint ?? "",
          client_id: oauthData.client_id ?? "",
          mcp_oauth: oauthData.mcp_oauth ?? false,
          token_encoding: oauthData.token_encoding ?? "none",
          resource_url: oauthData.resource_url ?? null,
          provider: oauthData.provider,
          mcp_url: oauthData.mcp_url,
          tokenFilePath: getTokenPathForScript(skillName, target),
          ...(oauthData.client_secret && { client_secret: oauthData.client_secret }),
        }
      : undefined;

    const { skillName: finalSkillName, skillMd, shellScript } = generate(
      result,
      skillName,
      oauthTokenInfo,
      target,
    );

    const skillDir = join(outDir, finalSkillName);
    const scriptsDir = join(skillDir, "scripts");
    await mkdir(scriptsDir, { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), skillMd, "utf8");
    const scriptPath = join(scriptsDir, `${finalSkillName}.sh`);
    await writeFile(scriptPath, shellScript, "utf8");
    await chmod(scriptPath, 0o755);

    if (tokenFilePath) console.log(`✓ Token saved: ${tokenFilePath}`);
    console.log(`✓ Skill installed: ${finalSkillName} (${target})`);
    console.log(`  ${skillDir}/`);

    if (target === "openclaw") {
      await updateOpenClawConfig(finalSkillName);
    }
  }

  const localScriptsDir = join(process.cwd(), "scripts");
  await mkdir(localScriptsDir, { recursive: true });
  const lastTarget = targets[targets.length - 1];
  const lastOutDir = lastTarget === "hermes" ? HERMES_SKILLS_DIR : OPENCLAW_SKILLS_DIR;
  const finalSkillName = skillNameOverride ?? skillName;
  const localScriptPath = join(localScriptsDir, `${finalSkillName}.sh`);
  await copyFile(join(lastOutDir, finalSkillName, "scripts", `${finalSkillName}.sh`), localScriptPath);
  await chmod(localScriptPath, 0o755);
  console.log(`✓ Copied to local workspace: ${localScriptPath}`);

  const targetNames = targets.map((t) => (t === "hermes" ? "Hermes" : "OpenClaw")).join(" & ");
  console.log("");
  if (oauthData) {
    console.log(`  Token auto-refresh enabled (${oauthData.provider})`);
  }
  console.log(`Restart ${targetNames} (or wait for auto-reload), then try:`);
  console.log(`  "use ${result.serverInfo.name} to ${result.tools[0]?.name?.replace(/-/g, " ") ?? "run a tool"}"`);
  console.log("");
  console.log("Test the script directly:");
  console.log(`  ${localScriptPath} ${result.tools[0]?.name ?? "tool-name"} '{}'`);
}

main().catch((err) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
