# Evaluation: a variation of attest on OpenVTC

Anselm, 2026-11-08: "i want to have a variation of this site - that attempts to use openvtc. this may be
different enough that it needs a separate repo. you are probably going to need to inspect this closely"
with notes from a member of the OpenVTC team (the buildathon starter, two data rooms, "let me know when
you have made your join request"). Then: "evaluate before making a new repo", and later "maybe there
can be an faq. if we are able to have a single repo - it can discuss the differences in this way - it
just seems so complicated."

Work by Claude Fable 5.1 in the attest room. The starter was cloned into the session scratchpad
(`/tmp/claude-1003/-home-anselm-projects-2027-attest/0179d0db-059d-46b4-85cd-dfb9e972e02b/scratchpad/vendor/openvti-buildathon-starter`),
`npm ci` and `npm run doctor` run. Nothing was built, no key minted, no repo made. Catalogue entry:
`reference/20261108-openvti-buildathon-starter.md`. Comparison: `devlog/20261108-atproto-vs-openvtc.md`.

## What "attest on OpenVTC" would have to change

| attest today | On VTI |
|---|---|
| Account = passkey + a did:plc repository on our PDS | Account = a did:webvh persona whose keys a VTA holds; the passkey only logs in to the agent |
| Record = public signed record in the person's repository, on the firehose, verifiable by anyone | Record = a signed Trust Task document or a data-room record, readable by members who present credentials |
| Vouch = a public record | Vouch = a Verifiable Relationship Credential, pairwise and private unless its scope says otherwise |
| Community = none; trust flows from a root you choose | Community = a VTC with an admin who approves joins |
| Static sites read one public endpoint | No public endpoint; a site would need a backend holding a VTA key (their L1) |
| Infrastructure = one Node process and a PDS | A VTA, a VTC, a mediator and a DID host; two Rust images at 25 to 40 minutes each, or the demo Farm |

Three of attest's premises invert: public by construction, keys rooted in the person's own browser,
nobody to ask for admission. What remains is the name. A "variation" would be a different product, a
membership community with sealed rooms, and would deserve a different name and repo if it were wanted.
It is not what attest is for.

## Recommendation: one repo, a bridge module, an FAQ

Keep attest where it is. Add, in order, each small and each reversible:

1. **An attest agent in their community.** A did:key for attest (open room) and, once we have a DID
   host, a persona (attributed room). Joins the community, posts into the rooms. This is what the team
   asked for and is the cheapest way to learn the stack. A `vti/` module under the modular policy, not a
   fork.
2. **Sign in with a did:webvh persona.** attest already resolves did:plc; resolving did:webvh and
   accepting a SIOPv2 `id_token` from an OpenVTC wallet lets their people into attest without an
   attest passkey. A second door, like the Bluesky one.
3. **Mirror attest's public records into a room**, as signed records with the attest signature inside,
   so a community can read what its members stand behind without leaving VTI.
4. **Vouches as VRCs**, later, if the relationship work settles.
5. **A public FAQ page** that says what a DID is, what each protocol is, how they differ, why attest
   sits on AT Protocol, and what it takes from OpenVTC. Drafted now in `public/faq.html` as a new
   section, not deployed; Anselm's pass before it goes live.

A separate repo only if step 2 or 3 grows its own interface.

## The join request: blocked on one fact

The two room DIDs resolve and name only a mediator (`mediator.vtc.storm.ws`). Nothing we were given
names the community's VTC. `vtc.storm.ws` exists in DNS but refuses connections. The kit cannot apply
without `VTC_URL` and `VTC_DID`. Ask the room owner for both. Then:

- **Open room (twist-assault):** I can apply at once with a did:key held in attest's private config; no
  VTA needed on the wire. The owner then adds that DID to the room.
- **Attributed room (rate-ostrich):** needs a persona did:webvh held by a VTA with a DID host. Two
  routes: Anselm signs up at https://vtafarm.ic3.dev with a passkey (five minutes, the kit says it
  cannot be scripted; pick image `0.72.0-26d0da81`) and gives me the agent name; or the team registers
  us a DID on webvh.storm.ws and we run a local VTA (Docker daemon is installed but not running here;
  one 25 to 40 minute build). The Farm route is quicker and is theirs to wipe.

## Passkeys

Answered in the comparison: VTI cannot make a passkey the signer of documents; its passkey logs the
person in to the agent. attest's passkey-rooted delegation is a real difference and should stay.

## Later the same day: what was done while waiting for the community's address

Anselm: "ok do what you can - i will get that info for you."

- **attest's identity in their system** is minted: `did:key:z6MkiJhsEFmq8nMzTUnHK58zpCybjkDtjPiQvZTBti2tDWVS` (a did:key; the seed is in the harness
  private notes, `private/attest-vti.md`, and in the kit's `.env` in the session scratchpad). This is the
  DID to give the owner of the open room. The attributed room will need a persona did:webvh instead,
  which waits on a VTA with a DID host.
- **A local VTA image is building** in the background from the kit's pin (vta-service 0.72.0, release
  commit 26d0da81), VTC left out. Docker was already running; this user was added to the `docker` group
  to reach it. The build gives a VTA to run `hello` and the client against; it does not give a DID host.
- Nothing applied yet: the community's `VTC_URL` and `VTC_DID` are still unknown.

## Evening: the Farm agent, and the local agent answering

- Anselm created the Farm agent `attest-monster` at vtafarm.ic3.dev (portal default image 0.78.0 nightly,
  not the kit's 0.72.0 pin; to be seen at provisioning). The kit minted the admin key on canada1
  (`npm run farm:setup`); its DID went to the portal's "Admin DID" field. Agent URL
  `https://vta-attest-monster.ic3.dev`, DID on `dids.ic3.dev`; health 404 until deployed. Keys in
  `harness/private/attest-vti.md`. The kit's `.env` is set up for farm mode with attest's existing
  did:key as the app identity, so `vta:provision` will keep that DID.
- The local VTA image built on the second try (16 GB cap, 12 cores, 11m50s; the default 6 GB cap ran out
  of memory). Brought up under `ENV_FILE=.env.local`, no VTC. `npm run hello`: 289 Trust Tasks, a signed
  `auth/whoami` answered with the application role's capabilities (`sign-document`, `room-present`,
  `room-open` among them). So the client path is proven here before the Farm agent exists.
- The local VTA lists no DID hosting server (`vta/webvh/servers/list` is empty) but serves
  `vta/webvh/servers/register/1.0`, so a persona could be published from a self-hosted agent if we ran
  or were given a DID host. The Farm agent has one (`control` on dids.ic3.dev), which is why the
  attributed room goes through it.
