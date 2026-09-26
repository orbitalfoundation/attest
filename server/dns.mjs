// Handle → DID binding by DNS, the AT Protocol way (_atproto.<handle> TXT "did=…"), through the Cloudflare zone API.
// Needs CF_TOKEN (a DNS-edit token for the zone) and CF_ZONE. Without them, handles resolve only through the PDS's own
// /.well-known/atproto-did on the handle's hostname, which needs the wildcard certificate.
const TOKEN = process.env.CF_TOKEN || "", ZONE = process.env.CF_ZONE || "";
export const enabled = () => !!(TOKEN && ZONE);
async function cf(method, path, body) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE}${path}`, { method, headers: { authorization: "Bearer " + TOKEN, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  const j = await r.json(); if (!j.success) throw new Error("cloudflare: " + JSON.stringify(j.errors).slice(0, 200)); return j.result;
}
export async function bindHandle(handle, did) {
  const name = "_atproto." + handle, content = "did=" + did;
  const existing = await cf("GET", `/dns_records?type=TXT&name=${encodeURIComponent(name)}`);
  if (existing.some((r) => r.content.replace(/^"|"$/g, "") === content)) return { name, content, existed: true };
  for (const r of existing) await cf("DELETE", `/dns_records/${r.id}`);
  await cf("POST", "/dns_records", { type: "TXT", name, content, ttl: 300 }); return { name, content };
}
export async function unbindHandle(handle) { const name = "_atproto." + handle; for (const r of await cf("GET", `/dns_records?type=TXT&name=${encodeURIComponent(name)}`)) await cf("DELETE", `/dns_records/${r.id}`); }
export async function bindLexicon(authority, did) {
  const name = "_lexicon." + authority, content = "did=" + did;
  const existing = await cf("GET", `/dns_records?type=TXT&name=${encodeURIComponent(name)}`);
  if (existing.some((r) => r.content.replace(/^"|"$/g, "") === content)) return { name, content, existed: true };
  for (const r of existing) await cf("DELETE", `/dns_records/${r.id}`);
  await cf("POST", "/dns_records", { type: "TXT", name, content, ttl: 300 }); return { name, content };
}
