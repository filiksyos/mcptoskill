# mcptoskill

`mcptoskill` connects to any remote MCP server, discovers its tools, and generates an OpenClaw or Hermes skill — letting you wire any MCP-compatible service into your AI agent environment with a single command.

---

## CLI Tool

**Install** — two variants:

- Global install via `npm install -g @filiksyos/mcptoskill`
- No-install via `npx @filiksyos/mcptoskill <url>`

**Usage** — full command signature:

```
npx @filiksyos/mcptoskill <mcp-server-url> [--target=openclaw|hermes] [--header "Key: Value"] [--name=<skill-name>] [--out=<output-dir>] [--skill-key=<key>]
```

**Flags**

| Flag | Description |
|---|---|
| `<url>` | MCP server endpoint URL (required) |
| `--target` | Output target: `openclaw` (default) or `hermes` |
| `--header "Key: Value"` | Add an HTTP header (repeatable for multiple headers) |
| `--skill-key=<key>` | *(Deprecated)* Legacy skill key from mcptoskill.com. Use local OAuth instead. |
| `--name=<name>` | Override the auto-generated skill name |
| `--out=<dir>` | Output directory (default: `~/.openclaw/skills/` for OpenClaw, `~/.hermes/skills/mcptoskill/` for Hermes) |

**Examples**

1. Context7 (no auth):

```
npx @filiksyos/mcptoskill https://mcp.context7.com/mcp
```

2. Hermes Agent — generate a skill for Hermes (auto-discovers from `~/.hermes/skills/`):

```
npx @filiksyos/mcptoskill https://mcp.context7.com/mcp --target=hermes
```

3. Local OAuth (Notion, PostHog) — run the command, follow prompts:

```
npx @filiksyos/mcptoskill https://mcp.notion.com/mcp
```

The CLI prints an auth URL. Open it in your browser, complete OAuth, then copy the redirect URL from the address bar (it will fail to load — that's fine) and paste it into the terminal. Tokens are saved locally to `~/.openclaw/mcptoskill/tokens/`.

4. Supabase (local OAuth) — same flow as Notion, no env vars needed:

```
npx @filiksyos/mcptoskill https://mcp.supabase.com/mcp
```

5. Supabase (manual Bearer token):

```
npx @filiksyos/mcptoskill "https://mcp.supabase.com/mcp?project_ref=YOUR_REF" --header "Authorization: Bearer YOUR_TOKEN"
```

6. Exa MCP (key in URL):

```
npx @filiksyos/mcptoskill "https://mcp.exa.ai/mcp?exaApiKey=YOUR_KEY"
```

7. Render MCP (API key auth) — create an API key from [Render Dashboard → Account Settings → API Keys](https://dashboard.render.com/settings#api-keys):

```
npx @filiksyos/mcptoskill https://mcp.render.com/mcp --header "Authorization: Bearer YOUR_RENDER_API_KEY"
```

**VPS / headless** — Run the CLI on a remote machine. When prompted, open the auth URL on your laptop, complete OAuth, then copy the redirect URL from the address bar and paste it into the SSH terminal. No server needs to listen on localhost.

**What gets generated** — two files are created:

- `SKILL.md` — the skill definition with tool documentation
- `scripts/<skill-name>.sh` — a shell script that calls the MCP server via curl

Output location depends on `--target` and `--out`:

- **OpenClaw** (default): `~/.openclaw/skills/<skill-name>/`
- **Hermes** (`--target=hermes`): `~/.hermes/skills/mcptoskill/<skill-name>/`

Hermes auto-discovers skills from `~/.hermes/skills/`; no config file needed. The agent runs the script via terminal when it needs to call tools. No `pip install hermes-agent[mcp]` needed for mcptoskill skills.

**Skill visibility** — Generated skills no longer declare `requires.bins: ["curl"]` because OpenClaw checks bins against the gateway process PATH at load time; in systemd/Docker/minimal environments, curl is often not found there, causing skills to be filtered out. The script runs in the agent's execution context where curl is typically available.

---

## Web Page

[https://mcptoskill.com](https://mcptoskill.com)

Generate the correct CLI command for any MCP server without leaving your browser.

**Contributing** — Fork the repo → edit → open a pull request.
