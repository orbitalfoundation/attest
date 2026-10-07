# 2026-10-07 · OpenID and AT Protocol: could attest speak both?

Anselm asked Google's AI mode how atproto compares with OpenID work, and whether attest could
support both. He pasted the answer. Checked here before relying on it (2026-10-07):

- **True:** atproto's OAuth profile requires PKCE, DPoP with server nonces, PAR, and client
  metadata documents with a URL as `client_id` (atproto.com/specs/oauth). The spec says plainly
  that it does not use OpenID Connect: "the current version of OIDC does not enable authentication
  of atproto identities in a secure and generic way." attest already does this side (sign in with
  an existing handle, `server/atoauth.mjs`).
- **True:** ATLogin (github.com/apenwarr/atlogin, atlogin.net) is an OpenID Connect provider that
  logs people in with their atproto account, so any OIDC app (its example: Tailscale) accepts a
  Bluesky identity.
- **Real but misnamed in the answer:** the OpenID Foundation's "Artificial Intelligence Identity
  Management Community Group" (the answer said "Artifactual").
- Not checked: the answer's claims about specific OIDF working groups' DID work.

## What it means for attest

Google offered two strategies. One fits and one does not.

1. **attest as an OpenID Connect provider ("sign in with attest").** Any app that accepts OIDC
   (wikis, forums, Tailscale, internal tools) could let people in with their attest passkey, and
   the app gets an ID token whose subject is the person's DID. This is the strongest fit with why
   attest exists ("every one of the founder's projects was re-implementing auth"), and it extends
   to apps that will never load our widget. Difference from ATLogin: the sign-in is a passkey, not
   a password at someone's PDS, and attest already has per-site keys and private sign-ins. The
   same privacy rule applies: attest learns where you sign in, never publishes it. Implementation:
   panva's `oidc-provider` for Node is the usual choice (not yet evaluated): discovery document,
   JWKS, an authorize step that is attest's passkey sign-in, ID tokens with `sub` = DID and the
   handle as `preferred_username`.
2. **Accepting Google or Microsoft sign-ins at attest.** Against the grain: it puts a center back
   in front of the person. Not recommended.

There is an agent angle. auth.md's "agent verified" flow has an identity provider vouch for the
person behind an agent with an ID-JAG (an OAuth identity assertion). Today that provider is an AI
company. An attest that speaks OIDC could be that provider instead, with the person's passkey
behind the assertion, which keeps agents' authority under the person rather than a platform.

Venues: the OpenID AI identity group, and the Internet Identity Workshop (#43, November 3–5, per
Kaliya Young's slides read 2026-09-28), where this community meets.

## Where ongoing thinking lives

Anselm: "we don't really have a blog or any kind of structure for ongoing thoughts. in fact our
devlog shows significant evolution in thinking." The devlog is public already, in the open
repository, but not linked from the site and written for us. Options: link it from the site as
"the thinking, as it happened"; and/or a /notes page of short public pieces distilled from it,
drafted by Claude and published only when Anselm passes them; longer essays stay on his Substack.
