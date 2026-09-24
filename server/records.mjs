// Domain operations after the fold: accounts have a repo on the PDS; records are lexicon-shaped, carry the author's inline
// device-key signature, are written into the repo, and indexed here. Verification lives here; storage in store.mjs; XRPC in pds.mjs.
import * as store from "./store.mjs";
import * as pds from "./pds.mjs";
import * as dns from "./dns.mjs";
import { checkDelegation, checkAction } from "./identity.mjs";
import { normalizeTarget, isDid, isAccountDid, didFromJwk, inlineSign, inlineVerify, INLINE_TYPE, canonical, verifyObject, jwkFromDidKey } from "../packages/orbital-attest/verify.mjs";
import { cidString } from "../packages/orbital-attest/cid.mjs";
import { verifyAssertion } from "./passkeys.mjs";
import { Lexicons, jsonToLex } from "@atproto/lexicon";
import { EventEmitter } from "node:events";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, randomBytes } from "node:crypto";
export const events = new EventEmitter(); // "counts" {target, counts}
const NS = "monster.attest.";
const KIND_OF = { vote: "upvote", comment: "comment", statement: "statement", vouch: "vouch", claim: "claim", verification: "verify" };
const COLLECTIONS = Object.keys(KIND_OF).map((k) => NS + k);
// ---- lexicons
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const files = []; (function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith(".json") && files.push(p); } })(join(root, "lexicons"));
export const lexicons = new Lexicons(files.map((f) => JSON.parse(readFileSync(f, "utf8"))));
// ---- the service's own identity: a P-256 key (signs verifications inline) and, when a PDS is present, a repo account
let service = null;
export async function initServiceKey(path = (process.env.ATTEST_DB || "data/attest.sqlite").replace(/[^/]*$/, "service-key.json")) {
  mkdirSync(dirname(path), { recursive: true });
  let jwk; if (existsSync(path)) jwk = JSON.parse(readFileSync(path, "utf8"));
  else { const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]); jwk = await crypto.subtle.exportKey("jwk", pair.privateKey); writeFileSync(path, JSON.stringify(jwk), { mode: 0o600 }); }
  const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const pub = { x: jwk.x, y: jwk.y }; service = { privateKey, pub, keyDid: didFromJwk(pub), did: null, handle: process.env.SERVICE_HANDLE || "attest" };
  if (pds.enabled()) {
    const acct = store.getAccountByHandle(service.handle);
    if (acct?.pds_handle) service.did = acct.did;
    else try { const password = randomBytes(18).toString("base64url"); const a = await pds.createAccount(service.handle, password); store.ensureServiceAccount(a.did, service.handle, { keyDid: service.keyDid, pdsHandle: a.handle, pdsPassword: password }); service.did = a.did; if (dns.enabled()) dns.bindHandle(a.handle, a.did).catch((e) => console.error("handle dns", e.message)); }
    catch (e) { console.error("service repo account unavailable (" + e.message + "); verifications will be signed by the service key without a repo"); service.did = service.keyDid; store.ensureServiceAccount(service.did, service.handle, { keyDid: service.keyDid }); }
  } else service.did = service.keyDid, store.ensureServiceAccount(service.did, service.handle, { keyDid: service.keyDid });
  return service.did;
}
export const serviceDid = () => service?.did || null;
export const serviceInfo = () => ({ did: service?.did, keyDid: service?.keyDid, handle: "attest" });
// ---- helpers
const b32 = "abcdefghijklmnopqrstuvwxyz234567";
export function rkeyFor(subject) { const h = createHash("sha256").update(subject).digest(); let bits = 0, val = 0, out = ""; for (const b of h.subarray(0, 20)) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += b32[(val >>> (bits - 5)) & 31]; bits -= 5; } } return out; }
const hexToB64u = (h) => Buffer.from(h, "hex").toString("base64url");
async function repoToken(did) { const c = store.pdsCredentials(did); if (!c?.pds_handle) throw new Error("no repo for " + did); return pds.tokenFor(did, c.pds_handle, c.pds_password); }
// ---- delegations (unchanged in shape; the root is now the account's did:plc)
export async function acceptDelegation({ envelope, origin }) {
  const id = await checkDelegation(envelope.delegation);
  const credential = store.getCredential(envelope.credentialId); if (!credential) throw new Error("unknown passkey");
  const account = store.getAccount(credential.did); if (!account || account.did !== envelope.delegation.root) throw new Error("passkey does not belong to root " + envelope.delegation.root);
  const { counter } = await verifyAssertion({ origin, response: envelope.assertion, challenge: hexToB64u(id), credential });
  store.setCounter(credential.id, counter);
  if (!store.getDelegation(id)) store.putDelegation(id, envelope);
  return { id, root: account.did, handle: account.handle, until: envelope.delegation.until };
}
function liveDelegation(del, origin) {
  const d = store.getDelegation(del); if (!d) throw new Error("unknown delegation");
  if (store.isRevoked(del)) throw new Error("delegation revoked; sign in again");
  const dg = d.delegation; if (origin && dg.origin !== origin) throw new Error("delegation was issued for " + dg.origin + ", not " + origin);
  if (Date.now() > Date.parse(dg.until)) throw new Error("delegation expired; sign in again");
  return dg;
}
// ---- a record from a client: { collection, rkey?, record, del }
export function indexShape(collection, record, by) {
  const k = collection.slice(NS.length), kind = KIND_OF[k]; const at = record.createdAt;
  if (k === "vote") return { by, kind, target: record.subject, at };
  if (k === "comment") return { by, kind, target: record.subject, at, body: record.text };
  if (k === "statement") return { by, kind, target: record.subject || "did:self", at, body: record.text };
  if (k === "vouch") return { by, kind, target: record.subject, at, body: record.reason };
  if (k === "claim") return { by, kind, target: record.target, at };
  if (k === "verification") return { by, kind, target: record.target, at, ref: record.claim?.cid, body: record.evidence };
}
export async function acceptRecord({ envelope, origin }) {
  const { collection, record, del } = envelope || {}; let { rkey } = envelope || {};
  if (!COLLECTIONS.includes(collection)) throw new Error("unknown collection " + collection);
  if (collection === NS + "verification") throw new Error("verifications are issued by verifiers, not submitted");
  const dg = liveDelegation(del, origin); const repo = dg.root;
  if (!record || record.$type !== collection) throw new Error("record $type must be " + collection);
  const at = Date.parse(record.createdAt); if (!(at > 0) || Math.abs(at - Date.now()) > 10 * 60e3) throw new Error("createdAt is not near now");
  // subjects normalised, and kind rules
  const k = collection.slice(NS.length);
  if (["vote", "comment"].includes(k) || (k === "statement" && record.subject !== undefined)) { if (normalizeTarget(record.subject) !== record.subject || isDid(record.subject)) throw new Error("subject must be a normalised URL, doi: or sha256: URI"); }
  if (k === "vouch") { if (!isAccountDid(record.subject)) throw new Error("vouch subject must be an account did"); if (record.subject === repo) throw new Error("you cannot vouch for yourself"); }
  if (k === "claim") { if (normalizeTarget(record.target) !== record.target || isDid(record.target)) throw new Error("claim target must be a normalised URL or service:handle"); }
  // exactly one inline signature, by the delegated device key, verifying against this repo
  const inline = (record.signatures || []).filter((s) => s.$type === INLINE_TYPE); if (inline.length !== 1) throw new Error("record needs exactly one inline signature");
  if (String(inline[0].key).split("#")[0] !== dg.device) throw new Error("inline signature key is not the delegated device key");
  const [v] = await inlineVerify(record, repo, async (did) => (did === dg.device ? dg.devKey : jwkFromDidKey(did))); if (!v?.ok) throw new Error("inline signature does not verify for this repo");
  lexicons.assertValidRecord(collection, jsonToLex(record));
  // deterministic keys for one-per-subject kinds
  const subject = k === "claim" ? record.target : record.subject; const wantKey = ["vote", "vouch", "claim"].includes(k) ? rkeyFor(subject) : null;
  if (wantKey) { if (rkey && rkey !== wantKey) throw new Error("rkey must be " + wantKey); rkey = wantKey; const existing = store.findLiveUri(repo, subject, KIND_OF[k]); if (existing) return { uri: existing, id: store.getRecordByUri(existing).id, duplicate: true, counts: store.countsFor(subject) }; }
  // write to the repo, then index
  const token = await repoToken(repo);
  const w = wantKey ? await pds.putRecord(token, repo, collection, rkey, record) : await pds.createRecord(token, repo, collection, record);
  const uri = w.uri, cid = w.cid, shape = indexShape(collection, record, repo);
  if (!store.getRecordByUri(uri)) store.putRecord(cid, { record: shape, repoRecord: record, uri, cid, collection, rkey: uri.split("/").pop(), del });
  const counts = store.countsFor(shape.target); events.emit("counts", { target: shape.target, counts });
  return { uri, id: cid, counts };
}
// ---- retract: delete the repo record. The device key signs {type:"retract", uri, at}.
export async function acceptRetract({ envelope, origin }) {
  const { uri, at, del, sig } = envelope || {}; const dg = liveDelegation(del, origin); const repo = dg.root;
  const r = store.getRecordByUri(uri); if (!r || r.record.by !== repo) throw new Error("no such record of yours");
  if (!(Date.parse(at) > 0) || Math.abs(Date.parse(at) - Date.now()) > 10 * 60e3) throw new Error("retract time is not near now");
  if (!(await verifyObject(dg.devKey, { type: "retract", uri, at }, sig))) throw new Error("retract signature does not verify");
  const [, , , collection, rkey] = uri.replace("at://", "").split("/").length === 3 ? ["", "", "", ...uri.replace("at://", "").split("/").slice(1)] : [];
  const parts = uri.replace("at://", "").split("/"); await pds.deleteRecord(await repoToken(repo), repo, parts[1], parts[2]);
  store.retractRecord(uri, repo); const counts = store.countsFor(r.record.target); events.emit("counts", { target: r.record.target, counts });
  return { uri, retracted: true, counts };
}
// ---- the service writes a verification into its own repo, signed inline by the service key
export async function serviceVerification({ claimUri, claimCid, target, evidence }) {
  const collection = NS + "verification";
  let record = { $type: collection, claim: { uri: claimUri, cid: claimCid }, target, evidence, createdAt: new Date().toISOString() };
  record = await inlineSign(service.privateKey, record, service.did, service.keyDid); lexicons.assertValidRecord(collection, jsonToLex(record));
  let uri, cid; if (pds.enabled() && store.pdsCredentials(service.did)?.pds_handle) ({ uri, cid } = await pds.createRecord(await repoToken(service.did), service.did, collection, record)); else { cid = await cidString(record); uri = `at://${service.did}/${collection}/${cid.slice(-13)}`; }
  const shape = indexShape(collection, record, service.did); if (!store.getRecordByUri(uri)) store.putRecord(cid, { record: shape, repoRecord: record, uri, cid, collection, rkey: uri.split("/").pop() });
  return { uri, cid, record };
}
// ---- root actions (revoke, add-key, remove-key), unchanged
const pendingKeys = new Map();
setInterval(() => { const cutoff = Date.now() - 10 * 60e3; for (const [k, v] of pendingKeys) if (v.at < cutoff) pendingKeys.delete(k); }, 60e3).unref();
export const stagePendingKey = (nonce, did, credential) => pendingKeys.set(nonce, { did, credential, at: Date.now() });
export async function acceptAction({ envelope, origin }) {
  const { action } = envelope; const id = await checkAction(action);
  const credential = store.getCredential(envelope.credentialId); if (!credential || credential.did !== action.root) throw new Error("passkey does not belong to " + action.root);
  const { counter } = await verifyAssertion({ origin, response: envelope.assertion, challenge: hexToB64u(id), credential }); store.setCounter(credential.id, counter);
  if (action.type === "revoke") { const d = store.getDelegation(action.del); if (!d || d.delegation.root !== action.root) throw new Error("no such delegation of yours"); if (!store.isRevoked(action.del)) store.putRevocation(id, envelope); return { id, revoked: action.del }; }
  if (action.type === "add-key") { const p = [...pendingKeys.values()].find((v) => v.did === action.root && v.credential.id === action.credentialId); if (!p) throw new Error("no pending passkey with that id; register it again"); store.addCredential(action.root, p.credential); for (const [k, v] of pendingKeys) if (v === p) pendingKeys.delete(k); return { id, added: action.credentialId, keys: store.keysOf(action.root).length }; }
  if (action.type === "remove-key") { if (action.credentialId === credential.id) throw new Error("sign with a different passkey than the one you are removing"); if (store.keysOf(action.root).length < 2) throw new Error("cannot remove the only passkey"); if (!store.removeCredential(action.root, action.credentialId)) throw new Error("no such passkey"); return { id, removed: action.credentialId, keys: store.keysOf(action.root).length }; }
}
// ---- reads
export function read(targets) { const out = {}; for (const t of targets.slice(0, 100)) { try { const n = normalizeTarget(t); out[t] = { target: n, ...store.countsFor(n) }; } catch (e) { out[t] = { error: e.message }; } } return out; }
export const by = (did) => { const a = store.getAccount(did); return { did, handle: a?.handle || null, repoHandle: a?.pds_handle || null, since: a?.created || null, service: did === service?.did || undefined, keys: store.keysOf(did).map(({ id, jwk, created, transports }) => ({ id, jwk, created, transports })), delegations: store.delegationsOf(did), counts: store.countsBy(did), vouchedBy: store.vouchesFor(did), vouches: store.vouchesBy(did), proofs: store.claimsOf(did), records: store.recordsBy(did) }; };
export const byHandle = (handle) => { const a = store.getAccountByHandle(String(handle || "").toLowerCase()); if (!a) return null; return by(a.did); };
export const whois = (did) => store.handleOf(did);
