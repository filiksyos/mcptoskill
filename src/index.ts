#!/usr/bin/env node
import { mkdir, writeFile, chmod } from "node:fs/promises";
import { join } from "node:path";
import { connectAndDiscover } from "./client.js";
import { generate } from "./generator.js";

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
    outDir: outFlag?.split("=")[1] ?? "./output",
  };
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

  console.log("");
  console.log(`Generated skill: ${skillName}`);
  console.log(`  ${skillMdPath}`);
  console.log(`  ${scriptPath}`);
  console.log("");
  console.log("Test it:");
  console.log(`  ${scriptPath} ${result.tools[0]?.name ?? "tool-name"} '{}'`);
}

main().catch((err) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
