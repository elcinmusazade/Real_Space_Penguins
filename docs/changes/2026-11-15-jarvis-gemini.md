# JARVIS through Gemini

- Restored the bottom-right campaign chat. It reads visible progress, recent conversation, the selected screen and the active tutorial step when a player asks a question.
- The Python server calls Gemini 3.1 Flash-Lite over verified HTTPS. The host can configure a Free-tier project key with the hidden Terminal prompt or the GEMINI_API_KEY environment variable. The browser displays setup, connectivity and quota errors and supports retry.
- Updated the campaign controller, server, chat assets, setup documentation and tests. Credentials stay on the game host. Google receives a compact campaign briefing with the question.
- Verification: 175 tests ran, with one optional check skipped. Tests covered the Gemini request format, follow-up context, progress readouts, quota errors and private key setup. The browser displayed the Gemini panel, the setup instruction and Retry. The official HTTPS endpoint responded. Two independent clients then received authenticated Gemini replies through the same host key. Their answers matched their own saves on turn 1 (390 credits) and turn 2 (402 credits).
