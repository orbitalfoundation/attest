// orbital-attest/agent: an agent acting for a person on attest, from any JavaScript runtime with WebCrypto (Node 20+, Deno, Bun,
// browsers). The agent makes its own P-256 key, asks the person for a permission (they approve it on attest with their passkey),
// then signs records with its own key. Everything it writes goes into the person's repository, carries the agent's key and the
// permission's id, and is attributed "via <agent name>". The permission is public at <server>/agent/<id>.
//
//   import * as Agent from "orbital-attest/agent";
//   const key = await Agent.createKey();                                  // keep key.privateJwk secret; it is the agent
//   const ask = await Agent.requestAccess({ server, key, name: "research-bot", purpose: "files reading notes",
//                                           permissions: ["repo:monster.attest.bookmark?action=create&action=delete"] });
//   console.log("Approve at", ask.url, "code", ask.code);
//   const grant = await Agent.waitForApproval({ server, token: ask.token });
//   const me = Agent.agent({ server, key, grant });
//   await me.attest("bookmark", "https://example.org/paper", { title: "A paper", tags: "reading-room trust" });
import { didFromJwk, inlineSign, signObject, shapeRecord } from "./verify.mjs";
const subtle = globalThis.crypto.subtle, ALG = { name: "ECDSA", namedCurve: "P-256" };
const base = (s) => String(s || "https://attest.monster").replace(/\/+$/, "");
async function json(url, init) { const r = await fetch(url, init); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || r.status + " from " + url); return j; }
const post = (url, body) => json(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// A new agent key. privateJwk is the agent's whole identity: store it like a password.
export async function createKey() {
  const k = await subtle.generateKey(ALG, true, ["sign", "verify"]);
  const privateJwk = await subtle.exportKey("jwk", k.privateKey), publicJwk = { x: privateJwk.x, y: privateJwk.y };
  return { did: didFromJwk(publicJwk), publicJwk, privateJwk };
}
const signer = (privateJwk) => subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: privateJwk.x, y: privateJwk.y, d: privateJwk.d }, ALG, false, ["sign"]);

// Ask for a permission. permissions are AT Protocol repo permission strings for attest's record types. Returns { code, url, token,
// expires }: show the person url and code; they approve within 15 minutes.
export const requestAccess = ({ server, key, name, purpose = "", permissions, limits = { perDay: 50 }, days = 30 }) =>
  post(base(server) + "/agent/request", { agentKey: key.publicJwk, name, purpose, permissions, limits, days });

// Wait for the person. Resolves to { id, delegation } (the signed permission), rejects when the request expires.
export async function waitForApproval({ server, token, every = 3000, onPending = () => {} }) {
  for (;;) { const r = await json(base(server) + "/agent/poll/" + encodeURIComponent(token)); if (r.status === "approved") return { id: r.id, delegation: r.delegation }; if (r.status !== "pending") throw new Error("the request expired; ask again"); onPending(r); await new Promise((res) => setTimeout(res, every)); }
}

// Act within a granted permission. grant = { id, delegation } from waitForApproval (store it beside the key).
export function agent({ server, key, grant }) {
  const S = base(server), d = grant.delegation; if (didFromJwk(key.publicJwk) !== d.agent) throw new Error("this key is not the agent the permission names");
  let k; const priv = async () => (k ||= await signer(key.privateJwk));
  return {
    id: grant.id, root: d.root, name: d.name, permissions: d.permissions, until: d.until,
    status: () => json(S + "/agent/" + grant.id, { headers: { accept: "application/json" } }),
    // kind: upvote | comment | statement | vouch | claim | bookmark; extra as for the browser client.
    async attest(kind, target, extra = {}) {
      const { collection, record } = shapeRecord(kind, target, extra);
      const signed = await inlineSign(await priv(), { $type: collection, ...record, createdAt: new Date().toISOString() }, d.root, d.agent);
      return post(S + "/agent/attest", { collection, record: signed, del: grant.id });
    },
    async retract(uri) { const at = new Date().toISOString(); return post(S + "/agent/retract", { uri, at, del: grant.id, sig: await signObject(await priv(), { type: "retract", uri, at }) }); },
  };
}
