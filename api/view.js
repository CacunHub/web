// Called by the website every ~3s: returns the accounts connected on this key.
"use strict";
const { cmd, jparse, lookupKey, body, reply } = require("../lib/store");

module.exports = async (req, res) => {
  if (req.method !== "POST") return reply(res, 405, { ok: false });
  try {
    const found = await lookupKey(body(req).key);
    if (!found) return reply(res, 200, { ok: false, error: "key must be at least 10 characters, no spaces" });
    const h = found.hash;
    await cmd("SET", `view:${h}`, "1", "EX", 30); // tells the hubs to poll fast
    const ids = (await cmd("SMEMBERS", `ids:${h}`)) || [];
    const vals = ids.length ? await cmd("MGET", ...ids.map((i) => `acct:${h}:${i}`)) : [];
    const accounts = [];
    ids.forEach((id, i) => {
      const a = jparse(vals[i]);
      if (a) accounts.push({ userId: Number(id), name: a.name, online: true, seen: a.seen, state: a.state });
    });
    accounts.sort((x, y) => x.name.localeCompare(y.name));
    return reply(res, 200, { ok: true, label: found.rec.label, accounts });
  } catch (e) {
    return reply(res, 500, { ok: false, error: "server error" });
  }
};
