// HTTP: the public, cacheable reads a static site or an agent calls, the embed script, the log for mirrors, and the pages.
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as records from "./records.mjs";
import * as store from "./store.mjs";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL_HOST = process.env.CANONICAL_HOST || "";
export async function routes(app) {
  // One origin for passkeys: when CANONICAL_HOST is set, any other host is redirected there (GET only; sockets and writes are origin-checked anyway).
  if (CANONICAL_HOST) app.addHook("onRequest", async (req, reply) => { if (req.method === "GET" && req.hostname !== CANONICAL_HOST && !req.url.startsWith("/socket.io")) return reply.code(301).redirect("https://" + CANONICAL_HOST + req.url); });
  app.addHook("onSend", async (req, reply, payload) => { reply.header("Access-Control-Allow-Origin", "*"); return payload; });
  app.get("/read", async (req, reply) => {
    const targets = String(req.query.targets || req.query.target || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!targets.length) return reply.code(400).send({ error: "targets required" });
    reply.header("Cache-Control", "public, max-age=0, s-maxage=10"); return { targets: records.read(targets) };
  });
  app.get("/handle/:handle", async (req, reply) => { const r = records.byHandle(req.params.handle); if (!r) return reply.code(404).send({ error: "no such handle" }); reply.header("Cache-Control", "public, max-age=0, s-maxage=5"); return r; });
  app.get("/@:handle", (req, reply) => reply.type("text/html").sendFile("profile.html", join(root, "public")));
  app.get("/service", async () => ({ did: records.serviceDid(), handle: "attest", note: "The service's own key; it signs verify records after checking a proof. Trust it as far as you trust this service." }));
  app.get("/by/:did", async (req, reply) => { reply.header("Cache-Control", "public, max-age=0, s-maxage=5"); return records.by(req.params.did); });
  app.get("/record/:id", async (req, reply) => { const r = store.getRecord(req.params.id); if (!r) return reply.code(404).send({ error: "no such record" }); reply.header("Cache-Control", "public, max-age=3600"); return r; });
  app.get("/log", async (req, reply) => { reply.header("Cache-Control", "public, max-age=5"); return { entries: store.logSince(Number(req.query.since || 0), Number(req.query.limit || 500)) }; });
  app.get("/stats", async () => store.stats());
  const pkg = join(root, "packages", "orbital-attest");
  app.get("/lib/did.js", (req, reply) => reply.type("text/javascript").header("Cache-Control", "public, max-age=300").sendFile("verify.mjs", pkg));
  app.get("/lib/verify.mjs", (req, reply) => reply.type("text/javascript").header("Cache-Control", "public, max-age=300").sendFile("verify.mjs", pkg));
  app.get("/lib/client.mjs", (req, reply) => reply.type("text/javascript").header("Cache-Control", "public, max-age=300").sendFile("client.mjs", pkg));
  await app.register(fastifyStatic, { root: join(root, "public"), prefix: "/", extensions: ["html"], cacheControl: true, maxAge: "5m" });
}
