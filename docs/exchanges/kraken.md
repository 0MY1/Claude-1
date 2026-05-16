# Kraken API Key Setup

## What you'll need
- Kraken account (sign up at kraken.com)
- 2FA recommended
- **Credentials you'll end up with:** API Key + API Secret (no passphrase)

## Step-by-step

1. Log into kraken.com
2. Click your name (top right) → **Security** → **API**
3. Click **Add key**
4. Give it a description: `trading-bot`

### Permissions to enable (Key Permissions)
- ✅ Query Funds
- ✅ Query Open Orders & Trades
- ✅ Query Closed Orders & Trades
- ✅ Create & Modify Orders
- ❌ Withdraw Funds — **NEVER enable**
- ❌ Transfer Funds — leave off

5. Under **Nonce window** — leave at default
6. Click **Generate Key**
7. Copy your **API Key** and **Private Key** — shown once

> ⚠️ Kraken shows the private key only once. Copy it before closing the page.

## What to enter in .env
```
EXCHANGE=kraken
API_KEY=your_api_key
API_SECRET=your_private_key
API_PASSPHRASE=          # Leave blank — Kraken doesn't use a passphrase
```
