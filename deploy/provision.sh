#!/usr/bin/env bash
# Provision the attest VM on exe.dev: Node 22, rsync, /srv/attest, one systemd unit on :8100. Usage: deploy/provision.sh [vm]
set -euo pipefail
VM="${1:-${VM:-attest}}"; HOST="$VM.exe.xyz"; DEST="exedev@$HOST"
SSH="ssh -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR -o ServerAliveInterval=5 -o ServerAliveCountMax=3"
echo "› node 22 + rsync"
$SSH "$DEST" 'node -e "process.exit(+process.versions.node.split(\".\")[0] >= 22 ? 0 : 1)" 2>/dev/null || { curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs; }; sudo apt-get install -y -q rsync >/dev/null; node --version'
echo "› dirs + unit"
$SSH "$DEST" 'sudo mkdir -p /srv/attest/data && sudo chown -R exedev:exedev /srv'
$SSH "$DEST" "sudo tee /etc/systemd/system/attest.service >/dev/null" <<'UNIT'
[Unit]
Description=attest — signed attestations service (fastify + socket.io + sqlite)
After=network-online.target

[Service]
User=exedev
WorkingDirectory=/srv/attest
Environment=PORT=8100
Environment=HOST=0.0.0.0
Environment=ATTEST_DB=/srv/attest/data/attest.sqlite
ExecStart=/usr/bin/node /srv/attest/server/index.mjs
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT
$SSH "$DEST" 'sudo systemctl daemon-reload && sudo systemctl enable attest >/dev/null 2>&1'
echo "✓ provisioned $HOST. Next: deploy/deploy.sh, then: ssh exe.dev share port $VM 8100 && ssh exe.dev share set-public $VM"
