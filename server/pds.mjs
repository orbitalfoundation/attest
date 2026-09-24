// The PDS behind attest (AT Protocol personal data server). Thin fetch wrappers; nothing else speaks XRPC.
// PDS_URL is the server-to-server address (localhost on the VM; the public origin from a dev box). Admin calls use PDS_ADMIN_PASSWORD.
const PDS_URL = (process.env.PDS_URL || "").replace(/\/$/, "");
const ADMIN = process.env.PDS_ADMIN_PASSWORD || "";
const HANDLE_DOMAIN = process.env.PDS_HANDLE_DOMAIN || ".attest.monster";
export const enabled = () => !!PDS_URL;
export const fullHandle = (handle) => handle.includes(".") ? handle : handle + HANDLE_DOMAIN;
async function xrpc(method, { params, body, token, admin } = {}) {
  const url = PDS_URL + "/xrpc/" + method + (params ? "?" + new URLSearchParams(params) : "");
  const headers = { "content-type": "application/json" };
  if (token) headers.authorization = "Bearer " + token; if (admin) headers.authorization = "Basic " + Buffer.from("admin:" + ADMIN).toString("base64");
  const r = await fetch(url, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  const text = await r.text(); let j = {}; try { j = text ? JSON.parse(text) : {}; } catch { j = { raw: text }; }
  if (!r.ok) throw new Error(`${method}: ${j.error || r.status} ${j.message || ""}`.trim());
  return j;
}
export const describe = () => xrpc("com.atproto.server.describeServer");
export const inviteCode = async () => (await xrpc("com.atproto.server.createInviteCode", { body: { useCount: 1 }, admin: true })).code;
// Create the repo account behind a handle. The password is a server-side secret the person never sees; the passkey is their key.
export async function createAccount(handle, password) {
  const inviteCodeValue = await inviteCode();
  const r = await xrpc("com.atproto.server.createAccount", { body: { handle: fullHandle(handle), email: handle + "@users" + HANDLE_DOMAIN, password, inviteCode: inviteCodeValue } });
  return { did: r.did, handle: r.handle, accessJwt: r.accessJwt, refreshJwt: r.refreshJwt };
}
export const createSession = (identifier, password) => xrpc("com.atproto.server.createSession", { body: { identifier, password } });
export const refreshSession = (refreshJwt) => xrpc("com.atproto.server.refreshSession", { body: {}, token: refreshJwt });
export const putRecord = (token, repo, collection, rkey, record) => xrpc("com.atproto.repo.putRecord", { body: { repo, collection, rkey, record, validate: false }, token });
export const createRecord = (token, repo, collection, record) => xrpc("com.atproto.repo.createRecord", { body: { repo, collection, record, validate: false }, token });
export const deleteRecord = (token, repo, collection, rkey) => xrpc("com.atproto.repo.deleteRecord", { body: { repo, collection, rkey }, token });
export const getRecord = (repo, collection, rkey) => xrpc("com.atproto.repo.getRecord", { params: { repo, collection, rkey } });
export const listRecords = (repo, collection, limit = 100) => xrpc("com.atproto.repo.listRecords", { params: { repo, collection, limit } });
export const deleteAccount = (did) => xrpc("com.atproto.admin.deleteAccount", { body: { did }, admin: true });
// Sessions cache: access tokens per DID, refreshed when the PDS says they expired.
const sessions = new Map();
export async function tokenFor(did, identifier, password) {
  const s = sessions.get(did); if (s && Date.now() < s.until) return s.accessJwt;
  const r = await createSession(identifier, password); sessions.set(did, { accessJwt: r.accessJwt, refreshJwt: r.refreshJwt, until: Date.now() + 90 * 60e3 }); return r.accessJwt;
}
