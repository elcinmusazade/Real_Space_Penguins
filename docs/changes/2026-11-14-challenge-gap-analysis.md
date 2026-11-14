# Change: Space Mission Design Game challenge gap analysis

- **Date:** 2026-11-14
- **Author:** Claude (Claude Code)
- **Scope:** Documentation / planning
- **State:** Documentation only

## Changed paths and behavior

- `docs/IDEAS.md`: added a "Challenge gap analysis" section that compares each element of the challenge Details tab with what Ares has today, plus proposed ideas in a suggested order. All are marked Proposed.
- `docs/STATUS.md`: added a pointer to the gap analysis under "Suggested next work."
- `.gitignore`: ignores `GMAT/`, a local 1.9 GB clone of NASA's GMAT source kept for reference. It is not used by the game.
- No game code changed.

## Why

- The challenge Details tab, read 2026-11-14, focuses on *designing* a complete mission (objective, spacecraft, instruments, launch vehicle/orbit) and managing mass, power, budget, data, communications, and time. Ares currently focuses on surface operations. Recording the gaps lets both teammates and any assistant prioritize from the same list.

## Observed verification

- `python3 -m unittest discover -s tests -v` was run after these documentation edits; see the result in the handoff.

## Remaining work and ideas

- The team needs to choose which proposals to approve. The recommended first step is a design phase before launch whose choices set colony starting conditions.
- Two untracked PDFs in the repo root (`250323-design-and-develop-science-mission.pdf`, `space mission concepts.pdf`) were left untouched.
