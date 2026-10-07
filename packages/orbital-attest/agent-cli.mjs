#!/usr/bin/env node
// attest-agent: act on attest as an agent for a person, from a terminal.
//   attest-agent request --name claude-code --purpose "files reading notes" --allow bookmark,comment [--per-day 50] [--days 30]
//   attest-agent attest bookmark https://example.org/x --title "A page" --tags "reading-room trust" --note "why it matters"
//   attest-agent attest comment https://example.org/x --body "…"        attest-agent retract at://…        attest-agent status
// Options: --server (default https://attest.monster, or ATTEST_SERVER), --file (default ~/.config/attest-agent/<name or default>.json;
// it holds the agent's private key: keep it private). --allow takes record kinds (vote, comment, statement, vouch, claim, bookmark);
// each becomes "repo:monster.attest.<kind>?action=create&action=delete".
import * as Agent from "./agent.mjs";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir } from "node:os"; import { dirname, join } from "node:path";
const argv = process.argv.slice(2), cmd = argv.shift(), pos = [], opt = {};
for (let i = 0; i < argv.length; i++) { if (argv[i].startsWith("--")) opt[argv[i].slice(2)] = argv[i + 1]?.startsWith("--") || argv[i + 1] === undefined ? true : argv[++i]; else pos.push(argv[i]); }
const server = opt.server || process.env.ATTEST_SERVER || "https://attest.monster";
const file = opt.file || join(homedir(), ".config", "attest-agent", (opt.name || "default").replace(/[^A-Za-z0-9._-]/g, "_") + ".json");
const load = () => { if (!existsSync(file)) throw new Error("no agent at " + file + "; run: attest-agent request --name …"); return JSON.parse(readFileSync(file, "utf8")); };
const save = (o) => { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(o, null, 2), { mode: 0o600 }); };
const KINDS = { vote: "vote", upvote: "vote", comment: "comment", statement: "statement", vouch: "vouch", claim: "claim", bookmark: "bookmark" };
try {
  if (cmd === "request") {
    if (!opt.name || !opt.allow) throw new Error("--name and --allow are required");
    const permissions = String(opt.allow).split(",").map((k) => { const c = KINDS[k.trim()]; if (!c) throw new Error("unknown kind " + k); return `repo:monster.attest.${c}?action=create&action=delete`; });
    const key = existsSync(file) ? load().key : await Agent.createKey();
    const ask = await Agent.requestAccess({ server, key, name: opt.name, purpose: opt.purpose || "", permissions, limits: { perDay: Number(opt["per-day"] || 50) }, days: Number(opt.days || 30) });
    save({ server, key, pending: ask.token });
    console.log(`Ask the person to open:\n\n  ${ask.url}\n\nand check the code is ${ask.code}. Waiting (until ${ask.expires})…`);
    const grant = await Agent.waitForApproval({ server, token: ask.token });
    save({ server, key, grant }); console.log(`Approved: acting for ${grant.delegation.root} as "${grant.delegation.name}" until ${grant.delegation.until}.\nPublic permission: ${server}/agent/${grant.id}\nKey saved in ${file}`);
  } else if (cmd === "attest") {
    const a = load(); const me = Agent.agent({ server: a.server, key: a.key, grant: a.grant });
    const [kind, target] = pos; const r = await me.attest(kind, target, { body: opt.body, reason: opt.reason, title: opt.title, tags: opt.tags, note: opt.note });
    console.log(JSON.stringify(r));
  } else if (cmd === "retract") {
    const a = load(); console.log(JSON.stringify(await Agent.agent({ server: a.server, key: a.key, grant: a.grant }).retract(pos[0])));
  } else if (cmd === "status") {
    const a = load(); console.log(JSON.stringify(await Agent.agent({ server: a.server, key: a.key, grant: a.grant }).status(), null, 2));
  } else { console.log("usage: attest-agent request|attest|retract|status (see the top of this file)"); process.exit(cmd ? 1 : 0); }
} catch (e) { console.error("attest-agent: " + e.message); process.exit(1); }
