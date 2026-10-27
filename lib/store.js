// Tiny Upstash/Vercel-KV REST client + shared helpers. No dependencies.
"use strict";
const crypto = require("crypto");

// Vercel's Upstash integration may add a custom prefix to the variable names, so look for any matching pair.
function findEnv(suffixes) {
  for (const name of Object.keys(process.env)) {
    if (suffixes.some((x) => name.endsWith(x)) && process.env[name]) return process.env[name];
  }
  return undefined;
}
const URL_ = findEnv(["KV_REST_API_URL", "UPSTASH_REDIS_REST_URL"]);
const TOKEN = findEnv(["KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_TOKEN"]);

async function pipeline(cmds) {
  if (!URL_ || !TOKEN) throw new Error("database not connected: add Upstash Redis under Storage in Vercel, connect it to this project, then Redeploy");
  const r = await fetch(URL_ + "/pipeline", {
    method: "POST",
    headers: { Authorization: "Bearer " + TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error("database error " + r.status + " (check the Upstash connection)");
  const out = await r.json();
  return out.map((x) => { if (x.error) throw new Error(x.error); return x.result; });
}
const cmd = async (...c) => (await pipeline([c]))[0];

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");
const jparse = (s) => { try { return JSON.parse(s); } catch { return null; } };

// Keys are chosen by the users themselves: whoever types a key into the hub claims it, and the same key opens
// their dashboard. Nothing is registered ahead of time. Only a hash of the key is used as the database id.
// One account per key at a time (a key frees up ~45s after its hub stops syncing).
const MIN_KEY = 10;
async function lookupKey(key) {
  if (typeof key !== "string" || key.length < MIN_KEY || key.length > 128 || /\s/.test(key)) return null;
  return { hash: sha(key), rec: { label: "", maxAccounts: 1 } };
}

// ---- validation of what the hub sends
const isStr = (v, max) => typeof v === "string" && v.length <= max;
const num = (v) => (typeof v === "number" && isFinite(v) ? v : null);
function cleanState(m) {
  m = m && typeof m === "object" ? m : {};
  const st = m.stats || {}, s = m.status || {};
  const inventory = {};
  let n = 0;
  if (m.inventory && typeof m.inventory === "object") {
    for (const [k, v] of Object.entries(m.inventory)) {
      if (++n > 2000) break;
      if (isStr(k, 80) && num(v) !== null) inventory[k] = Math.floor(v);
    }
  }
  const toggles = [];
  if (Array.isArray(m.toggles)) {
    for (const t of m.toggles.slice(0, 600)) {
      if (t && isStr(t.id, 80) && isStr(t.title, 120) && typeof t.value === "boolean") toggles.push({ id: t.id, title: t.title, value: t.value });
    }
  }
  return {
    stats: { level: num(st.level), peli: num(st.peli), bounty: num(st.bounty), fruit: isStr(st.fruit, 80) ? st.fruit : null, race: isStr(st.race, 40) ? st.race : null },
    inventory,
    status: {
      text: isStr(s.text, 200) ? s.text : "",
      active: Array.isArray(s.active) ? s.active.filter((x) => isStr(x, 120)).slice(0, 600) : [],
      placeId: num(s.placeId), jobId: isStr(s.jobId, 80) ? s.jobId : "",
      health: num(s.health), alive: s.alive === true,
    },
    toggles,
  };
}

function body(req) {
  let b = req.body;
  if (typeof b === "string") b = jparse(b);
  return b && typeof b === "object" ? b : {};
}
function reply(res, code, obj) { res.status(code).setHeader("Cache-Control", "no-store"); res.json(obj); }

module.exports = { pipeline, cmd, sha, jparse, lookupKey, cleanState, body, reply };
