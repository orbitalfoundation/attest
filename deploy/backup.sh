#!/usr/bin/env bash
# Nightly backup of attest, run from canada1's crontab. A consistent snapshot is taken on the VM (deploy/snapshot.mjs), then
# pulled to ~/backups/attest/daily/<date>. Rotation: 14 daily copies; the first copy of each ISO week is also kept under weekly/
# (hard links, so it costs nothing extra) for 8 weeks. Secrets to restore with are in harness private/attest-pds.md.
# Restore: copy pds/ to /srv/pds and data/ to /srv/attest/data on any Linux host with the PDS env, start both, point DNS.
set -euo pipefail
SSH="ssh -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ServerAliveInterval=5"
HOST=exedev@attest.exe.xyz; ROOT=~/backups/attest; DAY=$(date +%F); D=$ROOT/daily/$DAY; LOG=$ROOT/backup.log
fail() { echo "$(date -u +%FT%TZ) FAIL $*" >> "$LOG"; exit 1; }
trap 'fail "line $LINENO"' ERR
mkdir -p "$ROOT/daily" "$ROOT/weekly"
msg=$($SSH "$HOST" 'sudo node --no-warnings --input-type=module -' < "$(dirname "$0")/snapshot.mjs")
$SSH "$HOST" 'sudo chown -R exedev:exedev /srv/backup-stage'
rsync -a --delete -e "$SSH" "$HOST:/srv/backup-stage/" "$D/"
ln -sfn "$D" "$ROOT/latest"
W=$ROOT/weekly/$(date +%G-W%V); [ -d "$W" ] || cp -al "$D" "$W"
find "$ROOT/daily" -mindepth 1 -maxdepth 1 -type d -mtime +14 -exec rm -rf {} +
ls -1d "$ROOT"/weekly/*/ 2>/dev/null | sort | head -n -8 | xargs -r rm -rf
echo "$(date -u +%FT%TZ) ok $(du -sh "$D" | cut -f1) $msg" >> "$LOG"
