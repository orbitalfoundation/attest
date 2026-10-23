# Criticism of passkeys, read 2026-10-22 (pointer from Anselm)

Source read 2026-10-22: "Passkeys are a trap, do not use them", by the pseudonymous author
"The Hack" on the Substack *Non-Functional*, dated 2026-10-10,
https://nonfunctional.substack.com/p/passkeys-are-a-trap-do-not-use-them. An opinion piece, not
a standard or a paper; cited here as a critic's case against the substrate attest signs with.

| | |
|---|---|
| The claim | "you do not have ultimate control over your passkeys": the label hides "a hidden dial that lets the websites you use them on gradually remove your ability" to use them as you choose |
| The mechanism | WebAuthn attestation. A site can ask the authenticator to prove, through the device's cryptoprocessor, which passkey manager, operating system and firmware it runs on, and reject anything unapproved: a custom Android, a Linux desktop, a third-party manager. The author expects sites to add such checks quietly and tighten them over time |
| Supporting points | The FIDO Alliance is platforms, banks and governments, with "nobody there to make a strong case for the user's own interests"; one name covers copyable and non-copyable, hardware and software, attested and non-attested credentials; some authenticator-data flags are "reserved for future use" |
| Concedes | Passkeys are domain-bound and "far more secure than passwords", and "definitely more secure than TOTP"; attestation has honest uses such as blocking fake passkey apps |
| Recommends | TOTP, or a hardware security key such as a YubiKey; wait for a standard "more clearly defined and with fewer strings attached" |
| Not covered | Sync and recovery, in any detail |

## Relevance to attest

The dial the article fears is a relying-party choice, and attest has it at zero. Registration asks
for `attestationType: "none"` and `userVerification: "preferred"` (`server/passkeys.mjs`), so attest
learns nothing about the device and refuses no authenticator: a phone, a Linux laptop, a custom
Android, a password manager, or a hardware key, which is the author's own recommended alternative
and is what the end-to-end tests exercise over USB. Stating this on the site is the right answer to
the piece.

Name collision: the article's "attested passkeys" means WebAuthn device attestation, a statement by
the authenticator about itself. attest's records are statements by people about URLs and keys.
Nothing links the two, and the site copy should keep them apart.

The criticism the article skips is the one attest is exposed to: with a single passkey, a lost
device is a lost account. The answer today is a second passkey from another device, adopted by an
`add-key` signature; key export is planned. See the FAQ and the threat model on the technical page.
