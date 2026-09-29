// HTTP: the public, cacheable reads a static site or an agent calls, the embed script, the log for mirrors, and the pages.
import fastifyStatic from "@fastify/static";
import httpProxy from "@fastify/http-proxy";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as records from "./records.mjs";
import * as store from "./store.mjs";
import * as handles from "./handles.mjs";
import * as atoauth from "./atoauth.mjs";
import { randomBytes } from "node:crypto";
import { readdirSync } from "node:fs";
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
  // Sign in with an existing AT Protocol handle. The original /login query (device key, origin, return) rides in the OAuth state.
  app.get("/client-metadata.json", async (req, reply) => { reply.header("Cache-Control", "public, max-age=300"); return atoauth.clientMetadata(); });
  app.get("/jwks.json", async (req, reply) => { reply.header("Cache-Control", "public, max-age=300"); return atoauth.jwks(); });
  app.get("/atproto/login", async (req, reply) => {
    if (!atoauth.enabled()) return reply.code(503).send("sign-in with an existing handle is not available here");
    const handle = String(req.query.handle || "").trim().replace(/^@/, "").toLowerCase(); if (!/^[a-z0-9.-]{3,253}$/.test(handle) && !handle.startsWith("did:")) return reply.redirect("/login?err=" + encodeURIComponent("enter your full handle, like name.bsky.social"));
    try { const url = await atoauth.authorize(handle, JSON.stringify({ q: String(req.query.q || "") })); return reply.redirect(url.toString()); }
    catch (e) { const chain = []; for (let x = e; x && chain.length < 5; x = x.cause) chain.push(x.message); req.log.error({ chain }, "oauth authorize failed"); return reply.redirect("/login?" + new URLSearchParams({ err: "could not reach the server for " + handle + ": " + chain.join(" ← ") })); }
  });
  app.get("/atproto/callback", async (req, reply) => {
    let q = "";
    try {
      const { did, handle, state } = await atoauth.callback(new URLSearchParams(req.query));
      try { q = JSON.parse(state || "{}").q || ""; } catch {}
      const back = new URLSearchParams(q);
      const existing = store.getAccount(did);
      if (existing && store.keysOf(did).length) { back.set("handle", existing.handle); back.set("msg", "Connected. Sign in with your passkey to finish."); return reply.redirect("/login?" + back); }
      const token = randomBytes(18).toString("base64url"); store.kvSet("oauth_link", token, { did, handle, at: Date.now() });
      back.set("link", token); back.set("handle", handle || did); return reply.redirect("/login?" + back);
    } catch (e) { return reply.redirect("/login?" + new URLSearchParams({ err: "sign-in was not completed: " + e.message })); }
  });
  app.get("/moderation.json", async (req, reply) => { reply.header("Cache-Control", "public, max-age=0, s-maxage=10"); const { admins } = await import("./admin.mjs"); return { admins: admins(), actions: store.moderationLog() }; });
  app.get("/admins", async () => { const { admins } = await import("./admin.mjs"); return { admins: admins() }; });
  app.get("/tagged/:tag", async (req, reply) => { reply.header("Cache-Control", "public, max-age=0, s-maxage=10"); return { tag: req.params.tag, items: store.tagged(String(req.params.tag).toLowerCase()) }; });
  app.get("/tags.json", async (req, reply) => { reply.header("Cache-Control", "public, max-age=0, s-maxage=30"); return { tags: store.popularTags() }; });
  app.get("/bookmarks/:did", async (req, reply) => { reply.header("Cache-Control", "public, max-age=0, s-maxage=5"); return { did: req.params.did, tag: req.query.tag || null, items: store.bookmarksBy(req.params.did, req.query.tag ? String(req.query.tag).toLowerCase() : null) }; });
  app.get("/bookmark", async (req, reply) => { let subject; try { subject = (await import("../packages/orbital-attest/verify.mjs")).normalizeTarget(String(req.query.subject || "")); } catch { return reply.code(400).send({ error: "subject" }); } reply.header("Cache-Control", "no-store"); return { bookmark: store.bookmarkOf(String(req.query.did || ""), subject), counts: store.countsFor(subject) }; });
  app.get("/tag/:tag", (req, reply) => reply.type("text/html").sendFile("tag.html", join(root, "public")));
  app.get("/u/:handle", (req, reply) => reply.redirect("/" + encodeURIComponent(req.params.handle), 301));
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
  // Crumpled namespace: /<handle> is a person's page, unless a page of ours has that name (pages are reserved as handles at startup).
  const pages = readdirSync(join(root, "public"));
  app.addHook("onReady", async () => { const segs = new Set(pages); for (const r of app.printRoutes({ commonPrefix: false }).split("\n")) { const m = r.match(/\/([a-z0-9@._-]+)/i); if (m) segs.add(m[1]); } const added = handles.reserveRoots(segs); if (added.length) console.log("reserved page names as handles:", added.join(" ")); });
  app.setNotFoundHandler((req, reply) => {
    const m = req.method === "GET" && req.url.match(/^\/@?([a-z0-9][a-z0-9.-]{2,252})\/?(?:\?.*)?$/i);
    if (m && store.getAccountByHandle(m[1].toLowerCase())) return reply.type("text/html").sendFile("profile.html", join(root, "public"));
    reply.code(404).type("text/plain").send("not found");
  });
}
