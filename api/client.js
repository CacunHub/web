// Called by the hub (Roblox) every few seconds. Authenticates the key, stores this account's state,
// enforces "key already in use", and hands back any toggle commands queued from the website.
"use strict";
const { pipeline, cmd, jparse, lookupKey, cleanState, body, reply } = require("../lib/store");

const ACCOUNT_TTL = 45;   // seconds an account counts as "connected" after its last sync
const FAST = 3, SLOW = 15; // poll interval hint (fast while a dashboard is open)

module.exports = async (req, res) => {
  if (req.method !== "POST") return reply(res, 405, { ok: false, error: "POST only" });
  try {
    const m = body(req);
    const found = await lookupKey(m.key);
    if (!found) return reply(res, 200, { ok: false, error: "key must be at least 10 characters, no spaces" });
    const userId = Number(m.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0 || typeof m.name !== "string" || m.name.length > 50)
      return reply(res, 200, { ok: false, error: "bad identity" });

    const h = found.hash, idsKey = `ids:${h}`;
    // who is currently connected on this key?
    const ids = (await cmd("SMEMBERS", idsKey)) || [];
    const live = ids.length ? await cmd("MGET", ...ids.map((i) => `acct:${h}:${i}`)) : [];
    const liveIds = ids.filter((_, i) => live[i] !== null);
    if (!liveIds.includes(String(userId)) && liveIds.length >= found.rec.maxAccounts) {
      return reply(res, 200, { ok: false, error: `this key already has ${found.rec.maxAccounts} accounts connected (the maximum)` });
    }

    const acct = { name: m.name, seen: Date.now(), state: cleanState(m.state) };
    const cmdKey = `cmd:${h}:${userId}`;
    const results = await pipeline([
      ["SET", `acct:${h}:${userId}`, JSON.stringify(acct), "EX", ACCOUNT_TTL],
      ["SADD", idsKey, String(userId)],
      ["EXPIRE", idsKey, 86400],
      ["LPOP", cmdKey, 50],
      ["GET", `view:${h}`],
    ]);
    const commands = (results[3] || []).map(jparse).filter((c) => c && typeof c.id === "string" && typeof c.value === "boolean");
    // drop ids that expired
    const dead = ids.filter((_, i) => live[i] === null);
    if (dead.length) await cmd("SREM", idsKey, ...dead);
    return reply(res, 200, { ok: true, commands, next: results[4] ? FAST : SLOW });
  } catch (e) {
    return reply(res, 500, { ok: false, error: String((e && e.message) || "server error").slice(0, 200) });
  }
};
