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
  `);
  return db;
}
const now = () => new Date().toISOString();
// accounts and credentials
export const getAccount = (did) => db.prepare("SELECT did, handle, created FROM accounts WHERE did = ?").get(did) || null;
export const getAccountByHandle = (handle) => db.prepare("SELECT did, handle, created FROM accounts WHERE handle = ?").get(handle) || null;
export function createAccount({ did, handle, credential }) {
  const tx = db.prepare("INSERT INTO accounts (did, handle, created) VALUES (?, ?, ?)"), c = db.prepare("INSERT INTO credentials (id, did, public_key, jwk, counter, transports, created) VALUES (?, ?, ?, ?, ?, ?, ?)");
  db.exec("BEGIN"); try { tx.run(did, handle, now()); c.run(credential.id, did, credential.publicKey, JSON.stringify(credential.jwk), credential.counter, JSON.stringify(credential.transports), now()); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
}
export function getCredential(id) { const r = db.prepare("SELECT * FROM credentials WHERE id = ?").get(id); return r ? { ...r, jwk: JSON.parse(r.jwk), transports: JSON.parse(r.transports) } : null; }
export const setCounter = (id, counter) => db.prepare("UPDATE credentials SET counter = ? WHERE id = ?").run(counter, id);
export const handleOf = (did) => getAccount(did)?.handle || null;
export const keysOf = (did) => db.prepare("SELECT id, jwk FROM credentials WHERE did = ?").all(did).map((c) => ({ id: c.id, jwk: JSON.parse(c.jwk) }));
// log + delegations + records
function appendLog(type, id, obj) { db.prepare("INSERT INTO log (type, id, json, received) VALUES (?, ?, ?, ?)").run(type, id, JSON.stringify(obj), now()); }
export function putDelegation(id, envelope) {
  const d = envelope.delegation;
  db.exec("BEGIN"); try { appendLog("delegation", id, envelope); db.prepare("INSERT INTO delegations (id, root, device, origin, from_at, until_at, json) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, d.root, d.device, d.origin, d.from, d.until, JSON.stringify(envelope)); db.exec("COMMIT"); } catch (e) { db.exec("ROLLBACK"); throw e; }
}
export function getDelegation(id) { const r = db.prepare("SELECT json FROM delegations WHERE id = ?").get(id); return r ? JSON.parse(r.json) : null; }
export function putRecord(id, envelope) {
  const r = envelope.record;
  db.exec("BEGIN"); try {
    appendLog("record", id, envelope);
    db.prepare("INSERT INTO records (id, by_did, kind, target, at, ref, json) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, r.by, r.kind, r.target, r.at, r.ref || null, JSON.stringify(envelope));
    if (r.kind === "retract") db.prepare("UPDATE records SET retracted = 1 WHERE id = ? AND by_did = ?").run(r.ref, r.by);
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
}
export function getRecord(id) { const r = db.prepare("SELECT json, retracted FROM records WHERE id = ?").get(id); return r ? { ...JSON.parse(r.json), id, retracted: !!r.retracted } : null; }
export const findUpvote = (by, target) => db.prepare("SELECT id FROM records WHERE by_did = ? AND target = ? AND kind = 'upvote' AND retracted = 0").get(by, target)?.id || null;
export function countsFor(target) {
  const up = db.prepare("SELECT COUNT(*) AS n FROM records WHERE target = ? AND kind = 'upvote' AND retracted = 0").get(target).n;
  const comments = db.prepare("SELECT r.id, r.by_did, r.at, r.json, a.handle FROM records r LEFT JOIN accounts a ON a.did = r.by_did WHERE r.target = ? AND r.kind = 'comment' AND r.retracted = 0 ORDER BY r.at DESC LIMIT 50").all(target)
    .map((c) => ({ id: c.id, by: c.by_did, handle: c.handle, at: c.at, body: JSON.parse(c.json).record.body }));
  const vouches = db.prepare("SELECT COUNT(*) AS n FROM records WHERE target = ? AND kind = 'vouch' AND retracted = 0").get(target).n;
  return { upvotes: up, vouches, comments };
}
export function recordsBy(did, limit = 200) {
  return db.prepare("SELECT id, kind, target, at, ref, retracted, json FROM records WHERE by_did = ? ORDER BY at DESC LIMIT ?").all(did, limit)
    .map((r) => ({ id: r.id, kind: r.kind, target: r.target, at: r.at, ref: r.ref || undefined, retracted: !!r.retracted, body: JSON.parse(r.json).record.body }));
}
export const logSince = (seq, limit = 500) => db.prepare("SELECT seq, type, id, json, received FROM log WHERE seq > ? ORDER BY seq LIMIT ?").all(seq, Math.min(limit, 2000)).map((e) => ({ seq: e.seq, type: e.type, id: e.id, received: e.received, ...JSON.parse(e.json) }));
export const stats = () => ({ accounts: db.prepare("SELECT COUNT(*) AS n FROM accounts").get().n, records: db.prepare("SELECT COUNT(*) AS n FROM records WHERE retracted = 0").get().n, log: db.prepare("SELECT COALESCE(MAX(seq),0) AS n FROM log").get().n });
