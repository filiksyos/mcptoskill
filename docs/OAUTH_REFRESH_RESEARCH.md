# OAuth Token Refresh Research

## The Problem

OAuth tokens obtained via mcptoskill.com expire, causing OpenClaw skills to stop working. Users must re-authenticate at mcptoskill.com and re-run the CLI to generate a new skill — a terrible UX for Notion, Supabase, PostHog, and any future OAuth providers.

---

## Current Flow (Why Tokens Expire)

```
┌──────────────┐     ┌─────────────────┐     ┌───────────────┐     ┌──────────────┐
│ User clicks  │────▶│ mcptoskill.com  │────▶│ Provider OAuth│────▶│ Callback     │
│ "Connect X"  │     │ /api/auth/:id   │     │ (Notion, etc) │     │ /api/auth/cb │
└──────────────┘     └─────────────────┘     └───────────────┘     └──────┬───────┘
                                                                          │
                                        ┌─────────────────────────────────┘
                                        │ Stores ONLY access_token in Redis
                                        │ (refresh_token is DISCARDED)
                                        ▼
┌──────────────┐     ┌─────────────────┐     ┌───────────────┐
│ CLI fetches  │────▶│ Hardcodes token │────▶│ Token expires │
│ --skill-key  │     │ in shell script │     │ skill breaks  │
└──────────────┘     └─────────────────┘     └───────────────┘
```

### Root causes

1. **Refresh token is never saved.** The callback (`api/auth/callback/[provider].ts`) calls the token endpoint, which returns both `access_token` and `refresh_token`, but only `access_token` is extracted (line 99). The rest is thrown away.

2. **Token is hardcoded in the shell script.** The generator bakes `Authorization: Bearer <token>` as a literal `-H` curl header. Once the token expires, the script is dead — there's nothing that can refresh it.

3. **No refresh mechanism exists.** Neither the server, CLI, nor the generated skill has any concept of token expiry or renewal.

---

## Provider Token Characteristics

| Provider | OAuth Type | Token Endpoint | Auth Method for Refresh | Token Lifetime | Refresh Token Behavior |
|----------|-----------|---------------|------------------------|---------------|----------------------|
| **Notion** | MCP OAuth (PKCE + dynamic registration) | Discovered via `/.well-known/oauth-authorization-server` → `token_endpoint` | `client_id` in body, no secret (`token_endpoint_auth_method: "none"`) | ~1 hour (standard OAuth, not officially documented) | Issues new `refresh_token` with each refresh (rotation) |
| **Supabase** | Standard OAuth 2.1 + PKCE | `https://api.supabase.com/v1/oauth/token` | Basic auth (`client_id:client_secret` base64) | 5 min – 1 hour | Single-use, rotating. Refresh tokens don't expire but can only be used once |
| **PostHog** | MCP OAuth (PKCE + dynamic registration) | Discovered via `/.well-known/oauth-authorization-server` → `token_endpoint` | `client_id` in body, no secret | Standard OAuth lifetime | Uses RS256 JWT tokens |

### Key distinction: mcpOAuth vs Standard OAuth

- **Notion & PostHog** use **mcpOAuth** (dynamic client registration, PKCE, `token_endpoint_auth_method: "none"`). Refresh requires only `client_id` — **no secret needed**. This means refresh can happen **entirely on the user's local machine**.

- **Supabase** uses **standard OAuth** with `client_secret`. Refresh requires the server-side secret (`SUPABASE_CLIENT_SECRET`). This means either:
  - (a) A server-side refresh proxy, or
  - (b) Finding whether Supabase supports secret-less PKCE refresh (unlikely for confidential clients)

---

## How OpenClaw Manages Tokens

OpenClaw has a layered system for injecting credentials into skills:

1. **Per-skill `env`** — `skills.entries.<name>.env` in `~/.openclaw/openclaw.json` injects env vars at runtime (only if not already set)
2. **Per-skill `apiKey`** — Supports plaintext or `SecretRef` (`{ source: "env"|"file"|"exec", provider: "default", id: "..." }`)
3. **Global `.env`** — `~/.openclaw/.env` sets env vars for all skills
4. **Secrets `exec` source** — Can run an arbitrary command to resolve a secret at activation time

The `exec` secret source is especially interesting: OpenClaw can run a command (like a token-refresh script) to resolve a secret value. However, secrets are resolved eagerly at activation time, not per-request, so this wouldn't catch mid-session expirations.

The most practical integration: **the shell script itself handles refresh at invocation time**, reading/writing a local token file.

---

## Proposed Solution: Local Token Refresh

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ mcptoskill.com (server)                                     │
│                                                             │
│  callback now stores: access_token + refresh_token          │
│  + token_endpoint + client_id + expires_in                  │
│  in Redis skill key record                                  │
└─────────────────────────┬───────────────────────────────────┘
                          │ CLI fetches via --skill-key
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ CLI (local machine)                                         │
│                                                             │
│  Saves token data to:                                       │
│  ~/.openclaw/mcptoskill/tokens/<skill-name>.json            │
│                                                             │
│  Generates shell script that:                               │
│  1. Reads token from JSON file                              │
│  2. Checks expires_at                                       │
│  3. If expired → calls refresh_token endpoint               │
│  4. Saves new tokens back to JSON file                      │
│  5. Uses fresh access_token for MCP call                    │
└─────────────────────────────────────────────────────────────┘
```

### What changes where

#### 1. Backend: `api/auth/callback/[provider].ts`

**Current:** Extracts only `access_token` from token response.

**New:** Also extract and store in Redis:
- `refresh_token`
- `expires_in` (to calculate `expires_at`)
- `token_endpoint` (for mcpOAuth providers, from state; for standard, from provider config)
- `client_id` (for mcpOAuth, from state; for standard, from env)
- `token_encoding` (how to authenticate refresh requests)
- `client_secret_required` flag (true for Supabase, false for mcpOAuth)

```typescript
// In the callback, after the token exchange:
await redisSet("sk:" + skillKey, {
  access_token,
  refresh_token: tokenData.refresh_token ?? null,
  expires_in: tokenData.expires_in ?? null,
  token_endpoint: tokenUrl,
  client_id: clientId,
  provider: id,
  mcp_url: provider.mcpUrl,
  workspace_name,
  token_encoding: provider.tokenEncoding,
  mcp_oauth: !!provider.mcpOAuth,
  created_at: new Date().toISOString(),
});
```

#### 2. CLI: `src/index.ts`

**Current:** Fetches `access_token` from skill key, sets `Authorization` header, generates skill.

**New:**
- Receive full token payload including `refresh_token`, `expires_in`, `token_endpoint`, `client_id`
- Write token file to `~/.openclaw/mcptoskill/tokens/<skill-name>.json`
- Pass token file path to generator instead of baking in the bearer token

```typescript
// Token file structure
interface TokenFile {
  access_token: string;
  refresh_token: string | null;
  expires_at: number | null;       // Unix timestamp
  token_endpoint: string;
  client_id: string;
  mcp_oauth: boolean;              // true = no secret needed for refresh
  token_encoding: "basic" | "none";
  provider: string;
  mcp_url: string;
}
```

#### 3. Generator: `src/generator.ts`

**Current:** Generates shell script with hardcoded `-H "Authorization: Bearer <token>"`.

**New:** Generate a shell script that:

```bash
#!/bin/bash
# ...
TOKEN_FILE="$HOME/.openclaw/mcptoskill/tokens/notion.json"

# --- Token refresh logic ---
ensure_fresh_token() {
  if [ ! -f "$TOKEN_FILE" ]; then
    echo "Error: token file not found. Re-run: npx @filiksyos/mcptoskill ..." >&2
    exit 1
  fi

  ACCESS_TOKEN=$(jq -r '.access_token' "$TOKEN_FILE")
  EXPIRES_AT=$(jq -r '.expires_at // 0' "$TOKEN_FILE")
  NOW=$(date +%s)

  # Refresh if expired or within 60s of expiry
  if [ "$EXPIRES_AT" != "null" ] && [ "$EXPIRES_AT" -gt 0 ] && [ "$NOW" -ge "$((EXPIRES_AT - 60))" ]; then
    REFRESH_TOKEN=$(jq -r '.refresh_token' "$TOKEN_FILE")
    TOKEN_ENDPOINT=$(jq -r '.token_endpoint' "$TOKEN_FILE")
    CLIENT_ID=$(jq -r '.client_id' "$TOKEN_FILE")

    if [ -z "$REFRESH_TOKEN" ] || [ "$REFRESH_TOKEN" = "null" ]; then
      echo "Error: token expired and no refresh_token. Re-authenticate at mcptoskill.com" >&2
      exit 1
    fi

    # Refresh the token
    REFRESH_RESPONSE=$(curl -s -X POST "$TOKEN_ENDPOINT" \
      -H "Content-Type: application/x-www-form-urlencoded" \
      -d "grant_type=refresh_token&refresh_token=$REFRESH_TOKEN&client_id=$CLIENT_ID")

    NEW_ACCESS=$(echo "$REFRESH_RESPONSE" | jq -r '.access_token // empty')
    if [ -z "$NEW_ACCESS" ]; then
      echo "Error: token refresh failed. Re-authenticate at mcptoskill.com" >&2
      exit 1
    fi

    NEW_REFRESH=$(echo "$REFRESH_RESPONSE" | jq -r '.refresh_token // empty')
    NEW_EXPIRES_IN=$(echo "$REFRESH_RESPONSE" | jq -r '.expires_in // 3600')
    NEW_EXPIRES_AT=$((NOW + NEW_EXPIRES_IN))

    # Atomic update of token file
    jq --arg at "$NEW_ACCESS" \
       --arg rt "${NEW_REFRESH:-$REFRESH_TOKEN}" \
       --argjson ea "$NEW_EXPIRES_AT" \
       '.access_token=$at | .refresh_token=$rt | .expires_at=$ea' \
       "$TOKEN_FILE" > "${TOKEN_FILE}.tmp" && mv "${TOKEN_FILE}.tmp" "$TOKEN_FILE"

    ACCESS_TOKEN="$NEW_ACCESS"
  fi
}

ensure_fresh_token
# ... rest of the MCP call using $ACCESS_TOKEN ...
```

#### 4. Supabase special handling (server-side refresh proxy)

Since Supabase requires `client_secret` for token refresh, add a new API endpoint:

**`api/refresh/[provider].ts`** — Server-side refresh proxy

```
POST /api/refresh/supabase
Body: { "refresh_token": "...", "skill_name": "..." }
Response: { "access_token": "...", "refresh_token": "...", "expires_in": 3600 }
```

The server holds `SUPABASE_CLIENT_SECRET` and performs the refresh on behalf of the user. The shell script for Supabase would call this endpoint instead of the token endpoint directly.

For security: rate-limit this endpoint, require the refresh_token as proof of prior authorization, and return new tokens atomically.

---

## Alternative Approaches Considered

### Option A: Server-side token storage + refresh daemon
Store all tokens on mcptoskill.com permanently and have a cron job refresh them. Skills fetch fresh tokens from the server on each invocation.

- **Pro:** Centralized, simple shell scripts
- **Con:** Privacy violation (contradicts "no tokens stored long-term"), server becomes a single point of failure, requires persistent Redis, adds latency

**Verdict: Rejected** — breaks privacy promise

### Option B: OpenClaw `exec` secret source
Use OpenClaw's `{ source: "exec", id: "refresh-token.sh" }` mechanism to resolve tokens at skill activation time.

- **Pro:** Clean integration with OpenClaw's secret system
- **Con:** Secrets are resolved eagerly at activation, not per-invocation; wouldn't catch mid-session expirations. Also couples to OpenClaw internals.

**Verdict: Could be a complementary optimization**, but the shell script should still handle refresh as the primary mechanism.

### Option C: Background refresh daemon
Run a local daemon/cron that refreshes tokens proactively before they expire.

- **Pro:** Tokens always fresh, no latency on invocation
- **Con:** Requires installing a daemon, complexity, battery/resource impact

**Verdict: Future optimization**, not needed for v1.

---

## Implementation Plan (Ordered)

### Phase 1: Capture refresh tokens (backend)
1. Modify `api/auth/callback/[provider].ts` to store `refresh_token`, `expires_in`, `token_endpoint`, `client_id` in the Redis skill key record
2. Update `api/token/[skill_key].ts` to return the full token payload (not just `access_token`)

### Phase 2: Local token storage (CLI)
3. Modify `src/index.ts` to save token file to `~/.openclaw/mcptoskill/tokens/<skill-name>.json`
4. Create token file with all refresh data

### Phase 3: Self-refreshing shell scripts (generator)
5. Modify `src/generator.ts` to generate shell scripts that:
   - Read tokens from local JSON file (requires `jq`)
   - Check expiry and auto-refresh when needed
   - Write updated tokens back atomically
6. Add `jq` as a noted dependency in generated SKILL.md

### Phase 4: Supabase server-side refresh proxy
7. Add `api/refresh/[provider].ts` endpoint for providers that need `client_secret`
8. Shell scripts for Supabase call the proxy endpoint instead

### Phase 5: Backward compatibility
9. Support `--header` flag fallback (current behavior) for non-OAuth tokens
10. Detect existing skills without token files and provide migration guidance

---

## Token Refresh: Per-Provider Flow

### Notion (mcpOAuth — client-side refresh)

```
POST {token_endpoint from discovery}
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token={refresh_token}
&client_id={dynamic_client_id}
```

No `client_secret` needed. Returns new `access_token` + `refresh_token`.

### PostHog (mcpOAuth — client-side refresh)

```
POST {token_endpoint from discovery}
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token={refresh_token}
&client_id={dynamic_client_id}
&resource=https://mcp.posthog.com     (RFC 8707)
```

No `client_secret` needed. Returns new `access_token` + `refresh_token`.

### Supabase (standard OAuth — server-side refresh)

```
POST https://api.supabase.com/v1/oauth/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)

grant_type=refresh_token
&refresh_token={refresh_token}
```

Requires `client_secret`. Must go through server-side proxy.

---

## Security Considerations

1. **Token file permissions:** Write `~/.openclaw/mcptoskill/tokens/*.json` with `0600` permissions (owner read/write only)
2. **Refresh token rotation:** Always save the new refresh_token from each refresh response (providers rotate them)
3. **Atomic file writes:** Use write-to-temp + rename to prevent corruption during concurrent access
4. **Supabase proxy rate limiting:** Prevent abuse of the server-side refresh endpoint
5. **Graceful degradation:** If refresh fails, print clear error pointing user to re-authenticate
6. **`jq` dependency:** The generated scripts will need `jq` for JSON parsing. This is widely available but should be documented. Alternative: use a Node.js helper script instead of pure bash.

---

## Open Questions

1. **Exact token lifetimes** for Notion MCP and PostHog MCP (not publicly documented). Need to test empirically or check response `expires_in` field.
2. **Supabase PKCE refresh**: Does Supabase allow refresh without `client_secret` if the original flow used PKCE? If yes, server-side proxy isn't needed. (Unlikely for OAuth 2.1 confidential clients.)
3. **Dynamic client_id persistence**: For mcpOAuth providers, the `client_id` comes from dynamic registration. Will the authorization server remember it across refresh calls? Need to verify.
4. **Should the privacy note on mcptoskill.com be updated?** Currently says "tokens are not stored." With the Supabase proxy, refresh tokens pass through the server.
