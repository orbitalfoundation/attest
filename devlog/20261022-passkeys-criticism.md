# Passkeys criticism, catalogued and answered

Anselm sent https://nonfunctional.substack.com/p/passkeys-are-a-trap-do-not-use-them and asked
"Should we cite this as criticism?" This session (Claude Fable 5.1, attest room, 2026-10-22) read it
and said yes, as a criticism attest answers rather than one it is exposed to. He said "update commit
push".

Done: `reference/20261022-passkeys-criticism.md` (catalogue entry, count on the about page now 67);
one sentence each on the technical page, the builders page and the login page, and a new FAQ
question, all saying the same fact: registration uses `attestationType: "none"`, so attest asks
the device nothing about itself and accepts any authenticator, hardware keys included. The entry
also notes the name collision (WebAuthn attestation is the authenticator vouching for its own make)
and that the article skips the criticism attest is actually open to, a lost sole device.
