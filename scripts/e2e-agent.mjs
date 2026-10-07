// Agents end to end: a person signs up; an agent (this script, using packages/orbital-attest/agent.mjs) asks for a permission;
// the person approves it on attest with their passkey, narrowing the daily limit; the permission is public; the agent writes
// within it and is refused outside it (wrong kind, over the limit); its comment shows "via <name>"; a site sign-in cannot be used on
// the agents' endpoint; the person revokes the agent and its next write is refused. Usage: node scripts/e2e-agent.mjs [base]
import WebSocket from "ws"; import { spawn } from "node:child_process"; import { existsSync, readdirSync } from "node:fs"; import { homedir } from "node:os";
import * as Agent from "../packages/orbital-attest/agent.mjs";
import { requireCleanupCredentials } from "./test-env.mjs";
const pwDir = `${homedir()}/.cache/ms-playwright`; const CHROME = readdirSync(pwDir).filter((d) => d.startsWith("chromium-")).sort().map((d) => `${pwDir}/${d}/chrome-linux64/chrome`).filter(existsSync).pop();
const base = process.argv[2] || "http://localhost:8100"; requireCleanupCredentials(base); const port = 9500 + Math.floor(Math.random() * 90);
const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/attest-agent-" + port, "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 40; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => ws.on("open", r)); let id = 0;
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; const h = (m) => { const j = JSON.parse(m); if (j.id === i) { ws.off("message", h); j.error ? rej(new Error(j.error.message)) : res(j.result); } }; ws.on("message", h); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return "EXC " + (r.exceptionDetails.exception?.description || "").split("\n")[0]; return r.result.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0; const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) fails++; };
const waitFor = async (e, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(e) === true) return true; await sleep(250); } return false; };
const shot = async (name) => { if (!process.env.SHOTS) return; await send("Emulation.setDeviceMetricsOverride", { width: 420, height: 1100, deviceScaleFactor: 1, mobile: true }); const { data } = await send("Page.captureScreenshot", { format: "png" }); (await import("node:fs")).writeFileSync(process.env.SHOTS + "/" + name + ".png", Buffer.from(data, "base64")); };
const refused = async (p) => { try { await p; return "accepted"; } catch (e) { return e.message; } };
let root = null;
try {
  await send("Runtime.enable"); await send("Page.enable"); await send("WebAuthn.enable", { enableUI: false });
  await send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  const handle = "ag" + Math.random().toString(36).slice(2, 8);
  await send("Page.navigate", { url: base + "/login?return=/me" }); await waitFor(`!!document.getElementById('register')?.onclick`); await sleep(800);
  await ev(`document.getElementById('handle').value = ${JSON.stringify(handle)}; document.getElementById('register').click(); true`);
  ok(await waitFor(`location.pathname === '/me'`, 20000), "person registered: @" + handle);
  const sess = JSON.parse(await ev(`localStorage.getItem('attest:session')`)); root = sess.root;

  console.log("the agent asks");
  const key = await Agent.createKey();
  const ask = await Agent.requestAccess({ server: base, key, name: "test-agent", purpose: "end-to-end test of agents", permissions: ["repo:monster.attest.comment?action=create&action=delete", "repo:monster.attest.bookmark?action=create"], limits: { perDay: 5 }, days: 7 });
  ok(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(ask.code) && ask.url.includes("/agents/approve?code=" + ask.code), "request returns a code and an approval link: " + ask.code);
  const greedy = await refused(Agent.requestAccess({ server: base, key, name: "x", permissions: ["repo:app.bsky.feed.post"] }));
  ok(/not allowed/.test(greedy), "a permission outside attest's own record types is refused: " + greedy);

  console.log("the person approves, narrowing it");
  await send("Page.navigate", { url: ask.url }); await waitFor(`!!document.getElementById('ok')`);
  ok(await ev(`document.querySelector('.code').textContent === ${JSON.stringify(ask.code)} && document.body.innerText.includes('write, retract comments') && document.body.innerText.includes('test-agent')`) === true, "approval page shows the code, the agent and what it may do in plain words");
  await shot("approve");
  await ev(`document.querySelector('[data-p*="bookmark"]').checked = false; document.getElementById('perday').value = 2; document.getElementById('ok').click(); true`);
  ok(await waitFor(`document.body.innerText.includes('Approved.')`, 15000), "approved with the passkey: " + (await ev(`document.getElementById('msg').textContent`)));
  const grant = await Agent.waitForApproval({ server: base, token: ask.token, every: 500 });
  ok(grant.delegation.root === root && grant.delegation.limits.perDay === 2 && grant.delegation.permissions.length === 1 && grant.delegation.permissions[0].includes("comment"), "the agent picks up the permission as narrowed: comments only, 2 a day");

  console.log("the permission is public");
  const pub = await (await fetch(base + "/agent/" + grant.id, { headers: { accept: "application/json" } })).json();
  ok(pub.handle === handle && pub.name === "test-agent" && pub.purpose && pub.limits.perDay === 2 && !pub.revoked, "GET /agent/:id: who it acts for and its bounds");
  const prof = await (await fetch(base + "/by/" + encodeURIComponent(root))).json();
  ok(prof.agents?.some((a) => a.id === grant.id) && !prof.delegations.some((d) => d.id === grant.id), "the profile lists it under agents, not sign-ins");
  const log = (await (await fetch(base + "/log?since=0&limit=2000")).json()).entries.find((e) => e.type === "agent" && e.id === grant.id);
  ok(log?.assertion && log.delegation.agent === key.did, "the log holds the passkey's signature over it");

  await send("Page.navigate", { url: base + "/agent/" + grant.id }); await waitFor(`document.getElementById("h").textContent === "test-agent"`); await shot("agent-public");
  console.log("the agent acts within it");
  const me = Agent.agent({ server: base, key, grant });
  const target = "https://example.org/agent-test-" + handle;
  const c1 = await me.attest("comment", target, { body: "written by an agent" });
  ok(/^at:\/\//.test(c1.uri) && c1.uri.includes(root), "comment written into the person's repository: " + c1.uri);
  const rd = (await (await fetch(base + "/read?targets=" + encodeURIComponent(target))).json()).targets[target];
  ok(rd.comments[0]?.via === "test-agent" && rd.comments[0]?.handle === handle, "the comment is attributed to the person, via the agent");
  const v = await refused(me.attest("vouch", "did:plc:i44evao7r4qeg5373thidnqk"));
  ok(/not permitted/.test(v), "outside its permission (a vouch) it is refused: " + v);
  await me.attest("comment", target, { body: "second" });
  const third = await refused(me.attest("comment", target, { body: "third" }));
  ok(/limit of 2/.test(third), "over its daily limit it is refused: " + third);
  const rt = await me.retract(c1.uri); ok(rt.retracted === true, "it may retract its own comment (delete permitted)");
  const misuse = await refused(fetch(base + "/agent/attest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ collection: "monster.attest.comment", record: { $type: "monster.attest.comment" }, del: sess.id }) }).then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; }));
  ok(/for agents/.test(misuse), "a site sign-in cannot be used on the agents' endpoint: " + misuse);

  console.log("the person revokes it");
  await send("Page.navigate", { url: base + "/me" }); await waitFor(`!!document.querySelector('#agents [data-revoke="${grant.id}"]')`, 15000);
  ok(await ev(`document.querySelector('#agents').innerText.includes('test-agent')`) === true, "/me lists the agent");
  await ev(`document.querySelector('#agents [data-revoke="${grant.id}"]').click(); true`);
  ok(await waitFor(`document.getElementById('keymsg')?.textContent === 'Agent revoked.'`, 15000), "revoked with the passkey: " + await ev(`document.getElementById('keymsg')?.textContent`));
  const after = await refused(me.attest("comment", target, { body: "after revoke" }));
  ok(/revoked/.test(after), "after revoking, its writes are refused: " + after);
  ok(!!(await me.status()).revoked, "the public permission shows it revoked");
} catch (e) { ok(false, "crashed: " + e.message); }
finally {
  if (root && process.env.PDS_URL && process.env.PDS_ADMIN_PASSWORD) { try { const pds = await import("../server/pds.mjs"); await pds.deleteAccount(root); console.log("  · test account deleted from the PDS"); } catch (e) { console.log("  · cleanup failed:", e.message); } }
  console.log(fails ? `${fails} FAILED` : "all passed"); ws.close(); chrome.kill(); process.exit(fails ? 1 : 0);
}
