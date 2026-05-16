# Gate.io API Key Setup

## What you'll need
- Gate.io account (sign up at gate.io)
- **Credentials you'll end up with:** API Key + API Secret (no passphrase)

## Step-by-step

1. Log into gate.io
2. Click your profile (top right) → **API Keys** (or go to Account → API Management)
3. Click **Create API Key**
4. Set a name: `trading-bot`

### Permissions to enable
- ✅ Read Account Balance
- ✅ Spot Trading
- ❌ Withdraw — **NEVER enable**
- ❌ Transfer — leave off

5. IP Whitelist — leave blank
6. Complete the security verification (email code)
7. Copy your **API Key** and **API Secret**

> ⚠️ Store your secret immediately — it's shown only once on Gate.io.

## What to enter in .env
```
EXCHANGE=gateio
API_KEY=your_api_key
API_SECRET=your_api_secret
API_PASSPHRASE=          # Leave blank — Gate.io doesn't use a passphrase
```
