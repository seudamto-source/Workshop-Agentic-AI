import type { ChatMessage, ChatTurnResult, McpTool, ToolCaller, ToolTraceEntry } from '../types';

export async function runOpenAiCompatConversation(params: {
  baseUrl?: string; apiKey?: string; model: string; systemPrompt: string; messages: ChatMessage[]; tools: McpTool[]; callTool?: ToolCaller;
}): Promise<ChatTurnResult> {
  if (!params.baseUrl?.trim()) return { reply: 'ยังไม่ได้ตั้งค่า base URL ของ AI gateway จึงยังใช้งาน provider นี้ไม่ได้', toolTrace: [] };
  if (!params.apiKey?.trim()) return { reply: 'ยังไม่ได้ตั้งค่า API key ของ provider นี้ จึงยังใช้งานไม่ได้ กรุณาตั้งค่า key ฝั่ง Worker ก่อน', toolTrace: [] };
  if (!/^https?:\/\//i.test(params.baseUrl)) return { reply: 'ค่า OPENAI_COMPAT_BASE_URL ไม่ถูกต้อง ต้องขึ้นต้นด้วย http:// หรือ https://', toolTrace: [] };
  const endpoint = `${params.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const messages: Array<Record<string, unknown>> = [{ role: 'system', content: params.systemPrompt }, ...params.messages.map((m) => ({ role: m.role, content: m.content }))];
  const toolTrace: ToolTraceEntry[] = [];
  for (let round = 0; round < 4; round += 1) {
    const body: Record<string, unknown> = { model: params.model, messages };
    if (params.tools.length) { body.tools = params.tools.map((tool) => ({ type: 'function', function: { name: `${tool.serverId}__${tool.name}`, description: tool.description, parameters: tool.inputSchema } })); body.tool_choice = 'auto'; }
    const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${params.apiKey}` }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(`AI gateway ตอบกลับ ${response.status}: ${await response.text()}`);
    const data = await response.json() as { choices?: Array<{ message?: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments?: string } }> } }> };
    const message = data.choices?.[0]?.message;
    if (!message) return { reply: 'โมเดลไม่ได้ส่งข้อความตอบกลับ', toolTrace };
    if (!message.tool_calls?.length) return { reply: message.content?.trim() || 'โมเดลไม่ได้ส่งข้อความตอบกลับ', toolTrace };
    messages.push({ role: 'assistant', content: message.content ?? '', tool_calls: message.tool_calls });
    for (const call of message.tool_calls) {
      let args: Record<string, unknown> = {}; try { args = JSON.parse(call.function.arguments ?? '{}') as Record<string, unknown>; } catch { /* keep empty args */ }
      const trace: ToolTraceEntry = { name: call.function.name, arguments: args };
      try { trace.result = params.callTool ? await params.callTool(call.function.name, args) : 'ยังไม่มี tool ให้เรียกใช้'; } catch (error) { trace.error = error instanceof Error ? error.message : String(error); }
      toolTrace.push(trace); messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(trace.error ?? trace.result) });
    }
  }
  return { reply: 'การเรียกใช้เครื่องมือเกินจำนวนรอบที่กำหนด', toolTrace };
}