// Tests use invented words hashed on the fly, so no offensive word appears here. Run: node --test
import test from "node:test";
import assert from "node:assert/strict";
import { createGuard, hashWord, normalizeWord, RESERVED_PATHS, shippedLists } from "./index.mjs";

const lists = { exact: [hashWord("zorbl")], anywhere: [hashWord("quaxel")] };
const g = createGuard({ words: lists, reserved: false });

test("normalises case, accents and leetspeak", () => {
  assert.equal(normalizeWord("ZÖRBL"), "zorbl");
  assert.equal(normalizeWord("z0rbl"), "zorbl");
  assert.equal(normalizeWord("qu@x3l"), "quaxel");
});
test("exact words block as a whole handle or a separated part, not inside another word", () => {
  assert.ok(g.isOffensive("zorbl"));
  assert.ok(g.isOffensive("big-zorbl"));
  assert.ok(g.isOffensive("big_z0rbl"));
  assert.ok(!g.isOffensive("zorblington"));
});
test("anywhere words block inside a handle too", () => {
  assert.ok(g.isOffensive("myquaxelpage"));
  assert.ok(g.isOffensive("myqu4x3lpage"));
});
test("stretched letters and v-for-u are caught", () => {
  assert.ok(g.isOffensive("zooorbl"));
  assert.ok(g.isOffensive("qvaxel"));
});
test("allow lets a whole handle through; block adds a word; both may be functions", () => {
  const allowed = new Set();
  const h = createGuard({ words: lists, reserved: false, allow: () => allowed, block: [hashWord("fribble")] });
  assert.ok(h.isOffensive("myquaxelpage"));
  allowed.add(hashWord("myquaxelpage"));
  assert.ok(!h.isOffensive("myquaxelpage"));
  assert.ok(h.isOffensive("fribble"));
});
test("reserved paths: defaults, extras, custom, off, and reserving page files", () => {
  const d = createGuard({ words: false });
  assert.deepEqual(d.check("admin"), { ok: false, reason: "reserved" });
  assert.ok(RESERVED_PATHS.includes("login"));
  assert.ok(createGuard({ words: false, extraReserved: ["acme"] }).isReserved("ACME"));
  assert.ok(!createGuard({ words: false, reserved: ["acme"] }).isReserved("admin"));
  assert.ok(!createGuard({ words: false, reserved: false }).isReserved("admin"));
  assert.deepEqual(d.reserve(["gallery.html", "admin", "ab"], { minLength: 3 }), ["gallery"]);
  assert.ok(d.isReserved("gallery"));
});
test("shipped lists: hashes only, and ordinary names and words pass", () => {
  const s = shippedLists();
  assert.ok(s.exact.length + s.anywhere.length > 1000);
  assert.ok([...s.exact, ...s.anywhere].every((h) => /^[0-9a-f]{64}$/.test(h)));
  const shipped = createGuard({ reserved: false });
  for (const ok of ["claire", "regina", "maria-lopez", "nguyen", "kim", "essex", "therapist", "grapes", "classic", "button", "cocktail", "peacock", "mushroom-fan"])
    assert.ok(!shipped.isOffensive(ok), ok);
});
