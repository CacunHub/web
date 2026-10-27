// Website -> queue a toggle command for one of the key's accounts.
"use strict";
const { pipeline, lookupKey, body, reply } = require("../lib/store");

module.exports = async (req, res) => {
  if (req.method !== "POST") return reply(res, 405, { ok: false });
  try {
    const m = body(req);
    const found = await lookupKey(m.key);
    if (!found) return reply(res, 200, { ok: false, error: "key must be at least 10 characters, no spaces" });
    const userId = Number(m.userId);
    const v = m.value;
    const validValue = typeof v === "boolean" || (typeof v === "number" && isFinite(v)) || (typeof v === "string" && v.length <= 120) ||
      (Array.isArray(v) && v.length <= 300 && v.every((x) => typeof x === "string" && x.length <= 120));
    if (!Number.isSafeInteger(userId) || typeof m.id !== "string" || m.id.length > 80 || !validValue)
      return reply(res, 400, { ok: false, error: "bad request" });
    const k = `cmd:${found.hash}:${userId}`;
    await pipeline([["RPUSH", k, JSON.stringify({ id: m.id, value: v })], ["LTRIM", k, -50, -1], ["EXPIRE", k, 120]]);
    return reply(res, 200, { ok: true });
  } catch (e) {
    return reply(res, 500, { ok: false, error: String((e && e.message) || "server error").slice(0, 200) });
  }
};
