# Graph Report - pwa  (2026-06-19)

## Corpus Check
- 9 files · ~14,796 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 23 nodes · 36 edges · 5 communities (2 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `788e5052`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]

## God Nodes (most connected - your core abstractions)
1. `Handler` - 10 edges
2. `load_data()` - 4 edges
3. `normalize()` - 4 edges
4. `validate_tragitto()` - 4 edges
5. `validate_rifornimento()` - 4 edges
6. `today_iso()` - 3 edges
7. `next_id()` - 3 edges
8. `save_data()` - 2 edges
9. `Return next safe integer id for a given collection.` - 1 edges
10. `Ensure all expected keys exist and migrate old schema.` - 1 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (5 total, 3 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.47
Nodes (5): Validate tragitto payload, return (cleaned_dict, error_msg)., Validate rifornimento payload, return (cleaned_dict, error_msg)., today_iso(), validate_rifornimento(), validate_tragitto()

### Community 3 - "Community 3"
Cohesion: 0.40
Nodes (4): load_data(), normalize(), Ensure all expected keys exist and migrate old schema., save_data()

## Knowledge Gaps
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Handler` connect `Community 1` to `Community 0`, `Community 2`, `Community 3`?**
  _High betweenness centrality (0.403) - this node is a cross-community bridge._
- **Why does `validate_tragitto()` connect `Community 0` to `Community 3`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Why does `validate_rifornimento()` connect `Community 0` to `Community 3`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **What connects `Return next safe integer id for a given collection.`, `Ensure all expected keys exist and migrate old schema.`, `Validate tragitto payload, return (cleaned_dict, error_msg).` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._