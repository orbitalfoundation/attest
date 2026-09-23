# attest

Project-specific orientation only. House policy (devlog, git, UX, writing,
deploy) comes from the harness and is not repeated here.

## What this is

A standalone attestations and emitter-scoring service, separate from any
site that uses it. Ordinary sign-up with a hosted keypair; a bag of signed
attestations about URLs and emitters (upvote, comment, vouch, supports or
challenges a claim); one public read endpoint any static site can render.
Later: trust by flow from a root through vouches, plus track record. First
consumer: The Future Times (`../computational-journalism`). Not built; the
first deliverable is the prior-art catalogue in `reference/`. Not deployed.

## Where things are

- Code: this folder. Repo: `orbitalfoundation/attest`.
- Devlog: `devlog/` (dated entries; read the tail first).
- Deploy: see `project.toml`.

## Project-specific facts

- Identity is not soul-bound (Anselm): an emitter may burn an identity and
  re-earn trust on a new one; therefore newcomers start at zero and trust is
  earned slowly (Friedman and Resnick 2001).
- Score emitters, not items. Counts shown to consumers are trust-weighted
  from a root, never raw, once scoring exists.
- Attestations are public signed records; analytics derived from them are
  public by construction. No private dashboards from this project.
- Prefer existing fabric (AT Protocol labelers, PDS, OAuth) over new
  protocol; `did:web` on our own domain for our accounts.
- Origin thinking: `~/projects/devlog/20260922-emitter-trust-idea.md` and
  `../computational-journalism/devlog/20260921-arguer-articles.md`.
