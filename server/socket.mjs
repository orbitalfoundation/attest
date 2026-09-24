// socket.io transport: one structured request {name, payload} per call, switched on a handler map, ack carries the reply.
// Server pushes "counts" to sockets subscribed to a target.
import { Server } from "socket.io";
import * as store from "./store.mjs";
import * as records from "./records.mjs";
import * as passkeys from "./passkeys.mjs";
import { didFromJwk } from "./identity.mjs";
import { allow } from "./ratelimit.mjs";
import * as proofs from "./proofs.mjs";
import * as pds from "./pds.mjs";
import { randomBytes as rb } from "node:crypto";
import { randomBytes } from "node:crypto";
const pending = new Map(); // nonce -> {challenge, handle, at}
setInterval(() => { const cutoff = Date.now() - 5 * 60e3; for (const [k, v] of pending) if (v.at < cutoff) pending.delete(k); }, 60e3).unref();
const HANDLE = /^[a-z0-9][a-z0-9._-]{1,31}$/;
const handlers = {
  async "passkey.register.start"({ handle }, ctx) {
    handle = String(handle || "").trim().toLowerCase(); if (!HANDLE.test(handle)) throw new Error("handle: 2-32 chars, a-z 0-9 . _ -");
    if (store.getAccountByHandle(handle)) throw new Error("that handle is taken");
    const options = await passkeys.registrationOptions({ origin: ctx.origin, handle });
    const nonce = randomBytes(16).toString("base64url"); pending.set(nonce, { challenge: options.challenge, handle, at: Date.now() });
    return { nonce, options };
  },
  async "passkey.register.finish"({ nonce, response }, ctx) {
    const p = pending.get(nonce); if (!p) throw new Error("registration expired; try again"); pending.delete(nonce);
    const credential = await passkeys.verifyRegistration({ origin: ctx.origin, response, challenge: p.challenge });
    const keyDid = didFromJwk(credential.jwk);
    if (store.getCredential(credential.id)) throw new Error("this passkey already has an account");
    if (store.getAccountByHandle(p.handle)) throw new Error("that handle is taken");
    if (pds.enabled()) {
      // The account is a repo on our PDS. Its password is a server-side secret; the passkey is the person's key.
      const password = rb(18).toString("base64url"); const a = await pds.createAccount(p.handle, password);
      store.createAccount({ did: a.did, handle: p.handle, credential, keyDid, pdsHandle: a.handle, pdsPassword: password });
      return { did: a.did, handle: p.handle, repoHandle: a.handle };
    }
    store.createAccount({ did: keyDid, handle: p.handle, credential, keyDid });
    return { did: keyDid, handle: p.handle };
  },
  // Sign-in is signing a delegation: the client builds the delegation, we hand back WebAuthn options whose challenge is its id.
  async "delegate.start"({ delegation }, ctx) {
    const { checkDelegation } = await import("./identity.mjs"); const id = await checkDelegation(delegation);
    const options = await passkeys.authenticationOptions({ origin: ctx.origin, challenge: Buffer.from(id, "hex").toString("base64url"), allow: store.keysOf(delegation.root) });
    return { id, options };
  },
  async "delegate.finish"({ delegation, credentialId, assertion }, ctx) {
    return records.acceptDelegation({ envelope: { delegation, credentialId, assertion }, origin: ctx.origin });
  },
  // Root actions (revoke a delegation, add or remove a passkey): the passkey signs the action's id.
  async "root.start"({ action }, ctx) {
    const { checkAction } = await import("./identity.mjs"); const id = await checkAction(action);
    // Offer only the root's passkeys, and for remove-key never the one being removed.
    const allow = store.keysOf(action.root).filter((k) => !(action.type === "remove-key" && k.id === action.credentialId));
    const options = await passkeys.authenticationOptions({ origin: ctx.origin, challenge: Buffer.from(id, "hex").toString("base64url"), allow });
    return { id, options };
  },
  async "root.finish"({ action, credentialId, assertion }, ctx) { return records.acceptAction({ envelope: { action, credentialId, assertion }, origin: ctx.origin }); },
  // A second passkey: register it (excluding the ones the account has), then an existing passkey signs add-key to adopt it.
  async "passkey.add.start"({ did }, ctx) {
    const a = store.getAccount(did); if (!a) throw new Error("no such account");
    const options = await passkeys.registrationOptions({ origin: ctx.origin, handle: a.handle, existing: store.keysOf(did) });
    const nonce = randomBytes(16).toString("base64url"); pending.set(nonce, { challenge: options.challenge, handle: a.handle, did, at: Date.now() });
    return { nonce, options };
  },
  async "passkey.add.finish"({ nonce, response }, ctx) {
    const p = pending.get(nonce); if (!p || !p.did) throw new Error("registration expired; try again"); pending.delete(nonce);
    const credential = await passkeys.verifyRegistration({ origin: ctx.origin, response, challenge: p.challenge });
    if (store.getCredential(credential.id)) throw new Error("that passkey is already registered");
    records.stagePendingKey(nonce, p.did, credential);
    return { credentialId: credential.id, did: p.did };
  },
  async attest(envelope, ctx) {
    if (!allow("ip:" + ctx.ip, 60)) throw new Error("too many writes from this address; slow down");
    if (envelope?.del && !allow("del:" + envelope.del, 30)) throw new Error("too many writes for this session; slow down");
    return records.acceptRecord({ envelope, origin: ctx.origin });
  },
  async retract(envelope, ctx) { if (!allow("ip:" + ctx.ip, 60)) throw new Error("too many writes from this address; slow down"); return records.acceptRetract({ envelope, origin: ctx.origin }); },
  async subscribe({ targets }, ctx) { for (const t of (targets || []).slice(0, 100)) ctx.socket.join("t:" + t); return { ok: true }; },
  async whois({ did }) { return { did, handle: records.whois(did) }; },
  async "proof.instructions"({ claim }) { const c = proofs.claimRecord(claim); return { token: proofs.tokenFor(c.id), instructions: proofs.instructions(c.record.target, c.id) }; },
  async "proof.check"({ claim }, ctx) { if (!allow("proof:" + ctx.ip, 10)) throw new Error("too many checks; slow down"); return proofs.check(claim); },
  async lookup({ handle }) { const a = store.getAccountByHandle(String(handle || "").trim().toLowerCase()); if (!a) throw new Error("no account with that handle"); return { did: a.did, handle: a.handle }; },
  async read({ targets }) { return records.read(targets || []); },
};
export function attach(httpServer) {
  const io = new Server(httpServer, { cors: { origin: true, credentials: false }, serveClient: true, maxHttpBufferSize: 64 * 1024 });
  records.events.on("counts", ({ target, counts }) => io.to("t:" + target).emit("counts", { target, counts }));
  io.on("connection", (socket) => {
    const origin = socket.handshake.headers.origin || "", ip = socket.handshake.headers["x-forwarded-for"]?.split(",")[0].trim() || socket.handshake.address;
    const ctx = { socket, origin, ip };
    socket.on("req", async (msg, ack) => {
      const reply = typeof ack === "function" ? ack : () => {};
      try { const h = handlers[msg?.name]; if (!h) throw new Error("unknown request " + msg?.name); reply({ ok: true, data: await h(msg.payload || {}, ctx) }); }
      catch (e) { reply({ ok: false, error: e.message || String(e) }); }
    });
  });
  return io;
}
