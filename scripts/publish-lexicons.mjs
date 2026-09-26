// Publish our lexicons the AT Protocol way: each schema as a com.atproto.lexicon.schema record (rkey = NSID) in the
// service's repo, and a TXT record _lexicon.attest.monster → did=<service did> so resolvers find that repo.
// Needs PDS_URL, PDS_ADMIN_PASSWORD not required; reads the service repo credentials from the index DB (ATTEST_DB), and CF_TOKEN/CF_ZONE.
import { readFileSync, readdirSync } from "node:fs";
import * as store from "../server/store.mjs"; import * as pds from "../server/pds.mjs"; import * as dns from "../server/dns.mjs";
store.open(process.env.ATTEST_DB);
const svc = store.getAccountByHandle(process.env.SERVICE_HANDLE || "attest"); const cred = svc && store.pdsCredentials(svc.did);
if (!cred?.pds_handle) throw new Error("no service repo account in this index");
const token = await pds.tokenFor(svc.did, cred.pds_handle, cred.pds_password);
for (const f of readdirSync("lexicons/monster/attest")) {
  const doc = JSON.parse(readFileSync("lexicons/monster/attest/" + f, "utf8"));
  const r = await pds.putRecord(token, svc.did, "com.atproto.lexicon.schema", doc.id, { $type: "com.atproto.lexicon.schema", ...doc });
  console.log("published", doc.id, r.uri);
}
if (dns.enabled()) console.log("dns", JSON.stringify(await dns.bindLexicon("attest.monster", svc.did)));
else console.log("CF_TOKEN/CF_ZONE not set; add TXT _lexicon.attest.monster = did=" + svc.did + " by hand");
