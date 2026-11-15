# Shipyard branch comparison — 2026-11-15

Fetched `origin/main` and `origin/feature/shipyard-rework` and switched the clean checkout to a local branch tracking the latter. Compared `14b25d5` (main) to `213fef1`: nine commits ahead, zero behind, 32 committed files changed. The two Shipyard/Software commits add subsystem selection, destination fit and per-world flight rules/dangers; seven preceding commits add the interactive tutorial, Settings, rule-based AURA advice and overlay refinements. No merge, push or game-code edit.

Verified with `python3 -m unittest discover -s tests -v`: 155 run, 151 passed, three failed, one optional GMAT check skipped. The tech-tree and surface-controller Node harnesses lack the new `badgeCount` binding; the startup harness fails to render the Mars map. A live browser regression was not established. Next check: update the harnesses and rerun before merging.
