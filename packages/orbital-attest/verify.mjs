// Identity helpers shared by browser and server (no dependencies, no Node-only APIs).
// A key is identified by did:key over its P-256 public point (multicodec 0x1200, compressed point, base58btc, "z" prefix).
// Records are canonical JSON (sorted keys, no whitespace); an id is the sha256 of that.
const subtle = globalThis.crypto.subtle;
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export function base58(bytes) {
  const digits = [0];
  for (const b of bytes) { let carry = b; for (let j = 0; j < digits.length; j++) { carry += digits[j] << 8; digits[j] = carry % 58; carry = (carry / 58) | 0; } while (carry) { digits.push(carry % 58); carry = (carry / 58) | 0; } }
  let s = ""; for (const b of bytes) { if (b) break; s += "1"; }
  for (let i = digits.length - 1; i >= 0; i--) s += B58[digits[i]];
  return s;
}
export const b64u = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const unb64u = (s) => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
export const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
// did:key for a P-256 public key given as JWK {x, y} (base64url, 32 bytes each).
export function didFromJwk({ x, y }) {
  const X = unb64u(x), Y = unb64u(y); if (X.length !== 32 || Y.length !== 32) throw new Error("not a P-256 point");
  const out = new Uint8Array(2 + 33); out[0] = 0x80; out[1] = 0x24; // varint(0x1200)
  out[2] = (Y[31] & 1) ? 0x03 : 0x02; out.set(X, 3);
  return "did:key:z" + base58(out);
}
export const isDid = (s) => typeof s === "string" && /^did:key:z[1-9A-HJ-NP-Za-km-z]{40,60}$/.test(s);
export const isAccountDid = (s) => isDid(s) || (typeof s === "string" && /^did:plc:[a-z2-7]{24}$/.test(s));
// Canonical JSON: object keys sorted at every level, arrays in order, no whitespace. Undefined values are dropped.
export function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map((v) => canonical(v === undefined ? null : v)).join(",") + "]";
  return "{" + Object.keys(value).filter((k) => value[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
}
export async function sha256(bytesOrString) { const data = typeof bytesOrString === "string" ? new TextEncoder().encode(bytesOrString) : bytesOrString; return new Uint8Array(await subtle.digest("SHA-256", data)); }
export const idOf = async (obj) => hex(await sha256(canonical(obj)));
// ECDSA P-256 / SHA-256 over the canonical bytes of an object; signature is raw r||s, base64url.
export async function signObject(privateKey, obj) { return b64u(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, new TextEncoder().encode(canonical(obj)))); }
export async function verifyObject(jwk, obj, sigB64u) {
  const key = await subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
  return subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, unb64u(sigB64u), new TextEncoder().encode(canonical(obj)));
}
// Target grammar (NIP-73 spirit): a URL (normalised, no fragment), a DOI, an ISBN, a DID, a service handle, or a content hash.
export function normalizeTarget(t) {
  if (typeof t !== "string" || !t.trim()) throw new Error("empty target");
  t = t.trim();
  if (/^https?:\/\//i.test(t)) { const u = new URL(t); u.hash = ""; u.hostname = u.hostname.toLowerCase(); if (u.pathname === "") u.pathname = "/"; return u.toString(); }
  if (/^doi:10\.\d{4,9}\/\S+$/i.test(t)) return "doi:" + t.slice(4).toLowerCase();
  if (/^isbn:[0-9Xx-]{10,17}$/.test(t)) return "isbn:" + t.slice(5).replace(/-/g, "").toUpperCase();
  if (isDid(t)) return t;
  if (/^[a-z][a-z0-9]+:[A-Za-z0-9_.\-@]{1,64}$/.test(t)) return t; // service handle, e.g. github:anselm
  if (/^sha256:[0-9a-f]{64}$/i.test(t)) return "sha256:" + t.slice(7).toLowerCase();
  throw new Error("unrecognised target: " + t.slice(0, 80));
}
export const KINDS = ["upvote", "comment", "vouch", "statement", "retract", "claim", "verify"];

// ---- Inline signatures on AT Protocol records (badge.blue / app.certified.signature.defs#inline).
// Signed input: the 36-byte CIDv1 (dag-cbor, sha-256) of the record with `signatures` removed and a `$sig` object
// {$type, key, repository} inserted. ECDSA P-256 over those bytes, raw r||s, low-S mandatory.
import { cidBytes, toB64 } from "./cid.mjs";
export const INLINE_TYPE = "app.certified.signature.defs#inline";
const P256_N = BigInt("0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551");
const bnFrom = (bytes) => bytes.reduce((a, b) => (a << 8n) + BigInt(b), 0n);
const bnTo = (n) => { const out = new Uint8Array(32); for (let i = 31; i >= 0; i--) { out[i] = Number(n & 255n); n >>= 8n; } return out; };
export function lowS(sig) { const r = sig.slice(0, 32), s = bnFrom(sig.slice(32)); if (s <= P256_N / 2n) return sig; const out = new Uint8Array(64); out.set(r); out.set(bnTo(P256_N - s), 32); return out; }
export const isLowS = (sig) => bnFrom(sig.slice(32)) <= P256_N / 2n;
export const keyRef = (did) => did + "#" + did.slice("did:key:".length); // did:key verification method fragment is the key itself
function signingInput(record, repository, key) {
  const { signatures, $sig, ...rest } = record; return cidBytes({ ...rest, $sig: { $type: INLINE_TYPE, key, repository } });
}
// Sign a record (JSON form) with a device private key; returns the record with the inline entry appended (JSON form, $bytes).
export async function inlineSign(privateKey, record, repository, deviceDid) {
  const key = keyRef(deviceDid); const input = await signingInput(record, repository, key);
  const raw = lowS(new Uint8Array(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, input)));
  return { ...record, signatures: [...(record.signatures || []), { $type: INLINE_TYPE, key, signature: { $bytes: toB64(raw) } }] };
}
// Verify every inline entry whose key we can resolve (did:key P-256 only). Returns [{key, ok}] and throws on a malformed entry.
export async function inlineVerify(record, repository, resolveJwk = jwkFromDidKey) {
  const out = [];
  for (const e of record.signatures || []) {
    if (e.$type !== INLINE_TYPE) { out.push({ key: e.uri || null, ok: null, skipped: "not inline" }); continue; }
    const did = String(e.key).split("#")[0]; const jwk = await resolveJwk(did); if (!jwk) { out.push({ key: e.key, ok: null, skipped: "unresolvable key" }); continue; }
    const raw = Uint8Array.from(atob(e.signature.$bytes), (c) => c.charCodeAt(0)); if (raw.length !== 64 || !isLowS(raw)) { out.push({ key: e.key, ok: false, reason: "not a low-S raw signature" }); continue; }
    const input = await signingInput(record, repository, e.key);
    const k = await subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, true, ["verify"]);
    out.push({ key: e.key, ok: await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, k, raw, input) });
  }
  return out;
}
// did:key (P-256, compressed) → JWK. Decompresses the point: y² = x³ − 3x + b (mod p).
const P = BigInt("0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF"), B = BigInt("0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B");
const modPow = (b, e, m) => { let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; } return r; };
export function jwkFromDidKey(did) {
  if (!isDid(did)) return null; const s = did.slice("did:key:z".length); const bytes = base58decode(s);
  if (bytes[0] !== 0x80 || bytes[1] !== 0x24 || bytes.length !== 35) return null;
  const x = bnFrom(bytes.slice(3)); let y = modPow((x ** 3n - 3n * x + B) % P, (P + 1n) / 4n, P); if ((y & 1n) !== BigInt(bytes[2] & 1)) y = P - y;
  return { kty: "EC", crv: "P-256", x: b64u(bnTo(x)), y: b64u(bnTo(y)) };
}
export function base58decode(s) {
  let n = 0n; for (const c of s) { const i = B58.indexOf(c); if (i < 0) throw new Error("bad base58"); n = n * 58n + BigInt(i); }
  const out = []; while (n > 0n) { out.unshift(Number(n & 255n)); n >>= 8n; } for (const c of s) { if (c !== "1") break; out.unshift(0); } return new Uint8Array(out);
}
