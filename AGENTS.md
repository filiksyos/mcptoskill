# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

`mcptoskill` is a CLI tool + Vercel-hosted web app that converts remote MCP servers into OpenClaw skills. See `README.md` for usage details.

### Services

| Service | Purpose | How to run |
|---------|---------|------------|
| CLI tool | Core product — connects to MCP servers, generates skill files | `pnpm start <mcp-url> [flags]` (dev) or `node dist/index.js <mcp-url>` (built) |
| Vercel API | OAuth flows + token exchange (serverless functions in `api/`) | Requires `vercel dev` with env vars (`KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc.) — not needed for CLI development |

### Development commands

- **Install deps:** `pnpm install`
- **Type-check / lint:** `npx tsc --noEmit` (no ESLint configured; TypeScript strict mode is the primary check)
- **Build:** `pnpm build` (compiles `src/` to `dist/`)
- **Run in dev:** `pnpm start <mcp-url>` (uses `tsx` for TypeScript execution)
- **Test CLI against a public server:** `pnpm start https://mcp.context7.com/mcp --out=./test-output`

### Gotchas

- **esbuild build scripts:** pnpm blocks esbuild's postinstall scripts by default (needed by `tsx`). The update script handles this automatically by running esbuild's `install.js` after `pnpm install`.
- **No automated test suite:** The project has no unit/integration tests. Validate changes via `npx tsc --noEmit` and manual CLI runs.
- **Vercel API functions** (`api/` directory) require external secrets (Redis, OAuth credentials) and are not testable locally without those. CLI development does not require them.
