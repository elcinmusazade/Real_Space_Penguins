# Change: Science context and shared project guidebook

- **Date:** 2026-11-13
- **Author:** ChatGPT science/documentation task
- **Scope:** `dist/science.js`, `docs/`, and `.github/copilot-instructions.md`
- **State:** Content complete; game integration verification pending

## Changed paths and behavior

- Added five concise NASA-context notes, the game field guide, primary references, and an explicit simplified-simulation notice in `dist/science.js`.
- Added project decisions, module ownership, current-status tracking, an idea bank, data limitations, and reusable prompts in `docs/`.
- Added GitHub Copilot instructions pointing to the same shared guidebook as other assistants.

## Why

- Future teammates and assistants need persistent context instead of relying on one conversation.
- User-confirmed design choices are separated from implementation defaults.
- Scientific references explain real constraints without implying NASA datasets drive fictional resource values or that the greenhouse fulfills the whole Field Shift challenge.

## Observed verification

- Opened NASA Mars Facts, Curiosity RAD, NASA dust guidance, and NASA POWER Daily API pages.
- Verified NASA SWIM water-ice mapping information through primary-source search results.
- Ran `node --check dist/science.js` and imported the module in Node: passed, with five notes, eight references, and a populated field guide.
- Compared field-guide mechanics to `dist/engine.js`: 10 Sols, two actions, 70 science, adjacent exploration/construction, delayed building activation, research thresholds, and event resolution agree.
- Application tests and browser QA were not run by this task at this entry; final integration results belong in the Site owner's completion entry.

## Remaining work

- Recheck the field guide if engine rules change; replace the in-progress status after integration and publication checks.

