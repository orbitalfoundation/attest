// Floating top-right bar shared by the site's pages. The two things visitors ask for first (sign in, save a page)
// are visible pills; the folded ☰ holds the rest. Readers never found them inside the ☰ alone (2026-11-04).
import { session, clearSession } from "./attest-core.js";
const s = session();
const esc = (t) => String(t).replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]));
const here = location.pathname, onLogin = here.startsWith("/login");
const pills = s ? `<a class="pill" href="/${esc(s.handle)}">@${esc(s.handle)}</a><a class="pill go" href="/save">Save a page</a>`
  : onLogin ? "" : `<a class="pill go" href="/login?return=${encodeURIComponent(here)}">Sign in</a>`;
const el = document.createElement("nav"); el.className = "menu"; el.innerHTML = `${pills}<button aria-label="menu">☰</button><ul>
<li><a href="/">attest</a></li><li><a href="/tools">bookmark a page</a></li><li><a href="/faq">FAQ</a></li><li><a href="/about">about</a></li><li><a href="/notes">notes</a></li><li><a href="/docs">docs</a></li>
${s ? `<li><a href="/${s.handle}">my page</a></li><li><a href="/me">settings</a></li><li><a href="#" id="signout">sign out</a></li>` : `<li><a href="/login?return=${encodeURIComponent(location.pathname)}">sign in</a></li>`}</ul>`;
document.body.appendChild(el);
el.querySelector("button").onclick = () => el.classList.toggle("open");
document.addEventListener("click", (e) => { if (!el.contains(e.target)) el.classList.remove("open"); });
if (s) fetch("/admins").then((r) => r.json()).then(({ admins }) => { if (admins.includes(s.root)) { const li = document.createElement("li"); li.innerHTML = '<a href="/admin">admin</a>'; el.querySelector("ul").insertBefore(li, el.querySelector("#signout")?.parentElement || null); } }).catch(() => {});
el.querySelector("#signout")?.addEventListener("click", (e) => { e.preventDefault(); clearSession(); location.reload(); });
