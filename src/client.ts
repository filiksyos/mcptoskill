export interface ToolParam {
  name: string;
  type: string;
  description?: string;
  required: boolean;
}

export interface Tool {
  name: string;
  description: string;
  params: ToolParam[];
}

export interface McpServerInfo {
  name: string;
  version: string;
  instructions?: string;
}

export interface McpClientResult {
  serverInfo: McpServerInfo;
  tools: Tool[];
  sessionId: string | null;
  serverUrl: string;
}

function extractParams(inputSchema: Record<string, unknown>): ToolParam[] {
  const properties = inputSchema.properties as Record<string, { type?: string; description?: string }> | undefined;
  const required = (inputSchema.required as string[]) ?? [];

  if (!properties) return [];

  return Object.entries(properties).map(([name, schema]) => ({
    name,
    type: schema.type ?? "string",
    description: schema.description,
    required: required.includes(name),
  }));
}

export async function connectAndDiscover(serverUrl: string): Promise<McpClientResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
  };

  // Step 1: initialize
  const initRes = await fetch(serverUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "mcptoskill", version: "0.1.0" },
      },
    }),
  });

  if (!initRes.ok) {
    throw new Error(`initialize failed: ${initRes.status} ${initRes.statusText}`);
  }

  const sessionId = initRes.headers.get("mcp-session-id");

  const initData = await initRes.json() as {
    result: {
      serverInfo: McpServerInfo;
      instructions?: string;
    };
  };

  const serverInfo: McpServerInfo = {
    ...initData.result.serverInfo,
    instructions: initData.result.instructions,
  };

  // Step 2: tools/list
  const requestHeaders = sessionId
    ? { ...headers, "Mcp-Session-Id": sessionId }
    : headers;

  const toolsRes = await fetch(serverUrl, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    }),
  });

  if (!toolsRes.ok) {
    throw new Error(`tools/list failed: ${toolsRes.status} ${toolsRes.statusText}`);
  }

  const toolsData = await toolsRes.json() as {
    result: {
      tools: Array<{
        name: string;
        description: string;
        inputSchema: Record<string, unknown>;
      }>;
    };
  };

  const tools: Tool[] = toolsData.result.tools.map((t) => ({
    name: t.name,
    description: t.description,
    params: extractParams(t.inputSchema),
  }));

  return { serverInfo, tools, sessionId, serverUrl };
}
