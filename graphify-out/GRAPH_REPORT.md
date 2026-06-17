# Graph Report - pwa  (2026-06-17)

## Corpus Check
- 5 files · ~4,287 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 16 nodes · 19 edges · 4 communities (0 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4208e968`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]

## God Nodes (most connected - your core abstractions)
1. `Handler` - 8 edges
2. `load_data()` - 2 edges
3. `save_data()` - 2 edges
4. `generate_self_signed_cert()` - 2 edges
5. `Generate a self-signed cert for both DuckDNS and TailScale domains.` - 1 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (4 total, 4 thin omitted)

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Handler` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`?**
  _High betweenness centrality (0.605) - this node is a cross-community bridge._
- **Why does `load_data()` connect `Community 2` to `Community 0`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **What connects `Generate a self-signed cert for both DuckDNS and TailScale domains.` to the rest of the system?**
  _1 weakly-connected nodes found - possible documentation gaps or missing edges._