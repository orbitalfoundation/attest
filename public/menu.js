// Floating top-right menu shared by the site's pages; kept short: people first, everything else under Docs.
import { session, clearSession } from "./attest-core.js";
const s = session();
const el = document.createElement("nav"); el.className = "menu"; el.innerHTML = `<button aria-label="menu">☰</button><ul>
<li><a href="/">attest</a></li><li><a href="/tools">save from anywhere</a></li><li><a href="/faq">FAQ</a></li><li><a href="/about">about</a></li><li><a href="/docs">docs</a></li>
${s ? `<li><a href="/${s.handle}">my page</a></li><li><a href="/me">settings</a></li><li><a href="#" id="signout">sign out</a></li>` : `<li><a href="/login?return=${encodeURIComponent(location.pathname)}">sign in</a></li>`}</ul>`;
document.body.appendChild(el);
el.querySelector("button").onclick = () => el.classList.toggle("open");
document.addEventListener("click", (e) => { if (!el.contains(e.target)) el.classList.remove("open"); });
el.querySelector("#signout")?.addEventListener("click", (e) => { e.preventDefault(); clearSession(); location.reload(); });
