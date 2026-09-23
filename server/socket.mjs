// socket.io transport: one structured request {name, payload} per call, switched on a handler map, ack carries the reply.
// Server pushes "counts" to sockets subscribed to a target.
import { Server } from "socket.io";
import * as store from "./store.mjs";
import * as records from "./records.mjs";
import * as passkeys from "./passkeys.mjs";
import { didFromJwk } from "./identity.mjs";
import { allow } from "./ratelimit.mjs";
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
    const did = didFromJwk(credential.jwk);
    if (store.getAccount(did)) throw new Error("this passkey already has an account");
    store.createAccount({ did, handle: p.handle, credential });
    return { did, handle: p.handle };
  },
  // Sign-in is signing a delegation: the client builds the delegation, we hand back WebAuthn options whose challenge is its id.
  async "delegate.start"({ delegation }, ctx) {
    const { checkDelegation } = await import("./identity.mjs"); const id = await checkDelegation(delegation);
    const options = await passkeys.authenticationOptions({ origin: ctx.origin, challenge: Buffer.from(id, "hex").toString("base64url") });
    return { id, options };
  },
  async "delegate.finish"({ delegation, credentialId, assertion }, ctx) {
    return records.acceptDelegation({ envelope: { delegation, credentialId, assertion }, origin: ctx.origin });
  },
  async attest(envelope, ctx) {
    if (!allow("ip:" + ctx.ip, 60)) throw new Error("too many writes from this address; slow down");
    if (envelope?.record?.by && !allow("did:" + envelope.record.by, 30)) throw new Error("too many writes for this identity; slow down");
    return records.acceptRecord({ envelope, origin: ctx.origin });
  },
  async subscribe({ targets }, ctx) { for (const t of (targets || []).slice(0, 100)) ctx.socket.join("t:" + t); return { ok: true }; },
  async whois({ did }) { return { did, handle: records.whois(did) }; },
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
