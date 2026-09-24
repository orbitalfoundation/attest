# 2026-09-23 — fold into the atproto work, or continue?

Point-in-time. Anselm asked for a serious, critical answer after two
readers pointed at badge.blue, the `app.certified.*` lexicons,
Hypercerts and Tangled. Session's assessment; his decision.

## What their stack already has that we built or planned

Identity with rotation keys (`did:plc`), hosted repos (PDS), OAuth,
signed Merkle repos relayed by a firehose (our "CT-shaped log",
better), a shared record vocabulary (badges, follows, evaluations with
a score, acknowledgements, signature proofs), badge.blue's replay-safe
signatures, a live vouch graph on Tangled, labelers for distributing
scores, and millions of accounts. That is most of milestones 2, 4, 5's
distribution, and 7.

## What we have that they do not, honestly weighed

1. **Subjects that are URLs, DOIs and hashes.** Real, but not a wall:
   a lexicon may declare `subject: string, format: uri`. Nobody has
   defined a shared one. We could, and it would live in users' repos.
2. **A key the person holds.** On bsky.social the PDS signs the repo;
   the user holds only rotation keys, in practice not even those. Our
   passkey root plus per-site device keys is genuinely user-held
   custody. But badge.blue's `signatures` array lets a record carry an
   extra inline signature from a `did:key`, so our device-key
   signature can ride inside an atproto record. The custody model
   survives a fold as a layer, not a fabric.
3. **Scoring from a root with a capacity bound.** Nobody there has it.
   It is an AppView over their records, not a reason for a separate
   fabric.
4. **A widget a static site drops in with no build.** Same: an app on
   their fabric, using atproto OAuth for sign-in.
5. **Speed.** We shipped in a day because we owed nobody
   compatibility. That advantage is spent.

## What folding costs

Dependence on Bluesky PBC's stack and the PLC directory; account
creation needs a PDS (bsky.social, or we host one, the spike deferred
at pass 1); atproto OAuth in the browser; no URL-subject vocabulary
until we write and socialise one; and the stewardship of
`app.certified.*` is not stated anywhere read. Young, single-author
pieces. Young beats alone.

## Verdict

Fold the fabric, keep the application. attest stops being a place
where records live and becomes an AppView plus scorer plus widget over
atproto:

- Sign-in becomes atproto OAuth (bring your handle); we host a PDS for
  people without one. The passkey-delegated device key becomes an
  inline `did:key` signature inside each record (badge.blue), so
  user-held custody is kept.
- Records go into the user's own repo: `app.certified.*` shapes where
  they fit (follow, badge award, evaluation, signature proof) and one
  small lexicon of ours for URL and hash subjects, proposed to the
  certified namespace.
- Our log becomes an index rebuilt from the firehose; `/read`, `/by`,
  `/site` and the root-parameter scores stay as our public API, plain
  GETs, for static sites and agents.
- Read-in first (Tangled vouch, follows), because it costs nothing and
  gives scoring a graph.

What to stop: own custody beyond the device key (second passkey and
revocation become atproto account features), own log as source of
truth, own vocabulary where a shared one exists. Sunk cost: one day.

## If he says continue standalone instead

Then the honest position is a proof of concept for URL-subject
attestation and root-parameter scoring, and the About page should say
so, with the fold as the stated intent.

## Addendum: the key-custody objection, worked through

Anselm: "not having the user hold the key seems a concern." Before he
uses attest in other projects it must "work, be durable, be useful,
survive."

Where the key sits in each design:

- **Standalone today.** Root = passkey, held by the device and synced
  by Apple or Google; never by us. Every record carries a user-held
  signature (device key delegated from the passkey). Identity
  (`did:key`) needs nobody's directory. Survival depends on mirrors of
  our log existing; today there are none.
- **atproto.** Day-to-day record signing is by the PDS's repo key, so
  on bsky.social the host signs, not the person. Identity control is a
  rotation key the person may hold (Bluesky's "recovery key"), but a
  passkey cannot be one: WebAuthn signs a challenge structure, not raw
  bytes, and PLC operations need raw signatures. A user-held rotation
  key is therefore a key file to back up, the UX passkeys were
  invented to avoid.
- **Fold with the custody layer kept.** badge.blue's `signatures`
  array lets every record carry an inline `did:key` signature from our
  passkey-delegated device key in addition to the PDS's commit
  signature. The person's own signature is on every record; the host's
  key only says "this repo contains it". If we host the PDS ourselves,
  the host-held key is ours and the account is migratable, not
  Bluesky's.

Against his four tests: *work* is equal; *durable* and *survive*
favour the fold (records replicated across a network of relays and
mirrors that exist today, identity in a directory that outlives us);
*useful* favours the fold (Tangled and Hypercerts tooling reads the
records). The one thing the fold gives up is that the person's key is
the identity itself rather than a signature inside it. Recommendation
stands: fold, with the inline user signature non-negotiable and our
own PDS. A cheaper hedge if he is not ready: stay standalone but adopt
the shared shapes now (badge.blue signatures, DAG-CBOR CIDs, certified
record fields) so every record can be lifted into a repo later
without re-signing.
