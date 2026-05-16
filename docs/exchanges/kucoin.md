# KuCoin API Key Setup

## What you'll need
- KuCoin account (sign up at kucoin.com)
- **Credentials you'll end up with:** API Key + API Secret + Passphrase (all three required)

## Step-by-step

1. Log into kucoin.com
2. Click your profile icon → **API Management**
3. Click **Create API**
4. Enter your trading password (not your login password)
5. Set a name: `trading-bot`
6. **Set your API Passphrase** — this is a passphrase you create for this key. Write it down.

### Permissions to enable
- ✅ General (required)
- ✅ Spot Trading
- ❌ Futures — only if you trade futures
- ❌ Transfer — leave off
- ❌ Withdrawal — **NEVER enable**

7. Set IP Restriction — leave blank unless you have a static IP
8. Complete security verification (email + 2FA)
9. Copy your **API Key**, **API Secret**, and remember your **Passphrase**

> ⚠️ KuCoin requires all three credentials. The passphrase is one you set — keep it safe.

## What to enter in .env
```
EXCHANGE=kucoin
API_KEY=your_api_key
API_SECRET=your_api_secret
API_PASSPHRASE=your_passphrase   # Required for KuCoin
```
