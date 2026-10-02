# 2026-10-02 · Trustgraphs, a second look: what it is to attest

Anselm: "i still feel like we didn't fully think through all the benefits ... it is a working
example focused on actual trust graphs - ostensibly our goal - even though we are more low level
today and focused on attestations." He was talking with Jake Hartnell at the time; Jake: "Wasn't
my first go at trustgraphs. This version is ZK and onchain (controlling a DAO or funding
distribution). There is an experimental hypercerts AT Protocol prover… but I haven't gotten around
to fully setting it up."

Read for this entry (2026-10-02), beyond the first pass: docs "Networks and programs",
"Sub-networks", "Integrate proven outputs", "Weighted prior", "Contributions"; repo research notes
`HYPERCERTS_ATPROTO_PLAN.md` (status line: program "Built", "M5 pilot deploy is pending"),
`GRAPH_SEEDING.md`, and the openings of `AGENT_DELEGATION.md`, `PRIVACY_ARCHITECTURE.md`,
`SCORING_NEXT_STEPS.md`. Code not run.

## The main point: two halves of one system

attest today captures trust: passkey sign-in with no wallet, signed records in people's own AT
Protocol repositories, a PDS, a firehose index, widgets for any site. It computes nothing. Trustgraphs
computes and proves trust: deterministic scoring with a proof that no input was dropped. Its capture
side is a wallet ("Connect account, Ethereum mainnet"). Each has what the other lacks.

Jake's AT Protocol program needs, in his plan's words, "a partner running PDSes with real users".
attest runs a PDS, has a sign-in that needs no wallet, and has a first consumer in matchmaker. It
could be that program's first live deployment, or the second beside Hypercerts.

## Shared ground already there

- **Same lexicon family.** attest's inline signatures are `app.certified.signature.defs#inline`;
  the Hypercerts program reads `app.certified.graph.follow`, `app.certified.badge.*` and
  `app.certified.link.evm` from the same family.
- **Same stance on vocabularies.** His plan: "we consume their published lexicons instead of
  minting our own"; our FAQ says we would rather join a shared lexicon than duplicate one. Either
  attest writes certified-family records for vouches, or his program gains `monster.attest.*`
  semantics (a guest change and a new verification key). That is the question to put to Jake.
- **DID-only people are first class there.** "Satellite actors" (DID, no wallet) get provable
  scores at a configurable discount (0.5 at launch); binding a wallet is optional. attest's people
  are exactly that.

## Design we should take, integration or not

1. **Confirmation doubles weight.** An accepted badge or acknowledged attribution counts double;
   "being named is worth half of confirming". That gives attest's planned mutual vouches a number.
2. **Things get scores through people.** Evaluations flow trust into an artifact and out to its
   acknowledged contributors by attribution share. attest already has the pieces: votes on URLs, and
   proven claims that a site belongs to a person. Trust can flow voter → URL → the person who proved
   the site. That reconciles "score emitters, not items" with scoring pages.
3. **Only the repo owner speaks.** Self-asserted co-evaluator lists are ignored. Same as attest's
   rule for statements about people.
4. **A prior instead of distance decay.** His seeding research proposes deleting distance decay,
   since damping already supplies it, and anchoring on a weighted starting vector. attest's "scores
   relative to you" is that vector with one entry, you; a community is a list. Scores are linear
   in the prior, so any score splits into per-starting-account contributions: the maths behind our
   "show the paths that produced it".
5. **Read his findings before scoring anything.** `SCORING_NEXT_STEPS.md` reports, measured on the
   public Bitcoin OTC web of trust: vouching costs the voucher; "punishing someone always pays";
   "the score has no clock". It also proposes a complaints design that lets bad dealings count
   without negative scores. attest imports Tangled denouncements and lets them carry no weight;
   his design is a worked answer to what they should do.
6. **Determinism as a product.** Integer arithmetic, canonical ordering, golden vectors, a closed
   list of skip rules whose effects are committed. Anyone can recompute. attest can have that with
   no chain at all.
7. **Archive what you observe.** His plan: "CAR archival at observation time is mandatory (old
   commits are not re-servable; deletion is trace-free)". attest's firehose indexer already sees
   every commit of its members. Archiving repo snapshots per round makes attest a witness provider,
   and doubles as backup.
8. **Agents act for people, overrulably.** His agent delegation is shipped; it matches attest's
   planned agent accounts and the claude-code account.
9. **Honest privacy claims.** His private design claims only "coercion minimization", gives members
   score bands rather than exact scores, and says plainly which parties can still see what. That is
   the tone of today's private sign-ins work.

## Communities

His networks and sub-networks (a network that belongs to another, keeping its own rules, with
graded parent authority: Admin, Guardian with a 14-day window, Department, Label) are a worked
model for attest's planned communities. Score compositions (blend 2 to 8 networks' proven scores
at chosen shares) are "trusted by the communities I trust".

## Where we differ, plainly

- **Scope of a score.** His are per community, proven and published; ours are meant to be per
  viewer. Proving a score for every viewer on chain is not sensible. The fit: per-viewer scores
  computed by his deterministic code, off chain; proven community scores where money or governance
  rides on them.
- **Chain and wallet.** His anchors and proofs live on Optimism and Ethereum. attest users need
  never touch a chain if the operator anchors.
- **Maturity.** Alpha, not audited, one live network of 13 accounts; the AT Protocol pilot is not
  deployed. Keep attest's records in its own lexicon and treat Trustgraphs as a consumer, so neither
  project's schedule blocks the other.

## Others doing this

From a search on 2026-10-02 (see `reference/20261002-trustgraphs.md`): OpenRank runs EigenTrust
over Farcaster and Lens with commitments anyone can challenge, global and personalized, and is live;
Ethos scores credibility from vouches backed by staked ETH; Intuition is a token-curated graph of
attestations. None found proves trust scores over AT Protocol records. Trustgraphs' Hypercerts
program is the only such design found, and it is not yet deployed.

## Questions for Jake (Anselm's to ask)

1. Would his AT Protocol program take `monster.attest.vouch` (and statements) as edges, or should
   attest write certified-family records?
2. Could attest's PDS be on the anchor allowlist, with attest supplying repo archives?
3. May attest run his scoring core off chain for per-viewer scores, checked against his golden
   vectors (MIT)?
4. Is his complaints design settled enough for attest to follow?
