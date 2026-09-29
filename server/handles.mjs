// Handle rules. A handle becomes <handle>.attest.monster, a DNS label and an AT Protocol handle segment, so it must be a
// valid hostname label; we also require a minimum length, refuse reserved names, and hold released handles for a year.
import * as store from "./store.mjs";
import { createGuard, hashWord } from "../packages/handle-guard/index.mjs";
export const MIN = 4, MAX = 20, HOLD_DAYS = 365;
const SHAPE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/; // letters, digits, single hyphens; starts with a letter; no leading/trailing/double hyphen
// On top of handle-guard's generic reserved paths: our protocol and page words, our own names and brands, and other
// networks, so nobody can pose as them.
const OURS = `
xrpc attest attests attestation monster monsters service services pds plc did lexicon lexicons relay firehose appview labeler
roadmap changes site sites tag tags read record records log claim claims vouch vouches vote votes comment comments statement
statements orbital orbitalfoundation foundation hook anselm futuresdesk desk bluesky bsky atproto tangled nostr mastodon
twitter x facebook meta google apple microsoft github openai anthropic claude ethereum bitcoin
`;
// Crumpled namespace: people live at /<handle> beside the site's own pages. Pages always win, so every top-level page file and
// route segment is reserved too; reserveRoots() is called at startup with what the server actually serves.
export const ROUTE_WORDS = "save saved bookmarks bookmark tagged install tools technical domain handle stats socket bookmarklet extension popup mascot hero attest-core style menu";
// Admin additions to the blocklist, stored only as hashes: "blockhash" blocks a normalised word as a whole handle or part,
// "allowhash" lets a whole handle through that the lists would block.
const guard = createGuard({
  extraReserved: [...OURS.trim().split(/\s+/), ...ROUTE_WORDS.split(" ")],
  block: () => new Set(store.kvList("blockhash").map((r) => r.key)),
  allow: () => new Set(store.kvList("allowhash").map((r) => r.key)),
});
export const RESERVED = guard.reserved;
export const guardCounts = guard.counts;
export const reserveRoots = (names) => guard.reserve(names, { minLength: MIN });
export function check(raw) {
  const h = String(raw || "").trim().toLowerCase();
  if (h.length < MIN) return { ok: false, error: `handles are at least ${MIN} characters` };
  if (h.length > MAX) return { ok: false, error: `handles are at most ${MAX} characters` };
  if (!SHAPE.test(h)) return { ok: false, error: "use lowercase letters, digits and single hyphens, starting with a letter" };
  if (RESERVED.has(h) || store.kvGet("reserved", h)) return { ok: false, error: "that handle is reserved" };
  if (guard.isOffensive(h)) return { ok: false, error: "please choose a different handle" };
  if (store.getAccountByHandle(h)) return { ok: false, error: "that handle is taken" };
  const held = store.releasedHandle(h); if (held && Date.now() - Date.parse(held.at) < HOLD_DAYS * 86400e3) return { ok: false, error: "that handle belonged to a deleted account and is held until " + new Date(Date.parse(held.at) + HOLD_DAYS * 86400e3).toISOString().slice(0, 10) };
  return { ok: true, handle: h };
}
export const extraReserved = () => store.kvList ? store.kvList("reserved") : [];
export { hashWord };
