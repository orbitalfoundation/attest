// handle-guard: check a proposed public handle (username, subdomain, URL segment) against offensive words kept only as
// SHA-256 hashes, and against reserved paths. No offensive word appears in plaintext in this package. See README.md.
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { RESERVED_PATHS } from "./reserved.mjs";
export { RESERVED_PATHS };

// Leetspeak digits and symbols read as the letters they stand in for.
const LEET = { 0: "o", 1: "i", 2: "z", 3: "e", 4: "a", 5: "s", 6: "g", 7: "t", 8: "b", 9: "g", "@": "a", "$": "s", "!": "i", "|": "i", "+": "t" };
/** Lowercase, strip accents, read leetspeak as letters, drop everything but a–z. The build uses the same function. */
export const normalizeWord = (w) => String(w || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[0-9@$!|+]/g, (c) => LEET[c]).replace(/[^a-z]/g, "");
export const sha = (s) => createHash("sha256").update(s).digest("hex");
/** The hash under which a word is stored: SHA-256 of its normalised form. Use it to keep your own additions as hashes. */
export const hashWord = (w) => sha(normalizeWord(w));

// Variants of one normalised string: runs of three or more letters shortened to one and to two, each also with v read as u.
const forms = (s) => { const base = [s, s.replace(/(.)\1{2,}/g, "$1"), s.replace(/(.)\1{2,}/g, "$1$1")]; return [...new Set([...base, ...base.map((x) => x.replace(/v/g, "u"))])]; };
const asSet = (x) => (typeof x === "function" ? asSet(x()) : x instanceof Set ? x : new Set(x || []));

let shipped;
/** The shipped hash lists: { exact, anywhere, generated, sources }. */
export function shippedLists() {
  if (!shipped) { const f = new URL("./blocklist.json", import.meta.url); shipped = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : { exact: [], anywhere: [] }; }
  return shipped;
}

/**
 * Make a guard.
 *  words     true (default) for the shipped lists, false for none, or { exact, anywhere } arrays of hashes.
 *  reserved  true (default) for RESERVED_PATHS, false for none, or your own iterable of names.
 *  extraReserved  names to reserve on top.
 *  block     hashes (from hashWord) that block as a whole handle or hyphen part; a Set, array, or function returning one,
 *            so a database-backed list stays current.
 *  allow     hashes of whole handles to let through even if the lists would block them (a real name the lists catch).
 */
export function createGuard({ words = true, reserved = true, extraReserved = [], block = [], allow = [] } = {}) {
  const lists = words === true ? shippedLists() : words || { exact: [], anywhere: [] };
  const EXACT = new Set(lists.exact || []), ANYWHERE = new Set(lists.anywhere || []);
  const RESERVED = new Set([...(reserved === true ? RESERVED_PATHS : reserved || []), ...extraReserved].map((w) => String(w).toLowerCase()));

  function isOffensive(handle) {
    const whole = normalizeWord(handle);
    if (!whole || asSet(allow).has(sha(whole))) return false;
    const extra = asSet(block);
    const parts = String(handle).toLowerCase().split(/[-_.]/).map(normalizeWord).filter(Boolean);
    for (const p of new Set([whole, ...parts])) for (const f of forms(p)) { const h = sha(f); if (EXACT.has(h) || ANYWHERE.has(h) || extra.has(h)) return true; }
    if (ANYWHERE.size) for (const f of forms(whole)) for (let i = 0; i < f.length; i++) for (let j = i + 4; j <= f.length; j++) if (ANYWHERE.has(sha(f.slice(i, j)))) return true;
    return false;
  }
  const isReserved = (handle) => RESERVED.has(String(handle).trim().toLowerCase());
  return {
    isOffensive, isReserved, reserved: RESERVED,
    /** { ok: true } or { ok: false, reason: "reserved" | "offensive" }. Shape, length and uniqueness are the caller's rules. */
    check(handle) { if (isReserved(handle)) return { ok: false, reason: "reserved" }; if (isOffensive(handle)) return { ok: false, reason: "offensive" }; return { ok: true }; },
    /** Reserve more names, e.g. the site's own page files ("about.html" reserves "about"). Returns those newly added. */
    reserve(names, { minLength = 1 } = {}) { const added = []; for (const n of names) { const w = String(n).toLowerCase().replace(/\.[a-z0-9]+$/, ""); if (w.length >= minLength && !RESERVED.has(w)) { RESERVED.add(w); added.push(w); } } return added; },
    counts: () => ({ exact: EXACT.size, anywhere: ANYWHERE.size, reserved: RESERVED.size, generated: lists.generated || null }),
  };
}
