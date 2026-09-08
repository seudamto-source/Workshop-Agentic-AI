import type { Env } from './env';
import { errorJson, json } from './lib/http';
import { handleChatRoute } from './module-1.1-chat/chat-routes';
export function route(request: Request, env: Env): Promise<Response> | Response {
  const { pathname } = new URL(request.url);
  if (pathname === '/api/chat') return handleChatRoute(request, env);
  if (pathname === '/healthz') return json({ ok: true });
  if (env.ASSETS) return env.ASSETS.fetch(request);
  return errorJson('ไม่พบเส้นทางนี้', 404);
}