// Handle check against hashed word lists (server/blocklist.json, built by scripts/build-blocklist.mjs) plus hashes admins
// add. Only hashes are stored; no offensive word appears in plaintext in this code. A hash list is not secret (anyone can
// hash a dictionary); the point is to keep the words out of the code, not to hide which words are blocked.
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
const LEET = { 0: "o", 1: "i", 2: "z", 3: "e", 4: "a", 5: "s", 6: "g", 7: "t", 8: "b", 9: "g", "@": "a", "$": "s", "!": "i", "|": "i", "+": "t" };
export const normalizeWord = (w) => String(w || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[0-9@$!|+]/g, (c) => LEET[c]).replace(/[^a-z]/g, "");
export const sha = (w) => createHash("sha256").update(w).digest("hex");
const file = new URL("./blocklist.json", import.meta.url);
const data = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { exact: [], anywhere: [] };
const EXACT = new Set(data.exact), ANYWHERE = new Set(data.anywhere);
// Forms of one string: as normalised, with runs of three or more letters shortened to one and to two ("aaab" → "ab", "aab"),
// each also with v read as u.
const forms = (s) => { const base = [s, s.replace(/(.)\1{2,}/g, "$1"), s.replace(/(.)\1{2,}/g, "$1$1")]; return [...new Set([...base, ...base.map((x) => x.replace(/v/g, "u"))])]; };
export function isBlocked(handle, extra = { exact: new Set(), allow: new Set() }) {
  const parts = String(handle).toLowerCase().split("-").map(normalizeWord).filter(Boolean);
  const whole = normalizeWord(handle);
  if (extra.allow.has(sha(whole))) return false;
  for (const p of [whole, ...parts]) for (const f of forms(p)) { const h = sha(f); if (EXACT.has(h) || ANYWHERE.has(h) || extra.exact.has(h)) return true; }
  for (const f of forms(whole)) for (let i = 0; i < f.length; i++) for (let j = i + 4; j <= f.length; j++) if (ANYWHERE.has(sha(f.slice(i, j)))) return true;
  return false;
}
export const counts = () => ({ exact: EXACT.size, anywhere: ANYWHERE.size, generated: data.generated || null });
