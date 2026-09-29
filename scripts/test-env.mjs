// Tests that create accounts must delete them afterwards, which needs the PDS admin password. Against a non-local base,
// take PDS_URL and PDS_ADMIN_PASSWORD from the environment, else from the harness's private notes on this box; if neither
// has them, refuse to run rather than leave test accounts on the live site. Import this before anything reads the env.
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
export function requireCleanupCredentials(base) {
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(base)) return;
  if (!process.env.PDS_URL) process.env.PDS_URL = new URL(base).origin;
  if (!process.env.PDS_ADMIN_PASSWORD) {
    const f = `${homedir()}/projects/2027/harness/private/attest-pds.md`;
    const m = existsSync(f) && readFileSync(f, "utf8").match(/^PDS_ADMIN_PASSWORD=(\S+)/m);
    if (m) process.env.PDS_ADMIN_PASSWORD = m[1];
  }
  if (!process.env.PDS_ADMIN_PASSWORD) { console.error(`refusing to run against ${base}: set PDS_ADMIN_PASSWORD so the test can delete its accounts`); process.exit(2); }
}
