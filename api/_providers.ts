export interface Provider {
  id: string;
  name: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  mcpUrl: string;
  clientIdEnv: string;
  clientSecretEnv: string;
  tokenField: string;
  workspaceNameField: string | null;
  tokenEncoding: "basic" | "none";
  /** Use MCP server's own OAuth (PKCE + dynamic registration) instead of provider API OAuth */
  mcpOAuth?: boolean;
  /** OIDC/OAuth discovery URL for mcpOAuth providers */
  discoveryUrl?: string;
  /** RFC 8707 resource URL for audience-bound tokens */
  resourceUrl?: string;
  /** Use PKCE for standard OAuth (required by api.supabase.com) */
  requiresPkce?: boolean;
}

export const PROVIDERS: Provider[] = [
  {
    id: "notion",
    name: "Notion",
    authUrl: "https://mcp.notion.com/authorize",
    tokenUrl: "https://mcp.notion.com/token",
    scopes: [],
    mcpUrl: "https://mcp.notion.com/mcp",
    clientIdEnv: "",
    clientSecretEnv: "",
    tokenField: "access_token",
    workspaceNameField: "workspace_name",
    tokenEncoding: "none",
    mcpOAuth: true,
    discoveryUrl: "https://mcp.notion.com/.well-known/oauth-authorization-server",
  },
  {
    id: "supabase",
    name: "Supabase",
    authUrl: "https://api.supabase.com/v1/oauth/authorize",
    tokenUrl: "https://api.supabase.com/v1/oauth/token",
    scopes: [],
    mcpUrl: "https://mcp.supabase.com/mcp",
    clientIdEnv: "SUPABASE_CLIENT_ID",
    clientSecretEnv: "SUPABASE_CLIENT_SECRET",
    tokenField: "access_token",
    workspaceNameField: null,
    tokenEncoding: "basic",
    requiresPkce: true,
  },
  {
    id: "posthog",
    name: "PostHog",
    authUrl: "https://us.posthog.com/oauth/authorize/",
    tokenUrl: "https://us.posthog.com/oauth/token/",
    scopes: [],
    mcpUrl: "https://mcp.posthog.com/mcp",
    clientIdEnv: "",
    clientSecretEnv: "",
    tokenField: "access_token",
    workspaceNameField: null,
    tokenEncoding: "none",
    mcpOAuth: true,
    discoveryUrl: "https://us.posthog.com/.well-known/oauth-authorization-server",
    resourceUrl: "https://mcp.posthog.com",
  },
  {
    id: "stripe",
    name: "Stripe",
    authUrl: "https://access.stripe.com/mcp/oauth2/authorize",
    tokenUrl: "https://access.stripe.com/mcp/oauth2/token",
    scopes: [],
    mcpUrl: "https://mcp.stripe.com",
    clientIdEnv: "",
    clientSecretEnv: "",
    tokenField: "access_token",
    workspaceNameField: null,
    tokenEncoding: "none",
    mcpOAuth: true,
    discoveryUrl: "https://mcp.stripe.com/.well-known/oauth-authorization-server",
  },
];

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
