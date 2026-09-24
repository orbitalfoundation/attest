// Bundle the browser-side atproto helpers (DAG-CBOR + CID) into one served ES module, since the client has no build step.
import { build } from "esbuild";
await build({ entryPoints: ["packages/orbital-attest/cid.src.mjs"], bundle: true, format: "esm", outfile: "packages/orbital-attest/cid.mjs", minify: true, target: "es2022", legalComments: "none" });
console.log("built packages/orbital-attest/cid.mjs");
