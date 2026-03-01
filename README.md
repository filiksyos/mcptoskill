# mcptoskill

`mcptoskill` connects to any remote MCP server, discovers its tools, and generates an OpenClaw skill — letting you wire any MCP-compatible service into your AI agent environment with a single command.

---

## CLI Tool

**Install** — two variants:

- Global install via `npm install -g @filiksyos/mcptoskill`
- No-install via `npx @filiksyos/mcptoskill <url>`

**Usage** — full command signature:

```
npx @filiksyos/mcptoskill <mcp-server-url> [--header "Key: Value"] [--name=<skill-name>] [--out=<output-dir>] [--skill-key=<key>]
```

**Flags**

| Flag | Description |
|---|---|
| `<url>` | MCP server endpoint URL (required) |
| `--header "Key: Value"` | Add an HTTP header (repeatable for multiple headers) |
| `--skill-key=<key>` | Skill key from [mcptoskill.com](https://mcptoskill.com) OAuth flow (e.g. Notion). One-time use. |
| `--name=<name>` | Override the auto-generated skill name |
| `--out=<dir>` | Output directory (default: `~/.openclaw/skills/`) |

**Examples**

1. Context7 (no auth):

```
npx @filiksyos/mcptoskill https://mcp.context7.com/mcp
```

2. Supabase (Bearer token):

```
npx @filiksyos/mcptoskill "https://mcp.supabase.com/mcp?project_ref=YOUR_REF" --header "Authorization: Bearer YOUR_TOKEN"
```

3. Exa MCP (key in URL):

```
npx @filiksyos/mcptoskill "https://mcp.exa.ai/mcp?exaApiKey=YOUR_KEY"
```

4. Notion (OAuth via [mcptoskill.com](https://mcptoskill.com) — connect, then run the generated command):

```
npx @filiksyos/mcptoskill https://mcp.notion.com/mcp --skill-key sk_live_xxx
```

**Skill keys (OAuth)** — Keys from mcptoskill.com are one-time use. The first install consumes the key; it cannot be used again. Re-installing on another machine requires re-authenticating at mcptoskill.com. No tokens are stored long-term on mcptoskill.com.

**What gets generated** — two files are created inside `~/.openclaw/skills/<skill-name>/`:

- `SKILL.md` — the OpenClaw skill definition with tool documentation
- `scripts/<skill-name>.sh` — a shell script that calls the MCP server via curl

**Skill visibility** — Generated skills no longer declare `requires.bins: ["curl"]` because OpenClaw checks bins against the gateway process PATH at load time; in systemd/Docker/minimal environments, curl is often not found there, causing skills to be filtered out. The script runs in the agent's execution context where curl is typically available.

---

## Web Page

[https://mcptoskill.com](https://mcptoskill.com)

Generate the correct CLI command for any MCP server without leaving your browser.

**Contributing** — Fork the repo → edit → open a pull request.
