"""Tutorial assets and anchors.

The tutorial points at real interface elements by CSS selector. If someone
renames a data-action or class, the tutorial silently loses its spotlight, so
check every anchor still exists in the browser code that renders it.
"""

import re
import unittest
from pathlib import Path

WEB = Path(__file__).resolve().parent.parent / "web"
TUTORIAL = (WEB / "tutorial.js").read_text()
SOURCES = "\n".join(p.read_text() for p in WEB.glob("*.js") if p.name != "tutorial.js")


class TutorialTests(unittest.TestCase):
    def test_every_step_has_text_and_a_way_forward(self):
        steps = TUTORIAL[TUTORIAL.index("export const STEPS"):TUTORIAL.index("export function loadProgress")]
        titles = re.findall(r"title: '([^']+)'", steps)
        self.assertGreaterEqual(len(titles), 20)
        self.assertEqual(len(titles), len(set(titles)))
        self.assertEqual(steps.count("body:"), len(titles))
        # Every step teaches something: a hint, or (Shipyard steps) the real science behind the answer.
        for block in steps.split("{chapter:")[1:]:
            self.assertTrue("hint:" in block or "science:" in block, block[:80])
        # Action steps must say how they complete.
        self.assertEqual(steps.count("action: true"), steps.count("done:"))

    def test_shipyard_steps_give_the_exact_answer(self):
        steps = TUTORIAL[TUTORIAL.index("export const STEPS"):TUTORIAL.index("export function loadProgress")]
        self.assertGreaterEqual(steps.count("answer:"), 9)
        self.assertGreaterEqual(steps.count("science:"), 10)
        self.assertIn("data-tut=\"answer\"", TUTORIAL)

    def test_anchors_exist_in_the_interface(self):
        steps = TUTORIAL[TUTORIAL.index("export const STEPS"):TUTORIAL.index("export function loadProgress")]
        selectors = [s for group in re.findall(r"target: \[([^\]]+)\]", steps) for s in re.findall(r"'([^']+)'", group)]
        self.assertTrue(selectors)
        for selector in selectors:
            for action in re.findall(r'data-action="([^"]+)"', selector):
                self.assertIn(f'data-action="{action}"', SOURCES, selector)
            for ident in re.findall(r'data-id="([^"]+)"', selector):
                self.assertTrue(f"'{ident}'" in SOURCES or f'"{ident}"' in SOURCES, selector)
            for cls in re.findall(r"\.([a-z][a-z0-9-]+)", selector):
                self.assertRegex(SOURCES, rf"class=\"[^\"]*\b{re.escape(cls)}\b|className *= *['\"`][^'\"`]*\b{re.escape(cls)}\b", selector)
            for ident in re.findall(r"#([a-z][a-z0-9-]+)", selector):
                self.assertIn(f'id="{ident}"', SOURCES, selector)

    def test_goto_targets_are_real_tabs(self):
        for tab in re.findall(r"goto: '([a-z]+)'", TUTORIAL):
            self.assertIn(f"'{tab}'", SOURCES)

    def test_wired_into_the_page(self):
        self.assertIn('href="./tutorial.css"', (WEB / "index.html").read_text())
        campaign = (WEB / "campaign.js").read_text()
        self.assertIn("from './tutorial.js'", campaign)
        for action in ("settings-open", "tutorial-restart", "tutorial-resume", "tutorial-close"):
            self.assertIn(action, campaign)


if __name__ == "__main__":
    unittest.main()
