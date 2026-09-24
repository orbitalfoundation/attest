# 2026-09-23 — custody, the social layer, and sites (roadmap A, B, C)

Point-in-time. Anselm: "go for it in sequence." Built and deployed the
same night, after the roadmap entry. Test suite: same-origin e2e now 32
checks, cross-origin 10, all passing locally and the same-origin suite
against the live domain.

## A. Custody

- **Root actions.** Sign-in generalised: the passkey signs an action by
  signing an assertion whose challenge is the action's SHA-256. Actions:
  `revoke` (a delegation), `add-key`, `remove-key`. Each goes in the log
  with its assertion, so account history replays.
- **Revocation.** `/me` lists sessions (delegations) per site with
  "revoke"; the server refuses later records under a revoked delegation
  ("delegation revoked; sign in again") and the client clears its
  session on that error.
- **Second passkey.** New device registers (existing credentials
  excluded), then an existing passkey signs `add-key` to adopt it. Two
  prompts. Remove needs a signature from a different passkey, and the
  last one cannot be removed. The browser prompt now offers only the
  account's own passkeys (and never the one being removed), which also
  fixed a real bug: with two accounts on one device, sign-in could pick
  the wrong credential.
- Not done: key export; signed tree head; origin bound into the device
  signature.

## B. The social layer

- **Profile** `/@handle`, data at `/handle/:handle` and richer `/by`:
  vouched-by, vouches given, proofs with verifications, counts,
  statements and comments. Widget comment handles link to profiles.
- **Vouch** from a profile, "I know this person", with the cost shown
  ("you have vouched for N keys"); retract the same way. One live vouch
  per pair; self-vouch refused. Kind `vouch` must target a key.
- **Proof of control.** New kinds `claim` and `verify`. A key claims
  `https://…`, `dns:domain`, `github:user` or `bsky:handle`; the token
  `attest-proof:<claim id>` goes where only the controller can put it
  (the page or `/.well-known/attest.txt`; TXT at `_attest.<domain>`; a
  public gist; a Bluesky bio). The service fetches and, if found, signs
  a `verify` record with the evidence URL.
- **The service has a key.** P-256, generated on first start next to
  the database, DID at `/service`, account handle `attest`. Its records
  carry the public key in the envelope instead of a delegation. Anyone
  can verify a claim by hand too; the service's verification counts as
  far as the service is trusted, which is the honest scope.

## C. Sites

- **Per-domain page** `/site/host`, JSON at `/domain/host`: totals,
  most-attested pages, recent comments, verified domain claims. The
  public analytics from the brief, and the pitch to a site owner.

## Not touched

Bluesky follow import, statements feed, comment anchoring, scoring,
npm publish, the desk (held on Anselm's word).
