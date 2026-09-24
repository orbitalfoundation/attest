# 2026-09-23 — Substack draft: foundations of trust

Machine draft from Anselm's bullets, for his rewrite. Not published.
One correction to the bullets: Keybase was acquired by Zoom (May 2020),
not eBay. Heckler report at the bottom.

---

# Foundations of trust

There is a fungus, Ophiocordyceps unilateralis, that gets into a
carpenter ant and drives it. The ant leaves the colony, climbs a plant
to a height the fungus prefers, bites down on a leaf, and dies there.
Then the fungus grows a stalk out of the ant's head and rains spores on
the trail below. The ant's legs did all the work. The ant's energy,
the ant's muscles, the ant's careful foraging, spent to the last on
something that was never the ant's idea.

I think about that ant a lot lately.

The internet is our nervous system now. Not a metaphor I chose, just a
description of where the signals run. And on that nervous system, every
day, somebody manages to recruit a few million of us to climb a stalk
and bite down. Outrage that turns out to be a rented crowd. A product
review written by nobody. A photograph of a thing that did not happen.
Our attention, our anger, our money, spent on someone else's spores.

What surprises me is that this is not a solved problem. I don't even
want to solve it. I would like to live in a world where it is solved,
which is a different thing. I do not want to be squinting at the
pattern on a stranger's dress shirt to decide if a photograph is real.
I want to look at the envelope. Who sent this? Who vouches for them?
What else have they sent, and how did that turn out? That is how we
have handled trust for most of human history. You knew whose word was
good. The content of the message came second.

We had pieces of this and let them go. Keybase let you prove that one
key was yours across a dozen services; Zoom bought it in 2020 and it
went quiet. I have always thought that the big social networks should
have moved to user-owned keys years ago, a signature that is yours and
travels with you, instead of the identity moat they built and defended.
That moat was good business and poor civic responsibility, and I do not
think those two things had to be in tension.

It isn't only forums. I talked recently with the head of a whiskey
company who was trying to build an audit trail for bottles, so that a
buyer could know a bottle was what it claimed and that nobody had
opened it on the way. Adulteration is old. What's new is that we could
actually trace a thing from still to shelf, if the signing and the
vouching were ordinary infrastructure instead of a project every
company starts from scratch.

So I made a thing. It's called attest.monster, and I vibed it up with
Claude over a couple of days. You sign up once, with a passkey your
phone holds. After that, any website can let you upvote, comment,
vouch for someone or make a public statement, and the site itself
never runs accounts, passwords or a database. Every statement is
signed by your key, is public, and can be checked by anyone without
asking the service. Later, the plan is trust scoring over the graph of
who vouches for whom, always from a starting point you choose, never a
single number called "trustworthy". Your key has no profile and no
badge. It is defined by what it has signed and who has stood behind it.
If you wreck its reputation you can throw it away and start over at
zero, which will take you years. That cost is what makes everyone
else's standing mean something.

I am not especially attached to it. It states a position. If someone
has a better project I will happily merge with them or join theirs. I
just need something that works, and I need it to exist outside any one
company's walls.

Here is the larger reason. If we want to do the big things, build
simulations of the whole planet, model the climate or the food system
or a city together, argue our way to decisions with millions of people
in the room, we need a nervous system that cannot be hijacked by
anyone with a budget for spores. Nerves that matter get myelin, a
sheath that keeps the signal clean and fast. We have never wrapped our
social nervous system in anything. Signing, vouching, and a public
record of who was right are the beginning of a sheath.

It will not stop the fungus. Nothing stops the fungus. But an ant that
can tell which of its sisters are still themselves has a chance.

---

Ways in, if you want them: use it on your own site, read the source
(MIT), tell me who did it better, or break it before anyone real
arrives. attest.monster/about.

---

Heckler, 2026-09-23: 772 words, 9 paragraphs, burstiness 0.7, mean
sentence 14.4 words, no paragraph-level tells; the usual fingerprint
drift from his corpus (cos 0.863), which is the part only his rewrite
fixes.

Published by Anselm the same night, after his rewrite, as "Foundations
of Trust: Attest.monster":
https://anselm.substack.com/p/foundations-of-trust-attestmonster
The About page's "Why" section links it. The hero image is
`public/hero.png`.
