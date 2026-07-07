# Solana FOMO Bot

Watches Solana swaps via a Helius webhook, flags a token when 3+ distinct wallets
buy it (≥$150 each) within an 8-minute rolling window, and asks for approval on
Telegram before buying via Jupiter.

## How it works

1. Helius posts every SWAP transaction on the accounts you're tracking to `/webhook`.
2. `webhook.py` parses each transaction into a normalized buy: wallet, token mint,
   estimated USD value (via SOL/token price from Jupiter's Price API).
3. `convergence.py` keeps a sliding window per token. Once 3+ distinct wallets have
   each bought ≥$150 of the same token within 8 minutes, it flags a convergence.
4. `telegram_bot.py` sends you a message with **✅ Buy** / **❌ Skip** buttons.
5. If you tap Buy, `jupiter.py` gets a quote and submits the swap on-chain.

By default the bot runs in **paper trading mode** (`PAPER_TRADING=true`): it does
everything above but logs the trade instead of submitting it. Set
`PAPER_TRADING=false` and provide `SOLANA_PRIVATE_KEY` in `.env` to go live.

## Setup

### 1. Install dependencies

```bash
cd solana-fomo-bot
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure `.env`

The app reads `../.env` (the repo root), which should already have:

```
HELIUS_API_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

See `.env.example` in this directory for the full list of optional settings
(position size, slippage, thresholds, etc). To go live, add:

```
SOLANA_PRIVATE_KEY=<base58 secret key of the wallet that will execute swaps>
PAPER_TRADING=false
```

### 3. Run the app

```bash
python app.py
```

This starts the Flask server on port 5000 (configurable via `PORT`) and a background
thread that long-polls Telegram for your button presses.

### 4. Expose the webhook with Cloudflare Tunnel

Helius needs a public HTTPS URL to POST to. The quickest way to get one without
deploying anywhere is a Cloudflare Tunnel:

```bash
# Install cloudflared (macOS)
brew install cloudflare/cloudflare/cloudflared

# Install cloudflared (Linux)
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/

# Start a quick tunnel pointing at your local Flask server
cloudflared tunnel --url http://localhost:5000
```

This prints a public URL like `https://random-words.trycloudflare.com`. Your
webhook endpoint is that URL + `/webhook`, e.g.
`https://random-words.trycloudflare.com/webhook`.

(A quick tunnel's URL changes every time you restart it. For a stable URL, create
a named tunnel with a Cloudflare account and a domain — see `cloudflared tunnel
login` / `cloudflared tunnel create` in Cloudflare's docs.)

### 5. Create the Helius webhook

In the [Helius dashboard](https://dashboard.helius.dev) (or via their API), create
a webhook:

- **Webhook URL**: your tunnel URL + `/webhook`
- **Transaction type**: `SWAP`
- **Account addresses**: the wallets you want to watch for convergence (e.g. known
  smart-money / insider wallets)
- **Webhook type**: Enhanced

Once created, any tracked wallet's swap will POST to your bot in real time.

## Files

| File | Purpose |
|------|---------|
| `app.py` | Flask entrypoint — wires webhook → convergence → Telegram together |
| `config.py` | Loads and validates env vars from the repo-root `.env` |
| `webhook.py` | Parses Helius payloads into normalized buy events |
| `convergence.py` | Sliding-window convergence detector |
| `telegram_bot.py` | Sends approval alerts, long-polls for button presses |
| `jupiter.py` | Price lookups and swap execution via Jupiter's Swap API |

## Notes

- Convergence detection is in-memory — restarting the process clears the sliding
  window state (but not open Telegram approval requests, which also live in
  memory and will simply no longer resolve after a restart).
- USD value is estimated from the input side of the swap (SOL or stablecoin spent),
  priced via Jupiter's Price API — it's an estimate, not the exact fill price.
- Approvals expire after `APPROVAL_TTL_SECONDS` (default 10 min) so a stale signal
  can't get bought hours later.
- Jupiter API endpoints and the Solana/solders library surface change fairly often;
  if `jupiter.py` starts erroring, check [Jupiter's API reference](https://dev.jup.ag/api-reference)
  for breaking changes.
