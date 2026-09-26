// Read-in of trust edges that already exist on AT Protocol, for attest members who have proven a Bluesky/atproto identity:
// Tangled vouches and denouncements (sh.tangled.graph.vouch, subject = record key), Tangled follows and Bluesky follows
// (subject field). Stored as edges between DIDs; kept as distinct kinds so a scorer can weigh them differently.
// Denouncements are recorded as evidence and, per attest's design, never propagate.
import * as store from "./store.mjs";
export const WEIGHTS = { "attest.vouch": 1.0, "tangled.vouch": 0.8, "tangled.follow": 0.25, "bsky.follow": 0.15, "tangled.denounce": 0 }; // for the scorer; provisional
const UA = { "user-agent": "attest-graph/0.1 (+https://attest.monster/roadmap)" };
const MAX = { "app.bsky.graph.follow": 5000, "sh.tangled.graph.follow": 2000, "sh.tangled.graph.vouch": 2000 };
async function json(url) { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15000) }); if (!r.ok) throw new Error(url.split("?")[0] + " → " + r.status); return r.json(); }
export async function resolveHandle(handle) { return (await json(`https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`)).did; }
export async function pdsOf(did) {
  const doc = did.startsWith("did:plc:") ? await json(`https://plc.directory/${did}`) : did.startsWith("did:web:") ? await json(`https://${did.slice(8)}/.well-known/did.json`) : null;
  const svc = doc?.service?.find((s) => s.id.endsWith("#atproto_pds")); if (!svc) throw new Error("no PDS for " + did); return svc.serviceEndpoint;
}
async function listAll(pds, did, collection) {
  const out = []; let cursor;
  do { const q = new URLSearchParams({ repo: did, collection, limit: "100", ...(cursor ? { cursor } : {}) }); const r = await json(`${pds}/xrpc/com.atproto.repo.listRecords?${q}`); out.push(...(r.records || [])); cursor = r.cursor; } while (cursor && out.length < MAX[collection]);
  return out;
}
const isDid = (s) => typeof s === "string" && /^did:(plc|web):/.test(s);
// Import every edge a DID has declared, replacing what we held for it. Returns counts by kind.
export async function importFor(did) {
  const pds = await pdsOf(did); const rows = [];
  for (const r of await listAll(pds, did, "sh.tangled.graph.vouch")) { const dst = r.uri.split("/").pop(); if (!isDid(dst)) continue; rows.push({ uri: r.uri, dst, kind: r.value.kind === "denounce" ? "tangled.denounce" : "tangled.vouch", at: r.value.createdAt, reason: r.value.reason }); }
  for (const r of await listAll(pds, did, "sh.tangled.graph.follow")) if (isDid(r.value.subject)) rows.push({ uri: r.uri, dst: r.value.subject, kind: "tangled.follow", at: r.value.createdAt });
  for (const r of await listAll(pds, did, "app.bsky.graph.follow")) if (isDid(r.value.subject)) rows.push({ uri: r.uri, dst: r.value.subject, kind: "bsky.follow", at: r.value.createdAt });
  store.replaceEdges(did, rows); return store.edgeCountsFrom(did);
}
// Link an attest member to an atproto identity they have proven (a verified bsky: claim), then import its edges.
export async function linkAndImport(attestDid, handle, via) {
  const did = await resolveHandle(handle); store.linkIdentity(attestDid, did, handle, via); const counts = await importFor(did); return { did, handle, counts };
}
// Refresh everyone linked, slowly, and the members' own repos (on our PDS; normally empty of these collections).
export async function refreshAll() {
  for (const l of store.allLinks()) { try { await importFor(l.external_did); } catch (e) { console.error("graph refresh", l.handle, e.message); } await new Promise((r) => setTimeout(r, 2000)); }
}
export function start(everyMs = 6 * 3600e3) { setTimeout(() => refreshAll().catch(() => {}), 60e3).unref(); setInterval(() => refreshAll().catch(() => {}), everyMs).unref(); }
