import { createInterface } from "node:readline";

export type TargetChoice = "openclaw" | "hermes" | "both";

export type AuthChoice = "oauth" | "api_key" | "no_auth";

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function promptAuth(
  hasOAuthProvider: boolean,
  hasHeader: boolean
): Promise<AuthChoice> {
  if (hasHeader) return "api_key";

  if (!process.stdin.isTTY) {
    if (hasOAuthProvider) {
      throw new Error("Non-interactive mode: OAuth requires a TTY. Use --header for API key.");
    }
    return "no_auth";
  }

  const options = hasOAuthProvider
    ? "? Auth: (1) OAuth  (2) API key  (3) No auth\n> "
    : "? Auth: (2) API key  (3) No auth (OAuth only for Notion, PostHog, Supabase)\n> ";

  const answer = await question(options);
  const n = answer === "" ? "1" : answer;

  if (hasOAuthProvider && (n === "1" || n.toLowerCase() === "oauth")) return "oauth";
  if (n === "2" || n.toLowerCase() === "api" || n.toLowerCase() === "apikey") return "api_key";
  if (n === "3" || n.toLowerCase() === "no" || n.toLowerCase() === "none") return "no_auth";

  if (hasOAuthProvider) return "oauth";
  return "no_auth";
}

export async function promptTarget(): Promise<TargetChoice> {
  if (!process.stdin.isTTY) {
    return "openclaw";
  }

  const answer = await question("? Install to: (1) OpenClaw  (2) Hermes  (3) Both\n> ");
  const n = answer === "" ? "1" : answer;

  if (n === "1" || n.toLowerCase() === "openclaw") return "openclaw";
  if (n === "2" || n.toLowerCase() === "hermes") return "hermes";
  if (n === "3" || n.toLowerCase() === "both") return "both";

  return "openclaw";
}

export async function promptApiKey(): Promise<string> {
  const token = await question("? Paste your Bearer token:\n> ");
  if (!token) {
    throw new Error("No token provided.");
  }
  return token;
}
