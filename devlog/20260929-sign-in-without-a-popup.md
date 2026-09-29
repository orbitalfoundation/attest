# 2026-09-29 · Sign-in without a popup (mobile), and matchmaker as the second consumer

Done from the matchmaker room, which switched its sign-in to attest today (matchmaker devlog
2026-09-29). Anselm asked whether popups work on mobile. Reading the code: Android Chrome, probably;
iOS Safari, probably not, because Safari allows `window.open` only synchronously inside the tap and
`signIn()` awaited the device key before opening; and a home-screen web app loses the opener, so the
session never comes back. Two changes, both in the client library and the login page, nothing in the
server:

- **The popup opens first.** `signIn()` calls `window.open` before any await. A caller that has
  already awaited something (matchmaker imports the library lazily) opens a blank window in its own
  tap handler and passes it as `signIn({popup})`.
- **The redirect flow.** When no popup can open (`window.open` returned null, or `{mode:"redirect"}`),
  the page itself goes to `/login?device=…&key=…&origin=…&return=<its own address>`. The login page,
  finding no opener and a foreign origin, sends the person back to the return address with
  `#attest-session=<base64url JSON>`, and only to an address on the origin the delegation names. The
  library's `takeSessionFromHash()` runs at module load, stores the session and cleans the address bar.
  The fragment holds the delegation and its id, which are public; the device's private key never
  leaves its IndexedDB, and the session is only useful to the page that holds that key.

The login page used to keep a foreign-origin session in its own localStorage when there was no opener;
that was a dead end for the person and only the cross-origin test relied on it. `scripts/e2e-cross.mjs`
now takes the redirect flow, as matchmaker's `scripts/attest-e2e.mjs` does. Not run against the live
service from here; matchmaker's test ran against a local attest and passed. iOS is Anselm's to try on
his phone once this is deployed; the matchmaker change is useless until attest.monster serves this
client and login page.
