// The index follows the PDS's repo stream. Anything written to a repo in our collections, by us or by any other client,
// is verified (inline signature against the repo did) and indexed; deletes retract; account status changes are recorded.
// Writes we make ourselves are indexed immediately too; the firehose path is idempotent by uri.
import { Firehose } from "@atproto/sync";
import { IdResolver } from "@atproto/identity";
import { lexToJson } from "@atproto/lexicon";
import * as store from "./store.mjs";
import * as records from "./records.mjs";
import { inlineVerify, jwkFromDidKey } from "../packages/orbital-attest/verify.mjs";
const NS = "monster.attest.";
let fh = null;
export function start({ pdsUrl }) {
  const service = pdsUrl.replace(/^http/, "ws");
  fh = new Firehose({
    idResolver: new IdResolver(), service, unauthenticatedCommits: true, unauthenticatedHandles: true, excludeSync: true,
    filterCollections: ["vote", "comment", "statement", "vouch", "claim", "verification"].map((k) => NS + k),
    getCursor: () => store.getMeta("firehose_cursor") ?? undefined,
    handleEvent: async (evt) => {
      try {
        if (evt.event === "create" || evt.event === "update") await indexRecord(evt);
        else if (evt.event === "delete") { if (store.retractRecord(evt.uri.toString(), evt.did)) records.events.emit("counts", { target: store.getRecordByUri(evt.uri.toString())?.record.target, counts: null }); }
        else if (evt.event === "account") store.setAccountStatus(evt.did, evt.active ? "active" : (evt.status || "inactive"));
        else if (evt.event === "identity" && evt.handle) store.setRepoHandle(evt.did, evt.handle);
      } finally { if (typeof evt.seq === "number") store.setMeta("firehose_cursor", evt.seq); }
    },
    onError: (err) => console.error("firehose:", err.message),
  });
  fh.start(); console.log("firehose following", service);
  return fh;
}
export const stop = () => fh?.destroy();
async function indexRecord(evt) {
  const uri = evt.uri.toString(), did = evt.did, collection = evt.collection;
  if (store.getRecordByUri(uri)) return; // we wrote it, or saw it already
  const record = lexToJson(evt.record); if (!record || record.$type !== collection) return;
  const [v] = await inlineVerify(record, did, async (keyDid) => jwkFromDidKey(keyDid)).catch(() => []);
  if (!v?.ok) { console.warn("firehose: unsigned or unverifiable record ignored", uri); return; }
  const cid = evt.cid.toString(); const shape = records.indexShape(collection, record, did); if (!shape) return;
  const del = store.delegationForDevice(did, v.key.split("#")[0]);
  store.putRecord(cid, { record: shape, repoRecord: record, uri, cid, collection, rkey: evt.rkey, del: del || undefined, viaFirehose: true });
  records.events.emit("counts", { target: shape.target, counts: store.countsFor(shape.target) });
}
