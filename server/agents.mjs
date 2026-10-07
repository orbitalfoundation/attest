// Agent registration, modelled on the "user claimed" flow of WorkOS's auth.md (workos.com/auth-md): the agent asks, the person
// confirms on attest's own page with their passkey, the agent picks up the result. What the agent ends up with is not a bearer
// token but a public, passkey-signed agent permission naming its own key, so everything it signs stays attributable.
//   1. agent  → request({ agentKey, name, purpose, permissions, limits, days })  → { code, url, token, expires }
//   2. person → opens url on attest, signed in; sees the request (pending(code)); may narrow it; signs it with their passkey
//   3. agent  → poll(token) → { status: "pending" } … then { status: "approved", id, delegation }
// Pending requests live in memory for 15 minutes; nothing about them is published until the person approves.
import { randomBytes } from "node:crypto";
import { didFromJwk, parsePermission, AGENT_COLLECTIONS } from "../packages/orbital-attest/verify.mjs";
const TTL = 15 * 60e3, byToken = new Map(), byCode = new Map();
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
const newCode = () => { let c; do { const b = randomBytes(8); c = [...b].map((x) => ALPHA[x % ALPHA.length]).join(""); c = c.slice(0, 4) + "-" + c.slice(4); } while (byCode.has(c)); return c; };
const sweep = () => { const now = Date.now(); for (const [t, r] of byToken) if (now - r.created > TTL) { byToken.delete(t); byCode.delete(r.code); } };
setInterval(sweep, 60e3).unref();
export function request({ agentKey, name, purpose = "", permissions, limits = { perDay: 50 }, days = 30 } = {}, base) {
  if (!agentKey || typeof agentKey.x !== "string" || typeof agentKey.y !== "string") throw new Error("agentKey {x,y} (a P-256 public key) is required");
  const agent = didFromJwk(agentKey);
  if (typeof name !== "string" || !/^[A-Za-z0-9][A-Za-z0-9 ._-]{0,39}$/.test(name)) throw new Error("name: 1 to 40 letters, digits, spaces, dots, dashes");
  if (typeof purpose !== "string" || purpose.length > 300) throw new Error("purpose: at most 300 characters");
  if (!Array.isArray(permissions) || !permissions.length || permissions.length > 12) throw new Error("permissions: 1 to 12 atproto repo permission strings, e.g. repo:monster.attest.comment?action=create");
  for (const p of permissions) { const q = parsePermission(p); if (!q || !AGENT_COLLECTIONS.includes(q.collection)) throw new Error("permission not allowed: " + p); }
  if (!Number.isInteger(limits?.perDay) || limits.perDay < 1 || limits.perDay > 1000) throw new Error("limits.perDay: 1 to 1000");
  if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error("days: 1 to 90");
  sweep(); if (byToken.size > 500) throw new Error("too many pending requests; try later");
  const token = randomBytes(24).toString("base64url"), code = newCode();
  const r = { token, code, created: Date.now(), status: "pending", ask: { agentKey: { x: agentKey.x, y: agentKey.y }, agent, name, purpose, permissions, limits: { perDay: limits.perDay }, days } };
  byToken.set(token, r); byCode.set(code, r);
  return { code, url: `${base}/agents/approve?code=${code}`, token, expires: new Date(r.created + TTL).toISOString() };
}
// What the approval page shows. Only someone with the code (the person the agent showed it to) can see it.
export function pending(code) { sweep(); const r = byCode.get(String(code || "").toUpperCase()); if (!r || r.status !== "pending") throw new Error("no pending request with that code; ask the agent for a new one"); return { code: r.code, ...r.ask }; }
// The person's signed permission must be for this agent's key and grant no more than it asked for.
export function check(code, d) {
  const a = pending(code);
  if (d.agent !== a.agent || d.agentKey.x !== a.agentKey.x || d.agentKey.y !== a.agentKey.y || d.name !== a.name) throw new Error("this permission is not for the agent that asked");
  for (const p of d.permissions) if (!a.permissions.includes(p)) throw new Error("grants more than the agent asked for: " + p);
  if (d.limits.perDay > a.limits.perDay) throw new Error("a higher daily limit than the agent asked for");
}
export function approve(code, id, delegation) { const r = byCode.get(code); if (r) { r.status = "approved"; r.id = id; r.delegation = delegation; } }
export function poll(token) { const r = byToken.get(String(token || "")); if (!r) return { status: "expired" }; return r.status === "approved" ? { status: "approved", id: r.id, delegation: r.delegation } : { status: "pending", code: r.code, expires: new Date(r.created + TTL).toISOString() }; }
