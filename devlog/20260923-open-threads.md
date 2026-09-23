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
