// End-to-end for sign-in with an existing AT Protocol account (OAuth), run against the live site with a password account
// on any PDS: sign in there, approve attest, create a passkey, save a bookmark. STEP=full to go beyond the approval screen.
// Sign in to attest with an existing AT Protocol account through OAuth, create a passkey, save a bookmark, and check it
// landed in that account's own repository. Usage: node scripts/_oauth_e2e.mjs <account.json> <shotdir>
import WebSocket from "ws"; import { spawn } from "node:child_process"; import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"; import { homedir } from "node:os";
const pwDir = `${homedir()}/.cache/ms-playwright`; const CHROME = readdirSync(pwDir).filter((d) => d.startsWith("chromium-")).sort().map((d) => `${pwDir}/${d}/chrome-linux64/chrome`).filter(existsSync).pop();
const acct = JSON.parse(readFileSync(process.argv[2], "utf8")), shots = process.argv[3], base = "https://attest.monster", port = 9600 + Math.floor(Math.random() * 90);
const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/attest-oauth-" + port, "--window-size=420,900", "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 40; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => ws.on("open", r)); let id = 0;
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; const h = (m) => { const j = JSON.parse(m); if (j.id === i) { ws.off("message", h); j.error ? rej(new Error(j.error.message)) : res(j.result); } }; ws.on("message", h); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return "EXC " + (r.exceptionDetails.exception?.description || "").split("\n")[0]; return r.result.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let n = 0;
const shot = async (label) => { const { data } = await send("Page.captureScreenshot", { format: "png" }); const f = `${shots}/oauth-${++n}-${label}.png`; writeFileSync(f, Buffer.from(data, "base64")); console.log("shot", f, "|", await ev("location.href")); };
const controls = async () => console.log("controls:", await ev(`JSON.stringify([...document.querySelectorAll('input,button,a[role=button]')].map(e => (e.tagName + ':' + (e.type||'') + ':' + (e.name||e.id||'') + ':' + (e.innerText||e.placeholder||e.value||'').trim().slice(0,30))).slice(0,20))`));
await send("Runtime.enable"); await send("Page.enable"); await send("WebAuthn.enable", { enableUI: false });
await send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
await send("Page.navigate", { url: base + "/login?return=/me" }); await sleep(2500);
await ev(`document.getElementById('ext').value = ${JSON.stringify(acct.handle)}; document.getElementById('extgo').click(); true`); await sleep(5000);
await shot("authorize"); await controls();
const step = process.env.STEP || "explore";
if (step === "explore") { ws.close(); chrome.kill(); process.exit(0); }
// The PDS's own sign-in: React inputs need the native setter plus an input event.
const fill = (sel, v) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input', { bubbles: true })); return true; })()`);
await fill('input[name=password]', acct.password); await sleep(300);
await ev(`[...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Sign in').click(); true`); await sleep(4000);
await shot("consent"); await controls();
const approve = await ev(`(() => { const b = [...document.querySelectorAll('button')].find(b => /^(accept|authorize|allow|approve)$/i.test(b.innerText.trim())); if (b) { b.click(); return b.innerText.trim(); } return 'no approve button'; })()`);
console.log("clicked:", approve); await sleep(6000);
await shot("after-consent"); console.log("page msg:", await ev(`document.getElementById('msg')?.textContent || document.getElementById('linkedmsg')?.textContent || ''`));
if (await ev(`!!document.getElementById('linkpass') && !document.getElementById('linked').hidden`)) {
  await ev(`document.getElementById('linkpass').click(); true`);
  for (let i = 0; i < 60 && (await ev("location.pathname")) !== "/me"; i++) await sleep(250);
  console.log("after passkey:", await ev("location.pathname"), await ev(`localStorage.getItem('attest:session') ? 'session ok' : 'no session'`));
  const res = await ev(`(async () => { const A = await import('/attest-core.js'); try { const r = await A.attest('bookmark', 'https://example.com/oauth-test', { title: 'OAuth test', tags: 'test', note: 'written through the person own server' }); return JSON.stringify(r); } catch (e) { return 'ERR ' + e.message; } })()`);
  console.log("bookmark:", res);
}
ws.close(); chrome.kill(); process.exit(0);
