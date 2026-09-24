// Server-side identity: COSE public keys from passkeys → JWK → did:key; delegation and record verification.
import { decodeCredentialPublicKey, cose, isoBase64URL } from "@simplewebauthn/server/helpers";
import { didFromJwk, isDid, canonical, idOf, verifyObject, unb64u, b64u } from "../packages/orbital-attest/verify.mjs";
export { didFromJwk, isDid, canonical, idOf, verifyObject, b64u, unb64u };
// A passkey's COSE public key (from registration) as a JWK; ES256 only.
export function jwkFromCose(coseBytes) {
  const k = decodeCredentialPublicKey(coseBytes);
  const kty = k.get(cose.COSEKEYS.kty), alg = k.get(cose.COSEKEYS.alg);
  if (kty !== cose.COSEKTY.EC2 || alg !== cose.COSEALG.ES256) throw new Error("passkey is not ES256; got kty " + kty + " alg " + alg);
  return { kty: "EC", crv: "P-256", x: isoBase64URL.fromBuffer(k.get(cose.COSEKEYS.x)), y: isoBase64URL.fromBuffer(k.get(cose.COSEKEYS.y)) };
}
export const DELEGATION_MAX_DAYS = 90;
// Shape check for a delegation the client built. Returns the canonical id. Throws with a reason.
export async function checkDelegation(d) {
  if (!d || d.v !== 1 || d.type !== "delegation") throw new Error("not a v1 delegation");
  if (!isDid(d.root) || !isDid(d.device)) throw new Error("root and device must be did:key");
  if (!d.devKey || typeof d.devKey.x !== "string" || typeof d.devKey.y !== "string") throw new Error("devKey {x,y} required");
  if (didFromJwk(d.devKey) !== d.device) throw new Error("device did does not match devKey");
  if (typeof d.origin !== "string" || !/^https?:\/\/[^/]+$/.test(d.origin)) throw new Error("origin must be a bare origin");
  const from = Date.parse(d.from), until = Date.parse(d.until), now = Date.now();
  if (!(from > 0) || !(until > from)) throw new Error("bad from/until");
  if (until - from > DELEGATION_MAX_DAYS * 86400e3) throw new Error("delegation longer than " + DELEGATION_MAX_DAYS + " days");
  if (Math.abs(from - now) > 10 * 60e3) throw new Error("delegation 'from' is not near now");
  const keys = Object.keys(d).sort().join(","); if (keys !== "devKey,device,from,origin,root,type,until,v") throw new Error("unexpected delegation fields: " + keys);
  return idOf(d);
}
// Shape check for a record; returns its id.
export async function checkRecord(r, { KINDS, normalizeTarget }) {
  if (!r || r.v !== 1 || r.type !== "record") throw new Error("not a v1 record");
  if (!KINDS.includes(r.kind)) throw new Error("unknown kind " + r.kind);
  if (!isDid(r.by)) throw new Error("by must be did:key");
  if (normalizeTarget(r.target) !== r.target) throw new Error("target is not normalised");
  const at = Date.parse(r.at); if (!(at > 0)) throw new Error("bad at"); if (Math.abs(at - Date.now()) > 10 * 60e3) throw new Error("record time is not near now");
  if (r.body !== undefined && (typeof r.body !== "string" || r.body.length > 4000)) throw new Error("body must be a string under 4000 chars");
  if (r.kind === "comment" && !(r.body && r.body.trim())) throw new Error("comment needs a body");
  if (r.kind === "statement" && !(r.body && r.body.trim())) throw new Error("statement needs a body");
  if (r.kind === "retract" && !/^[0-9a-f]{64}$/.test(r.ref || "")) throw new Error("retract needs ref");
  if (r.kind !== "retract" && r.ref !== undefined) throw new Error("only retract carries ref");
  const allowed = new Set(["v", "type", "kind", "by", "target", "at", "body", "ref"]); for (const k of Object.keys(r)) if (!allowed.has(k)) throw new Error("unexpected field " + k);
  return idOf(r);
}

// Root actions: things only the passkey may do, each signed by an assertion whose challenge is the action's id.
export async function checkAction(a) {
  if (!a || a.v !== 1 || !isDid(a.root)) throw new Error("not a v1 root action");
  const at = Date.parse(a.at); if (!(at > 0) || Math.abs(at - Date.now()) > 10 * 60e3) throw new Error("action time is not near now");
  const fields = Object.keys(a).sort().join(",");
  if (a.type === "revoke") { if (!/^[0-9a-f]{64}$/.test(a.del || "")) throw new Error("revoke needs del"); if (fields !== "at,del,root,type,v") throw new Error("unexpected fields " + fields); }
  else if (a.type === "add-key") { if (typeof a.credentialId !== "string" || !a.credentialId) throw new Error("add-key needs credentialId"); if (fields !== "at,credentialId,root,type,v") throw new Error("unexpected fields " + fields); }
  else if (a.type === "remove-key") { if (typeof a.credentialId !== "string" || !a.credentialId) throw new Error("remove-key needs credentialId"); if (fields !== "at,credentialId,root,type,v") throw new Error("unexpected fields " + fields); }
  else throw new Error("unknown action " + a.type);
  return idOf(a);
}
