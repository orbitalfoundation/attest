// Cross-origin end-to-end: a page on one origin embeds the widget from the service on another. Headless Chrome cannot open
// the sign-in popup (window.open stalls under CDP), so the test does what the popup does: it opens the service's login page
// in a second tab with the page's device key and origin, registers with a virtual authenticator, and hands the resulting
// session to the page the way postMessage would. Then it checks the page can sign, and that the same delegation is refused
// from any other origin. Usage: node scripts/e2e-cross.mjs [site] [service]
import WebSocket from "ws"; import { spawn } from "node:child_process"; import { existsSync, readdirSync } from "node:fs"; import { homedir } from "node:os";
const pwDir = `${homedir()}/.cache/ms-playwright`; const pw = existsSync(pwDir) ? readdirSync(pwDir).filter((d) => d.startsWith("chromium-")).sort().map((d) => `${pwDir}/${d}/chrome-linux64/chrome`).filter(existsSync).pop() : null;
const CHROME = process.env.CHROME || pw || "chromium"; const site = process.argv[2] || "http://localhost:8101", service = process.argv[3] || "http://localhost:8100"; const port = 9600 + Math.floor(Math.random() * 100);
const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/attest-cross-" + port, "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 40; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); const ws = new WebSocket(webSocketDebuggerUrl); await new Promise((r) => ws.on("open", r)); let id = 0; const sessions = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; const h = (m) => { const j = JSON.parse(m); if (j.id === i) { ws.off("message", h); j.error ? rej(new Error(j.error.message)) : res(j.result); } }; ws.on("message", h); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
ws.on("message", (m) => { const j = JSON.parse(m); if (j.method === "Target.attachedToTarget") sessions.set(j.params.targetInfo.targetId, j.params.sessionId); if (j.method === "Runtime.exceptionThrown") console.error("  EXCEPTION", j.params.exceptionDetails.exception?.description?.split("\n")[0]); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0; const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) fails++; };
const evalIn = async (s, expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, s); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed"); return r.result.value; };
const waitFor = async (s, expr, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await evalIn(s, expr)) return true; } catch {} await sleep(200); } return false; };
const tab = async (url) => { const { targetId } = await send("Target.createTarget", { url: "about:blank" }); await sleep(400); const s = sessions.get(targetId); await send("Runtime.enable", {}, s); await send("Page.enable", {}, s); await send("Page.navigate", { url }, s); await sleep(1800); return s; };
await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
const page = await tab(site + "/");
ok(await evalIn(page, `!!document.querySelector('[data-attest] .up')`), "widget mounted on the third-party page " + site);
const dev = JSON.parse(await evalIn(page, `(async () => { const A = await import(${JSON.stringify(service + "/attest-core.js")}); const d = await A.deviceKey(); return JSON.stringify({ did: d.did, jwk: d.jwk }); })()`));
ok(dev.did.startsWith("did:key:zDna"), "page has its own device key " + dev.did.slice(0, 20) + "…");
const keyParam = Buffer.from(JSON.stringify(dev.jwk)).toString("base64url");
const login = await tab(`${service}/login?device=${encodeURIComponent(dev.did)}&key=${encodeURIComponent(keyParam)}&origin=${encodeURIComponent(site)}`);
await send("WebAuthn.enable", { enableUI: false }, login);
await send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } }, login);
ok(await evalIn(login, `document.getElementById('for').textContent.includes(${JSON.stringify(site)})`), "login page names the requesting origin");
const handle = "x" + Math.random().toString(36).slice(2, 7);
await evalIn(login, `document.getElementById('handle').value = ${JSON.stringify(handle)}; document.getElementById('register').click(); true`);
ok(await waitFor(login, `location.pathname === '/me' || document.getElementById('msg')?.textContent.startsWith('Signed in as')`, 15000), "registered and delegated for the foreign origin (login page moved on to " + await evalIn(login, `location.pathname`) + ")");
// With no opener the login page kept the session on the service origin; hand it to the page as postMessage would.
const session = await evalIn(login, `localStorage.getItem('attest:session')`);
ok(JSON.parse(session).delegation.origin === site && JSON.parse(session).delegation.device === dev.did, "delegation is scoped to the page's origin and device key");
await evalIn(page, `localStorage.setItem('attest:session', ${JSON.stringify(session)}); true`);
await send("Page.reload", {}, page); await sleep(2000);
ok(await evalIn(page, `document.body.innerText.includes('@' + ${JSON.stringify(handle)})`), "page shows the handle from the handed-over session");
await evalIn(page, `document.querySelector('[data-attest] .up').click(); true`);
ok(await waitFor(page, `Number(document.querySelector('[data-attest] .n').textContent) >= 1 && document.querySelector('[data-attest] .up').getAttribute('aria-pressed') === 'true'`), "upvote signed by the page's device key, accepted from the page's origin");
const target = await evalIn(page, `document.querySelector('[data-attest]').attestWidget.target`); ok(target === site + "/article-1", "target is the page's canonical URL: " + target);
await evalIn(page, `const ta = document.querySelector('[data-attest] textarea'); ta.value = 'cross-origin comment'; document.querySelector('[data-attest] form button').click(); true`);
ok(await waitFor(page, `document.querySelector('[data-attest] li')?.innerText.includes('cross-origin comment')`), "comment from the third-party page");
// The same delegation must be refused when submitted from the service's own origin (a different arena).
const env = await evalIn(page, `(async () => { const A = await import(${JSON.stringify(service + "/attest-core.js")}); return JSON.stringify(await A.makeRecord('upvote', 'https://example.org/other')); })()`);
const misuse = await evalIn(login, `(async () => { const A = await import('/attest-core.js'); try { await A.req('attest', ${env}); return 'accepted'; } catch (e) { return e.message; } })()`);
ok(/issued for/.test(misuse), "a validly signed record is refused when submitted from another origin: " + misuse);
console.log(fails ? `${fails} FAILED` : "all passed"); ws.close(); chrome.kill(); process.exit(fails ? 1 : 0);
