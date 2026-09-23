# 2026-09-22 — plan of attack

First real entry; continues `20260922-init.md`. Point-in-time. Rests on
the discussion with Anselm today in the desk session, recorded in
`~/projects/devlog/20260922-emitter-trust-idea.md` and in the desk's
`devlog/20260921-arguer-articles.md` (addenda of 2026-09-22).

## What this is

Anselm: "I've often wanted to start a standalone attestations and social
graph filtering site." He is fed low-quality articles and posts from
known bad actors with no trust filtering anywhere; "I liken this to the
food and drug administration, or to a river; I am being fed pollutants
and there isn't even any scoring." He needs "a way to score emitters."
Separately, a site like The Future Times should not have to build its
own votes, comments and identity, nor hand its articles to a platform
that owns that moat. Both are the same service.

He will build it out over time, or recycle what exists, stage it and
run it; the desk uses it when it is ready. Working name `attest`, his to
change.

## Principles fixed today

- **Score emitters, not items.**
- **Identity is disposable, not soul-bound.** An emitter can burn an
  identity by acting badly and re-earn trust on a new one. This works
  only if newcomers start at zero and trust is earned slowly, so
  whitewashing gains nothing (Friedman and Resnick, "The Social Cost of
  Cheap Pseudonyms", 2001). Default is distrust.
- **Sybils are a non-issue by construction.** Trust computed by flow
  from a root through vouches bounds an isolated cluster at zero
  however many keys it holds. Consequence: consumers get trust-weighted
  counts, never raw ones, once scoring exists.
- **Two signals**: graph trust (vouches) and track record (claims that
  resolved, scored on calibration). The desk's claims tracker is the
  second in miniature.
- **Separable from content.** The service holds identity, attestations
  and scores; a consuming site only fetches and renders.
- **Public by construction.** Attestations are signed public records;
  analytics from them are public, to competitors too. Private metrics
  are somebody else's product.
- **Reuse before invent.** AT Protocol is the closest existing fabric
  (DIDs, hosted signed repos, OAuth, labelers, AppViews); adopt its
  record shapes unless the catalogue finds a reason not to.

## Deliverables, in order

1. **Prior-art catalogue** (`reference/20260922-prior-art.md`, research
   pass running as this is written): every effort we can find, read,
   with what it scores, how identity works, whether it is separable
   from hosting, and what to reuse or avoid. Also the desk's records:
   each catalogued effort that is live becomes a `project` or `site`
   card there, which is the desk's third-party stream (M5) done for
   real.
2. **The minimum service.** Sign-up with a hosted key; an attestation
   record (subject URL, kind, body, signature, timestamp); a public read
   endpoint by URL; rate limits and caching from day one. Standalone or
   over a self-hosted PDS, decided after the catalogue.
3. **The desk consumes it.** A fetch-and-render behind a flag replaces
   the placeholder votes on futuresdesk.ai.
4. **Vouches and scoring.** "I know this author" attestations, a root
   (Anselm's key), flow-based scores, trust-weighted counts. The
   labeler pattern, so any AT Protocol client can subscribe to the
   scores too.
5. **Track record.** Claims with resolution dates, scored, feeding the
   emitter score.

## Not decided

- The name. Sign-in providers for the mainstream path. Whether our
  accounts are `did:web` or `did:plc`. Where it runs (an exe.dev VM is
  the default for a service with state). Whether a public ledger ever
  enters.
