import type { IncomingMessage, ServerResponse } from "node:http";

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(
    JSON.stringify({
      ok: true,
      server: "vercel-function",
      hasOpenAIKey: !!process.env.OPENAI_API_KEY,
      hasDbUrl: !!process.env.DATABASE_URL,
      ts: Date.now(),
    }),
  );
}
