#!/usr/bin/env node
import { mkdir, writeFile, chmod, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { existsSync } from "node:fs";
import { connectAndDiscover } from "./client.js";
import { generate } from "./generator.js";

const OPENCLAW_DIR = join(homedir(), ".openclaw");
const OPENCLAW_SKILLS_DIR = join(OPENCLAW_DIR, "skills");
const OPENCLAW_CONFIG = join(OPENCLAW_DIR, "openclaw.json");

function parseArgs(argv: string[]): { url: string; name?: string; outDir: string } {
  const args = argv.slice(2);
  const url = args.find((a) => !a.startsWith("--"));
  const nameFlag = args.find((a) => a.startsWith("--name="));
  const outFlag = args.find((a) => a.startsWith("--out="));

  if (!url) {
    console.error("Usage: mcptoskill <mcp-server-url> [--name=<skill-name>] [--out=<output-dir>]");
    console.error("");
    console.error("Examples:");
    console.error("  mcptoskill https://mcp.context7.com/mcp");
    console.error("  mcptoskill https://mcp.context7.com/mcp --name=context7 --out=./skills");
    process.exit(1);
  }

  return {
    url,
    name: nameFlag?.split("=")[1],
    outDir: outFlag?.split("=")[1] ?? OPENCLAW_SKILLS_DIR,
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

async function main() {
  const { url, name, outDir } = parseArgs(process.argv);

  console.log(`Connecting to ${url} ...`);

  const result = await connectAndDiscover(url);

  console.log(`Found: ${result.serverInfo.name} v${result.serverInfo.version} — ${result.tools.length} tool(s)`);
  for (const t of result.tools) {
    console.log(`  • ${t.name}: ${t.description.slice(0, 80)}${t.description.length > 80 ? "…" : ""}`);
  }

  const { skillName, skillMd, shellScript } = generate(result, name);

  const skillDir = join(outDir, skillName);
  const scriptsDir = join(skillDir, "scripts");

  await mkdir(scriptsDir, { recursive: true });

  const skillMdPath = join(skillDir, "SKILL.md");
  const scriptPath = join(scriptsDir, `${skillName}.sh`);

  await writeFile(skillMdPath, skillMd, "utf8");
  await writeFile(scriptPath, shellScript, "utf8");
  await chmod(scriptPath, 0o755);

  const isOpenClawInstall = resolve(outDir) === resolve(OPENCLAW_SKILLS_DIR);

  if (isOpenClawInstall) {
    await updateOpenClawConfig(skillName);
    console.log("");
    console.log(`✓ Skill installed: ${skillName}`);
    console.log(`  ${skillDir}/`);
    console.log("");
    console.log("Restart OpenClaw (or wait for auto-reload), then try:");
    console.log(`  "use ${result.serverInfo.name} to ${result.tools[0]?.name?.replace(/-/g, " ") ?? "run a tool"}"`);
  } else {
    console.log("");
    console.log(`Generated skill: ${skillName}`);
    console.log(`  ${skillMdPath}`);
    console.log(`  ${scriptPath}`);
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
