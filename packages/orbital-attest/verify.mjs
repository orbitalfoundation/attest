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
