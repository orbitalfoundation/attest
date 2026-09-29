# handle-guard

Checks a proposed public handle (a username, a subdomain, the `name` in `example.com/name`) against two things:

- offensive words in twelve languages, stored only as SHA-256 hashes;
- reserved paths such as `admin`, `login`, `api` and `robots`, which a site needs for itself.

It was written for [attest.monster](https://attest.monster), where people live at `/<handle>` and at `<handle>.attest.monster`, beside the site's own pages.

```js
import { createGuard, hashWord } from "handle-guard";

const guard = createGuard({ extraReserved: ["acme", "pricing-2027"] });
guard.check("admin");      // { ok: false, reason: "reserved" }
guard.check("some-name");  // { ok: true }
guard.reserve(["gallery.html", "about.html"]);  // reserve your page files by name
```

Shape, length and uniqueness are left to you: `check` only answers "reserved", "offensive" or fine.

## Why another blocklist

There are good profanity packages on npm. This one reads three of them at build time. None fitted this job.

**They ship the words.** Every list we found keeps its words in plain text, so installing one puts a file of slurs in your dependencies, your editor and your code search. We would rather our source not read like that. This package keeps only the SHA-256 of each normalised word. The words are read once, when the list is built, from packages that are development dependencies and never installed where the code runs.

The hashing keeps the words out of the source; it does not hide them. Anyone can hash a dictionary and see which words are listed. That is fine, and it is not the point.

**They are built for prose.** A chat filter scans sentences and masks words. A handle is one short token, often several words run together, chosen once and shown for years. Blocking a real person's name there is worse than letting a mild word through, so the matching is tuned the other way (below).

**Reserved paths belong in the same check.** Anyone giving out handles in a shared URL space needs both, and in the same place.

## How a handle is checked

The handle is lowercased, accents are stripped, and leetspeak digits and symbols are read as letters (`3` as `e`, `@` as `a`). Then:

1. If the whole handle is on the `allow` list, it passes.
2. The whole handle, and each part between `-`, `_` or `.`, is tried as written, with runs of three or more letters shortened to one and to two, and with `v` read as `u`. Any hash match blocks.
3. Words in the "anywhere" tier are also looked for inside the handle, at every substring of four letters or more.

Only a word that passed a test at build time goes in the anywhere tier. It must be English, at least four letters long, and not contained in any ordinary English word or name in the dictionary, apart from its own inflections. Every other word is "exact": it blocks as the whole handle or a whole part, never inside a longer word.

## Twelve languages, one namespace

The multilingual lists are where a naive filter does the most damage. A word that is crude in one language is often an everyday word or a common given name in another. Substring matching across twelve languages blocks a great many real people. So the build is conservative:

- **Other languages match exactly.** A word from another language's list blocks only as a whole handle or a whole part.
- **English words are dropped from other lists.** A word from another list that is also an ordinary English word ("name", "flat", "mist", "pour") is dropped.
- **Names are exempt.** A word that is a proper name in the dictionary never blocks, in any language.
- **Only the Latin alphabet survives.** Handles are ASCII, so words written in other scripts drop out at build time. Only romanised entries from those languages remain, and for several languages that is very few.

| Language | Entries in @2toad/profanity | Left after normalising |
|---|---|---|
| English | 449 | 394 |
| Arabic | 323 | 144 |
| German | 368 | 334 |
| Spanish | 363 | 328 |
| French | 372 | 355 |
| Italian | 168 | 168 |
| Hindi | 337 | 133 |
| Japanese | 317 | 65 |
| Korean | 114 | 33 |
| Portuguese | 322 | 298 |
| Russian | 314 | 22 |
| Chinese | 292 | 31 |

English also draws on leo-profanity and bad-words. The last build, against `/usr/share/dict/words` on Ubuntu, looked like this:

| Measure | Count |
|---|---|
| Words kept, as hashes | 1,517 |
| Exact tier | 873 |
| Anywhere tier | 644 |
| Words exempted as names | 30 |
| Dictionary names still blocked | 1 of 9,919 |
| Dictionary words still blocked | 232 of 63,737, mostly offensive, a few borderline |

## Limits

- **Names used as insults pass**, because names are exempt.
- **Place names can still be blocked** if they are not in the dictionary and contain an anywhere-tier word. The English town of Scunthorpe is blocked. Use `allow` for those.
- **The source lists are uneven.** They are community-assembled, stronger in English and the big European languages than elsewhere, and thin on extremist terms. Add what you need with `block`.
- **It is not a prose filter.** For messages and comments, use one of the packages above directly.
- **It runs in Node only.** It uses `node:crypto`. A browser version would need the asynchronous WebCrypto digest.

## Options

```js
createGuard({
  words: true,          // shipped lists; false for none; or { exact, anywhere } arrays of hashes
  reserved: true,       // RESERVED_PATHS; false for none; or your own list
  extraReserved: [],    // names reserved on top
  block: [],            // hashes (from hashWord) that block as a whole handle or part
  allow: [],            // hashes of whole handles to let through
});
```

`block` and `allow` may be a Set, an array, or a function that returns one. Pass a function to read from a database, so admin changes apply at once. attest keeps both in its database as hashes. An admin types a word, and only `hashWord(word)` is stored.

`RESERVED_PATHS` is exported from `handle-guard/reserved` if you only want that list.

## Rebuilding the list

```sh
npm install      # the three word-list packages are dev dependencies
npm run build    # writes blocklist.json; DICT=/path/to/words to use another dictionary
EXTRA="word1,word2" npm run build   # add terms once; they are hashed, never saved as text
npm test
```

The build needs a dictionary with proper names capitalised (`/usr/share/dict/words` from the `wamerican` package), which is how it finds innocent words and names.

## Licence and sources

MIT. The word lists come from [leo-profanity](https://www.npmjs.com/package/leo-profanity), [bad-words](https://www.npmjs.com/package/bad-words) and [@2toad/profanity](https://www.npmjs.com/package/@2toad/profanity), all MIT.
