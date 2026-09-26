// attest — signed attestations about URLs and keys. Wiring only: store, HTTP routes, socket.io.
import Fastify from "fastify";
import * as store from "./store.mjs";
import { routes } from "./http.mjs";
import { attach } from "./socket.mjs";
const PORT = Number(process.env.PORT || 8100), HOST = process.env.HOST || "0.0.0.0";
store.open();
const { initServiceKey } = await import("./records.mjs"); console.log("service key", await initServiceKey());
const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" }, trustProxy: true });
await routes(app);
await app.ready();
attach(app.server);
await app.listen({ port: PORT, host: HOST });
if (process.env.PDS_URL) (await import("./firehose.mjs")).start({ pdsUrl: process.env.PDS_URL });
if (process.env.GRAPH_IMPORT !== "off") (await import("./graph.mjs")).start();
console.log(`attest listening on http://${HOST}:${PORT}`);
