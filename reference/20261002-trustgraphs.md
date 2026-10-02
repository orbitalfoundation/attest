# Trustgraphs, read 2026-10-02 (pointer from Anselm)

Source: https://trustgraphs.xyz (home, FAQ, networks, create) and its docs pages "What is
trustgraphs?", "How vouch scoring works", "Why trust the result", "Vouch scoring algorithm",
"Architecture", "Hypercerts", "Off-chain EAS attestations", "Score compositions", "Nostr
workspace", "Governance", all read 2026-10-02. Code not read. Repo
https://github.com/AInima-Collective/trustgraphs (MIT, created 2026-07-06, last push
2026-09-15; top contributors by commits JakeHartnell 658, noahsaso 212). Organisation "Ainima",
https://ainima.xyz. Anselm: Jake Hartnell's project; they spoke on 2026-10-02.

| | |
|---|---|
| What it is (quote) | "a way to compute useful results from verifiable, relationship-shaped data without asking everyone to trust the computer that did the work" |
| Status (quote) | "alpha"; "still pre-production"; "Not [audited] by an outside firm" |
| Live | Ethereum mainnet; one listed network, "Ethereum Extitutional", 13 scored accounts |
| Standard program | Weighted, revocable vouches as Ethereum Attestation Service (EAS) attestations between Ethereum accounts; community-chosen starting accounts; "seeded PageRank-style" recurrence with damping and per-hop decay from the starting set; integer arithmetic scaled by 10^18; Hamilton allocation of a fixed point pool; Merkle root of scores published on-chain |
| Sybil stance (quote) | "Reachability is the Sybil boundary": "An account that cannot be reached from a starting account through active vouches receives zero score." "This is resistance, not a proof that every scored account is genuine." |
| Vouch weight | "controls how the sender divides their outgoing influence; it does not grant score by itself" |
| Proof | SP1 zkVM; proves the program ran over exactly the committed inputs (an on-chain running hash of every attestation and revocation); "Zero knowledge is not the same as privacy"; the proof does not establish "a signed claim is true", "a starting account made good judgments", or that the rules are fair |
| Epochs | Checkpoints freeze inputs and parameters; "a settled round is never recalculated" |
| Other inputs | Roadmap: on-chain EAS current; off-chain EAS, Nostr, AT Protocol "Pilot"; private graphs "Research". Hypercerts program: AT Protocol repository heads anchored on-chain, records turned into edges by deterministic rules, AT Protocol identities as score keys, optional EVM binding |
| Compositions | Blend 2 to 8 networks' proven scores at chosen percentages into a new proven allocation |
| Data | "Vouches, rules, code, and scores are all public" |

## What there is for attest

- **An algorithm to adopt, not invent.** attest's roadmap ("Scores, first version") describes
  flow from a root with decay; Trustgraphs has written that down exactly, with golden vectors.
  Using its spec makes attest's scores reproducible and comparable.
- **Same Sybil answer, stated more carefully.** Reachability from chosen seeds; a seed set of one
  (you) is attest's "relative to you".
- **Weighted vouches that divide, not add.** attest vouches are unweighted today.
- **Epochs.** Frozen inputs per round make a score citable and recomputable; attest currently
  scores nothing, and its counts are live.
- **Completeness is the real trust problem.** Their answer is a running commitment of every
  input; for AT Protocol, anchored repo heads. attest's analogue would be publishing the repo
  heads (commit CIDs) it scored over per round.
- **Interop.** attest vouches are AT Protocol records (`monster.attest.vouch`), so they could be
  an input to a Trustgraphs AT Protocol program; attest would not need to run zero-knowledge
  proving itself.
- **Differences.** Ethereum accounts and wallets, per-community scoreboards, on-chain cost;
  attest is passkeys, no chain, and per-viewer scores. The zero-knowledge proof serves cheap
  on-chain verification, which attest has no consumer for yet.

Filed in the reading room by claude-code (2026-10-02); history line and a roadmap citation added.

## Peers, from a search on 2026-10-02

Only OpenRank's protocol page was opened; the other two rows are from search-result summaries and
their own sites' titles, not read closely.

| Name | What (source wording) | Relevance |
|---|---|---|
| OpenRank, https://docs.openrank.com | "verifiable reputation compute layer for the open web"; EigenTrust, Hubs and Authorities, Collaborative Filtering; "global and personalized rankings" on Farcaster and Lens graphs; compute nodes commit results "to be verified by other network participants"; EigenCloud for challenges | The closest live peer: personalized trust over an open social graph, verified by challenge rather than zero-knowledge proof. No AT Protocol mention on the page read |
| Ethos, https://www.ethos.network | Vouches made by staking ETH, with diminishing returns; mutual vouches magnified; one credibility score in levels | Money as the cost of a vouch; attest has none |
| Intuition, https://www.docs.intuition.systems | Token-curated knowledge graph: atoms and triples, staking on claims | Claims as a graph with economic backing |

Trustgraphs' Hypercerts program is the only design found that proves trust scores over AT Protocol
records; Jake says it is not yet fully set up. Analysis: `devlog/20261002-trustgraphs-second-look.md`.
