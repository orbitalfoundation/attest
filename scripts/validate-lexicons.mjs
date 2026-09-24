// Validate every lexicon under lexicons/ with @atproto/lexicon, then validate a sample record against each of ours.
import { Lexicons } from "@atproto/lexicon"; import { readFileSync, readdirSync, statSync } from "node:fs"; import { join } from "node:path";
const files = []; (function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : p.endsWith(".json") && files.push(p); } })("lexicons");
const docs = files.map((f) => JSON.parse(readFileSync(f, "utf8"))); const lex = new Lexicons(docs); console.log("loaded", docs.length, "lexicon documents");
const sig = [{ $type: "app.certified.signature.defs#inline", key: "did:key:zDnaeuQNcyusaSvPjbZjMtQ7uD5UT8RqrnJb7JUCHBaCYctTQ#zDnaeuQNcyusaSvPjbZjMtQ7uD5UT8RqrnJb7JUCHBaCYctTQ", signature: new Uint8Array(64) }];
const samples = {
  "monster.attest.vote": { $type: "monster.attest.vote", subject: "https://futuresdesk.ai/", createdAt: new Date().toISOString(), signatures: sig },
  "monster.attest.comment": { $type: "monster.attest.comment", subject: "https://futuresdesk.ai/", text: "signed hello", createdAt: new Date().toISOString(), signatures: sig },
  "monster.attest.statement": { $type: "monster.attest.statement", text: "I stand behind this.", createdAt: new Date().toISOString(), signatures: sig },
  "monster.attest.vouch": { $type: "monster.attest.vouch", subject: "did:plc:e26hq76yah3a5txxlz2elfss", createdAt: new Date().toISOString(), signatures: sig },
  "monster.attest.claim": { $type: "monster.attest.claim", target: "https://hook.org/", createdAt: new Date().toISOString(), signatures: sig },
  "monster.attest.verification": { $type: "monster.attest.verification", claim: { uri: "at://did:plc:e26hq76yah3a5txxlz2elfss/monster.attest.claim/3abc", cid: "bafyreih3esls7gjz64akwinybcoqnevvspd6idnby2nrkca5brt7dnch34" }, target: "https://hook.org/", evidence: "https://hook.org/.well-known/attest.txt", createdAt: new Date().toISOString(), signatures: sig },
};
let bad = 0; for (const [id, rec] of Object.entries(samples)) { try { lex.assertValidRecord(id, rec); console.log("  ✓", id); } catch (e) { bad++; console.log("  ✗", id, e.message); } }
try { lex.assertValidRecord("monster.attest.vote", { $type: "monster.attest.vote", subject: "not a uri", createdAt: "x" }); console.log("  ✗ bad vote accepted"); bad++; } catch { console.log("  ✓ bad vote refused"); }
process.exit(bad ? 1 : 0);
