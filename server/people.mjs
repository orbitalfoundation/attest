// Which person, if any, a subject URL is about. Records keep their subject as written; the index adds about_did, resolved
// once when the record is indexed, so a handle later reused by someone else does not move old statements to them.
import * as store from "./store.mjs";
const HOST = (process.env.CANONICAL_HOST || "attest.monster").toLowerCase();
const HANDLES = (process.env.PDS_HANDLE_DOMAIN || ".attest.monster").toLowerCase().replace(/^\./, ""); // handles live under this domain whatever the site host
export function aboutFor(target) {
  let u; try { u = new URL(target); } catch { return null; }
  const host = u.hostname.toLowerCase(), path = u.pathname.replace(/\/+$/, "");
  const byHandle = (h, via) => { const a = h && store.getAccountByHandle(h.toLowerCase()); return a && (!a.status || a.status === "active") ? { did: a.did, via } : null; };
  if (host === HOST) { const m = path.match(/^\/(?:@|u\/)?([a-z][a-z0-9-]{3,19})$/); if (m) return byHandle(m[1], "profile"); }
  if (host.endsWith("." + HANDLES) && (path === "" || path === "/")) return byHandle(host.slice(0, -HANDLES.length - 1), "profile");
  if (host === "bsky.app") {
    const m = path.match(/^\/profile\/([^/]+)$/); if (!m) return null; const x = decodeURIComponent(m[1]).toLowerCase();
    if (x.endsWith("." + HANDLES)) return byHandle(x.slice(0, -HANDLES.length - 1), "bluesky");
    if (x.startsWith("did:")) { if (store.getAccount(x)) return { did: x, via: "bluesky" }; const l = store.linkByExternal(x); return l ? { did: l.attest_did, via: "bluesky" } : null; }
    const l = store.linkByHandle(x); return l ? { did: l.attest_did, via: "bluesky" } : null;
  }
  if (path === "" || path === "/") { const c = store.verifiedClaimFor(u.origin + "/"); if (c) return { did: c, via: "site" }; }
  return null;
}
