// Runs ON the attest VM (piped over ssh by deploy/backup.sh, as root): a consistent copy of everything worth keeping, in
// /srv/backup-stage. Each SQLite database is copied with VACUUM INTO (a transactionally consistent copy, safe while the PDS and
// the service are writing) and checked; every other file is copied as is; -wal and -shm files are skipped (VACUUM INTO folds
// them in). Sources: /srv/pds (accounts, repos, keys, blobs) and /srv/attest/data (index, service and OAuth keys).
import { DatabaseSync } from "node:sqlite";
import { readdirSync, statSync, mkdirSync, copyFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
const STAGE = "/srv/backup-stage", SOURCES = { pds: "/srv/pds", data: "/srv/attest/data" };
rmSync(STAGE, { recursive: true, force: true });
let dbs = 0, files = 0;
const walk = (dir, out) => { for (const name of readdirSync(dir)) { const p = join(dir, name), q = join(out, name), st = statSync(p);
  if (st.isDirectory()) { walk(p, q); continue; }
  if (/\.sqlite-(wal|shm|journal)$/.test(name) || /^attest-before-.*\.sqlite$/.test(name)) continue;
  mkdirSync(dirname(q), { recursive: true });
  if (name.endsWith(".sqlite")) {
    const db = new DatabaseSync(p); db.exec(`VACUUM INTO '${q.replace(/'/g, "''")}'`); db.close();
    const c = new DatabaseSync(q, { readOnly: true }); const ok = c.prepare("PRAGMA quick_check").get(); c.close();
    if (Object.values(ok)[0] !== "ok") throw new Error("snapshot of " + p + " failed its check: " + JSON.stringify(ok)); dbs++;
  } else { copyFileSync(p, q); files++; }
} };
for (const [name, src] of Object.entries(SOURCES)) walk(src, join(STAGE, name));
console.log(`snapshot ok: ${dbs} databases, ${files} other files`);
