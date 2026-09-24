// Served shim over the orbital-attest client package: configures the service origin from this file's own URL.
import * as C from "./lib/client.mjs";
C.configure({ server: new URL(import.meta.url).origin });
export * from "./lib/client.mjs";
