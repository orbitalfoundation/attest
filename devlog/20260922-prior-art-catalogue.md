# 2026-09-22 — the prior-art catalogue, and what it decides

Point-in-time. Deliverable 1 of `20260922-plan-of-attack.md`. Source:
`reference/20260922-prior-art.md`, 48 entries across eight categories,
every row with the URL actually read and the access date; 12 sources
could not be opened and are listed as UNVERIFIED with the substitute
used. This entry is the distillation; the table is the evidence.

## The gap is real

Nothing found combines all four of: ordinary sign-up with a hosted key;
signed attestations on arbitrary URLs and emitters; a public read
endpoint a static site can render; and trust by bounded flow plus
resolved-claim track record, with burnable identity. Each of the five
nearest efforts is missing at least two.

## The five nearest, and the gap in each

1. **AT Protocol labels and Ozone.** Signed, revocable, DID-sourced
   annotations distributed separately from hosting, with an open
   moderation UI. Gap: targets are `at://` and `did:` only; labels are
   tags with no score, no vouching, no track record.
2. **Advogato's trust metric and Levien's metadata HOWTO.** Flow from a
   seed through certifications with a per-level capacity bound,
   generalised to assertions about arbitrary identifiers. Nearest in
   spirit to the scoring we want. Gap: dead since 2016, one seed, no
   resolved claims, no burning of identity.
3. **Ethereum Attestation Service, off-chain.** Schema, attester,
   recipient, reference, revocable, expiry, signed and verifiable
   off-chain. Gap: wallet identity and chain gravity; no scoring.
4. **Community Notes with the 2026 per-rater quality weight.** Bridging
   consensus across a latent disagreement axis. Gap: needs tens of
   millions of ratings; scores only X posts; identity is an X account.
   No open fork found, only analysis papers.
5. **Nostr kind-17 reactions with NIP-73 targets and a web-of-trust
   oracle.** The only running system today where anyone signs a
   reaction to an arbitrary URL and a separate service answers how far
   a key is from you. Gap: distance is not trust, by their own words;
   no root, no sybil bound, no track record.

## Shapes to reuse, not reinvent

- The **atproto label record** (source, uri, cid, value, negation,
  created, expiry, signature) as our attestation envelope.
- **EAS fields** (schema, reference UID, revocable, expiry) for chaining
  supports and challenges to a claim.
- **NIP-73's identifier grammar** for targets: URL, DOI, ISBN.
- The **SIWE message layout** for keypair login, even without a chain.
- The **Brier score** definition for track record; Polymarket's
  optimistic "stands unless challenged within a window" for resolving a
  claim.
- Wikipedia's **perennial-sources vocabulary** (reliable, no consensus,
  unreliable, deprecated), each status requiring a linked discussion as
  evidence, as the non-numeric layer over a score.

## Theory that backs the design

EigenTrust (2003), TrustRank (2004; a seed set under 200 sites),
SybilGuard (2006; accepted sybils bounded by attack edges), SybilRank
(2012; rank, do not classify). All read in full. The burnable-identity
rule has a name in the literature, **whitewashing** (Seradji and Fallah
2017; the Hoffman survey; Kuntze 2006 prices pseudonyms to deter it).
Friedman and Resnick 2001 is verified only as a citation; the full text
was paywalled and must be read before the rule is designed.

## Things to avoid

The staff-rated outlet raters (NewsGuard, Ad Fontes, Media Bias/Fact
Check) are proprietary and carry a left-right bias axis, which the
no-party-colours rule excludes. The Global Disinformation Index, under
sanctions on its CEO since December 2025, is the failure mode of an
unaccountable rating that demonetises. Several candidates are dead or
dormant: Advogato (2016), Commento (2021), Cusdis (archived 2026-07),
Hypercerts' monorepo (archived 2025-02, records now "on AT Protocol"),
Lens (stewardship moved 2026-01).

## What this decides for deliverable 2

Build on AT Protocol's record shapes and a self-hosted PDS unless a
reason appears; extend the label record with a score field, a target
grammar that takes URLs, and vouch and claim kinds; run scoring
Advogato-style from a root with a capacity bound; publish scores as a
labeler so any client can subscribe. Read Friedman and Resnick first.

## Next

- Each live, catalogued effort becomes a `project` or `site` record on
  the desk with a written dek and its provenance line (deliverable 1's
  second half); not done yet, since each card needs its own reading.
- Deliverable 2, the minimum service, on Anselm's go.
