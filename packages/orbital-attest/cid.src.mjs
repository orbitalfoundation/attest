// CID helpers for records: DAG-CBOR encode, CIDv1 (dag-cbor, sha-256), as AT Protocol and badge.blue define them.
// JSON form ↔ data model: {"$bytes": base64} is a byte string, {"$link": cid} is a CID link.
import * as dagCbor from "@ipld/dag-cbor";
import { CID } from "multiformats/cid";
import { sha256 } from "multiformats/hashes/sha2";
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export function fromJson(v) {
  if (Array.isArray(v)) return v.map(fromJson);
  if (v && typeof v === "object") {
    if (v instanceof Uint8Array || v instanceof CID) return v;
    const keys = Object.keys(v);
    if (keys.length === 1 && keys[0] === "$bytes" && typeof v.$bytes === "string") return b64(v.$bytes);
    if (keys.length === 1 && keys[0] === "$link" && typeof v.$link === "string") return CID.parse(v.$link);
    const o = {}; for (const k of keys) if (v[k] !== undefined) o[k] = fromJson(v[k]); return o;
  }
  return v;
}
export const toB64 = (bytes) => btoa(String.fromCharCode(...bytes));
export const encode = (obj) => dagCbor.encode(fromJson(obj));
export async function cidOf(obj) { const bytes = encode(obj); const hash = await sha256.digest(bytes); return CID.create(1, dagCbor.code, hash); }
export const cidString = async (obj) => (await cidOf(obj)).toString();
export const cidBytes = async (obj) => (await cidOf(obj)).bytes; // 36 bytes: what an inline signature signs
export { CID };
