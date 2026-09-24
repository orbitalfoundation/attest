# orbital-attest

Client and verifier for [attest](https://attest.monster): signed, public statements about URLs and keys, with passkey sign-in and per-site delegated device keys. No dependencies.

```js
import * as A from "orbital-attest";
A.configure({ server: "https://attest.monster" });
if (!A.session()) await A.signIn();          // popup on the service origin; the passkey signs a 30-day delegation to this page's device key
await A.attest("upvote", location.href);     // signed locally, submitted over one socket
const counts = await A.read([location.href]);
```

Verify a record with nothing but public data:

```js
import { canonical, idOf, verifyObject, didFromJwk } from "orbital-attest/verify";
const ok = (await idOf(env.record)) === id && await verifyObject(delegation.devKey, env.record, env.sig);
```

The integrator page has the whole API, the record format and the verification steps: https://attest.monster/docs. Source and issues: https://github.com/orbitalfoundation/attest (MIT).
