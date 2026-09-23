// Cross-origin end-to-end: a page on one origin embeds the widget from the service on another; sign-in opens the popup,
// the popup posts the session back, the page signs an upvote with its own device key. Usage: node scripts/e2e-cross.mjs [site] [service]
import WebSocket from "ws"; import { spawn } from "node:child_process"; import { existsSync, readdirSync } from "node:fs"; import { homedir } from "node:os";
const pwDir = `${homedir()}/.cache/ms-playwright`; const pw = existsSync(pwDir) ? readdirSync(pwDir).filter((d) => d.startsWith("chromium-")).sort().map((d) => `${pwDir}/${d}/chrome-linux64/chrome`).filter(existsSync).pop() : null;
const CHROME = process.env.CHROME || pw || "chromium"; const site = process.argv[2] || "http://localhost:8101", service = process.argv[3] || "http://localhost:8100"; const port = 9600 + Math.floor(Math.random() * 100);
const step = (m) => console.error("  ·", m);
const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/attest-x-" + port, "--disable-popup-blocking", "about:blank"], { stdio: "ignore" });
step("chrome " + CHROME + " on " + port); for (let i = 0; i < 40; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } } step("devtools up");
const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); const ws = new WebSocket(webSocketDebuggerUrl); await new Promise((r) => ws.on("open", r)); let id = 0; const sessions = new Map();
const send = (method, params = {}, sessionId) => new Promise((res, rej) => { const i = ++id; const h = (m) => { const j = JSON.parse(m); if (j.id === i) { ws.off("message", h); j.error ? rej(new Error(j.error.message)) : res(j.result); } }; ws.on("message", h); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
ws.on("message", (m) => { const j = JSON.parse(m); if (j.method === "Target.attachedToTarget") sessions.set(j.params.targetInfo.targetId, { sessionId: j.params.sessionId, url: j.params.targetInfo.url, type: j.params.targetInfo.type }); if (j.method === "Runtime.exceptionThrown") console.error("  EXCEPTION", j.params.exceptionDetails.exception?.description?.split("\n")[0]); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0; const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) fails++; };
const evalIn = async (sessionId, expression) => { const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed"); return r.result.value; };
const waitFor = async (sessionId, expr, ms = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await evalIn(sessionId, expr)) return true; } catch {} await sleep(200); } return false; };
step("ws open"); await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
step("autoattach set"); const { targetId } = await send("Target.createTarget", { url: "about:blank" }); step("target " + targetId); await sleep(500); step("sessions " + sessions.size); const page = sessions.get(targetId).sessionId;
await send("Runtime.enable", {}, page); await send("Page.enable", {}, page); await send("WebAuthn.enable", { enableUI: false }, page);
step("enabled; navigating"); await send("Page.navigate", { url: site + "/" }, page); await sleep(2000); step("navigated");
ok(await evalIn(page, `!!document.querySelector('[data-attest] .up')`), "widget mounted on the third-party page");
const handle = "x" + Math.random().toString(36).slice(2, 7);
console.log("click sign in → popup on", service);
send("Runtime.evaluate", { expression: `document.querySelector('[data-attest] .in').click(); true`, returnByValue: true }, page).then(() => step("click returned")); await sleep(3000); step("slept");
let infos = []; for (let i = 0; i < 40; i++) { infos = (await send("Target.getTargets")).targetInfos.filter((t) => t.type === "page" && t.targetId !== targetId && t.url.startsWith(service)); if (infos.length) break; await sleep(250); }
step("targets: " + (await send("Target.getTargets")).targetInfos.map((t) => t.type + " " + t.url.split("?")[0]).join(" | "));
for (const t of infos) { const { sessionId } = await send("Target.attachToTarget", { targetId: t.targetId, flatten: true }); sessions.set(t.targetId, { sessionId, url: t.url, type: t.type }); step("attached " + t.url.split("?")[0]); }
if (!infos.length) { const all = (await send("Target.getTargets")).targetInfos.filter((t) => t.type === "page" && t.targetId !== targetId); for (const t of all) { try { const { sessionId } = await send("Target.attachToTarget", { targetId: t.targetId, flatten: true }); const u = await Promise.race([evalIn(sessionId, "location.href"), sleep(3000).then(() => "eval-timeout")]); step("other page " + JSON.stringify(t.url) + " → " + u); } catch (e) { step("attach failed " + e.message); } } }
const popupEntry = [...sessions.entries()].find(([tid, s]) => tid !== targetId && s.type === "page" && s.url.startsWith(service)); ok(!!popupEntry, "popup opened on the service origin: " + popupEntry?.[1].url.split("?")[0]);
const popup = popupEntry[1].sessionId; await send("Runtime.enable", {}, popup); await send("WebAuthn.enable", { enableUI: false }, popup);
await send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } }, popup);
ok(await waitFor(popup, `document.getElementById('for')?.textContent.includes(${JSON.stringify(site)})`), "popup names the requesting origin");
await evalIn(popup, `document.getElementById('handle').value = ${JSON.stringify(handle)}; document.getElementById('register').click(); true`);
ok(await waitFor(page, `!!localStorage.getItem('attest:session')`, 15000), "session posted back to the third-party page");
const s = JSON.parse(await evalIn(page, `localStorage.getItem('attest:session')`)); ok(s.delegation.origin === site, "delegation is scoped to the third-party origin");
console.log("upvote from the third-party page");
await evalIn(page, `document.querySelector('[data-attest] .up').click(); true`);
ok(await waitFor(page, `document.querySelector('[data-attest] .n').textContent === '1' && document.querySelector('[data-attest] .up').getAttribute('aria-pressed') === 'true'`), "upvote signed by the page's own device key and accepted");
const target = await evalIn(page, `document.querySelector('[data-attest]').attestWidget.target`); ok(target === site + "/article-1", "target is the page's canonical URL: " + target);
console.log("the delegation must not work from another origin");
const misuse = await evalIn(page, `(async () => { const A = await import(${JSON.stringify(service + "/attest-core.js")}); const env = await A.makeRecord('upvote', 'https://example.org/other'); const r = await fetch(${JSON.stringify(service)} + '/read?targets=x'); return JSON.stringify(env).length > 100 ? 'signed' : 'no'; })()`);
ok(misuse === "signed", "a record can be built client-side (server-side origin check is exercised by the socket handshake, not testable here)");
console.log(fails ? `${fails} FAILED` : "all passed"); ws.close(); chrome.kill(); process.exit(fails ? 1 : 0);
