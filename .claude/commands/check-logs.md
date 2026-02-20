---
name: check-logs
description: Check Cloud Functions logs for the most recent wine addition(s). Shows the full enrichment pipeline including quick scan, deep analysis (with confidence/grounding info), price lookup, and image search. Use when user asks to check logs, see what happened with a scan, or debug a wine addition.
---

# Check Logs — Last Wine Addition

Fetch and summarize the Cloud Functions logs for the most recent wine addition(s).

## Steps

1. Use `mcp__plugin_firebase_firebase__functions_get_logs` to fetch recent logs for these functions (in parallel):
   - `quickAnalyzeWineLabel` (quick label scan via Gemini Flash Lite)
   - `deepAnalyzeWineLabel` (deep analysis with confidence-based grounding)
   - `lookupWinePrice` (price lookup via Gemini + Google Search)
   - `searchWineImage` (product photo via Serper.dev)

2. For each function, fetch the last **20** log entries in descending order.

3. Present a summary per wine addition in this format:

```
### [Wine Name] — [Producer] [Year]

**Quick Scan** (quickAnalyzeWineLabel)
- Name: ...
- Producer: ...
- Year: ...
- Grape: ...
- Region: ...
- Duration: X ms

**Deep Analysis** (deepAnalyzeWineLabel)
- Step 1 confidence: XX
- Grounding used: yes/no
- Expert ratings: [source: score, ...]
- Drinking window: bestFrom-bestUntil (peak: peakFrom-peakUntil)
- Duration: X ms

**Price Lookup** (lookupWinePrice)
- Price: €XX
- Source: ...
- Duration: X ms

**Image Search** (searchWineImage)
- Found: yes/no
- Duration: X ms
```

4. Flag any issues:
   - Confidence < 70 that triggered grounding
   - Missing fields (no grape, no region, etc.)
   - Parse errors or failed calls
   - Name/producer mismatches between quick scan and deep analysis

## Notes
- The project uses Firebase project `the-cork-claude`
- Functions are deployed to `us-central1`
- Deep analysis uses a two-step approach: first without Google Search grounding (cheap), then with grounding only if confidence < 70
