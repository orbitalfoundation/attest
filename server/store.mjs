// The only module that touches the database. SQLite (node:sqlite), one file, an append-only log plus index tables.
// Callers see named functions; nothing else knows SQL.
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
let db;
export function open(path = process.env.ATTEST_DB || "data/attest.sqlite") {
  mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS accounts (did TEXT PRIMARY KEY, handle TEXT UNIQUE NOT NULL, created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS credentials (id TEXT PRIMARY KEY, did TEXT NOT NULL, public_key TEXT NOT NULL, jwk TEXT NOT NULL, counter INTEGER NOT NULL DEFAULT 0, transports TEXT NOT NULL DEFAULT '[]', created TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS credentials_did ON credentials(did);
    CREATE TABLE IF NOT EXISTS log (seq INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL, id TEXT NOT NULL UNIQUE, json TEXT NOT NULL, received TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS delegations (id TEXT PRIMARY KEY, root TEXT NOT NULL, device TEXT NOT NULL, origin TEXT NOT NULL, from_at TEXT NOT NULL, until_at TEXT NOT NULL, json TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS delegations_root ON delegations(root);
    CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, by_did TEXT NOT NULL, kind TEXT NOT NULL, target TEXT NOT NULL, at TEXT NOT NULL, ref TEXT, retracted INTEGER NOT NULL DEFAULT 0, json TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS records_target ON records(target, kind, retracted);
    CREATE INDEX IF NOT EXISTS records_by ON records(by_did, at);
    CREATE UNIQUE INDEX IF NOT EXISTS records_one_upvote ON records(by_did, target) WHERE kind = 'upvote' AND retracted = 0;
    CREATE TABLE IF NOT EXISTS revocations (del TEXT PRIMARY KEY, root TEXT NOT NULL, at TEXT NOT NULL, json TEXT NOT NULL);
    CREATE UNIQUE INDEX IF NOT EXISTS records_one_vouch ON records(by_did, target) WHERE kind = 'vouch' AND retracted = 0;
    CREATE UNIQUE INDEX IF NOT EXISTS records_one_claim ON records(by_did, target) WHERE kind = 'claim' AND retracted = 0;
    CREATE INDEX IF NOT EXISTS records_ref ON records(ref);
  `);
  for (const [table, col, type] of [["accounts", "key_did", "TEXT"], ["accounts", "pds_handle", "TEXT"], ["accounts", "pds_password", "TEXT"], ["records", "uri", "TEXT"], ["records", "cid", "TEXT"], ["records", "collection", "TEXT"], ["records", "rkey", "TEXT"]])
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  db.exec("CREATE INDEX IF NOT EXISTS records_uri ON records(uri); CREATE INDEX IF NOT EXISTS records_cid ON records(cid); CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT); CREATE TABLE IF NOT EXISTS moderation (seq INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, subject TEXT NOT NULL, action TEXT NOT NULL, reason TEXT, by_did TEXT NOT NULL, at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS kv (ns TEXT NOT NULL, k TEXT NOT NULL, v TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (ns, k)); CREATE TABLE IF NOT EXISTS released_handles (handle TEXT PRIMARY KEY, did TEXT, at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS record_tags (record_id TEXT NOT NULL, tag TEXT NOT NULL, PRIMARY KEY (record_id, tag)); CREATE INDEX IF NOT EXISTS record_tags_tag ON record_tags(tag); CREATE TABLE IF NOT EXISTS identity_links (attest_did TEXT NOT NULL, external_did TEXT NOT NULL, handle TEXT, via TEXT, at TEXT NOT NULL, PRIMARY KEY (attest_did, external_did)); CREATE TABLE IF NOT EXISTS edges (uri TEXT PRIMARY KEY, src TEXT NOT NULL, dst TEXT NOT NULL, kind TEXT NOT NULL, at TEXT, reason TEXT, imported TEXT NOT NULL); CREATE INDEX IF NOT EXISTS edges_src ON edges(src, kind); CREATE INDEX IF NOT EXISTS edges_dst ON edges(dst, kind);");
  for (const [table, col, type] of [["accounts", "status", "TEXT"], ["records", "about_did", "TEXT"], ["records", "about_via", "TEXT"]]) if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  return db;
}
const now = () => new Date().toISOString();
// accounts and credentials
export const getAccount = (did) => db.prepare("SELECT did, handle, created, key_did, pds_handle, status FROM accounts WHERE did = ?").get(did) || null;
export const getAccountByHandle = (handle) => db.prepare("SELECT did, handle, created, key_did, pds_handle FROM accounts WHERE handle = ?").get(handle) || null;
export function ensureServiceAccount(did, handle, { keyDid = null, pdsHandle = null, pdsPassword = null } = {}) {
  // A stale row with the same handle but another did (the standalone era) is replaced, so the repo credentials are never dropped.
  const stale = db.prepare("SELECT did FROM accounts WHERE handle = ? AND did != ?").get(handle, did); if (stale) { db.prepare("UPDATE records SET by_did = ? WHERE by_did = ?").run(did, stale.did); db.prepare("DELETE FROM accounts WHERE did = ?").run(stale.did); }
  db.prepare("INSERT INTO accounts (did, handle, created, key_did, pds_handle, pds_password) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(did) DO UPDATE SET pds_handle = COALESCE(excluded.pds_handle, accounts.pds_handle), pds_password = COALESCE(excluded.pds_password, accounts.pds_password), key_did = COALESCE(excluded.key_did, accounts.key_did)").run(did, handle, now(), keyDid, pdsHandle, pdsPassword);
}
export function createAccount({ did, handle, credential, keyDid = null, pdsHandle = null, pdsPassword = null }) {
  const tx = db.prepare("INSERT INTO accounts (did, handle, created, key_did, pds_handle, pds_password) VALUES (?, ?, ?, ?, ?, ?)"), c = db.prepare("INSERT INTO credentials (id, did, public_key, jwk, counter, transports, created) VALUES (?, ?, ?, ?, ?, ?, ?)");
  db.exec("BEGIN"); try { tx.run(did, handle, now(), keyDid, pdsHandle, pdsPassword); c.run(credential.id, did, credential.publicKey, JSON.stringify(credential.jwk), credential.counter, JSON.stringify(credential.transports), now()); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
}
export const pdsCredentials = (did) => db.prepare("SELECT pds_handle, pds_password FROM accounts WHERE did = ?").get(did) || null;
export function getCredential(id) { const r = db.prepare("SELECT * FROM credentials WHERE id = ?").get(id); return r ? { ...r, jwk: JSON.parse(r.jwk), transports: JSON.parse(r.transports) } : null; }
export const setCounter = (id, counter) => db.prepare("UPDATE credentials SET counter = ? WHERE id = ?").run(counter, id);
export const handleOf = (did) => getAccount(did)?.handle || null;
export const keysOf = (did) => db.prepare("SELECT id, jwk, created, transports FROM credentials WHERE did = ?").all(did).map((c) => ({ id: c.id, jwk: JSON.parse(c.jwk), created: c.created, transports: JSON.parse(c.transports) }));
export function addCredential(did, credential) { db.prepare("INSERT INTO credentials (id, did, public_key, jwk, counter, transports, created) VALUES (?, ?, ?, ?, ?, ?, ?)").run(credential.id, did, credential.publicKey, JSON.stringify(credential.jwk), credential.counter, JSON.stringify(credential.transports), now()); }
export const removeCredential = (did, id) => db.prepare("DELETE FROM credentials WHERE did = ? AND id = ?").run(did, id).changes;
export const delegationsOf = (root) => db.prepare("SELECT d.id, d.device, d.origin, d.from_at, d.until_at, r.at AS revoked FROM delegations d LEFT JOIN revocations r ON r.del = d.id WHERE d.root = ? ORDER BY d.from_at DESC").all(root).map((d) => ({ id: d.id, device: d.device, origin: d.origin, from: d.from_at, until: d.until_at, revoked: d.revoked || null }));
export const isRevoked = (del) => !!db.prepare("SELECT 1 FROM revocations WHERE del = ?").get(del);
export function putRevocation(id, envelope) {
  const a = envelope.action;
  db.exec("BEGIN"); try { appendLog("revoke", id, envelope); db.prepare("INSERT OR IGNORE INTO revocations (del, root, at, json) VALUES (?, ?, ?, ?)").run(a.del, a.root, a.at, JSON.stringify(envelope)); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
}
// log + delegations + records
function appendLog(type, id, obj) { db.prepare("INSERT INTO log (type, id, json, received) VALUES (?, ?, ?, ?)").run(type, id, JSON.stringify(obj), now()); }
export function putDelegation(id, envelope) {
  const d = envelope.delegation;
  db.exec("BEGIN"); try { appendLog("delegation", id, envelope); db.prepare("INSERT INTO delegations (id, root, device, origin, from_at, until_at, json) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, d.root, d.device, d.origin, d.from, d.until, JSON.stringify(envelope)); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
}
export function getDelegation(id) { const r = db.prepare("SELECT json FROM delegations WHERE id = ?").get(id); return r ? JSON.parse(r.json) : null; }
// A repo record, indexed. id = cid. `kind` is the collection's last segment; `target` the subject/target; `ref` a referenced record's cid.
export function putRecord(id, envelope) {
  const r = envelope.record;
  db.exec("BEGIN"); try {
    appendLog("record", id, envelope);
    db.prepare("INSERT INTO records (id, by_did, kind, target, at, ref, json, uri, cid, collection, rkey, about_did, about_via) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, r.by, r.kind, r.target, r.at, r.ref || null, JSON.stringify(envelope), envelope.uri || null, envelope.cid || null, envelope.collection || null, envelope.rkey || null, envelope.about?.did || null, envelope.about?.via || null);
    for (const t of envelope.tags || []) db.prepare("INSERT OR IGNORE INTO record_tags (record_id, tag) VALUES (?, ?)").run(id, t);
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
}
// Replace the index row for a uri (an updated record, such as an edited bookmark).
export function dropRecordRow(uri) { const r = db.prepare("SELECT id FROM records WHERE uri = ?").get(uri); if (!r) return; db.prepare("DELETE FROM record_tags WHERE record_id = ?").run(r.id); db.prepare("DELETE FROM records WHERE uri = ?").run(uri); }
const ACTIVE_B = "r.by_did NOT IN (SELECT did FROM accounts WHERE status IS NOT NULL AND status != 'active')";
const bookmarkRow = (r) => { const j = JSON.parse(r.json); return { uri: r.uri, by: r.by_did, handle: r.handle, subject: r.target, title: j.repoRecord?.title || null, tags: j.repoRecord?.tags || [], note: j.repoRecord?.note || null, at: r.at }; };
export const bookmarksBy = (did, tag = null, limit = 200) => (tag
  ? db.prepare(`SELECT r.*, a.handle FROM records r JOIN record_tags t ON t.record_id = r.id LEFT JOIN accounts a ON a.did = r.by_did WHERE r.by_did = ? AND r.kind = 'bookmark' AND r.retracted = 0 AND t.tag = ? ORDER BY r.at DESC LIMIT ?`).all(did, tag, limit)
  : db.prepare(`SELECT r.*, a.handle FROM records r LEFT JOIN accounts a ON a.did = r.by_did WHERE r.by_did = ? AND r.kind = 'bookmark' AND r.retracted = 0 ORDER BY r.at DESC LIMIT ?`).all(did, limit)).map(bookmarkRow);
export const bookmarkOf = (did, subject) => { const r = db.prepare(`SELECT r.*, a.handle FROM records r LEFT JOIN accounts a ON a.did = r.by_did WHERE r.by_did = ? AND r.kind = 'bookmark' AND r.target = ? AND r.retracted = 0`).get(did, subject); return r ? bookmarkRow(r) : null; };
export const tagsOf = (did) => db.prepare(`SELECT t.tag, COUNT(*) AS n FROM record_tags t JOIN records r ON r.id = t.record_id WHERE r.by_did = ? AND r.retracted = 0 GROUP BY t.tag ORDER BY n DESC, t.tag LIMIT 200`).all(did);
export const popularTags = (limit = 60) => db.prepare(`SELECT t.tag, COUNT(DISTINCT r.by_did) AS people, COUNT(*) AS n FROM record_tags t JOIN records r ON r.id = t.record_id WHERE r.retracted = 0 AND ${ACTIVE_B} GROUP BY t.tag ORDER BY people DESC, n DESC LIMIT ?`).all(limit);
// Everything filed under a tag, one row per subject, with who filed it.
export function tagged(tag, limit = 200) {
  return db.prepare(`SELECT r.target AS subject, COUNT(DISTINCT r.by_did) AS people, MAX(r.at) AS last, GROUP_CONCAT(DISTINCT a.handle) AS handles, MAX(json_extract(r.json, '$.repoRecord.title')) AS title FROM records r JOIN record_tags t ON t.record_id = r.id LEFT JOIN accounts a ON a.did = r.by_did WHERE t.tag = ? AND r.retracted = 0 AND ${ACTIVE_B} GROUP BY r.target ORDER BY people DESC, last DESC LIMIT ?`).all(tag, limit).map((x) => ({ ...x, handles: x.handles ? x.handles.split(",") : [] }));
}
export function retractRecord(uri, byDid) { const n = db.prepare("UPDATE records SET retracted = 1 WHERE uri = ? AND by_did = ? AND retracted = 0").run(uri, byDid).changes; db.prepare("DELETE FROM record_tags WHERE record_id IN (SELECT id FROM records WHERE uri = ?)").run(uri); if (n) appendLog("retract", uri + "@" + now(), { uri, by: byDid, at: now() }); return n; }
export const getRecordByUri = (uri) => { const r = db.prepare("SELECT json, id, retracted FROM records WHERE uri = ?").get(uri); return r ? { ...JSON.parse(r.json), id: r.id, retracted: !!r.retracted } : null; };
export const findLiveUri = (by, target, kind) => db.prepare("SELECT uri FROM records WHERE by_did = ? AND target = ? AND kind = ? AND retracted = 0").get(by, target, kind)?.uri || null;
export function getRecord(id) { const r = db.prepare("SELECT json, retracted FROM records WHERE id = ?").get(id); return r ? { ...JSON.parse(r.json), id, retracted: !!r.retracted } : null; }
export const findLive = (by, target, kind) => db.prepare("SELECT id FROM records WHERE by_did = ? AND target = ? AND kind = ? AND retracted = 0").get(by, target, kind)?.id || null;
export const findUpvote = (by, target) => db.prepare("SELECT id FROM records WHERE by_did = ? AND target = ? AND kind = 'upvote' AND retracted = 0").get(by, target)?.id || null;
export function countsFor(target) {
  const up = db.prepare("SELECT COUNT(*) AS n FROM records WHERE target = ? AND kind = 'upvote' AND retracted = 0 AND by_did NOT IN (SELECT did FROM accounts WHERE status IS NOT NULL AND status != 'active')").get(target).n;
  const comments = db.prepare("SELECT r.id, r.by_did, r.at, r.json, a.handle FROM records r LEFT JOIN accounts a ON a.did = r.by_did WHERE r.target = ? AND r.kind = 'comment' AND r.retracted = 0 AND r.by_did NOT IN (SELECT did FROM accounts WHERE status IS NOT NULL AND status != 'active') ORDER BY r.at DESC LIMIT 50").all(target)
    .map((c) => ({ id: c.id, by: c.by_did, handle: c.handle, at: c.at, body: JSON.parse(c.json).record.body }));
  const vouches = db.prepare("SELECT COUNT(*) AS n FROM records WHERE target = ? AND kind = 'vouch' AND retracted = 0 AND by_did NOT IN (SELECT did FROM accounts WHERE status IS NOT NULL AND status != 'active')").get(target).n;
  return { upvotes: up, vouches, comments };
}
export const vouchesFor = (did) => db.prepare("SELECT r.id, r.by_did, r.at, a.handle FROM records r LEFT JOIN accounts a ON a.did = r.by_did WHERE r.target = ? AND r.kind = 'vouch' AND r.retracted = 0 AND r.by_did NOT IN (SELECT did FROM accounts WHERE status IS NOT NULL AND status != 'active') ORDER BY r.at DESC").all(did).map((r) => ({ id: r.id, by: r.by_did, handle: r.handle, at: r.at }));
export const vouchesBy = (did) => db.prepare("SELECT r.id, r.uri, r.target, r.at, a.handle FROM records r LEFT JOIN accounts a ON a.did = r.target WHERE r.by_did = ? AND r.kind = 'vouch' AND r.retracted = 0 ORDER BY r.at DESC").all(did).map((r) => ({ id: r.id, uri: r.uri, target: r.target, handle: r.handle, at: r.at }));
export function claimsOf(did) {
  return db.prepare("SELECT id, uri, cid, target, at FROM records WHERE by_did = ? AND kind = 'claim' AND retracted = 0 ORDER BY at DESC").all(did).map((c) => ({ ...c,
    verifications: db.prepare("SELECT r.id, r.by_did, r.at, r.json, a.handle FROM records r LEFT JOIN accounts a ON a.did = r.by_did WHERE r.kind = 'verify' AND r.ref = ? AND r.retracted = 0 ORDER BY r.at DESC").all(c.id).map((v) => ({ id: v.id, by: v.by_did, handle: v.handle, at: v.at, evidence: JSON.parse(v.json).record.body })) }));
}
export function siteSummary(host, limit = 50) {
  const h = String(host).toLowerCase(); const like = ["https://" + h + "/%", "http://" + h + "/%"];
  const rows = db.prepare(`SELECT target, SUM(kind = 'upvote') AS upvotes, SUM(kind = 'comment') AS comments, SUM(kind = 'vouch') AS vouches, SUM(kind = 'statement') AS statements, MAX(at) AS last, COUNT(DISTINCT by_did) AS keys FROM records WHERE retracted = 0 AND by_did NOT IN (SELECT did FROM accounts WHERE status IS NOT NULL AND status != 'active') AND (target LIKE ? OR target LIKE ?) GROUP BY target ORDER BY upvotes DESC, comments DESC, last DESC LIMIT ?`).all(like[0], like[1], limit);
  const totals = db.prepare(`SELECT COUNT(*) AS records, COUNT(DISTINCT by_did) AS keys, COUNT(DISTINCT target) AS targets FROM records WHERE retracted = 0 AND by_did NOT IN (SELECT did FROM accounts WHERE status IS NOT NULL AND status != 'active') AND (target LIKE ? OR target LIKE ?)`).get(like[0], like[1]);
  const recent = db.prepare(`SELECT r.id, r.by_did, r.at, r.target, r.json, a.handle FROM records r LEFT JOIN accounts a ON a.did = r.by_did WHERE r.retracted = 0 AND r.by_did NOT IN (SELECT did FROM accounts WHERE status IS NOT NULL AND status != 'active') AND r.kind = 'comment' AND (r.target LIKE ? OR r.target LIKE ?) ORDER BY r.at DESC LIMIT 20`).all(like[0], like[1]).map((c) => ({ id: c.id, by: c.by_did, handle: c.handle, at: c.at, target: c.target, body: JSON.parse(c.json).record.body }));
  const claims = db.prepare(`SELECT r.id, r.by_did, r.target, a.handle, (SELECT COUNT(*) FROM records v WHERE v.kind = 'verify' AND v.ref = r.id AND v.retracted = 0) AS verified FROM records r LEFT JOIN accounts a ON a.did = r.by_did WHERE r.kind = 'claim' AND r.retracted = 0 AND (r.target = ? OR r.target = ? OR r.target = ?)`).all("https://" + h + "/", "http://" + h + "/", "dns:" + h).map((c) => ({ id: c.id, by: c.by_did, handle: c.handle, target: c.target, verified: !!c.verified }));
  return { host: h, totals, targets: rows, recent, claims };
}
export const countsBy = (did) => db.prepare("SELECT kind, COUNT(*) AS n FROM records WHERE by_did = ? AND retracted = 0 GROUP BY kind").all(did).reduce((o, r) => (o[r.kind] = r.n, o), {});
export function recordsBy(did, limit = 200) {
  return db.prepare("SELECT id, kind, target, at, ref, retracted, json, uri FROM records WHERE by_did = ? ORDER BY at DESC LIMIT ?").all(did, limit)
    .map((r) => ({ id: r.id, uri: r.uri || undefined, kind: r.kind, target: r.target, at: r.at, ref: r.ref || undefined, retracted: !!r.retracted, body: JSON.parse(r.json).record.body }));
}
export const logSince = (seq, limit = 500) => db.prepare("SELECT seq, type, id, json, received FROM log WHERE seq > ? ORDER BY seq LIMIT ?").all(seq, Math.min(limit, 2000)).map((e) => ({ seq: e.seq, type: e.type, id: e.id, received: e.received, ...JSON.parse(e.json) }));
// ---- imported graph (Tangled vouches and follows, Bluesky follows) from linked atproto identities
export const linkIdentity = (attestDid, externalDid, handle, via) => db.prepare("INSERT INTO identity_links (attest_did, external_did, handle, via, at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(attest_did, external_did) DO UPDATE SET handle = excluded.handle, via = excluded.via").run(attestDid, externalDid, handle, via, now());
export const linksOf = (attestDid) => db.prepare("SELECT external_did AS did, handle, via, at FROM identity_links WHERE attest_did = ?").all(attestDid);
export const allLinks = () => db.prepare("SELECT attest_did, external_did, handle FROM identity_links").all();
export function replaceEdges(src, rows) {
  db.exec("BEGIN"); try { db.prepare("DELETE FROM edges WHERE src = ?").run(src); const ins = db.prepare("INSERT OR REPLACE INTO edges (uri, src, dst, kind, at, reason, imported) VALUES (?, ?, ?, ?, ?, ?, ?)"); for (const r of rows) ins.run(r.uri, src, r.dst, r.kind, r.at || null, r.reason || null, now()); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
}
export const edgeCountsFrom = (src) => db.prepare("SELECT kind, COUNT(*) AS n FROM edges WHERE src = ? GROUP BY kind").all(src).reduce((o, r) => (o[r.kind] = r.n, o), {});
// Edges between attest members, through linked identities (or a member's own repo did): who, of the people here, vouches for or follows whom elsewhere.
const memberOf = `SELECT attest_did AS m, external_did AS d FROM identity_links UNION SELECT did AS m, did AS d FROM accounts`;
export const memberEdgesTo = (attestDid) => db.prepare(`SELECT e.kind, e.at, e.reason, e.uri, s.m AS from_member, a.handle FROM edges e JOIN (${memberOf}) s ON s.d = e.src JOIN (${memberOf}) t ON t.d = e.dst JOIN accounts a ON a.did = s.m WHERE t.m = ? AND s.m != ? ORDER BY e.kind`).all(attestDid, attestDid);
export const memberEdgesFrom = (attestDid) => db.prepare(`SELECT e.kind, e.at, e.uri, t.m AS to_member, a.handle FROM edges e JOIN (${memberOf}) s ON s.d = e.src JOIN (${memberOf}) t ON t.d = e.dst JOIN accounts a ON a.did = t.m WHERE s.m = ? AND t.m != ? ORDER BY e.kind`).all(attestDid, attestDid);
export const linkByExternal = (did) => db.prepare("SELECT attest_did FROM identity_links WHERE external_did = ?").get(did) || null;
export const linkByHandle = (h) => db.prepare("SELECT attest_did FROM identity_links WHERE lower(handle) = ?").get(h) || null;
export const verifiedClaimFor = (target) => db.prepare("SELECT c.by_did FROM records c WHERE c.kind = 'claim' AND c.retracted = 0 AND c.target = ? AND EXISTS (SELECT 1 FROM records v WHERE v.kind = 'verify' AND v.retracted = 0 AND v.ref = c.cid) ORDER BY c.at LIMIT 1").get(target)?.by_did || null;
// Statements about a person (records whose subject resolved to them), excluding their own and inactive authors.
export function aboutSummary(did) {
  const ACTIVE = "r.by_did NOT IN (SELECT did FROM accounts WHERE status IS NOT NULL AND status != 'active')";
  const counts = db.prepare(`SELECT r.kind, COUNT(*) AS n, COUNT(DISTINCT r.by_did) AS people FROM records r WHERE r.about_did = ? AND r.by_did != ? AND r.retracted = 0 AND ${ACTIVE} GROUP BY r.kind`).all(did, did).reduce((o, x) => (o[x.kind] = { n: x.n, people: x.people }, o), {});
  const comments = db.prepare(`SELECT r.id, r.uri, r.by_did, r.at, r.target, r.about_via, r.json, a.handle FROM records r LEFT JOIN accounts a ON a.did = r.by_did WHERE r.about_did = ? AND r.by_did != ? AND r.retracted = 0 AND ${ACTIVE} AND r.kind IN ('comment','statement') ORDER BY r.at DESC LIMIT 50`).all(did, did).map((c) => ({ id: c.id, uri: c.uri, by: c.by_did, handle: c.handle, at: c.at, target: c.target, via: c.about_via, body: JSON.parse(c.json).record.body }));
  return { counts, comments };
}
export function backfillAbout(resolve) { let n = 0; for (const r of db.prepare("SELECT id, target FROM records WHERE about_did IS NULL AND target LIKE 'http%'").all()) { const a = resolve(r.target); if (a) { db.prepare("UPDATE records SET about_did = ?, about_via = ? WHERE id = ?").run(a.did, a.via, r.id); n++; } } return n; }
export const kvSet = (ns, k, v) => db.prepare("INSERT INTO kv (ns, k, v, at) VALUES (?, ?, ?, ?) ON CONFLICT(ns, k) DO UPDATE SET v = excluded.v, at = excluded.at").run(ns, k, JSON.stringify(v), now());
export const kvGet = (ns, k) => { const r = db.prepare("SELECT v FROM kv WHERE ns = ? AND k = ?").get(ns, k); return r ? JSON.parse(r.v) : null; };
export const kvList = (ns) => db.prepare("SELECT k, v, at FROM kv WHERE ns = ? ORDER BY k").all(ns).map((r) => ({ key: r.k, value: JSON.parse(r.v), at: r.at }));
export const kvDel = (ns, k) => db.prepare("DELETE FROM kv WHERE ns = ? AND k = ?").run(ns, k);
export const isExternal = (did) => { const a = db.prepare("SELECT pds_password FROM accounts WHERE did = ?").get(did); return !!a && !a.pds_password; };
// ---- moderation: reversible, logged publicly. A hidden record is marked retracted = 2 (every live query needs 0);
// a hidden account gets status 'hidden' (every count excludes non-active authors).
export function moderate({ kind, subject, action, reason, by }) {
  db.exec("BEGIN"); try {
    if (kind === "record") { const n = db.prepare("UPDATE records SET retracted = ? WHERE (uri = ? OR id = ?) AND retracted = ?").run(action === "hide" ? 2 : 0, subject, subject, action === "hide" ? 0 : 2).changes; if (!n) throw new Error("no such " + (action === "hide" ? "live" : "hidden") + " record"); }
    else if (kind === "account") { const n = db.prepare("UPDATE accounts SET status = ? WHERE did = ?").run(action === "hide" ? "hidden" : "active", subject).changes; if (!n) throw new Error("no such account"); }
    else throw new Error("unknown kind");
    db.prepare("INSERT INTO moderation (kind, subject, action, reason, by_did, at) VALUES (?, ?, ?, ?, ?, ?)").run(kind, subject, action, reason || null, by, now());
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
}
export const moderationLog = (limit = 200) => db.prepare("SELECT m.*, a.handle AS by_handle FROM moderation m LEFT JOIN accounts a ON a.did = m.by_did ORDER BY seq DESC LIMIT ?").all(limit);
export function adminAccounts() {
  return db.prepare(`SELECT a.did, a.handle, a.created, a.status, a.pds_password IS NOT NULL AS hosted, (SELECT COUNT(*) FROM records r WHERE r.by_did = a.did AND r.retracted = 0) AS records, (SELECT COUNT(*) FROM credentials c WHERE c.did = a.did) AS passkeys, (SELECT MAX(r.at) FROM records r WHERE r.by_did = a.did) AS last FROM accounts a WHERE a.handle NOT LIKE '~%' ORDER BY a.created DESC`).all().map((a) => ({ ...a, hosted: !!a.hosted }));
}
export const recentRecords = (limit = 60) => db.prepare("SELECT r.id, r.uri, r.kind, r.target, r.at, r.retracted, r.json, a.handle FROM records r LEFT JOIN accounts a ON a.did = r.by_did ORDER BY r.at DESC LIMIT ?").all(limit).map((r) => ({ id: r.id, uri: r.uri, kind: r.kind, target: r.target, at: r.at, state: ["live", "retracted", "hidden"][r.retracted] || "?", handle: r.handle, body: JSON.parse(r.json).record?.body || null }));
export const logCount = () => db.prepare("SELECT COALESCE(MAX(seq),0) AS n FROM log").get().n;
export const getMeta = (k) => { const r = db.prepare("SELECT value FROM meta WHERE key = ?").get(k); return r ? JSON.parse(r.value) : null; };
export const setMeta = (k, v) => db.prepare("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(k, JSON.stringify(v));
export function setAccountStatus(did, status) {
  // Record status even for accounts this index never registered (records that arrived through the firehose), so a
  // deleted or deactivated account's records stop counting either way.
  if (!db.prepare("UPDATE accounts SET status = ? WHERE did = ?").run(status, did).changes) db.prepare("INSERT OR IGNORE INTO accounts (did, handle, created, status) VALUES (?, ?, ?, ?)").run(did, "~" + did, now(), status);
  if (status === "deleted") { const a = db.prepare("SELECT handle FROM accounts WHERE did = ?").get(did); if (a) db.prepare("INSERT OR REPLACE INTO released_handles (handle, did, at) VALUES (?, ?, ?)").run(a.handle, did, now()); db.prepare("UPDATE accounts SET handle = handle || '~' || ? WHERE did = ?").run(did.slice(-8), did); }
}
export const releasedHandle = (h) => db.prepare("SELECT handle, did, at FROM released_handles WHERE handle = ?").get(h) || null;
export const setRepoHandle = (did, handle) => db.prepare("UPDATE accounts SET pds_handle = ? WHERE did = ? AND (pds_handle IS NULL OR pds_handle != ?)").run(handle, did, handle);
export const delegationForDevice = (root, device) => db.prepare("SELECT d.id FROM delegations d LEFT JOIN revocations r ON r.del = d.id WHERE d.root = ? AND d.device = ? AND r.del IS NULL ORDER BY d.from_at DESC LIMIT 1").get(root, device)?.id || null;
export const stats = () => ({ accounts: db.prepare("SELECT COUNT(*) AS n FROM accounts WHERE status IS NULL OR status = 'active'").get().n, records: db.prepare("SELECT COUNT(*) AS n FROM records WHERE retracted = 0 AND by_did NOT IN (SELECT did FROM accounts WHERE status IS NOT NULL AND status != 'active')").get().n, log: db.prepare("SELECT COALESCE(MAX(seq),0) AS n FROM log").get().n });
