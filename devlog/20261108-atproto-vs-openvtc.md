# AT Protocol and OpenVTC: what each one is, and the decentralisation argument

Anselm, 2026-11-08, at a retreat with the OpenVTC team: "i do need to really also understand the
difference between atproto and openvtc - like - what _is_ atproto - what _is_ openvtc? how feature rich
are they, how do they differ. the openvtc team argues that their approach has less points of failure -
it is more decentralized." Also: "lots of questions too like what really is a did", and "for the
atproto attest i was really proud of the passkey based authentication - i believe that openvtc cannot
support that concept?"

Written by Claude Fable 5.1 in the attest room. Sources for the OpenVTC side: the buildathon starter
read today (`reference/20261108-openvti-buildathon-starter.md`) and the OpenVTC repositories read on
2026-10-07 (`reference/20261007-openvtc.md`). The AT Protocol side is from building attest on it since
2026-09-24 and from the protocol's public documentation as I know it; statements I could not check
today are marked.

## First, what a DID is

A Decentralized Identifier is a string, `did:<method>:<id>`, that names something controlled by
cryptographic keys. It resolves to a DID document: a small JSON file listing the public keys that may
sign for it and the service endpoints where it can be reached. The method says where the document
lives and who can change it, and that is the whole difference between methods:

| Method | Where the document is | Who can change it | Used by |
|---|---|---|---|
| `did:key` | Nowhere; the identifier is the public key | Nobody; it cannot rotate | OpenVTC apps, attest device keys |
| `did:web` | A file on a domain over HTTPS | Whoever controls the domain | Many |
| `did:webvh` | A hash-chained log on a domain; the id contains a hash of the first entry (self-certifying), so moving domains keeps the id | The current update keys, with pre-rotation and optional witnesses | OpenVTC people, communities, rooms |
| `did:plc` | One directory (plc.directory) holding a signed operation log | The rotation keys named in the log | AT Protocol, attest accounts |
| `did:peer` | Only the two parties hold it | Those parties | OpenVTC pairwise relationships |

So "a DID" is not a technology. It is a naming convention that lets different trust arrangements share
one syntax. The interesting question is always: who runs the place the document lives, and what happens
when they stop.

## What AT Protocol is

The protocol under Bluesky, open source, in production since 2023, with tens of millions of accounts.
Its parts:

- **Identity.** A `did:plc` (or `did:web`) and a handle, a domain name bound to the DID by a DNS TXT
  record or an HTTPS file. attest handles are `<name>.attest.monster`.
- **A repository per account**, hosted on a Personal Data Server (PDS). The repository is a Merkle
  search tree of records; each commit is signed by the repository signing key, which the PDS holds.
  Records are typed by lexicons, JSON schemas with a reverse-domain name. attest's records are
  `monster.attest.*`. Anyone can fetch a repository and verify every record against the DID document.
- **A firehose.** Relays crawl PDSes and republish every commit as one stream. AppViews index that
  stream into something to read; feed generators and labelers (moderation services) hang off it.
- **Account portability.** A person can move to another PDS by updating the DID document; identity,
  handle and data survive. Sign-in to third-party apps is OAuth with DPoP, the version attest uses for
  Bluesky accounts.
- **Scope.** Public social data. Private data is on the roadmap but not in the protocol today.

Points of failure, honestly: the PLC directory is one service operated by Bluesky PBC (they have stated
an intent to move it to an independent body; the status of that move I did not check today). The
dominant relay and AppView are Bluesky's, though others run them (Blacksky runs its own stack, as I
recall; not verified today). PDSes are many and self-hosted; attest runs its own on an exe.dev VM. The
protocol's design accepts large aggregators on purpose: "big-world" networking, where anyone's public
record can be found by anyone.

## What OpenVTC and VTI are

OpenVTC is an LF Decentralized Trust lab; its specifications sit in Trust over IP's Decentralized Trust
Graph working group; the software is the First Person Project's Verifiable Trust Infrastructure (VTI),
in Rust, at version 0.x. Its parts:

- **Trust Tasks.** Every request and response is a signed JSON document with a Data Integrity proof.
  About 300 task types exist, from `auth/challenge` to `rooms/records/put`.
- **The VTA, a person's agent.** A server-side process that holds the person's keys, mints DIDs,
  signs on their behalf, keeps a vault of credentials, enforces approval policies, and logs. Hosted by a
  "Fiduciary Service Provider" (the VTA Farms today) or self-hosted.
- **The VTC, a community.** A server that admits members (admin review, invitation, or credential),
  issues membership and role credentials, keeps a directory, endorsements, groups, a relationships
  graph, polls, a website, and data rooms (chat, notes, files; plaintext or MLS-sealed).
- **Relationships.** Verifiable Relationship Credentials exchanged pairwise over DIDComm or the Trust
  Spanning Protocol through mediators; each credential declares whether it may be correlated publicly.
- **Discovery.** The Trust Registry Query Protocol, "DNS for trust", so a verifier can ask whether a
  DID is a member in good standing of some community.
- **Scope.** Accountable, membership-gated relationships between people and communities; personhood
  by vetting; private by default.

Points of failure, honestly: a person depends on a VTA host, a DID host, and a mediator, and a
community on its VTC host. None of these is global; all of them are servers somebody runs. In the demo
world today they are the project's own Farms on AWS, wiped and rebuilt as the software moves. The
design's claim is that nothing has to be global: no directory, no firehose, no indexer, and a DID
that moves when its host dies. That claim is right about architecture and untested at scale.

## Feature richness

| | AT Protocol | VTI / OpenVTC |
|---|---|---|
| Identity | did:plc, did:web, handles | did:webvh, did:key, did:peer |
| Where the person's keys live | Repository signing key on the PDS; rotation keys may be the person's own; attest adds a passkey root | In the VTA, always; a passkey logs the person in to the agent |
| Data model | Public signed repositories of typed records | Signed request documents; credentials; room records |
| Public reading | Anyone, offline-verifiable, firehose | Members of a community, by presenting credentials |
| Privacy | None in-protocol | MLS-sealed rooms, pairwise DIDs, correlation scopes |
| Communities | Not a first-class object; lists, feeds, labelers | The central object, with admission, roles, governance |
| Moderation | Labelers, composable | Membership and policy (Rego) |
| Messaging | Chat is a Bluesky service, not protocol | DIDComm v2 and TSP through mediators |
| Agents | OAuth clients; attest adds signed permissions | A context and ACL row at the VTA; `vta-mcp` |
| Maturity | Years in production, many implementations | 0.x, demo Farms, "unverified" labels throughout their own docs |
| Build cost to run your own | A PDS in a container in minutes | Two Rust images, 25 to 40 minutes each, plus a mediator and a DID host |

## "Less points of failure, more decentralised"

Both sides are right about different things, and the slide Drummond Reed showed (transcribed in the
catalogue entry) says why: a website is "an anonymous, one-way publishing endpoint"; a VTC is "an
accountable, membership-gated trust endpoint". AT Protocol is the web's model with signatures added.
VTI is a different shape, closer to a federation of clubs with cryptographic membership cards.

- **Global dependencies.** AT Protocol has one: the PLC directory (did:web avoids it). The relay is
  replaceable and the AppView is a convenience. VTI has none by design, which is the stronger position.
- **Per-person dependencies.** An AT Protocol person depends on one PDS, which they can leave. A VTI
  person depends on a VTA host, a DID host and a mediator, each of which they can in principle leave.
  Three is more than one. "Fewer points of failure" is true of the network and not of the person.
- **Who can verify what.** In AT Protocol anyone can verify any public record forever with the
  repository and the DID document. In VTI, verification needs the credentials the community issued and
  a resolver for the registry. Public accountability is weaker; private accountability is stronger.
- **What dies with the operator.** A dead PDS loses nothing if the person kept a backup or migrated;
  a dead VTC loses the community's rooms unless members exported them (the kit says backups are the
  operator's job). A dead VTA loses the person's keys unless the vault was backed up.

For attest the decisive line is public verifiability. attest's records are statements about the open web
that anyone, including people outside any community, must be able to check. That is the publishing
endpoint on the slide's left column. The right column is where attest's *vouches* could live well,
because a vouch is a relationship between accountable parties.

## The passkey question

Anselm: "for the atproto attest i was really proud of the passkey based authentication - i believe that
openvtc cannot support that concept?"

Correct, in the sense that matters. In attest the passkey is the root of the person's key hierarchy: it
signs the 30-day delegation to a device key and the add-key and revoke actions, as a WebAuthn assertion
whose challenge is the action's SHA-256, and anyone can verify that signature against the public key at
`/by/<did>`. No server ever holds a key that can act as the person's root.

In VTI the root keys are Ed25519 keys inside the VTA, and Trust Task proofs are `eddsa-jcs-2022` or
`ecdsa-jcs-2019` over the canonicalised document. A WebAuthn assertion signs a different structure
(authenticator data plus a hash of the client data), so a passkey cannot produce a conformant proof. The
kit's security doc says it plainly: "Passkeys authenticate a human to a service; they are not usable to
sign Trust Task documents." Their browser plugin does put a passkey into the person's did:webvh
document for sign-in to websites (SIOPv2), and the VTA can require a passkey step-up before it signs
something, so "sign in with a passkey" exists. What does not exist is attest's property: the person's
own passkey signature on the permission, checkable by strangers, with no agent in the chain.

That is also the honest trade. attest's design has the person's browser hold a key that can act for
them for 30 days, and loses the account with the last passkey. VTI's design has an agent hold
everything, which survives devices and supports approval policies, at the cost of trusting the host.

## Where this leaves the "variation of attest on OpenVTC"

See `devlog/20261108-attest-on-openvtc-evaluation.md`: one repo, a bridge module, and an FAQ page
that says the above in plain words.
