// Admin end-to-end against a local server started with ADMIN_HANDLE=<handle>: that account sees /admin, can hide and
// unhide a record (logged publicly), reserve a handle; another account is refused. Usage: node scripts/e2e-admin.mjs <base> <adminHandle>
import WebSocket from "ws"; import { spawn } from "node:child_process"; import { existsSync, readdirSync } from "node:fs"; import { homedir } from "node:os";
const pwDir = `${homedir()}/.cache/ms-playwright`; const CHROME = readdirSync(pwDir).filter((d) => d.startsWith("chromium-")).sort().map((d) => `${pwDir}/${d}/chrome-linux64/chrome`).filter(existsSync).pop();
const [base, adminHandle] = process.argv.slice(2); const port = 9500 + Math.floor(Math.random() * 90);
const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${port}`, "--user-data-dir=/tmp/attest-admin-" + port, "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 40; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => ws.on("open", r)); let id = 0;
const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; const h = (m) => { const j = JSON.parse(m); if (j.id === i) { ws.off("message", h); j.error ? rej(new Error(j.error.message)) : res(j.result); } }; ws.on("message", h); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const r = await send("Runtime.evaluate", { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) return "EXC " + (r.exceptionDetails.exception?.description || "").split("\n")[0]; return r.result.value; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); let fails = 0; const ok = (c, m) => { console.log(c ? "  ✓" : "  ✗", m); if (!c) fails++; };
const waitFor = async (e, ms = 12000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await ev(e) === true) return true; await sleep(250); } return false; };
await send("Runtime.enable"); await send("Page.enable"); await send("WebAuthn.enable", { enableUI: false });
await send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
const register = async (h) => { await ev(`localStorage.removeItem('attest:session'); true`); await send("Page.navigate", { url: base + "/login?return=/demo" }); await sleep(2500); await ev(`document.getElementById('handle').value = ${JSON.stringify(h)}; document.getElementById('register').click(); true`); return waitFor(`location.pathname === '/demo'`); };
ok(await register(adminHandle), "admin account registered: " + adminHandle);
await sleep(1500); await ev(`const ta = document.querySelector('[data-attest] textarea'); ta.value = 'a comment to moderate'; document.querySelector('[data-attest] form button').click(); true`); await sleep(2500);
await send("Page.navigate", { url: base + "/admin" }); await sleep(3000);
ok(await waitFor(`!document.getElementById('panel').hidden && document.querySelectorAll('#tiles div').length >= 8`), "admin panel shows health tiles");
ok(await ev(`document.querySelector('#accounts tbody').innerText.includes(${JSON.stringify(adminHandle)})`) === true, "accounts table lists the admin");
ok(await waitFor(`!!document.querySelector('#records button[data-act=hide]')`), "recent records offer hide");
await ev(`window.prompt = () => 'test of moderation'; document.querySelector('#records button[data-act=hide]').click(); true`);
ok(await waitFor(`document.getElementById('msg').textContent === 'done' && !!document.querySelector('#records .st-hidden')`), "a record hidden");
const mod = await (await fetch(base + "/moderation.json")).json(); ok(mod.actions[0]?.action === "hide" && mod.actions[0]?.reason === "test of moderation", "the hide is in the public moderation log with its reason");
const counts = (await (await fetch(base + "/read?targets=" + encodeURIComponent(base.replace("localhost:8100", "attest.monster") + "/demo"))).json());
await ev(`window.prompt = () => 'undo'; document.querySelector('#records button[data-act=unhide]').click(); true`);
ok(await waitFor(`!document.querySelector('#records .st-hidden')`), "unhidden again");
await ev(`document.getElementById('rname').value = 'reservedtest'; document.getElementById('reserve').requestSubmit(); true`);
ok(await waitFor(`document.getElementById('added').innerText.includes('reservedtest')`), "an admin-reserved handle is listed");
const hc = await ev(`(async () => { const A = await import('/attest-core.js'); return JSON.stringify(await A.req('handle.check', { handle: 'reservedtest' })); })()`); ok(/reserved/.test(hc), "and cannot be registered: " + hc);
ok(await register("e2enotadmin" + Math.random().toString(36).slice(2, 5)), "second, non-admin account registered");
await send("Page.navigate", { url: base + "/admin" }); await sleep(3000);
ok(await waitFor(`document.getElementById('gate').innerText.includes('not an admin')`), "non-admin is refused: " + await ev(`document.getElementById('gate').innerText`));
const forged = await ev(`(async () => { const A = await import('/attest-core.js'); try { await A.req('admin', { name: 'overview', payload: null, at: new Date().toISOString(), del: A.session().id, sig: 'AAAA' }); return 'accepted'; } catch (e) { return e.message; } })()`);
ok(/not an admin|does not verify/.test(forged), "a forged admin request is refused: " + forged);
console.log(fails ? `${fails} FAILED` : "all passed"); ws.close(); chrome.kill(); process.exit(fails ? 1 : 0);
