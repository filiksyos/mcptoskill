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
}

export const PROVIDERS: Provider[] = [
  {
    id: "notion",
    name: "Notion",
    authUrl: "https://api.notion.com/v1/oauth/authorize",
    tokenUrl: "https://api.notion.com/v1/oauth/token",
    scopes: [],
    mcpUrl: "https://mcp.notion.com/mcp",
    clientIdEnv: "NOTION_CLIENT_ID",
    clientSecretEnv: "NOTION_CLIENT_SECRET",
    tokenField: "access_token",
    workspaceNameField: "workspace_name",
    tokenEncoding: "basic",
  },
  {
    id: "linear",
    name: "Linear",
    authUrl: "https://linear.app/oauth/authorize",
    tokenUrl: "https://api.linear.app/oauth/token",
    scopes: ["read", "write"],
    mcpUrl: "https://mcp.linear.app/mcp",
    clientIdEnv: "LINEAR_CLIENT_ID",
    clientSecretEnv: "LINEAR_CLIENT_SECRET",
    tokenField: "access_token",
    workspaceNameField: "organization.name",
    tokenEncoding: "none",
  },
  {
    id: "slack",
    name: "Slack",
    authUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    scopes: ["channels:read", "chat:write", "users:read"],
    mcpUrl: "https://mcp.slack.com/mcp",
    clientIdEnv: "SLACK_CLIENT_ID",
    clientSecretEnv: "SLACK_CLIENT_SECRET",
    tokenField: "access_token",
    workspaceNameField: "team.name",
    tokenEncoding: "none",
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
  },
];

export function getProvider(id: string): Provider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
