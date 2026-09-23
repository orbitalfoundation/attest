# 2026-09-23 — open threads before the minimum service

Point-in-time. Continues `20260922-prior-art-catalogue.md`. Anselm asked
to extend the thinking before any code. Positions below marked
*proposal* are the session's, not decided; everything else restates
what the two earlier entries fixed.

## 1. Trust from whom? The root is a parameter, not a constant

The plan names "a root (Anselm's key)". The catalogue's Advogato row
lists single-seed centralisation under *avoid*. Those conflict.

*Proposal*: a score is never absolute. The read endpoint takes a root
(one DID, or a small set), and the answer is "trust in X, as seen from
R". The desk queries with Anselm's key as R; another site queries with
its editor's key; a reader could query with their own. This is what
nostr-wot already does with distance, and what Levien's HOWTO does
with seeds. It also makes the service politically neutral by
construction: it holds no opinion about who is trustworthy, only
arithmetic over signed vouches from a root the asker chose. The
no-party-colours rule falls out for free.

Cost: no single "the score" to print on a card. Consumers must say
whose view they show. That is honest, and it is what the desk wants
anyway (an editorial stance, signed).

## 2. What a vouch costs the voucher

SybilGuard's bound works only if attack edges are few, which means an
honest node must not hand out vouches freely. Advogato bounds this by
capacity per level; EigenTrust normalises out-trust so vouching for
more people gives each less.

*Proposal*: both. Each identity has finite out-capacity (normalised,
EigenTrust-style), so a vouch is a share of your standing, not a free
tag. And when an identity you vouched for is burned or challenged
successfully, that is a resolved claim against your track record: "I
know this author" was a claim, it resolved false. Vouching then costs
exactly what it should: a piece of your own record. This is the link
between the two signals the plan keeps separate.

Open: does a vouch expire? Atproto labels carry `exp`. A vouch that
must be renewed yearly is cheap to implement and forces the graph to
decay toward the people who are still around.

## 3. Negative attestations do not propagate

Challenges, downvotes, "this is a bad actor". EigenTrust has no
negatives; Advogato has none; the literature on propagating distrust
is thin and the catalogue found nothing running.

*Proposal*: negatives are evidence, not flow. A challenge on a claim
enters that claim's resolution; a challenge on an emitter is displayed
alongside the score, weighted by the challenger's trust from the same
root, but it never reduces anyone else's score by propagation. What
does reduce an emitter's score is their own record: claims that
resolved false, vouches that resolved false. Nobody can be talked
down; they can only be shown to have been wrong.

## 4. What an emitter is

The word covers a person, a site (`did:web`), and a byline at a site.
The catalogue's did row proposes sites as `did:web` and people as
hosted keys.

*Proposal*: three kinds of subject, one score function. A site vouches
for its bylines (the site's key signs "this author writes here"); an
author's standing travels with them across sites; a site's standing is
partly the aggregate of its authors and partly its own resolved
claims. Anonymous bylines score as the site alone. This gives the
burnable-identity story a second layer: an author can burn a personal
key but the site's vouch was for that key, so the site must re-vouch
the new one, and that re-vouch is itself a claim on the site's record.

## 5. Track record needs a resolver

Claims resolve on a date. Someone must say how. The catalogue takes
Polymarket's optimistic rule (stands unless challenged in a window) and
Brier for the score.

Open, no proposal yet: who may propose a resolution, and from which
root is the resolver's weight computed. If resolutions are themselves
attestations from trusted keys, this reduces to thread 1 and 2 and
needs no new machinery. The desk's claims tracker is where to find out
whether that is enough; it has the claims and no other resolver.

## 6. Cold start

Trust flow from one root over a graph with nobody in it returns zero
for everyone, which is correct and useless. Two seeds exist already:
Anselm's Bluesky follows, and the desk's list of outlets it already
cites. Wikipedia's perennial-sources list is a third, with its
discussion links as evidence.

*Proposal*: import nothing automatically. Offer a one-click "vouch for
everyone I follow" on first sign-in, so the edges are still signed by
the person and still cost capacity. A follow is not a vouch until
someone says it is.

## 7. Read before designing

Friedman and Resnick 2001 is still verified only as a citation. The
burnable-identity rule rests on it. Thread 2 and 4 both depend on what
they actually show about newcomers. Read it first; the catalogue entry
says the same.

## Not touched here

The name, sign-in providers, `did:web` versus `did:plc` for our own
accounts, hosting, whether a public ledger ever enters. All still open
from `20260922-plan-of-attack.md`.

## Addendum, same day: a pasted discussion

Anselm pasted a discussion between himself and another assistant (not
this session) on ledgers, C2PA, key custody and chokepoints. His own
lines are quoted; the other assistant's factual claims (C2PA has no
ledger and a paid CA list; the Web of Trust browser extension sold
browsing histories; Keybase's fate; Manifest V3) came with its own web
search and are **not verified here**. They are recorded as claims to
check, not as catalogue rows. What it settles or adds:

### Settled by Anselm's words

- **The key is the identity.** "I don't feel like one needs to bind a
  key to a person - a key itself builds rep. It can burn rep as well."
  A person may claim a key (Keybase-style proof on a public site) but
  the claim is optional. Thread 4 above is therefore wrong in one
  respect: an emitter is a key, full stop; "person", "site" and
  "byline" are what a key's holder chooses to prove about it.
- **Attestations are the anchor; everything else is rebuildable.**
  "anybody can build the rest of the fabric themselves." The other
  assistant called this the narrow waist. Consequence for us: the
  commons is signed statements, append-only, mirrored. Score
  computation is *not* in the commons; it is one client among many.
  This is thread 1 made structural, and it dissolves "who owns the
  score" before it starts.
- **Raw ledgers are too low-level.** Recovery is unsolved there, and he
  wants "slow money" as a general principle: nothing irreversible
  should also be fast. The other assistant's line, "rate limits are a
  security primitive", is the same rule as years-to-rebuild-rep.
  *Slow trust*: an identity's standing can only rise at a bounded rate.
  This belongs in the score function, not just the social norm.
- **Curating a trust graph is basic social hygiene.** He expects people
  will have to do this work. The other assistant's reframe: this is
  the ancestral default returning, the broadcast century was the
  anomaly; "gardening, not homework". Thread 6's one-click "vouch for
  who I follow" is the first gardening tool.
- **"The CT logs idea is interesting."** Not decided, but the open
  question "whether a public ledger ever enters" now has a candidate
  answer: a Certificate-Transparency-shaped log (append-only Merkle
  structure, few writers, anyone can audit and mirror), not a chain.
  *Note from memory, verify*: an atproto PDS repo is already a signed
  Merkle search tree and the relay firehose is already a mirror; a
  self-hosted PDS plus one independent mirror may give most of CT's
  properties for free. Worth a catalogue row on CT itself and on
  OpenTimestamps for existence proofs.
- **A browser plugin as chokepoint**, filtering social sites "including
  twitter", scoring at least articles. He wants this.

### Added by the other assistant, worth keeping

- **Two-tier attestation.** Institutions hold keys and sign content
  into the log; separately they attest "this byline is a real human in
  our employ"; the author's own key is optional. The DKIM precedent:
  signing scaled when the domain did it and the individual never saw
  it. And the case that matters for journalism: a source under threat
  needs *pseudonymous key with institutional voucher* as a first-class
  citizen, never an exception. This fits thread 4 once "emitter = key"
  is applied: the masthead's vouch is an attestation from one key about
  another.
- **"Trusted by people you trust", never "trustworthy".** Sybil
  resistance is easy locally and unsolved globally, and this design
  works because it only ever asks the local question. The badge must
  say from whom. Confirms thread 1 and names its UX cost.
- **Edge cost, three kinds**: time (age-weighted edges), liability
  (reputation flows out through vouches, a bad vouch damages you), and
  attested history (the log gives the longitudinal record). Thread 2
  had the second; add the first.
- **The first mass consumer may be a model, not a person.** Retrieval
  agents must weight sources now and degrade visibly when they cite
  slop; they are not hosted inside the adversary's browser. Design the
  read endpoint for batch scoring of many URLs from a root, not only
  for one card on one page. This is new and changes deliverable 2's
  endpoint shape.
- **The plugin's failure mode is surveillance.** If the claim about the
  Web of Trust extension holds, the lesson is: a trust filter that
  phones home with every URL you visit is a browsing-history collector.
  *Proposal*: reads must be private even though attestations are
  public. Either the client scores locally from a mirrored log, or the
  endpoint answers by hash prefix so it never learns the URL. This is a
  constraint on deliverable 2, not a later feature.
- The plugin is the **reference client** that proves the fabric
  renders; the plugin on X is DOM-scraping against a hostile surface;
  the browser vendor is a landlord (Manifest V3 as precedent, claim
  unverified here).

### Revised list of what deliverable 2 must have

Restating with the above folded in: an attestation is a signed record
from one key about a target (URL by NIP-73 grammar, or another key);
records go to an append-only, mirrorable log; a read endpoint takes a
root and a batch of targets and answers with trust-weighted results
that name the root; reads are unlinkable to the reader; scores rise at
a bounded rate. Everything else (plugin, model client, resolver, site
vouches for bylines) is a client or a later kind.

### Not this project's

The first part of the paste is a critique of a Dingo Daily article's
writing (it tells the reader what to think, "bad actors" misused, a
moralising summation). That belongs on the desk and in the writing
rules; a feedback memory was saved so every room sees it.
