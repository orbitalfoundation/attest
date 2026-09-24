# Prior art, additions of 2026-09-23

Provenance: two pointers from a reader's feedback on the Substack post,
read the same night with WebFetch and curl. Same columns as the
2026-09-22 catalogue; nothing from memory.

| Name | What it is (quote) | Runs it | Status | Licence | Model | Identity | Separable | Reuse or avoid | URL | Accessed |
|---|---|---|---|---|---|---|---|---|---|---|
| badge.blue, "CID-First Attestation Specification" | "This specification defines how any party may attach cryptographic attestations to an AT Protocol record"; "any cryptographically verifiable statement bound to a specific record, made by a specific key, in a specific repository" | Spec page unattributed on the page; reference implementation is the Rust crate `atproto-attestation` by ngerakines (docs.rs: v0.14.5, 2026-09-21, MIT); source hosted at tangled.org (503 when read) | Live spec, live verifier at /verify ("Verification runs entirely in your browser") | Crate MIT; spec licence not stated | A `$sig` metadata object (`$type`, `repository` auto-added, `key`, custom fields such as `issuer`, `issuedAt`, `purpose`) is inserted into the record, the `signatures` array stripped, the whole serialised as DAG-CBOR, hashed SHA-256, wrapped as CIDv1 (codec 0x71, base32 `bafy…`); the CID bytes are what the key signs. Inline attestations: `{ $type, key, cid, signature: { $bytes } }` in the record's `signatures` array. Remote attestations: a proof record in the attestor's own repo, referenced by `com.atproto.repo.strongRef` `{ uri, cid }`; "the source record's repository owner still controls what appears in the signatures array". Signatures normalised to low-S; P-256, P-384 and K-256 | Keys as `did:key`; repositories as DIDs | Yes: attestations about records in any atproto repo | Reuse: binding the context (their repository DID) into the signed payload so a signed thing cannot be replayed elsewhere; low-S normalisation; the split between inline signatures and third-party proof records the owner may or may not reference. Avoid for us: subjects are atproto records only, and ids are DAG-CBOR CIDs where ours are sha256 over canonical JSON; a v2 could adopt CIDs for interop | https://badge.blue/ ; https://badge.blue/verify ; https://docs.rs/atproto-attestation | 2026-09-23 |
| socialweb.computer, "Compute Contracts" | "pre-alpha software" that "has yet to have a thorough review"; a marketplace where ATProto accounts request and offer compute through RFP → bid → accept → receipt records | GitHub org `publicdomainrelay` (the reader calls the builder Johnny; no name on the pages read); 251 commits | Pre-alpha; blog post "Compute Contracts Pre-Alpha" dated July 18 (year not shown) | Not stated | Lexicons `com.publicdomainrelay.temp.market.{rfp,bid,accept,receipt}`, `…compute.vm`, `…compute.events.vm.onNetwork`. Access governed by a policy engine (`only-me`, `tangled-vouch`, RBAC); the protocol text uses "Alice has vouched for Bob" and "Alice has denounced Eve". Identity associated by QR at qr.fedfork.com | ATProto DIDs and Bluesky accounts | Runs natively on atproto repos | Reuse: it is a consumer of exactly the graph attest publishes, a policy that says "only keys vouched for by my graph may bid". Its `tangled-vouch` policy name suggests vouches sourced from the tangled forge; not verified. Denounce as a first-class negative is the thing our design deliberately keeps out of propagation | https://socialweb.computer/ ; https://github.com/publicdomainrelay/socialweb-computer ; https://blog.socialweb.computer/ | 2026-09-23 |

## What the two change

- badge.blue is the nearest thing to a shared *envelope* convention in
  the atproto world, and the reader's point stands: the lexicon (the
  kinds) is service-specific, the envelope need not be. Three of its
  practices are worth adopting, in order: bind the context into what
  the device key signs (our roadmap item A5, now with precedent);
  normalise ECDSA signatures to low-S; and define a CID form of our
  record id so a record can be referenced from an atproto repo. None
  changes the v1 record shape today; all three are v2 material.
- socialweb.computer is not a competitor; it is a policy engine that
  wants a vouch graph to read. That is the first concrete outside
  consumer of the labeler output in milestone 5.
