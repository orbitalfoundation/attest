# 2026-09-29: candidates for future modularisation

Anselm asked which other code is isolated enough to be a utility package,
after `packages/handle-guard` was split out. Survey only; nothing moved.
His call: record it here for later.

## Worth packaging

- **Inline signatures for AT Protocol records.** `inlineSign`,
  `inlineVerify`, `lowS`, did:key and JWK conversion, `canonical`, now in
  `packages/orbital-attest/verify.mjs`. No attest logic; useful to any
  AT Protocol developer who wants signatures that survive copying between
  repositories (badge.blue style). Most useful outside our projects;
  small job; first in line if we do any.
- **Passkey sign-in with delegated device keys.** Server:
  `server/passkeys.mjs`, `server/identity.mjs` (`jwkFromCose`,
  `checkDelegation`, `checkAction`), the signed-request check in
  `server/admin.mjs`. Client: `packages/orbital-attest/client.mjs`. The
  core of attest's design (passkey root, 30-day delegation to a
  non-extractable browser key, signed requests, no cookies or sessions).
  matchmaker has its own interim passkey auth and is expected to use
  attest as a service, which would not need this as a package. The case
  rests on sites wanting the pattern without the service; none named yet.

## Possible but thin

- **DNS binding through Cloudflare** (`server/dns.mjs`). TXT records
  binding a handle or lexicon authority to a DID. Generic, about 20 lines;
  `bindHandle` and `bindLexicon` duplicate each other and should be tidied
  in place. Fold into an AT Protocol hosting kit only if a second project
  runs a PDS.
- **The PDS wrapper** (`server/pds.mjs`). Generic XRPC calls, but account
  creation bakes in attest's handle domain and invite flow. Goes with the
  DNS binding, if anywhere.

## Not worth it

- `server/ratelimit.mjs`: nine lines; npm has plenty.
- The fetch-dispatcher workaround in `server/atoauth.mjs`: the fix is an
  upstream report to the AT Protocol maintainers (still not filed), not a
  package that preserves the bug.
- store, records, firehose, proofs, graph, socket, http: all read or write
  attest's store; they are attest. `server/graph.mjs` could become a pure
  scoring algorithm once scores v1 exists.
