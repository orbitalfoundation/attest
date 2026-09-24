// orbital-attest client: a per-site device key, a delegation from the person's passkey, signing, and one socket to the service.
// Plain ES module, no build step, no dependencies (socket.io's client is loaded from the service itself).
// Usage: import * as A from "orbital-attest"; A.configure({ server: "https://attest.monster" }).
import { didFromJwk, canonical, idOf, signObject, normalizeTarget, b64u, unb64u, KINDS } from "./verify.mjs";
export { didFromJwk, canonical, idOf, normalizeTarget, b64u, unb64u, KINDS };
export let server = null;
export function configure({ server: origin }) { if (!/^https?:\/\/[^/]+$/.test(origin || "")) throw new Error("configure({server}) needs a bare origin"); server = origin; if (sock) { sock.disconnect(); sock = null; } return server; }
const need = () => { if (!server) throw new Error("orbital-attest: call configure({server}) first"); return server; };
const SESSION_KEY = "attest:session";
// --- device key: ECDSA P-256, private half non-extractable, kept in this origin's IndexedDB. One per site (arena) by construction.
function idb() { return new Promise((res, rej) => { const r = indexedDB.open("attest", 1); r.onupgradeneeded = () => r.result.createObjectStore("keys"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
function idbGet(db, k) { return new Promise((res, rej) => { const t = db.transaction("keys").objectStore("keys").get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); }); }
function idbPut(db, k, v) { return new Promise((res, rej) => { const t = db.transaction("keys", "readwrite").objectStore("keys").put(v, k); t.onsuccess = () => res(); t.onerror = () => rej(t.error); }); }
let deviceCache;
export async function deviceKey() {
  if (deviceCache) return deviceCache;
  const db = await idb(); let entry = await idbGet(db, "device");
  if (!entry) {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    entry = { privateKey: pair.privateKey, jwk: { x: jwk.x, y: jwk.y }, created: new Date().toISOString() };
    await idbPut(db, "device", entry);
  }
  deviceCache = { privateKey: entry.privateKey, jwk: entry.jwk, did: didFromJwk(entry.jwk) };
  return deviceCache;
}
// --- session = an accepted delegation {id, delegation, root, handle, until}
export function session() { try { const s = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); if (s && Date.parse(s.until) > Date.now()) return s; } catch {} return null; }
export function setSession(s) { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); }
export function clearSession() { localStorage.removeItem(SESSION_KEY); }
// --- socket: one connection, structured requests with acks
let sock;
export async function connect() {
  if (sock) return sock;
  const { io } = await import(need() + "/socket.io/socket.io.esm.min.js");
  sock = io(server, { transports: ["websocket", "polling"] });
  return sock;
}
export async function req(name, payload = {}) {
  const s = await connect();
  const r = await new Promise((res) => s.timeout(15000).emit("req", { name, payload }, (err, reply) => res(err ? { ok: false, error: "timeout" } : reply)));
  if (!r.ok) throw new Error(r.error); return r.data;
}
export const onCounts = async (fn) => (await connect()).on("counts", fn);
export const subscribe = (targets) => req("subscribe", { targets });
// --- build, sign and submit a record. Needs a session (a delegation for this site's device key).
export async function makeRecord(kind, target, extra = {}) {
  const s = session(); if (!s) throw new Error("not signed in");
  const record = { v: 1, type: "record", kind, by: s.root, target: normalizeTarget(target), at: new Date().toISOString(), ...extra };
  const dev = await deviceKey(); if (dev.did !== s.delegation.device) throw new Error("session belongs to another device key; sign in again");
  const sig = await signObject(dev.privateKey, record);
  return { record, del: s.id, sig };
}
export async function attest(kind, target, extra) { try { return await req("attest", await makeRecord(kind, target, extra)); } catch (e) { if (/revoked|unknown delegation/.test(e.message)) clearSession(); throw e; } }
// WebAuthn JSON helpers (shared by the service's own pages).
export const creationOptions = (o) => ({ ...o, challenge: unb64u(o.challenge), user: { ...o.user, id: unb64u(o.user.id) }, excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: unb64u(c.id) })) });
export const requestOptions = (o) => ({ ...o, challenge: unb64u(o.challenge), allowCredentials: (o.allowCredentials || []).map((c) => ({ ...c, id: unb64u(c.id) })) });
export function credToJSON(c) {
  if (typeof c.toJSON === "function") return c.toJSON();
  const r = c.response, j = { id: c.id, rawId: b64u(c.rawId), type: c.type, clientExtensionResults: c.getClientExtensionResults(), authenticatorAttachment: c.authenticatorAttachment || undefined, response: { clientDataJSON: b64u(r.clientDataJSON) } };
  if (r.attestationObject) { j.response.attestationObject = b64u(r.attestationObject); j.response.transports = r.getTransports?.() || []; }
  else { j.response.authenticatorData = b64u(r.authenticatorData); j.response.signature = b64u(r.signature); if (r.userHandle) j.response.userHandle = b64u(r.userHandle); }
  return j;
}
// A root action: build, have the passkey sign it (one prompt), submit. Only on the service's own origin.
export async function rootAction(action) {
  const { options } = await req("root.start", { action });
  const cred = await navigator.credentials.get({ publicKey: requestOptions(options) });
  return req("root.finish", { action, credentialId: cred.id, assertion: credToJSON(cred) });
}
export const read = async (targets) => (await (await fetch(need() + "/read?targets=" + encodeURIComponent(targets.join(",")))).json()).targets;
export const by = async (did) => (await fetch(need() + "/by/" + encodeURIComponent(did))).json();
// --- sign in: same origin → go to the login page and come back; another origin → popup that posts the session back.
export function signIn() {
  return new Promise(async (resolve, reject) => {
    const dev = await deviceKey(); need();
    if (server === location.origin) { location.href = server + "/login?return=" + encodeURIComponent(location.href); return; }
    const url = server + "/login?device=" + encodeURIComponent(dev.did) + "&key=" + encodeURIComponent(b64u(new TextEncoder().encode(JSON.stringify(dev.jwk)))) + "&origin=" + encodeURIComponent(location.origin);
    const w = window.open(url, "attest-login", "popup,width=420,height=560"); if (!w) return reject(new Error("popup blocked"));
    const onMsg = (e) => { if (e.origin !== server || e.data?.type !== "attest:session") return; window.removeEventListener("message", onMsg); setSession(e.data.session); resolve(e.data.session); };
    window.addEventListener("message", onMsg);
    const t = setInterval(() => { if (w.closed) { clearInterval(t); window.removeEventListener("message", onMsg); if (!session()) reject(new Error("sign-in cancelled")); } }, 500);
  });
}
export const short = (did) => did.slice(8, 16) + "…" + did.slice(-4);
