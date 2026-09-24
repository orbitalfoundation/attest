# 2026-09-23 — roadmap after pass 1

Point-in-time. Anselm: hold off on wiring the desk; what features can
we add? The list below is the session's proposal, ordered by what I
would build first; his to reorder. Milestone numbers refer to the
brief (`20260923-brief.md`).

## A. Make a key safe to rely on (custody, milestone 7 pulled forward)

1. **Delegation revocation.** A signed `revoke` from the root key,
   listed by the reads and checked by clients. Today a stolen device
   key acts for up to 90 days. Small.
2. **Second passkey on one account.** Today a lost passkey is a lost
   account. Register another device from a signed-in session.
3. **Export and re-import a key.** For people who want custody
   themselves; also the seed of account migration.
4. **Signed tree head over the log** plus a one-file mirror script.
   The Certificate Transparency shape: a mirror can then prove we did
   not rewrite history rather than merely notice.
5. **Bind the origin into what the device key signs**, so the origin
   check stops depending on a browser-set header.

## B. The social layer people can see (milestone 4)

6. **Public profile per handle** (`/@handle`): what the key signed, who
   vouched for it, its proofs. The page that makes a key legible.
7. **Vouch UI.** "I know this person" from a profile, with the cost
   made visible ("you have vouched for 7 keys").
8. **Proof of control.** GitHub gist, DNS TXT, a well-known file, a
   Bluesky handle; any key may post a verification. Keybase's move.
9. **Authorship of content.** Drop a file, get a signed claim on its
   hash, timestamped in the log; a "check this file" page. The
   whiskey bottle in the essay is the same shape with a label hash.
10. **Statements as a feed.** The `statement` kind exists; a signed
    public feed per key and a firehose page make it usable.
11. **Comment anchoring** to a passage (URL plus selector), Hypothesis
    style, for the desk's articles later.
12. **One-click "vouch for everyone I follow"** by importing Bluesky
    follows through the public AT Protocol API, each as a signed
    vouch the person confirms.

## C. Public standing for sites (goal 4)

13. **Per-domain page** (`/site/example.com`): most-attested URLs, live
    counts, who is vouching. The public analytics the brief promised,
    and a reason for a site owner to add the tag.
14. **Site keys.** `did:web` for a domain, proven by a well-known
    file; a site vouches for its bylines (two-tier, milestone 3 of
    the About page).

## D. Trust (milestone 5 and 6)

15. **Root-as-parameter reads**: `/read?root=<did>` returning
    trust-weighted counts by Advogato-style flow with a capacity
    bound, age-weighted edges, bounded rise. Needs B first.
16. **Publish scores as an AT Protocol labeler** so any subscribing
    client sees a root's view.
17. **Claims and track record**: claim kind with a resolution date,
    supports and challenges, optimistic resolution window, Brier per
    key.

## E. Clients and ecosystem

18. **npm publish `orbital-attest`** after a week of real records.
19. **Matchmaker as second tenant**: sign in with attest, vouches and
    posts as records.
20. **Browser extension** as reference client, with private reads
    (mirror or hash prefix).
21. **Agent endpoint**: `/read` with a root and larger batches, and a
    documented rate plan for retrieval agents.
22. **Interop out**: emit records as Nostr kind-17 reactions and as
    atproto labels, so existing clients see attest activity.

## What I would do first

A1, A2, B6, B7, B8, in that order. Revocation and a second passkey make
it safe to ask real people to sign up; the profile, vouch and proof
pages give those people something to do that the scoring later needs.
Then C13, because a per-domain page is the pitch to the next site
owner. Scoring (D) waits until vouches exist.

## Addendum, same night: first outside feedback

A reader on the Substack post pointed at badge.blue (a CID-first
attestation spec for atproto records) and socialweb.computer (a
pre-alpha atproto compute marketplace whose policies read a vouch
graph). Both read and added to `reference/20260923-prior-art-additions.md`;
About gained an "Other work" section and the technical page a table of
practices borrowed and still to adopt. Roadmap changes: A5 (bind the
context into the device signature) now has a precedent and a v2 record
shape to carry it; add low-S normalisation; define a CID form of the
record id for atproto references. socialweb.computer is the first named
consumer for the milestone 5 labeler.

## Addendum: the lexicon argument (reader comment, 2026-09-23)

The reader: the benefit of storing attestations as records on the
protocol is "borrowing meaning from the lexicons across use cases";
Tangled has follows and vouches "which signal different levels of
trust while being understandable to the basic user", and John reused
Tangled vouches as the initial trust graph for sharing CI compute.
Search confirms Tangled lexicons `sh.tangled.graph.follow` and
`sh.tangled.graph.vouch` exist (tangled-mcp architecture notes).

Session's read: this is the strongest argument for the PDS path and it
is right. Two consequences, neither requiring us to move onto a PDS
today:

1. **Read in.** Treat `sh.tangled.graph.vouch`, `sh.tangled.graph.follow`
   and `app.bsky.graph.follow` as edge types with their own weights in
   the flow computation (vouch strong, follow weak), imported from the
   public firehose or API and attributed to the atproto DID that a key
   has proven control of (we have `bsky:` proofs already). This
   replaces roadmap item 12, which would have converted follows into
   vouches and lost the distinction the reader values.
2. **Write out.** For a key with a proven atproto identity, mirror its
   vouches as `sh.tangled.graph.vouch` records (or a lexicon of ours)
   into its own PDS, so tools like socialweb.computer read them without
   knowing attest exists. Needs atproto OAuth write access, which is
   the piece deferred at pass 1; it is now the most valuable single
   thing to add after scoring.

What stays different on purpose: subjects. atproto records address
`at://` and `did:`; our whole point is URLs, DOIs and content hashes.
Vouches and follows can live on the protocol; statements about the
open web cannot yet, and that is where a separate log earns its keep.
