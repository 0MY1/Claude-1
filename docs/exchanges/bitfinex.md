# Bitfinex API Key Setup

## What you'll need
- Bitfinex account (sign up at bitfinex.com)
- **Credentials you'll end up with:** API Key + API Secret (no passphrase)

## Step-by-step

1. Log into bitfinex.com
2. Click your username → **API Keys** (under account settings)
3. Click **Generate New Key**
4. Set a label: `trading-bot`

### Permissions to enable (under each category)
- **Orders:** ✅ Read, ✅ Write
- **Wallets:** ✅ Read
- **Withdrawals:** ❌ **NEVER enable**
- **Positions:** ✅ Read (if trading margin), ❌ Write unless needed

5. Click **Generate API Key**
6. Complete 2FA verification
7. Copy your **API Key** and **API Key Secret**

> ⚠️ Bitfinex shows the secret once. Copy it immediately.

## What to enter in .env
```
EXCHANGE=bitfinex
API_KEY=your_api_key
API_SECRET=your_api_secret
API_PASSPHRASE=          # Leave blank — Bitfinex doesn't use a passphrase
```
