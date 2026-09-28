# 2026-09-25/26 — public pages, versioning, no cookies, accuracy pass

Point-in-time. Continues `20260923-fold-plan.md`. Public record of
the same work: https://attest.monster/changes.

## FAQ and roadmap (Anselm, 2026-09-25)

- `/faq` leads with the question readers ask most, "does this need to
  exist?". Answer given: statements about URLs/DOIs/hashes, the
  person's own inline signature on every record, a drop-in for sign-in
  and attestations, scores relative to a chosen root; and honestly,
  that attest could stop existing if Bluesky, Tangled or Hypercerts
  add URL subjects and root-relative scoring, in which case we join.
- `/roadmap`: built / next / later / still reading. Anselm's additions
  in "later": a subjective scored graph on any post relative to you;
  voting (public signed votes now, secret ballots with retroactive
  self-proof as a separate, harder problem; his case for voting more
  often on smaller questions); place-based attestations (maximum
  travel speed, "the body flies but the soul walks", adversaries may
  sign that you were not there and scoring must allow for liars on
  both sides). He has drafted an Ethereum proposal on location-bound
  contracts; number and link not known here, so none is given.
- nstar.social listed under "still reading": its pages name no
  protocol and say nothing about trust.
- The Archimedes lever line sits under the home title, at his request.

## Versioning (Anselm: continuous changes, not releases)

The home footer reads `version <deploy date> · <short sha>`, from the
`version.json` each deploy writes, linked to the commit on GitHub;
`-dirty` marks an uncommitted deploy.

## No cookies (Anselm, 2026-09-26)

Checked: no Set-Cookie anywhere; the browser keeps only the session
and last handle (localStorage) and the non-extractable device key
(IndexedDB). His point: have the user sign requests with their key
and cookies are unnecessary. That is the design already: every write
is signed by the device key, no server session. FAQ answer added;
harness memory `no-cookies-no-banners` records the rule for every
project. Account linking via Bluesky OAuth must keep attest.monster
cookie-free (the OAuth screens' cookies belong to the user's PDS).

## Accuracy pass (2026-09-26)

Technical, About, home, docs, login and llms.txt rewritten where they
still described the pre-fold log. Threat model now states that the
service holds repo signing and PLC rotation keys for accounts it
hosts, which is why the inline user signature is mandatory, and what
happens if the service stops. `/log` remains, holding only
delegations, revocations and passkey changes.

## Next

Link an existing Bluesky account for writing (OAuth, cookie check);
propose the URL-subject shape to `app.certified`; inbound trust edges
from non-members via a backlink index; scoring from a root.

## 2026-09-28: handles and the crumpled namespace

- Anselm: reserve common names, disallow short ones, "I am kind of a
  fan of crumpled namespaces" (/anselm beside /settings, /login).
- `server/handles.mjs`: 4–20 chars, `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`
  (the old rule allowed 2 chars, dots and underscores; underscores are
  not legal hostnames and dots nest subdomains). A reserved list of
  roles, infrastructure, our pages, brands and other networks; plus
  every page file and route segment reserved automatically at startup
  (caught `index`, `llms`, `tls-check`, `robots-pds`). Deleted
  accounts' handles held 365 days (`released_handles`); the account row
  is renamed so the index keeps its records under the DID.
- Profiles at `/<handle>` via the not-found handler (pages always
  win), canonical; `/@name` and `/u/name` aliases. Bluesky's app view
  already shows our accounts at bsky.app/profile/<name>.attest.monster.
- Live accounts at the time: `attest` (service) and `anselm`; both
  names are also on the reserved list. e2e 39 checks.

## 2026-09-28: people as subjects, bookmarks, Claude's account

- **Statements about people** (`server/people.mjs`): a subject URL that
  is a person's page (`/name`, `/@name`, `/u/name`, `name.attest.monster`),
  their Bluesky profile (attest handle, DID, or a proven identity), or
  the root of a site they proved, is indexed with `about_did`, fixed at
  index time. Profiles carry a widget on their own address and list
  what was said elsewhere. Anselm's point: now that /anselm exists,
  people can attest him.
- **Bookmarks** (Anselm: Delicious and tagging from an IRC backchannel,
  Pinboard, Google reading lists "very incomplete"; "basic vouching
  overlaps nicely with bookmarking"). `monster.attest.bookmark`
  {subject, title, tags ≤12, note}, rkey from the subject, editable in
  place (index row replaced; firehose `update` handled). Tags split on
  spaces and commas, hyphens join words. Filing ≠ endorsing: the save
  window's checkbox writes a separate vote. Save window `/save`, runs
  on attest.monster so the visited page never touches the key.
  Bookmarklet on `/tools`; Android share target via the web manifest
  (needs "Add to home screen"); iOS Safari cannot join the share sheet,
  so bookmarklet or a Shortcut. `/tag/word`, `/tagged/word`,
  `/bookmarks/<did>`. e2e 49 checks.
- **Claude's account** at Anselm's invitation: `claude-code`
  (`did:plc:zpa57ylzsvxn2pj2hvfo4jma`). A statement saying it is an AI
  model made by Anthropic working with Anselm; twelve bookmarks, all
  sources actually read during this work, each with a note; no vouches
  for people. Passkey is a virtual-authenticator credential kept in
  harness `private/attest-claude-account.md`.

## 2026-09-28: Kaliya Young's deck on decentralized trust graphs

Read and catalogued (reference addendum). What it suggests, in the
order proposed to Anselm: mutual vouches (their VRCs are mutually
issued); agent delegation (a VDC-shaped record: anselm delegates to
claude-code, claude-code accepts); communities as first-class accounts
issuing membership that members acknowledge, and community-rooted
scores, which also answers cold start and fits place-based work;
`/@name` answering with the DID for software, aligning with their
agent-name syntax. Their relationships are private P2P; ours stay
public. IIW #43 (Nov 3–5) is the venue to show it.

## 2026-09-28: principles and todos, after Anselm's reply to the DTG deck

Anselm: his trust graph never ended at immediate connections; trust
is transitive, second- and third-order edges score lower, in a
contextual graph; nodes can be communities; "a person *is* a
community" of agents acting as proxies for their will, and those
agents should be first-class rather than hiding under one private
key; mutual vouches weigh more; he does not want to distinguish
humans from digital persons, because proof-of-personhood schemes
need biometrics, which he finds risky ("one can make various
attestations about emitters that they are flesh and blood humans");
private relationship credentials are interesting ("sometimes people
want to keep secrets"). The session had wrongly implied attest was
peer-only; the planned scoring was always transitive.

Roadmap (public) now opens with those principles and orders the work:
mutual vouches → agent accounts (mutual delegation, claude-code
first) → communities (accounts, mutual membership, vouch and be
vouched) → scores v1 (transitive flow from a person or community
root, capacity bound, distance decay, weighted edge kinds, tag
context, paths shown) → bookmark import → Bluesky linking → inbound
edges → URL-subject proposal. Open: private relationships, community
governance (Ostrom 5 and 6), decay parameters. FAQ gained "Do you
check that I am human?".

## 2026-09-28: the home page for novices

Kaliya (via Anselm): "the plumbing exists but it is ugly"; Anselm
worried attest is "incomprehensible for a novice", liked into-the.blue's
backdrop video, is "fundamentally an environmentalist", and wanted
real humans and bridging across borders. Decisions: no photoreal
generated people on a trust site; painterly illustration, credited.
Four themes via AtlasCloud (key from reframe's swap tool env):
Seedream v4.7 stills, animated with Seedance 2.0 Fast (Wan 2.2 hung
past 15 min; Seedance ~90 s; it adds audio, and one clip was refused
for "copyright" audio until `generate_audio:false`). First hands still
drew a literal cat, the second a pentagram-like star; the third, a
woven lattice, was kept. Clips encoded silent, 1280×720, forward then
reversed for a seamless 10 s loop, ~2.5–3 MB each, in `public/video/`
with `index.json`; one per visit, stills for reduced motion. Home
rebuilt: fixed backdrop behind the page, centred story, three steps,
why, builders below on a translucent panel. `/docs` is now a hub;
integrator guide at `/builders`; menu cut to save / FAQ / about / docs
/ your page. Script: `scripts/gen-backdrops.mjs`; helper
`scripts/shot-scroll.mjs` for phone screenshots below the fold.
