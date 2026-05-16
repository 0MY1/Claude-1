# claude-execute

Automated trading bot that connects TradingView, Claude AI, and a crypto exchange.

## Quick start

**Onboarding (recommended):**
```bash
npm install
node onboard.js
```

**Run bot directly:**
```bash
cp .env.example .env   # fill in your credentials
node bot.js
```

**Tax summary:**
```bash
node bot.js --tax-summary
```

## How it works

1. On schedule, the bot fetches indicator values from TradingView via MCP
2. It runs a safety check: evaluates every condition in `rules.json` against live data
3. If all conditions pass, it calculates position size and places an order
4. Every decision — pass or block — is logged to `safety-check-log.json`
5. Every trade is recorded in `trades.csv`

## Files

| File | Purpose |
|------|---------|
| `bot.js` | Main bot — run this |
| `onboard.js` | Interactive setup wizard |
| `rules.json` | Your trading strategy conditions |
| `.env` | Your credentials and preferences |
| `railway.json` | Cloud deployment config |
| `trades.csv` | Auto-generated trade log |
| `safety-check-log.json` | Auto-generated audit trail |
| `docs/exchanges/` | API key setup guides per exchange |
| `prompts/` | Claude prompts for strategy extraction |

## Exchanges supported

BitGet · Binance · Bybit · OKX · Coinbase Advanced · Kraken · KuCoin · Gate.io · MEXC · Bitfinex

## Paper trading

The bot defaults to `PAPER_TRADING=true` — it logs all decisions but moves no real money.
When you're ready to go live:

```bash
# If using Railway:
railway variables set PAPER_TRADING=false

# If running locally:
# Edit PAPER_TRADING=false in your .env
```

## Deploy to Railway (24/7)

```bash
npm install -g @railway/cli
railway login
railway init
railway up
```

The schedule is set in `railway.json` → `deploy.cronSchedule`.
