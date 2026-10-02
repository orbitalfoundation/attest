// orbital-attest client: a per-site device key, a delegation from the person's passkey, signing, and one socket to the service.
// Plain ES module, no build step, no dependencies (socket.io's client is loaded from the service itself).
// Usage: import * as A from "orbital-attest"; A.configure({ server: "https://attest.monster" }).
import { didFromJwk, canonical, idOf, signObject, normalizeTarget, normalizeTags, b64u, unb64u, KINDS, inlineSign, inlineVerify, originCommitment } from "./verify.mjs";
export { didFromJwk, canonical, idOf, normalizeTarget, normalizeTags, b64u, unb64u, KINDS, inlineSign, inlineVerify };
const NS = "monster.attest.";
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
// --- build a lexicon-shaped record, sign it inline with this page's device key, submit it to be written into the person's repo.
// kind: upvote | comment | statement | vouch | claim. extra: {body} for comment/statement, {reason} for vouch, {anchor} for comment.
export async function makeRecord(kind, target, extra = {}) {
  const s = session(); if (!s) throw new Error("not signed in");
  const dev = await deviceKey(); if (dev.did !== s.delegation.device) throw new Error("session belongs to another device key; sign in again");
  const createdAt = new Date().toISOString(); let collection, record;
  if (kind === "upvote") { collection = NS + "vote"; record = { subject: normalizeTarget(target) }; }
  else if (kind === "comment") { collection = NS + "comment"; record = { subject: normalizeTarget(target), text: extra.body, ...(extra.anchor ? { anchor: extra.anchor } : {}) }; }
  else if (kind === "statement") { collection = NS + "statement"; record = { ...(target ? { subject: normalizeTarget(target) } : {}), text: extra.body }; }
  else if (kind === "vouch") { collection = NS + "vouch"; record = { subject: target, ...(extra.reason ? { reason: extra.reason } : {}) }; }
  else if (kind === "claim") { collection = NS + "claim"; record = { target: normalizeTarget(target) }; }
  else if (kind === "bookmark") { collection = NS + "bookmark"; const tags = normalizeTags(extra.tags); record = { subject: normalizeTarget(target), ...(extra.title ? { title: String(extra.title).slice(0, 300) } : {}), ...(tags.length ? { tags } : {}), ...(extra.note ? { note: extra.note } : {}) }; }
  else throw new Error("unknown kind " + kind);
  record = await inlineSign(dev.privateKey, { $type: collection, ...record, createdAt }, s.root, dev.did);
  return { collection, record, del: s.id };
}
export async function attest(kind, target, extra = {}) {
  try {
    if (kind === "retract") return await retract(extra.ref);
    return await req("attest", await makeRecord(kind, target, extra));
  } catch (e) { if (/revoked|unknown delegation|expired/.test(e.message)) clearSession(); throw e; }
}
// Retract = delete the repo record; the device key signs {type:"retract", uri, at}.
export async function retract(uri) {
  const s = session(); if (!s) throw new Error("not signed in"); const dev = await deviceKey(); const at = new Date().toISOString();
  return req("retract", { uri, at, del: s.id, sig: await signObject(dev.privateKey, { type: "retract", uri, at }) });
}
export const read = async (targets) => (await (await fetch(need() + "/read?targets=" + encodeURIComponent(targets.join(",")))).json()).targets;
export const by = async (did) => (await fetch(need() + "/by/" + encodeURIComponent(did))).json();
// --- sign in. Same origin: go to the login page and come back. Another origin: a popup on the service that posts the session
// back, or, when a popup cannot work, a redirect to the service that returns here with the session in the URL fragment.
// Mobile: Safari only allows a popup opened synchronously inside the tap, so a caller that has already awaited something
// should open a blank window in its tap handler and pass it as {popup}; a blocked popup (null) falls back to the redirect.
// {mode:"redirect"} forces the redirect (a home-screen web app, where a popup loses its opener; an in-app browser).
export function signIn({ popup, mode } = {}) {
  return new Promise(async (resolve, reject) => {
    need();
    if (server === location.origin) { location.href = server + "/login?return=" + encodeURIComponent(location.href); return; }
    let w = popup; if (w === undefined && mode !== "redirect") { try { w = window.open("about:blank", "attest-login", "popup,width=420,height=560"); } catch { w = null; } }
    const dev = await deviceKey();
    const url = server + "/login?device=" + encodeURIComponent(dev.did) + "&key=" + encodeURIComponent(b64u(new TextEncoder().encode(JSON.stringify(dev.jwk)))) + "&origin=" + encodeURIComponent(location.origin);
    if (mode === "redirect" || !w) { if (w) w.close(); location.href = url + "&return=" + encodeURIComponent(location.href); return; }
    w.location.href = url;
    const onMsg = (e) => { if (e.origin !== server || e.data?.type !== "attest:session") return; window.removeEventListener("message", onMsg); setSession(e.data.session); resolve(e.data.session); };
    window.addEventListener("message", onMsg);
    const t = setInterval(() => { if (w.closed) { clearInterval(t); window.removeEventListener("message", onMsg); if (!session()) reject(new Error("sign-in cancelled")); } }, 500);
  });
}
// The redirect's return: the login page sends the person back with #attest-session=<base64url JSON>. Taken at load, so a page
// that imports this module is signed in by the time it asks session(); the fragment is removed from the address bar.
export function takeSessionFromHash() {
  try { const m = (location.hash || "").match(/^#attest-session=([A-Za-z0-9_-]+)$/); if (!m) return null;
    const s = JSON.parse(new TextDecoder().decode(unb64u(m[1]))); if (!s?.id || !s.delegation || siteOf(s) !== location.origin) return null;
    setSession(s); history.replaceState(null, "", location.pathname + location.search); return s; } catch { return null; }
}
if (typeof location !== "undefined") takeSessionFromHash();
// The site a session is for: v2 sessions carry it beside the delegation (whose originHash commits to it, with the salt); v1 named it.
export function siteOf(s) { return s?.delegation?.v === 1 ? s.delegation.origin : s?.origin || null; } // hoisted: used at module load
// The owner's own private reads, signed by this page's device key: own("sessions") lists every sign-in with its site.
export async function own(name, payload = null) {
  const s = session(); if (!s) throw new Error("not signed in"); const dev = await deviceKey(); const at = new Date().toISOString();
  return req("own", { name, payload, at, del: s.id, sig: await signObject(dev.privateKey, { type: "own", name, payload, at }) });
}
export { originCommitment };
export const short = (did) => did.slice(8, 16) + "…" + did.slice(-4);
// --- WebAuthn JSON helpers and root actions (used by the service's own pages).
export const creationOptions = (o) => ({ ...o, challenge: unb64u(o.challenge), user: { ...o.user, id: unb64u(o.user.id) }, excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: unb64u(c.id) })) });
export const requestOptions = (o) => ({ ...o, challenge: unb64u(o.challenge), allowCredentials: (o.allowCredentials || []).map((c) => ({ ...c, id: unb64u(c.id) })) });
export function credToJSON(c) {
  if (typeof c.toJSON === "function") return c.toJSON();
  const r = c.response, j = { id: c.id, rawId: b64u(c.rawId), type: c.type, clientExtensionResults: c.getClientExtensionResults(), authenticatorAttachment: c.authenticatorAttachment || undefined, response: { clientDataJSON: b64u(r.clientDataJSON) } };
  if (r.attestationObject) { j.response.attestationObject = b64u(r.attestationObject); j.response.transports = r.getTransports?.() || []; }
  else { j.response.authenticatorData = b64u(r.authenticatorData); j.response.signature = b64u(r.signature); if (r.userHandle) j.response.userHandle = b64u(r.userHandle); }
  return j;
}
// A root action (revoke, add-key, remove-key): the passkey signs its id. Only on the service's own origin.
export async function rootAction(action) {
  const { options } = await req("root.start", { action });
  const cred = await navigator.credentials.get({ publicKey: requestOptions(options) });
  return req("root.finish", { action, credentialId: cred.id, assertion: credToJSON(cred) });
}
// Admin requests: signed by this page's device key over {type:"admin", name, payload, at}; the server checks the root is an admin.
export async function adminReq(name, payload = null) {
  const s = session(); if (!s) throw new Error("not signed in"); const dev = await deviceKey(); const at = new Date().toISOString();
  return req("admin", { name, payload, at, del: s.id, sig: await signObject(dev.privateKey, { type: "admin", name, payload, at }) });
}
