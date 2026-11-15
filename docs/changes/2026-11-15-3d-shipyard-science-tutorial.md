# 3D Shipyard and NASA-science Earth tutorial (2026-11-15)

## Shipyard
- `web/ship-view.js` is now a small canvas 3D renderer (`mountShip3d`): flat-shaded boxes, cylinders, cones and spheres built from the parts, painter-sorted, with a floor ring. Drag or arrow keys rotate, double-click resets, hover names a part, click focuses its picker, the changed part pops in. The view angle survives re-renders.
- `web/campaign.js` `plannerView()` is three columns: mission/rocket, centred ship stage with six part pickers and payload chips, and a status column (verdict, checks with detail only on failure, mass and delta-v bars, cost, launch windows, LAUNCH, world fit chips). `web/shipyard.css` replaced.

## Tutorial
- First mission chapter: 14 steps that give the exact Earth answer with a "🔭 The science" note and a SET IT FOR ME button (`answer` field; fills the Shipyard draft only, Python still checks the plan). The player then writes the Earth hurricane rule, tests, saves and launches.

## Easier Earth
- `WORLD_INTENSITY = {"earth": (0.8, 1.0)}` and `intensity_range()` in `ares/campaign_data.py`: Earth arrivals never exceed the lab test, and the quote's "harsher" check uses the same bound.
- Default draft: fast transfer, Survey Station only, 300 kg propellant.

## Tests
- `tests/test_ship.py`: the tutorial answer is all green; Earth intensity bound.
- `tests/test_tutorial.py`: each step has a hint or a science note; Shipyard steps have answers.
