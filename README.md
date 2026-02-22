# mcptoskill

`mcptoskill` connects to any remote MCP server, discovers its tools, and generates an OpenClaw skill — letting you wire any MCP-compatible service into your AI agent environment with a single command.

---

## CLI Tool

**Install** — two variants:

- Global install via `npm install -g @filiksyos/mcptoskill`
- No-install via `npx @filiksyos/mcptoskill <url>`

**Usage** — full command signature:

```
npx @filiksyos/mcptoskill <mcp-server-url> [--header "Key: Value"] [--name=<skill-name>] [--out=<output-dir>]
```

**Flags**

| Flag | Description |
|---|---|
| `<url>` | MCP server endpoint URL (required) |
| `--header "Key: Value"` | Add an HTTP header (repeatable for multiple headers) |
| `--name=<name>` | Override the generated skill name |
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

**What gets generated** — two files are created inside `~/.openclaw/skills/<skill-name>/`:

- `SKILL.md` — the OpenClaw skill definition with tool documentation
- `scripts/<skill-name>.sh` — a shell script that calls the MCP server via curl

---

## Web Page

[https://mcptoskill.com](https://mcptoskill.com)

Generate the correct CLI command for any MCP server without leaving your browser.

**Contributing** — Fork the repo → edit → open a pull request.
