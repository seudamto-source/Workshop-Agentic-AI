export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ChatProvider = 'gemini' | 'openai' | 'openai-compat';

export type McpTool = {
  serverId: string;
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

export type ToolTraceEntry = {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
  error?: string;
};

export type ChatTurnResult = {
  reply: string;
  toolTrace: ToolTraceEntry[];
};

export type ToolCaller = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export function toolFunctionName(tool: Pick<McpTool, 'serverId' | 'name'>): string {
  return `${tool.serverId}__${tool.name}`;
}