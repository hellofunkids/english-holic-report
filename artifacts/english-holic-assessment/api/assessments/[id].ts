import type { IncomingMessage, ServerResponse } from "node:http";
import { withDb, sendJson } from "../_db";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  if (req.method !== "DELETE") { sendJson(res, 405, { error: "Method not allowed" }); return; }

  const parts = (req.url ?? "").split("?")[0].split("/").filter(Boolean);
  const idStr = parts[parts.length - 1];
  const id = Number(idStr);
  if (!Number.isFinite(id) || id <= 0) {
    sendJson(res, 400, { error: "잘못된 ID입니다." });
    return;
  }

  try {
    await withDb((client) =>
      client.query("DELETE FROM assessments WHERE id = $1", [id]),
    );
    sendJson(res, 200, { ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "DB 오류";
    sendJson(res, 500, { error: msg });
  }
}
