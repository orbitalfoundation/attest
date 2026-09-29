// Admin: a short list of DIDs (ADMIN_DIDS, default the account with handle ADMIN_HANDLE or "anselm"). Every admin
// request is signed by the admin's delegated device key over {type:"admin", name, payload, at}; no password, no cookie.
// Actions are reversible and moderation is logged publicly at /moderation.
import * as store from "./store.mjs";
import * as handles from "./handles.mjs";
import * as pds from "./pds.mjs";
import * as atoauth from "./atoauth.mjs";
import { verifyObject } from "../packages/orbital-attest/verify.mjs";
import { statfsSync } from "node:fs";
export function admins() {
  const env = (process.env.ADMIN_DIDS || "").split(",").map((s) => s.trim()).filter(Boolean); if (env.length) return env;
  const a = store.getAccountByHandle(process.env.ADMIN_HANDLE || "anselm"); return a ? [a.did] : [];
}
export async function check({ name, payload, at, del, sig }, origin) {
  const d = store.getDelegation(del); if (!d) throw new Error("not signed in");
  if (store.isRevoked(del)) throw new Error("session revoked; sign in again");
  const dg = d.delegation; if (origin && dg.origin !== origin) throw new Error("wrong origin"); if (Date.now() > Date.parse(dg.until)) throw new Error("session expired");
  if (!admins().includes(dg.root)) throw new Error("not an admin");
  if (!(Math.abs(Date.parse(at) - Date.now()) < 5 * 60e3)) throw new Error("request time is not near now");
  if (!(await verifyObject(dg.devKey, { type: "admin", name, payload: payload ?? null, at }, sig))) throw new Error("admin signature does not verify");
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
};
export async function handle(envelope, origin) {
  const by = await check(envelope, origin); const h = handlers[envelope.name]; if (!h) throw new Error("unknown admin request");
  return h(envelope.payload || {}, by);
}
