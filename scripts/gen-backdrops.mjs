// Generate backdrop clips for the home page through AtlasCloud: a painterly still (text-to-image), then a short loop
// (image-to-video). Everything is clearly illustration, never photoreal people. Outputs to OUT_DIR.
// Usage: ATLASCLOUD_API_KEY=… OUT_DIR=… node scripts/gen-backdrops.mjs [theme…]
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
const KEY = process.env.ATLASCLOUD_API_KEY, OUT = process.env.OUT_DIR || "backdrops"; mkdirSync(OUT, { recursive: true });
const IMAGE = process.env.IMAGE_MODEL || "bytedance/seedream-v4.7/text-to-image", VIDEO = process.env.VIDEO_MODEL || "atlascloud/wan-2.2/image-to-video";
const API = "https://api.atlascloud.ai/api/v1/model", auth = { Authorization: `Bearer ${KEY}` }, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const STYLE = "hand-painted illustration, painterly gouache and watercolour texture, visible brushwork, warm natural light, deep teal and earth tones with soft glowing teal threads, cinematic 16:9 wide composition, calm, hopeful, no text, no letters, no logos, not photorealistic";
export const THEMES = {
  hands: { still: `Close view of four pairs of human hands around a wooden table, clearly different people: deep brown, pale, olive and light brown skin, one pair young, one pair old and wrinkled, one with a bright woven bracelet; together they hold a single loop of string stretched between all their fingers into an intricate woven lattice of many crossing strands, like a web or net, with no star shapes and no pentagrams, the string glowing faintly teal; only hands, string and table, no animals, no figures, no symbols in the middle. ${STYLE}`, motion: "the hands slowly pass the glowing string figure from one pair to the next, the threads shimmer softly, gentle slow camera drift" },
  forest: { still: `Cross-section of a forest floor at dusk: tree roots and fine fungal mycelium threads running underground between the trees, the threads glowing teal where they connect one tree's roots to another's, small ferns and moss above. ${STYLE}`, motion: "soft pulses of light travel along the underground threads from tree to tree, leaves above sway gently, slow push-in" },
  tending: { still: `Many human hands of different ages and origins tending the earth together: planting seedlings, cupping water from a stream, repairing a small wooden weir, seen from close above; a fine glowing teal thread links each pair of hands to the next. ${STYLE}`, motion: "hands move gently as they plant and tend, water ripples, the glowing thread brightens as it passes from hand to hand, slow drift" },
  river: { still: `Aerial painted view of a great river and its tributaries winding through mountains and plains across faint painted national border lines, small warm lights of villages along the banks joined to one another by fine glowing teal threads that cross the borders. ${STYLE}`, motion: "the river water flows and glints, the glowing threads between villages brighten one after another across the borders, slow aerial drift" },
};
async function call(path, body) { const r = await fetch(`${API}/${path}`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body) }); const j = await r.json(); const id = j.data?.id; if (!id) throw new Error(path + " submit failed: " + JSON.stringify(j).slice(0, 300)); return id; }
async function wait(id) { for (let i = 0; i < 150; i++) { await sleep(6000); const p = await (await fetch(`${API}/prediction/${id}`, { headers: auth })).json(); if (p.data?.status === "completed") return p.data.outputs[0]; if (p.data?.status === "failed") throw new Error("failed: " + String(p.data.error || "").slice(0, 300)); } throw new Error("timeout"); }
const save = async (url, path) => writeFileSync(path, Buffer.from(await (await fetch(url)).arrayBuffer()));
const which = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(THEMES);
for (const name of which) {
  const t = THEMES[name]; if (!t) { console.log("unknown theme", name); continue; }
  const still = `${OUT}/${name}.jpg`, clip = `${OUT}/${name}-raw.mp4`;
  try {
    let stillUrl;
    if (!existsSync(still)) { stillUrl = await wait(await call("generateImage", { model: IMAGE, prompt: t.still, size: process.env.IMAGE_SIZE || "2560*1440" })); await save(stillUrl, still); console.log(name, "still", still); }
    if (process.env.STILLS_ONLY) continue;
    if (!stillUrl) { const form = new FormData(); form.append("file", new Blob([(await import("node:fs")).readFileSync(still)], { type: "image/jpeg" }), "s.jpg"); stillUrl = (await (await fetch(`${API}/uploadMedia`, { method: "POST", headers: auth, body: form })).json()).data?.download_url; }
    const videoUrl = await wait(await call("generateVideo", { model: VIDEO, prompt: t.motion, image: stillUrl, ...(process.env.VIDEO_EXTRA ? JSON.parse(process.env.VIDEO_EXTRA) : {}) }));
    await save(videoUrl, clip); console.log(name, "clip", clip);
  } catch (e) { console.log(name, "ERROR", e.message); }
}
