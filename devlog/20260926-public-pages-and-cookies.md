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
