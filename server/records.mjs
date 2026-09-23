// Domain operations: accept a delegation, accept a record, answer reads. Verification lives here; storage in store.mjs.
import * as store from "./store.mjs";
import { checkDelegation, checkRecord, verifyObject } from "./identity.mjs";
import { KINDS, normalizeTarget } from "../shared/did.mjs";
import { verifyAssertion } from "./passkeys.mjs";
import { EventEmitter } from "node:events";
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
const hexToB64u = (h) => Buffer.from(h, "hex").toString("base64url");
// A record envelope: { record, del, sig }. sig is the device key's ECDSA over canonical(record).
export async function acceptRecord({ envelope, origin }) {
  const { record, del, sig } = envelope || {};
  const id = await checkRecord(record, { KINDS, normalizeTarget });
  const d = store.getDelegation(del); if (!d) throw new Error("unknown delegation");
  const dg = d.delegation;
  if (dg.root !== record.by) throw new Error("delegation root is not the record's author");
  if (origin && dg.origin !== origin) throw new Error("delegation was issued for " + dg.origin + ", not " + origin);
  const at = Date.parse(record.at); if (at < Date.parse(dg.from) || at > Date.parse(dg.until)) throw new Error("delegation not valid at record time");
  if (!(await verifyObject(dg.devKey, record, sig))) throw new Error("signature does not verify");
  if (record.kind === "upvote") { const existing = store.findUpvote(record.by, record.target); if (existing) return { id: existing, duplicate: true, counts: store.countsFor(record.target) }; }
  if (record.kind === "retract") { const target = store.getRecord(record.ref); if (!target) throw new Error("retract: no such record"); if (target.record.by !== record.by) throw new Error("retract: not yours"); if (target.record.target !== record.target) throw new Error("retract: target mismatch"); }
  if (!store.getRecord(id)) store.putRecord(id, envelope);
  const counts = store.countsFor(record.target); events.emit("counts", { target: record.target, counts });
  return { id, counts };
}
export function read(targets) {
  const out = {}; for (const t of targets.slice(0, 100)) { try { const n = normalizeTarget(t); out[t] = { target: n, ...store.countsFor(n) }; } catch (e) { out[t] = { error: e.message }; } }
  return out;
}
export const by = (did) => { const a = store.getAccount(did); return { did, handle: a?.handle || null, since: a?.created || null, keys: store.keysOf(did), records: store.recordsBy(did) }; };
export const whois = (did) => store.handleOf(did);
