// Floating top-right menu shared by the service's pages; shows sign-in state.
import { session, clearSession } from "./attest-core.js";
const s = session();
const el = document.createElement("nav"); el.className = "menu"; el.innerHTML = `<button aria-label="menu">☰</button><ul>
<li><a href="/">attest</a></li><li><a href="/about">about</a></li><li><a href="/demo">demo</a></li><li><a href="/me">what I attested</a></li><li><a href="/log?since=0&limit=50">the log</a></li>
${s ? `<li><span>signed in as @${s.handle}</span></li><li><a href="#" id="signout">sign out</a></li>` : `<li><a href="/login?return=${encodeURIComponent(location.pathname)}">sign in</a></li>`}</ul>`;
document.body.appendChild(el);
el.querySelector("button").onclick = () => el.classList.toggle("open");
document.addEventListener("click", (e) => { if (!el.contains(e.target)) el.classList.remove("open"); });
el.querySelector("#signout")?.addEventListener("click", (e) => { e.preventDefault(); clearSession(); location.reload(); });
