// Domain operations: accept a delegation, accept a record, answer reads. Verification lives here; storage in store.mjs.
import * as store from "./store.mjs";
import { checkDelegation, checkRecord, checkAction, verifyObject } from "./identity.mjs";
import { KINDS, normalizeTarget } from "../packages/orbital-attest/verify.mjs";
import { verifyAssertion } from "./passkeys.mjs";
import { EventEmitter } from "node:events";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { signObject, didFromJwk } from "../packages/orbital-attest/verify.mjs";
// The service's own key: it signs verification records ("I checked this proof"). Generated on first start, kept next to the database.
let service = null;
export async function initServiceKey(path = (process.env.ATTEST_DB || "data/attest.sqlite").replace(/[^/]*$/, "service-key.json")) {
  mkdirSync(dirname(path), { recursive: true });
  let jwk; if (existsSync(path)) jwk = JSON.parse(readFileSync(path, "utf8"));
  else { const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]); jwk = await crypto.subtle.exportKey("jwk", pair.privateKey); writeFileSync(path, JSON.stringify(jwk), { mode: 0o600 }); }
  const privateKey = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const pub = { x: jwk.x, y: jwk.y }; service = { privateKey, pub, did: didFromJwk(pub) };
  store.ensureServiceAccount(service.did, "attest"); return service.did;
}
export const serviceDid = () => service?.did || null;
// A record signed by the service key itself: envelope {record, sig, key} with no delegation.
export async function serviceRecord(kind, target, extra = {}) {
  const record = { v: 1, type: "record", kind, by: service.did, target, at: new Date().toISOString(), ...extra };
  const id = await checkRecord(record, { KINDS, normalizeTarget }); const sig = await signObject(service.privateKey, record);
  if (!store.getRecord(id)) store.putRecord(id, { record, sig, key: service.pub });
  return { id, record };
}
export const events = new EventEmitter(); // "counts" {target, counts}
// A delegation envelope: { delegation, credentialId, assertion } where assertion is the WebAuthn response whose challenge was the delegation id.
export async function acceptDelegation({ envelope, origin }) {
  const id = await checkDelegation(envelope.delegation);
  const credential = store.getCredential(envelope.credentialId); if (!credential) throw new Error("unknown passkey");
  const account = store.getAccount(credential.did); if (!account || account.did !== envelope.delegation.root) throw new Error("passkey does not belong to root " + envelope.delegation.root);
  const { counter } = await verifyAssertion({ origin, response: envelope.assertion, challenge: hexToB64u(id), credential });
  store.setCounter(credential.id, counter);
  if (!store.getDelegation(id)) store.putDelegation(id, envelope);
  return { id, root: account.did, handle: account.handle, until: envelope.delegation.until };
}
const pendingKeys = new Map(); // nonce -> {did, credential, at}; a new passkey waits here until an existing one signs add-key
setInterval(() => { const cutoff = Date.now() - 10 * 60e3; for (const [k, v] of pendingKeys) if (v.at < cutoff) pendingKeys.delete(k); }, 60e3).unref();
export const stagePendingKey = (nonce, did, credential) => pendingKeys.set(nonce, { did, credential, at: Date.now() });
// A root action envelope: { action, credentialId, assertion }; the assertion's challenge is the action id, signed by one of the root's passkeys.
export async function acceptAction({ envelope, origin }) {
  const { action } = envelope; const id = await checkAction(action);
  const credential = store.getCredential(envelope.credentialId); if (!credential || credential.did !== action.root) throw new Error("passkey does not belong to " + action.root);
  const { counter } = await verifyAssertion({ origin, response: envelope.assertion, challenge: hexToB64u(id), credential }); store.setCounter(credential.id, counter);
  if (action.type === "revoke") {
    const d = store.getDelegation(action.del); if (!d || d.delegation.root !== action.root) throw new Error("no such delegation of yours");
    if (!store.isRevoked(action.del)) store.putRevocation(id, envelope);
    return { id, revoked: action.del };
  }
  if (action.type === "add-key") {
    const p = [...pendingKeys.values()].find((v) => v.did === action.root && v.credential.id === action.credentialId); if (!p) throw new Error("no pending passkey with that id; register it again");
    store.addCredential(action.root, p.credential); for (const [k, v] of pendingKeys) if (v === p) pendingKeys.delete(k);
    return { id, added: action.credentialId, keys: store.keysOf(action.root).length };
  }
  if (action.type === "remove-key") {
    if (action.credentialId === credential.id) throw new Error("sign with a different passkey than the one you are removing");
    if (store.keysOf(action.root).length < 2) throw new Error("cannot remove the only passkey");
    if (!store.removeCredential(action.root, action.credentialId)) throw new Error("no such passkey");
    return { id, removed: action.credentialId, keys: store.keysOf(action.root).length };
  }
}
const hexToB64u = (h) => Buffer.from(h, "hex").toString("base64url");
// A record envelope: { record, del, sig }. sig is the device key's ECDSA over canonical(record).
export async function acceptRecord({ envelope, origin }) {
  const { record, del, sig } = envelope || {};
  const id = await checkRecord(record, { KINDS, normalizeTarget });
  const d = store.getDelegation(del); if (!d) throw new Error("unknown delegation");
  if (store.isRevoked(del)) throw new Error("delegation revoked; sign in again");
  const dg = d.delegation;
  if (dg.root !== record.by) throw new Error("delegation root is not the record's author");
  if (origin && dg.origin !== origin) throw new Error("delegation was issued for " + dg.origin + ", not " + origin);
  const at = Date.parse(record.at); if (at < Date.parse(dg.from) || at > Date.parse(dg.until)) throw new Error("delegation not valid at record time");
  if (!(await verifyObject(dg.devKey, record, sig))) throw new Error("signature does not verify");
  if (record.kind === "verify") throw new Error("verify records are issued by verifiers, not submitted");
  for (const k of ["upvote", "vouch", "claim"]) if (record.kind === k) { const existing = store.findLive(record.by, record.target, k); if (existing) return { id: existing, duplicate: true, counts: store.countsFor(record.target) }; }
  if (record.kind === "retract") { const target = store.getRecord(record.ref); if (!target) throw new Error("retract: no such record"); if (target.record.by !== record.by) throw new Error("retract: not yours"); if (target.record.target !== record.target) throw new Error("retract: target mismatch"); }
  if (!store.getRecord(id)) store.putRecord(id, envelope);
  const counts = store.countsFor(record.target); events.emit("counts", { target: record.target, counts });
  return { id, counts };
}
export function read(targets) {
  const out = {}; for (const t of targets.slice(0, 100)) { try { const n = normalizeTarget(t); out[t] = { target: n, ...store.countsFor(n) }; } catch (e) { out[t] = { error: e.message }; } }
  return out;
}
export const by = (did) => { const a = store.getAccount(did); return { did, handle: a?.handle || null, since: a?.created || null, service: did === service?.did || undefined, keys: store.keysOf(did).map(({ id, jwk, created, transports }) => ({ id, jwk, created, transports })), delegations: store.delegationsOf(did), counts: store.countsBy(did), vouchedBy: store.vouchesFor(did), vouches: store.vouchesBy(did), proofs: store.claimsOf(did), records: store.recordsBy(did) }; };
export const byHandle = (handle) => { const a = store.getAccountByHandle(String(handle || "").toLowerCase()); if (!a) return null; return by(a.did); };
export const whois = (did) => store.handleOf(did);
