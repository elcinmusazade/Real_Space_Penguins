# Local supply decisions

- Added four seeded campaign incidents in `ares/campaign_data.py` and `ares/campaign.py`. One active base is selected every three or four turns. Payments are atomic and receipts show the actual local stock change.
- Updated `web/campaign.js` to display costs, available stock and losses or rewards. Unaffordable actions are disabled. Pending decisions survive reloads, including earlier campaign event saves.
- Played turns 1–7 in a browser. The turn-4 pod survived a reload and yielded four spare parts for seven fuel and four energy. Two of those parts repaired the turn-7 water leak.
- Full regression run: 180 passed, one optional GMAT test skipped. Tests cover seeded cadence, eligible sites, stock shortages, storage limits, the no-cost response, save compatibility and continuing the campaign.
