# 2026-10-02 · Where you sign in is private

Anselm asked whether the FAQ says what is public when someone uses attest to sign in to, say,
suspiciously-weird-site.com. It did not, and the answer was bad: every delegation sat in the
public `/log` with the account's DID, the site's origin and the time, and `/by/:did` listed each
account's delegations with origins (two already named matchmaker.monster). His call: "protect
sign ins as best we can - users of attest.monster probably don't intend to signal to other people
about where they sign in."

## What changed

- **Delegation v2.** `{v:2, type, root, device, devKey, originHash, from, until}` with
  `originHash = idOf({origin, salt})` (`originCommitment` in `packages/orbital-attest/verify.mjs`).
  The login page makes a 16-byte salt; `{origin, salt}` goes to the server beside the delegation
  as `proof` and into the site's session, never into the signed public object. New sign-ins must
  be v2; stored v1 delegations stay valid until they expire (30 days at most).
- **Published on first use.** `store.putDelegation` keeps the delegation private (`published=0`);
  `store.putRecord` publishes it to the log the first time a record carries its id, on both the
  socket path and the firehose path. A revocation of a never-published delegation is not logged.
- **Reads.** `/by` lists only published delegations and no origins. `GET /delegation/:id?origin=`
  answers `match`/`mismatch` for a site's server confirming a sign-in; the id covers the salt, so
  only a session holder can ask. The owner sees their sign-ins with sites through a signed
  `own("sessions")` request (`records.checkSigned`, now shared with admin).
- **Old entries.** `/log` withholds the origin of v1 delegations for any site other than attest
  itself (3 entries: 2 matchmaker.monster, 1 localhost). Their signatures no longer check from the
  log alone; accepted as the cost.
- **What still knows.** attest's database keeps each delegation's origin, to refuse a key used on
  another site and to show the owner. Not public, not in any endpoint but the owner's.
- **Matchmaker** (its room's code, changed from here with Anselm's go-ahead): `lib/attest.mjs`
  accepts v2, checks the hash itself if the handshake carries the salt, and confirms through
  `/delegation/:id`, falling back to `/by` against an older attest. Its frontend is unchanged
  (it loads attest's client live). Deployed before attest so no sign-in broke.

## Tests

`scripts/e2e.mjs` gained five privacy checks (all pass locally); `scripts/e2e-cross.mjs` now
serves its own third-party page and runs its misuse check from a tab on the service (the redirect
change had moved the login tab onto the site); matchmaker's `scripts/attest-e2e.mjs` passes against
a local attest. A bug found on the way: a helper used at module load was a `const` defined below
the call, so the redirect's session was silently dropped; now a hoisted function.

## Not done

Timing: a published delegation's `from` still says when someone signed in somewhere. Records
published from a site name their page, by design.

## Later the same day: old entries deleted, not withheld

Anselm: "it is ok to delete old earlier sign in attempts - i don't see this as a big deal". The
three v1 delegations naming another site were deleted from the live database (`delegations`,
`log`, `revocations`): Anselm's two matchmaker.monster sign-ins, which had signed no records (his
matchmaker session needs a fresh sign-in), and the deleted cross-test account's localhost one,
with its two test records. Backup first: `data/attest-before-v1-delete-20261002T2244.sqlite` on
the VM. The `/log` redaction code is gone with them. v1 delegations to attest.monster itself
remain and back existing records.
