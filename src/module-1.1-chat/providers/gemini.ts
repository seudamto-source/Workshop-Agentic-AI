import type { ChatMessage, ChatTurnResult, McpTool, ToolCaller, ToolTraceEntry } from '../types';
import { toGeminiSchema } from '../tool-schema';

type GeminiPart = { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: unknown };

export async function runGeminiConversation(params: {
  apiKey?: string; model: string; systemPrompt: string; messages: ChatMessage[]; tools: McpTool[]; callTool?: ToolCaller;
}): Promise<ChatTurnResult> {
  if (!params.apiKey?.trim()) return { reply: 'ยังไม่ได้ตั้งค่า GEMINI_API_KEY จึงยังใช้งาน Gemini ไม่ได้ กรุณาตั้งค่า key ฝั่ง Worker ก่อน', toolTrace: [] };
  const contents: Array<{ role: string; parts: GeminiPart[] }> = params.messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }],
  }));
  const toolTrace: ToolTraceEntry[] = [];
  for (let round = 0; round < 4; round += 1) {
    const body: Record<string, unknown> = { contents, systemInstruction: { parts: [{ text: params.systemPrompt }] } };
    if (params.tools.length) body.tools = [{ functionDeclarations: params.tools.map((tool) => ({ name: `${tool.serverId}__${tool.name}`, description: tool.description, parameters: toGeminiSchema(tool.inputSchema) })) }];
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(`Gemini ตอบกลับ ${response.status}: ${await response.text()}`);
    const data = await response.json() as { candidates?: Array<{ content?: { role?: string; parts?: GeminiPart[] } }> };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((part) => part.functionCall?.name);
    if (!calls.length) return { reply: parts.map((part) => part.text ?? '').join('').trim() || 'โมเดลไม่ได้ส่งข้อความตอบกลับ', toolTrace };
    contents.push({ role: 'model', parts });
    for (const part of calls) {
      const call = part.functionCall!; const args = call.args ?? {}; const trace: ToolTraceEntry = { name: call.name, arguments: args };
      try { trace.result = params.callTool ? await params.callTool(call.name, args) : 'ยังไม่มี tool ให้เรียกใช้'; } catch (error) { trace.error = error instanceof Error ? error.message : String(error); }
      toolTrace.push(trace);
      contents.push({ role: 'user', parts: [{ functionResponse: { name: call.name, response: { name: call.name, content: trace.error ?? trace.result } } }] });
    }
  }
  return { reply: 'การเรียกใช้เครื่องมือเกินจำนวนรอบที่กำหนด', toolTrace };
}