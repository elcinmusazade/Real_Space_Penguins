# First-visit JARVIS highlight

- Reused the campaign’s existing first-visit check to highlight the lower-right JARVIS button and show “Open chat”. The ring pulses twice when motion is enabled. Opening chat clears the highlight, and saved campaigns use the usual button.
- Updated the campaign initializer, JARVIS launcher markup, chat controller and stylesheet. Verified the first-visit and returning views in a browser, keyboard activation, and tap access beside the map controls at a 390-pixel viewport.
- Regression suite: 175 tests ran successfully with one optional check skipped.
