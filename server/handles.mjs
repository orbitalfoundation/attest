// Handle rules. A handle becomes <handle>.attest.monster, a DNS label and an AT Protocol handle segment, so it must be a
// valid hostname label; we also require a minimum length, refuse reserved names, and hold released handles for a year.
import * as store from "./store.mjs";
import { isBlocked, normalizeWord, sha } from "./blocklist.mjs";
export const MIN = 4, MAX = 20, HOLD_DAYS = 365;
const SHAPE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/; // letters, digits, single hyphens; starts with a letter; no leading/trailing/double hyphen
// Roles, infrastructure subdomains, our own pages and brands, other networks, and words that would mislead as an identity.
export const RESERVED = new Set(`
admin administrator root system sysadmin support help helpdesk contact info team staff official owner moderator moderation
mod mods abuse security safety trust privacy legal terms policy copyright dmca report reports postmaster hostmaster webmaster
noreply no-reply mailer daemon www www1 mail email smtp imap pop ftp ns1 ns2 dns cdn static assets media img images api xrpc
oauth auth login logout signin signup register account accounts settings profile profiles user users member members me you
self everyone anyone nobody somebody null undefined none true false test tests testing demo example sample guest anonymous
anon attest attests attestation monster monsters service services pds plc did lexicon lexicons relay firehose appview labeler
about docs doc faq roadmap changes blog news status health version site sites tag tags search explore home dashboard feed
read record records log verify verification claim claims vouch vouches vote votes comment comments statement statements
orbital orbitalfoundation foundation hook anselm futuresdesk desk bluesky bsky atproto tangled nostr mastodon twitter x
facebook meta google apple microsoft github openai anthropic claude ethereum bitcoin
`.trim().split(/\s+/));
// Crumpled namespace: people live at /<handle> beside the site's own pages. Pages always win, so every top-level page file and
// route segment is reserved too; reserveRoots() is called at startup with what the server actually serves.
export const ROUTE_WORDS = "save saved bookmarks bookmark tagged tags manifest install tools technical domain handle record read stats service socket share bookmark bookmarklet extension popup embed widget tag tags new create edit delete privacy terms donate sponsor contact press robots sitemap favicon mascot hero attest-core version style menu";
for (const w of ROUTE_WORDS.split(" ")) RESERVED.add(w);
export function reserveRoots(names) { const added = []; for (const n of names) { const w = String(n).toLowerCase().replace(/\.[a-z0-9]+$/, ""); if (w.length >= MIN && !RESERVED.has(w)) { RESERVED.add(w); added.push(w); } } return added; }
export function check(raw) {
  const h = String(raw || "").trim().toLowerCase();
  if (h.length < MIN) return { ok: false, error: `handles are at least ${MIN} characters` };
  if (h.length > MAX) return { ok: false, error: `handles are at most ${MAX} characters` };
  if (!SHAPE.test(h)) return { ok: false, error: "use lowercase letters, digits and single hyphens, starting with a letter" };
  if (RESERVED.has(h) || store.kvGet("reserved", h)) return { ok: false, error: "that handle is reserved" };
  if (isBlocked(h, extraBlocklist())) return { ok: false, error: "please choose a different handle" };
  if (store.getAccountByHandle(h)) return { ok: false, error: "that handle is taken" };
  const held = store.releasedHandle(h); if (held && Date.now() - Date.parse(held.at) < HOLD_DAYS * 86400e3) return { ok: false, error: "that handle belonged to a deleted account and is held until " + new Date(Date.parse(held.at) + HOLD_DAYS * 86400e3).toISOString().slice(0, 10) };
  return { ok: true, handle: h };
}
export const extraReserved = () => store.kvList ? store.kvList("reserved") : [];
// Admin additions to the blocklist, stored only as hashes: "blockhash" blocks a normalised word as a whole handle or part,
// "allowhash" lets a whole handle through that the lists would block.
export const extraBlocklist = () => ({ exact: new Set(store.kvList("blockhash").map((r) => r.key)), allow: new Set(store.kvList("allowhash").map((r) => r.key)) });
export const hashWord = (w) => sha(normalizeWord(w));
