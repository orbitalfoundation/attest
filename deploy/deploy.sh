#!/usr/bin/env bash
# Deploy attest to its exe.dev VM: rsync the repo (no node_modules/data), npm ci, restart. Manual deploy: push ≠ deploy. Usage: deploy/deploy.sh [vm]
set -euo pipefail
VM="${1:-${VM:-attest}}"; HOST="$VM.exe.xyz"; DEST="exedev@$HOST"; ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SSH="ssh -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ServerAliveInterval=5 -o ServerAliveCountMax=3"
echo "› sync → $HOST:/srv/attest"
rsync -ah --delete -e "$SSH" --exclude '.git' --exclude 'node_modules' --exclude 'data' --exclude '.env' --exclude 'deploy' --exclude 'reference' --exclude 'devlog' "$ROOT/" "$DEST:/srv/attest/"
echo "› npm ci"
$SSH "$DEST" 'cd /srv/attest && npm ci --omit=dev --no-audit --no-fund --silent 2>&1 | tail -1'
SHA="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo manual)"; git -C "$ROOT" diff --quiet 2>/dev/null || SHA="$SHA-dirty"
$SSH "$DEST" "printf '{\"sha\":\"%s\",\"at\":\"%s\"}\n' '$SHA' \"\$(date -u +%Y-%m-%dT%H:%MZ)\" > /srv/attest/public/version.json; sudo systemctl restart attest; sleep 2; systemctl is-active attest"
echo "✓ deployed $SHA → https://$HOST"
