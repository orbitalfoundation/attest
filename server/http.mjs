// HTTP: the public, cacheable reads a static site or an agent calls, the embed script, the log for mirrors, and the pages.
import fastifyStatic from "@fastify/static";
import httpProxy from "@fastify/http-proxy";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as records from "./records.mjs";
import * as store from "./store.mjs";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL_HOST = process.env.CANONICAL_HOST || "";
const PDS_URL = process.env.PDS_URL || ""; // when set, atproto paths are proxied to the PDS behind this origin (websockets included)
export async function routes(app) {
  // One origin for passkeys: when CANONICAL_HOST is set, any other host is redirected there (GET only; sockets and writes are origin-checked anyway).
  if (CANONICAL_HOST) app.addHook("onRequest", async (req, reply) => { const h = req.hostname.split(":")[0]; const pdsPath = /^\/(xrpc|oauth|\.well-known)/.test(req.url); if (req.method === "GET" && h !== CANONICAL_HOST && !req.url.startsWith("/socket.io") && !(pdsPath && h.endsWith("." + CANONICAL_HOST))) return reply.code(301).redirect("https://" + CANONICAL_HOST + req.url); });
  if (PDS_URL) for (const prefix of ["/xrpc", "/oauth", "/.well-known/atproto-did", "/.well-known/oauth-authorization-server", "/.well-known/oauth-protected-resource", "/@atproto", "/tls-check", "/robots-pds"]) await app.register(httpProxy, { upstream: PDS_URL, prefix, rewritePrefix: prefix, websocket: prefix === "/xrpc", replyOptions: { rewriteRequestHeaders: (req, headers) => ({ ...headers, host: req.hostname, "x-forwarded-proto": "https" }) } });
  app.addHook("onSend", async (req, reply, payload) => { if (!reply.getHeader("Access-Control-Allow-Origin")) reply.header("Access-Control-Allow-Origin", "*"); return payload; });
  app.get("/read", async (req, reply) => {
    const targets = String(req.query.targets || req.query.target || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!targets.length) return reply.code(400).send({ error: "targets required" });
    reply.header("Cache-Control", "public, max-age=0, s-maxage=10"); return { targets: records.read(targets) };
  });
  app.get("/handle/:handle", async (req, reply) => { const r = records.byHandle(req.params.handle); if (!r) return reply.code(404).send({ error: "no such handle" }); reply.header("Cache-Control", "public, max-age=0, s-maxage=5"); return r; });
  app.get("/@:handle", (req, reply) => reply.type("text/html").sendFile("profile.html", join(root, "public")));
  app.get("/domain/:host", async (req, reply) => { if (!/^[a-z0-9.-]+\.[a-z]{2,}$|^localhost(:\d+)?$/i.test(req.params.host)) return reply.code(400).send({ error: "host" }); reply.header("Cache-Control", "public, max-age=0, s-maxage=30"); return store.siteSummary(req.params.host); });
  app.get("/site/:host", (req, reply) => reply.type("text/html").sendFile("site.html", join(root, "public")));
  app.get("/service", async () => ({ ...records.serviceInfo(), note: "The service's own repo and signing key; it writes verification records after checking a proof. Trust it as far as you trust this service." }));
  app.get("/by/:did", async (req, reply) => { reply.header("Cache-Control", "public, max-age=0, s-maxage=5"); return records.by(req.params.did); });
  app.get("/record", async (req, reply) => { const r = req.query.uri ? store.getRecordByUri(req.query.uri) : null; if (!r) return reply.code(404).send({ error: "no such record" }); reply.header("Cache-Control", "public, max-age=3600"); return r; });
  app.get("/record/:id", async (req, reply) => { const r = store.getRecord(req.params.id); if (!r) return reply.code(404).send({ error: "no such record" }); reply.header("Cache-Control", "public, max-age=3600"); return r; });
  app.get("/log", async (req, reply) => { reply.header("Cache-Control", "public, max-age=5"); return { entries: store.logSince(Number(req.query.since || 0), Number(req.query.limit || 500)) }; });
  app.get("/stats", async () => store.stats());
  const pkg = join(root, "packages", "orbital-attest");
  app.get("/lib/did.js", (req, reply) => reply.type("text/javascript").header("Cache-Control", "public, max-age=300").sendFile("verify.mjs", pkg));
  for (const f of ["verify.mjs", "client.mjs", "cid.mjs"]) app.get("/lib/" + f, (req, reply) => reply.type("text/javascript").header("Cache-Control", "public, max-age=300").sendFile(f, pkg));
  await app.register(fastifyStatic, { root: join(root, "public"), prefix: "/", extensions: ["html"], cacheControl: true, maxAge: "5m" });
}
