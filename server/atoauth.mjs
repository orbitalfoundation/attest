// Sign in with an existing AT Protocol account (bsky.social or any PDS) via atproto OAuth, as a confidential client.
// attest.monster sets no cookie: OAuth state lives server-side; any cookie belongs to the person's own server's sign-in page.
// Workaround (2026-09-29): importing @atproto/oauth-client-node (via @atproto-labs/fetch-node, which bundles undici 6, 7
// and 8) replaces Node's global fetch dispatcher with a wrapper from a different undici, after which the built-in fetch
// returns responses without headers ("Missing response Content-Type header" everywhere, in this module and the rest of
// the server). So: let Node create its own dispatcher first, load the package, then put Node's dispatcher back.
const DISPATCHER = Symbol.for("undici.globalDispatcher.1");
await fetch("http://127.0.0.1:9/").catch(() => {});
const nodeDispatcher = globalThis[DISPATCHER];
const { NodeOAuthClient } = await import("@atproto/oauth-client-node");
if (nodeDispatcher && globalThis[DISPATCHER] !== nodeDispatcher) globalThis[DISPATCHER] = nodeDispatcher;
import { JoseKey } from "@atproto/jwk-jose";
import { DidResolverCached, DidResolverCommon } from "@atproto-labs/did-resolver";
// Workaround (2026-09-29): the default cached DID resolver in @atproto-labs/did-resolver 0.3.9 fails with
// "Missing response Content-Type header" when called without options, which the OAuth client does. Resolving
// directly works; a DidResolverCached subclass is passed so the factory does not wrap it again.
class DirectDidResolver extends DidResolverCached {
  constructor() { const inner = new DidResolverCommon({}); super(inner); this.inner = inner; }
  resolve(did, options) { return this.inner.resolve(did, { signal: options?.signal }); }
}
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as store from "./store.mjs";
const BASE = "https://" + (process.env.CANONICAL_HOST || "attest.monster");
// Narrow permission: write only attest's own record types in the person's repository.
export const SCOPE = process.env.OAUTH_SCOPE || ["atproto", ...["vote", "comment", "statement", "vouch", "claim", "bookmark"].map((k) => "repo:monster.attest." + k)].join(" ");
let client = null;
export const enabled = () => !!client;
export function clientMetadata() {
  return { client_id: `${BASE}/client-metadata.json`, client_name: "attest", client_uri: BASE, logo_uri: `${BASE}/icon-192.png`, tos_uri: `${BASE}/about`, policy_uri: `${BASE}/faq`,
    redirect_uris: [`${BASE}/atproto/callback`], scope: SCOPE, grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], application_type: "web",
    token_endpoint_auth_method: "private_key_jwt", token_endpoint_auth_signing_alg: "ES256", dpop_bound_access_tokens: true, jwks_uri: `${BASE}/jwks.json` };
}
export async function init(path = (process.env.ATTEST_DB || "data/attest.sqlite").replace(/[^/]*$/, "oauth-key.json")) {
  if (process.env.OAUTH === "off") return null;
  mkdirSync(dirname(path), { recursive: true });
  let jwk; if (existsSync(path)) jwk = JSON.parse(readFileSync(path, "utf8")); else { const k = await JoseKey.generate(["ES256"], "attest-k1"); jwk = k.privateJwk; writeFileSync(path, JSON.stringify(jwk), { mode: 0o600 }); }
  const key = await JoseKey.fromImportable(jwk, jwk.kid || "attest-k1");
  client = new NodeOAuthClient({ clientMetadata: clientMetadata(), keyset: [key], didResolver: new DirectDidResolver(),
    stateStore: { set: async (k, v) => store.kvSet("oauth_state", k, v), get: async (k) => store.kvGet("oauth_state", k) ?? undefined, del: async (k) => store.kvDel("oauth_state", k) },
    sessionStore: { set: async (k, v) => store.kvSet("oauth_session", k, v), get: async (k) => store.kvGet("oauth_session", k) ?? undefined, del: async (k) => store.kvDel("oauth_session", k) } });
  return client;
}
export const jwks = () => client?.jwks || { keys: [] };
export const authorize = (handle, appState) => client.authorize(handle, { scope: SCOPE, state: appState });
export async function callback(params) {
  const { session, state } = await client.callback(params);
  const r = await session.fetchHandler(`/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(session.did)}`);
  const handle = r.ok ? (await r.json()).handle : null;
  return { did: session.did, handle, state };
}
// XRPC against the person's own PDS through their OAuth session.
async function xrpc(did, method, body, params) {
  const s = await client.restore(did, "auto");
  const path = `/xrpc/${method}` + (params ? "?" + new URLSearchParams(params) : "");
  const r = await s.fetchHandler(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  const t = await r.text(); let j = {}; try { j = t ? JSON.parse(t) : {}; } catch { j = { raw: t }; }
  if (!r.ok) throw new Error(`${method}: ${j.error || r.status} ${j.message || ""}`.trim()); return j;
}
export const hasSession = async (did) => { try { await client.restore(did, false); return true; } catch { return false; } };
export const putRecord = (did, collection, rkey, record) => xrpc(did, "com.atproto.repo.putRecord", { repo: did, collection, rkey, record, validate: false });
export const createRecord = (did, collection, record) => xrpc(did, "com.atproto.repo.createRecord", { repo: did, collection, record, validate: false });
export const deleteRecord = (did, collection, rkey) => xrpc(did, "com.atproto.repo.deleteRecord", { repo: did, collection, rkey });
