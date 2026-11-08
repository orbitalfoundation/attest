# OpenVTI buildathon starter and the storm.ws data rooms, read 2026-11-08 (pointer from Anselm)

Sources: https://github.com/Mickens-Lab/openvti-buildathon-starter at commit 5fdd0d8 (README, docs/ARCHITECTURE,
MODES, FARM, VTC, VTC-SURFACE, ROOMS, SECURITY, TRACKS, CHEATSHEET; packages/rooms-client README; scripts
env.ts, vtc-join.ts, rooms-persona.ts; packages/vta-client identity.ts and client.ts), cloned and `npm ci`
run, `npm run doctor` run (Docker daemon not running here, otherwise ready). The DID documents of the two rooms
and of webvh.storm.ws fetched live. Anselm is at a retreat with the OpenVTC team; the notes and the room DIDs
came from a member of that team ("Mickens-Lab" on GitHub; name not given to me).

## What the kit is

A TypeScript kit (Apache-2.0) for the First Person Project's **Verifiable Trust Infrastructure (VTI)**: a
disposable local stack in Docker, clients, and templates. Its own warning: "a playground for demos and
testing ONLY. Keys are held in plaintext files." The pieces, as the code and docs show them:

| Piece | What it is |
|---|---|
| **Trust Task** | A signed JSON document: `id`, `type` (`https://trusttasks.org/spec/<slug>/<version>`), `issuer` (a DID), `recipient` (the server's DID), `issuedAt`, `payload`, and a Data Integrity proof (`eddsa-jcs-2022`). Request, response and error are all such documents. The VTA serves about 300 types |
| **VTA, Verifiable Trust Agent** | A Rust service (`vta-service`, 0.72.0 pinned) that holds a person's or app's keys: contexts, ACL roles, a vault, DID minting (`vta/webvh/dids/create`), signing for DIDs it holds (`keys/sign-document`), approvals and consent policy, audit. The person's agent, not their browser |
| **VTC, Verifiable Trust Community** | A Rust service (`vtc-service`, 0.20.0 pinned; the live room host runs 0.26.0) that runs a community: join manifest and requests, admin decisions, membership credentials (VMC) and role credentials (VAC), directory cards, endorsements, groups, relationships graph, polls, a website module, registry sync, vetting and personhood, and **data rooms**. Its DID and keys are minted by a VTA |
| **Identity** | Apps are `did:key` (Ed25519) granted an ACL row at a VTA. People are **personas**: `did:webvh` DIDs minted by the VTA and published on a DID host (`https://dids.ic3.dev/...`, or webvh.storm.ws). `did:webvh` is did:web with a hash-chained history, a self-certifying SCID, pre-rotation and `portable: true` |
| **Messaging** | DIDComm v2 and the Trust Spanning Protocol (TSP) through a **mediator**; credentials are pushed to members this way. Off in local mode, on in tunnel mode |
| **Data rooms** | Shared spaces on a VTC: chat, notes, files, with a record history. Tiers `open` (plaintext, members only), `attributed` and `private` (MLS-sealed; the member's VTA holds the group keys and seals and opens records). Every call carries a presentation of membership credentials. Host document cap 64 KiB; sealed files about 34 KB; open-room blobs 100 MiB |
| **Hosting** | `MODE=local`: Docker, a cold Rust build of 25 to 40 minutes per image (VTA, VTC), no prebuilt images. `MODE=farm`: VTA Farm (https://vtafarm.ic3.dev, "staging, preferred"), self-service sign-up with email and passkey in a browser, "cannot be scripted", two agents per person, "wiped and rebuilt on 2026-09-29/30", "moves often" |
| **Browser** | A Farm VTA's CORS allows only the wallet extension origin; the templates proxy through Vite. A deployed site needs its own backend holding the key (their hardening ladder, L1). "Passkeys authenticate a human to a service; they are not usable to sign Trust Task documents" (L4) |

Verified live by the kit's authors on 2026-11-08: open room join, post, read; attributed room with a persona
(key-package, accept, welcome, sealed post, read back), one host, one run. Unverified: `private` rooms, a
second member in a sealed room, epoch changes, ts-mls against openmls.

## The two rooms

| Room | DID | Tier (per the note) |
|---|---|---|
| rate-ostrich | `did:webvh:QmU2VwVYvGtgWJcgVf8gXBdyLT2KLKoAiBKki82uj1fnnV:webvh.storm.ws:rate-ostrich` | attributed, encrypted |
| twist-assault | `did:webvh:Qmc549Hw3u5QcLEbyQvMRnZ5b5tuzxpZMkXcutn3w3YHnq:webvh.storm.ws:twist-assault` | open |

Both DID logs resolve (created 2026-11-08 20:11Z and 20:22Z, one Ed25519 key each, `portable: true`). Their
service entries name only the mediator `did:webvh:...:webvh.storm.ws:mediator`, whose document gives
`https://mediator.vtc.storm.ws/mediator/v1` (TSP, DIDComm, authenticate). **Neither document names the VTC
that hosts the room.** `vtc.storm.ws` has a DNS record (an AWS load balancer) but refuses connections; the
`/health` paths on the mediator host return 404. webvh.storm.ws itself is a "DID Hosting Manager" web app.
So the community's `VTC_URL` and `VTC_DID`, which the kit needs for `vtc:join`, are not discoverable from
what we were given and must come from the room owner.

## What joining takes

- **Open room:** an identity (any `did:key`), `vtc:join` to the community (admin approves), the owner adds
  the DID to the room, `rooms:accept`, then post and read. No VTA is needed on the wire for an open room: the
  client presents the credentials inside the offer.
- **Attributed room:** a persona `did:webvh` that a VTA holds and that is published on a DID host, the
  persona joins the community, the owner offers the room to the persona, the VTA does key-package, accept
  and welcome. So it needs a VTA with a DID host: the Farm (a passkey sign-up in a browser, Anselm's step)
  or a local VTA plus a DID host someone registers for us.

## Drummond Reed's "Website vs. VTC" (slide shown to Anselm at the retreat, 2026-11-08)

Header: "First Person Project · VTI Architecture. A Verifiable Trust Community is a node on the Decentralized
Trust Graph — the trust-layer analog of a website on the Web." Transcribed from the image; the PNG itself is
not in this repository (I cannot write an image from the conversation; drop it in `reference/` if wanted).

| Attribute | Website | VTC |
|---|---|---|
| Address | URL / domain name, resolved via DNS | DID (self-certifying identifier), resolved via a DID method, no central registry |
| Spanning protocol | HTTP(S) over TCP/IP | Trust Spanning Protocol (TSP) over the ToIP stack |
| Who can connect | Anyone with a browser, open, anonymous by default | Members only; joining requires a credential (VMC) or invitation (VIC) |
| Trust basis | TLS cert proves domain ownership only, says nothing about operator or visitor | Verifiable credentials (VMC, VRC, VDC…) assert real relationships between accountable parties |
| Governance | Terms of service, set unilaterally by the operator | Formal governance framework: membership classes, policy (e.g. Rego), dispute resolution |
| Discovery | DNS + search engines | Trust Registry Query Protocol (TRQP), "DNS for trust" |
| Hosting | Lives on a server the operator controls | Cloud-hosted (Fiduciary Service Provider) or self-hosted via a VTA; supports multi-device / multi-admin |
| Network unit | Hyperlinks connect sites into the Web graph | VRCs / VICs connect people and VTCs into the Decentralized Trust Graph |

"In short: a website is an anonymous, one-way publishing endpoint discoverable by DNS; a VTC is an
accountable, membership-gated trust endpoint discoverable by TRQP."

The slide's own last line is the sharpest statement of the difference from attest: attest is a publishing
endpoint on purpose. See `devlog/20261108-atproto-vs-openvtc.md`.
