// Proof of control, Keybase-style. A key claims a handle or URL; the token attest-proof:<claim id> must appear where only the
// controller could put it; the service fetches, and on success signs a `verify` record referencing the claim.
import * as store from "./store.mjs";
import * as records from "./records.mjs";
import { resolveTxt } from "node:dns/promises";
const UA = "attest-proof-check/0.1 (+https://attest.monster/docs)";
const lastCheck = new Map();
async function text(url, max = 512 * 1024) {
  const r = await fetch(url, { headers: { "user-agent": UA, accept: "text/plain, text/html, application/json;q=0.9, */*;q=0.5" }, redirect: "follow", signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error(url + " → HTTP " + r.status);
  const buf = await r.arrayBuffer(); return new TextDecoder().decode(buf.slice(0, max));
}
export const tokenFor = (claimId) => "attest-proof:" + claimId;
export function instructions(target, claimId) {
  const t = tokenFor(claimId);
  if (/^https?:\/\//.test(target)) { const o = new URL(target).origin; return `Put the text ${t} anywhere on ${target}, or in a file at ${o}/.well-known/attest.txt.`; }
  if (target.startsWith("github:")) return `Create a public gist as ${target.slice(7)} containing the text ${t}.`;
  if (target.startsWith("bsky:")) return `Put the text ${t} in the bio (description) of ${target.slice(5)} on Bluesky.`;
  if (target.startsWith("dns:")) return `Add a TXT record at _attest.${target.slice(4)} with the value ${t}.`;
  return `Unsupported target type for automatic checking; another key can still verify it by hand.`;
}
// Returns {evidence} on success, throws with a reason otherwise.
async function locate(target, token) {
  if (/^https?:\/\//.test(target)) {
    const o = new URL(target).origin;
    try { if ((await text(target)).includes(token)) return { evidence: target }; } catch (e) { var first = e.message; }
    try { if ((await text(o + "/.well-known/attest.txt")).includes(token)) return { evidence: o + "/.well-known/attest.txt" }; } catch (e) { throw new Error("token not found at " + target + (first ? " (" + first + ")" : "") + " nor at " + o + "/.well-known/attest.txt"); }
    throw new Error("token not found at " + target + " nor in /.well-known/attest.txt");
  }
  if (target.startsWith("github:")) {
    const user = target.slice(7); const gists = JSON.parse(await text(`https://api.github.com/users/${encodeURIComponent(user)}/gists?per_page=30`));
    for (const g of gists.slice(0, 30)) for (const f of Object.values(g.files || {}).slice(0, 5)) { try { if ((await text(f.raw_url, 64 * 1024)).includes(token)) return { evidence: g.html_url }; } catch {} }
    throw new Error("no public gist by " + user + " contains the token");
  }
  if (target.startsWith("bsky:")) {
    const h = target.slice(5); const p = JSON.parse(await text(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(h)}`));
    if ((p.description || "").includes(token)) return { evidence: "https://bsky.app/profile/" + h }; throw new Error("the Bluesky bio of " + h + " does not contain the token");
  }
  if (target.startsWith("dns:")) {
    const d = target.slice(4); let txt = []; try { txt = (await resolveTxt("_attest." + d)).map((a) => a.join("")); } catch (e) { throw new Error("no TXT record at _attest." + d + " (" + e.code + ")"); }
    if (txt.some((v) => v.includes(token))) return { evidence: "dns:_attest." + d }; throw new Error("TXT at _attest." + d + " does not contain the token");
  }
  throw new Error("unsupported target type");
}
export async function check(claimId) {
  const c = store.getRecord(claimId); if (!c || c.record.kind !== "claim" || c.retracted) throw new Error("no such live claim");
  const t = lastCheck.get(claimId) || 0; if (Date.now() - t < 30e3) throw new Error("checked less than 30 s ago; wait"); lastCheck.set(claimId, Date.now());
  const { evidence } = await locate(c.record.target, tokenFor(claimId));
  const v = await records.serviceRecord("verify", c.record.target, { ref: claimId, body: evidence });
  return { verified: true, evidence, verification: v.id, by: records.serviceDid() };
}
