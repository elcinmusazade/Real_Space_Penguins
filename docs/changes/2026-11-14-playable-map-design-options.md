# Design review: playable-map visual directions

- **Date:** 2026-11-14. **Request:** User dislikes the current playable maps and asked for suggestions.
- **Proposed:** Living isometric (recommended: richer terrain/buildings with existing rules), Top-down colony (clear placement and networks), or Tactical hex (strong sector/exploration feel, requiring adjacency and save-design changes).
- **Preview:** Created three illustrative, interactive in-conversation concepts with selectable buildings and placement/resource overlays. These are visual proposals, not game implementation or scientific terrain data.
- **Shared improvements suggested:** Grid on demand, distinctive building silhouettes/stages, terrain landmarks, planet-specific environments, utility connections and clearer exploration fog.
- **Changed in repository:** This log and the pending-design note in `docs/STATUS.md`; game files and saves were not edited.
- **Checked:** Fragment readback/JS syntax and mocked canvas/control smoke checks pass. Existing game suite: 77 tests run, OK, 1 optional GMAT check skipped. Browser rendering was not inspected.
- **Next:** User selects a direction before implementation scope is decided.
