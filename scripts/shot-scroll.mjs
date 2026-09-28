import WebSocket from "ws"; import { spawn } from "node:child_process"; import { existsSync, readdirSync, writeFileSync } from "node:fs"; import { homedir } from "node:os";
const pwDir = `${homedir()}/.cache/ms-playwright`; const CHROME = readdirSync(pwDir).filter((d) => d.startsWith("chromium-")).sort().map((d) => `${pwDir}/${d}/chrome-linux64/chrome`).filter(existsSync).pop();
const [url, out, y] = process.argv.slice(2); const port = 9900 + Math.floor(Math.random() * 90);
const chrome = spawn(CHROME, ["--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars", `--remote-debugging-port=${port}`, "--window-size=420,900", "--user-data-dir=/tmp/attest-shot-" + port, "about:blank"], { stdio: "ignore" });
for (let i = 0; i < 40; i++) { try { await fetch(`http://127.0.0.1:${port}/json/version`); break; } catch { await new Promise((r) => setTimeout(r, 250)); } }
const page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page"); const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => ws.on("open", r)); let id = 0;
const send = (method, params = {}) => new Promise((res) => { const i = ++id; const h = (m) => { const j = JSON.parse(m); if (j.id === i) { ws.off("message", h); res(j.result); } }; ws.on("message", h); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Emulation.setDeviceMetricsOverride", { width: 420, height: 900, deviceScaleFactor: 1, mobile: true });
await send("Page.enable"); await send("Page.navigate", { url }); await new Promise((r) => setTimeout(r, 4000));
await send("Runtime.evaluate", { expression: `window.scrollTo(0, ${y}); true` }); await new Promise((r) => setTimeout(r, 800));
const { data } = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(out, Buffer.from(data, "base64"));
ws.close(); chrome.kill(); process.exit(0);
