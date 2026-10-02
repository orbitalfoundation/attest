// Admin: a short list of DIDs (ADMIN_DIDS, default the account with handle ADMIN_HANDLE or "anselm"). Every admin
// request is signed by the admin's delegated device key over {type:"admin", name, payload, at}; no password, no cookie.
// Actions are reversible and moderation is logged publicly at /moderation.
import * as store from "./store.mjs";
import * as handles from "./handles.mjs";
import * as records from "./records.mjs";
import * as pds from "./pds.mjs";
import * as atoauth from "./atoauth.mjs";
import { verifyObject } from "../packages/orbital-attest/verify.mjs";
import { statfsSync } from "node:fs";
export function admins() {
  const env = (process.env.ADMIN_DIDS || "").split(",").map((s) => s.trim()).filter(Boolean); if (env.length) return env;
  const a = store.getAccountByHandle(process.env.ADMIN_HANDLE || "anselm"); return a ? [a.did] : [];
}
export async function check(envelope, origin) {
  const dg = await records.checkSigned(envelope, origin, "admin");
  if (!admins().includes(dg.root)) throw new Error("not an admin");
  return dg.root;
}
const handlers = {
  async overview() {
    let pdsHealth = null; try { pdsHealth = (await pds.describe()).did; } catch (e) { pdsHealth = "unreachable: " + e.message; }
    let disk = null; try { const f = statfsSync("/"); disk = { freeGB: +(f.bavail * f.bsize / 1e9).toFixed(1), totalGB: +(f.blocks * f.bsize / 1e9).toFixed(1) }; } catch {}
    return { stats: store.stats(), log: store.logCount(), firehoseCursor: store.getMeta("firehose_cursor"), pds: pdsHealth, oauth: atoauth.enabled(), admins: admins(), disk, uptimeMin: Math.round(process.uptime() / 60), node: process.version, memoryMB: Math.round(process.memoryUsage().rss / 1e6) };
  },
  accounts: () => store.adminAccounts(),
  records: ({ limit } = {}) => store.recentRecords(Math.min(limit || 60, 300)),
  moderation: () => store.moderationLog(),
  reserved: () => ({ builtIn: [...handles.RESERVED].sort(), added: store.kvList("reserved") }),
  async hide({ kind, subject, reason }, by) { store.moderate({ kind, subject, action: "hide", reason, by }); return { ok: true }; },
  async unhide({ kind, subject, reason }, by) { store.moderate({ kind, subject, action: "unhide", reason, by }); return { ok: true }; },
  async reserve({ handle }, by) { const h = String(handle || "").trim().toLowerCase(); if (!/^[a-z][a-z0-9-]{3,19}$/.test(h)) throw new Error("not a handle shape"); if (store.getAccountByHandle(h)) throw new Error("already taken by an account"); store.kvSet("reserved", h, { by, at: new Date().toISOString() }); return { ok: true }; },
  async unreserve({ handle }) { store.kvDel("reserved", String(handle || "").toLowerCase()); return { ok: true }; },
  // Block or allow a word; only its hash is stored, so the word never lands in the database or a log.
  async blockword({ word }, by) { const h = handles.hashWord(word); if (!word || h === handles.hashWord("")) throw new Error("empty"); store.kvSet("blockhash", h, { by, at: new Date().toISOString() }); return { ok: true, hash: h.slice(0, 12) }; },
  async allowword({ word }, by) { const h = handles.hashWord(word); if (!word) throw new Error("empty"); store.kvSet("allowhash", h, { by, at: new Date().toISOString() }); return { ok: true, hash: h.slice(0, 12) }; },
  async unblockhash({ hash }) { store.kvDel("blockhash", hash); store.kvDel("allowhash", hash); return { ok: true }; },
  wordlists: () => { return { ...handles.guardCounts(), blocked: store.kvList("blockhash").map((r) => ({ hash: r.key, at: r.value.at })), allowed: store.kvList("allowhash").map((r) => ({ hash: r.key, at: r.value.at })) }; },
};
export async function handle(envelope, origin) {
  const by = await check(envelope, origin); const h = handlers[envelope.name]; if (!h) throw new Error("unknown admin request");
  return h(envelope.payload || {}, by);
}
