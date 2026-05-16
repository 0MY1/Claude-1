# Strategy Extraction Prompt

Use this prompt with Claude to extract a trading strategy from YouTube transcripts.
Paste this prompt followed by the raw transcripts from `transcripts-raw.txt`.

---

You are a quantitative trading strategy analyst. I'm going to give you transcripts from a trading YouTube channel. Your job is to extract a concrete, rules-based trading strategy from them and output it as a structured JSON object.

The JSON must follow this exact schema (based on the rules.json format used by this trading bot):

```json
{
  "strategy_name": "...",
  "description": "...",
  "timeframe": "1m | 5m | 15m | 1h | 4h | 1d",
  "symbol": "BTC/USDT",

  "entry_rules": {
    "logic": "ALL",
    "conditions": [
      {
        "id": "condition_id",
        "description": "Plain English description of what this checks",
        "indicator": "close | rsi_14 | ema_20 | macd | vwap | volume | etc",
        "operator": "> | >= | < | <= | == | !=",
        "value": 0,
        "required": true
      }
    ]
  },

  "exit_rules": {
    "logic": "ANY",
    "conditions": [...]
  },

  "risk_rules": {
    "stop_loss_pct": 2.0,
    "take_profit_pct": 4.0,
    "max_position_size_pct": 5,
    "trailing_stop": false
  },

  "filters": {
    "min_volume_usd_24h": 5000000,
    "avoid_news_windows": false
  }
}
```

Rules for extraction:
1. Only include conditions the trader explicitly states — don't invent rules
2. If they mention a specific number (e.g. "RSI above 30"), use it exactly
3. If they use a named pattern (e.g. "golden cross"), translate it to specific indicator conditions
4. If the trader is inconsistent, use the most commonly mentioned version
5. For any indicator not in the list above, use a descriptive snake_case name (e.g. `bb_upper`, `stoch_k`)
6. If you can't determine a value, use a reasonable default and note it in the description
7. Keep descriptions concise but precise — what exactly is being checked

Output ONLY the JSON. No explanation, no markdown, just the raw JSON object.

---

TRANSCRIPTS:

[Paste the contents of transcripts-raw.txt here]
