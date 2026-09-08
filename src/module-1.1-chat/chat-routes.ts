import type { Env } from '../../env';
import { errorJson, json } from '../../lib/http';
import { runGeminiConversation } from './providers/gemini';
import { runOpenAiCompatConversation } from './providers/openai-compat';
import type { ChatMessage, ChatProvider, ChatTurnResult, McpTool } from './types';

const validProviders: ChatProvider[] = ['gemini', 'openai', 'openai-compat'];
export function resolveProvider(value: unknown, env: Env): ChatProvider { return validProviders.includes(value as ChatProvider) ? value as ChatProvider : validProviders.includes(env.DEFAULT_CHAT_PROVIDER as ChatProvider) ? env.DEFAULT_CHAT_PROVIDER as ChatProvider : 'gemini'; }
export function defaultModelFor(provider: ChatProvider, env: Env): string { return provider === 'gemini' ? env.GEMINI_MODEL || 'gemini-flash-latest' : provider === 'openai' ? env.OPENAI_MODEL || 'gpt-4o-mini' : env.OPENAI_COMPAT_MODEL || 'gpt-4o-mini'; }
export function buildSystemPrompt(): string { return 'คุณคือผู้ช่วย AI ภาษาไทยที่สุภาพ กระชับ และช่วยผู้ใช้แก้ปัญหาอย่างเป็นประโยชน์ หากไม่แน่ใจให้บอกตามตรง'; }
function resolveApiKey(provider: ChatProvider, env: Env): string | undefined { return provider === 'gemini' ? env.GEMINI_API_KEY : provider === 'openai' ? env.OPENAI_API_KEY : env.OPENAI_COMPAT_API_KEY; }
function resolveBaseUrl(provider: ChatProvider, env: Env): string | undefined { return provider === 'openai' ? 'https://api.openai.com/v1' : provider === 'openai-compat' ? env.OPENAI_COMPAT_BASE_URL : undefined; }
function resolveTools(): McpTool[] { return []; }

export async function runChatTurn(params: { env: Env; provider: ChatProvider; model: string; messages: ChatMessage[] }): Promise<ChatTurnResult> {
  const common = { apiKey: resolveApiKey(params.provider, params.env), model: params.model, systemPrompt: buildSystemPrompt(), messages: params.messages, tools: resolveTools() };
  return params.provider === 'gemini' ? runGeminiConversation(common) : runOpenAiCompatConversation({ ...common, baseUrl: resolveBaseUrl(params.provider, params.env) });
}

export async function handleChatRoute(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return errorJson('ต้องใช้เมธอด POST', 405);
  try {
    const body = await request.json() as { message?: unknown; history?: unknown; provider?: unknown; model?: unknown };
    if (typeof body.message !== 'string' || !body.message.trim()) return errorJson('กรุณาระบุ message ที่ไม่ว่าง');
    const provider = resolveProvider(body.provider, env);
    const history = Array.isArray(body.history) ? body.history.filter((item): item is ChatMessage => !!item && typeof item === 'object' && ((item as ChatMessage).role === 'user' || (item as ChatMessage).role === 'assistant') && typeof (item as ChatMessage).content === 'string').slice(-40) : [];
    const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : defaultModelFor(provider, env);
    const result = await runChatTurn({ env, provider, model, messages: [...history, { role: 'user', content: body.message.trim() }] });
    return json({ reply: result.reply, provider, model, toolTrace: result.toolTrace });
  } catch (error) { return errorJson(error instanceof Error ? `เกิดข้อผิดพลาด: ${error.message}` : 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ', 502); }
}