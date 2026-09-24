// attest embed: <script type="module" src="https://attest.monster/attest.js"></script> then <div data-attest data-target="https://…" data-comments></div>.
// Without data-target the page's canonical URL is the target. Renders an upvote button with a live count, optionally comments.
import * as A from "./attest-core.js";
const CSS = `
.attest{font:14px/1.4 system-ui,sans-serif;color:inherit;--accent:var(--attest-accent,#2b6cb0);margin:.5rem 0}
.attest button{font:inherit;cursor:pointer;border:1px solid color-mix(in srgb,currentColor 25%,transparent);background:transparent;color:inherit;border-radius:3px;padding:.25rem .6rem}
.attest button.up[aria-pressed=true]{background:var(--accent);border-color:var(--accent);color:#fff}
.attest button:disabled{opacity:.5;cursor:default}
.attest .row{display:flex;gap:.6rem;align-items:center;flex-wrap:wrap}
.attest .who{opacity:.65;font-size:12px}.attest .who a{color:inherit}
.attest .err{color:#b91c1c;font-size:12px}
.attest ul{list-style:none;margin:.5rem 0 0;padding:0}.attest li{padding:.4rem 0;border-top:1px solid color-mix(in srgb,currentColor 12%,transparent)}
.attest li b{font-weight:600}.attest li time{opacity:.6;font-size:12px;margin-left:.4rem}
.attest form{display:flex;gap:.4rem;margin-top:.5rem}.attest textarea{flex:1;font:inherit;padding:.4rem;border:1px solid color-mix(in srgb,currentColor 25%,transparent);border-radius:3px;background:transparent;color:inherit;min-height:2.4rem}
`;
function ensureStyle() { if (document.getElementById("attest-style")) return; const s = document.createElement("style"); s.id = "attest-style"; s.textContent = CSS; document.head.appendChild(s); }
const pageTarget = () => document.querySelector('link[rel="canonical"]')?.href || (location.origin + location.pathname + location.search);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const when = (iso) => { const d = new Date(iso), m = (Date.now() - d) / 60e3; return m < 1 ? "just now" : m < 60 ? Math.round(m) + " min ago" : m < 1440 ? Math.round(m / 60) + " h ago" : d.toLocaleDateString(); };
class Widget {
  constructor(el) {
    this.el = el; this.target = A.normalizeTarget(el.dataset.target || pageTarget()); this.comments = el.hasAttribute("data-comments");
    this.mine = null; this.counts = { upvotes: 0, comments: [] };
    el.classList.add("attest"); el.innerHTML = `<div class="row"><button class="up" aria-pressed="false" title="upvote">▲ <span class="n">–</span></button><span class="who"></span><span class="err"></span></div>` + (this.comments ? `<ul class="list"></ul><form><textarea placeholder="say something, signed" rows="1"></textarea><button type="submit">post</button></form>` : "");
    this.$ = (q) => el.querySelector(q);
    this.$(".up").onclick = () => this.toggle().catch((e) => this.error(e));
    if (this.comments) this.$("form").onsubmit = (e) => { e.preventDefault(); this.post().catch((err) => this.error(err)); };
  }
  error(e) { this.$(".err").textContent = e.message || String(e); setTimeout(() => (this.$(".err").textContent = ""), 6000); }
  async ensureSession() { if (A.session()) return; await A.signIn(); await this.loadMine(); }
  async toggle() {
    await this.ensureSession(); const b = this.$(".up"); b.disabled = true;
    try { const r = this.mine ? await A.attest("retract", this.target, { ref: this.mine }) : await A.attest("upvote", this.target); this.mine = this.mine ? null : r.uri; this.apply(r.counts); } finally { b.disabled = false; }
  }
  async post() {
    await this.ensureSession(); const ta = this.$("textarea"), body = ta.value.trim(); if (!body) return;
    const r = await A.attest("comment", this.target, { body }); ta.value = ""; this.apply(r.counts);
  }
  async loadMine() {
    const s = A.session(); this.mine = null;
    if (s) { const me = await A.by(s.root); this.mine = me.records.find((r) => r.kind === "upvote" && r.target === this.target && !r.retracted)?.uri || null; }
    this.render();
  }
  apply(counts) { this.counts = counts; this.render(); }
  render() {
    const s = A.session(); this.$(".n").textContent = this.counts.upvotes; this.$(".up").setAttribute("aria-pressed", String(!!this.mine));
    this.$(".who").innerHTML = s ? `@${esc(s.handle)} · <a href="#" class="out">sign out</a>` : `<a href="#" class="in">sign in</a>`;
    const out = this.$(".out"), inn = this.$(".in"); if (out) out.onclick = (e) => { e.preventDefault(); A.clearSession(); this.mine = null; this.render(); }; if (inn) inn.onclick = (e) => { e.preventDefault(); this.ensureSession().catch((err) => this.error(err)); };
    if (this.comments) this.$(".list").innerHTML = this.counts.comments.map((c) => `<li><b>${c.handle ? `<a href="${A.server}/@${esc(c.handle)}" style="color:inherit;text-decoration:none">@${esc(c.handle)}</a>` : "@" + esc(A.short(c.by))}</b><time>${when(c.at)}</time><div>${esc(c.body)}</div></li>`).join("");
  }
}
export async function mount(root = document) {
  ensureStyle();
  const widgets = [...root.querySelectorAll("[data-attest]")].filter((el) => !el.attestWidget).map((el) => (el.attestWidget = new Widget(el)));
  if (!widgets.length) return widgets;
  const targets = [...new Set(widgets.map((w) => w.target))];
  const counts = await A.read(targets); for (const w of widgets) if (counts[w.target] && !counts[w.target].error) w.apply(counts[w.target]);
  await Promise.all(widgets.map((w) => w.loadMine().catch(() => w.render())));
  A.subscribe(targets).catch(() => {}); A.onCounts(({ target, counts }) => widgets.filter((w) => w.target === target).forEach((w) => w.apply(counts)));
  return widgets;
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => mount()); else mount();
