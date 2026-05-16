# OKX API Key Setup

## What you'll need
- OKX account (sign up at okx.com)
- 2FA enabled
- **Credentials you'll end up with:** API Key + Secret Key + Passphrase (all three required)

## Step-by-step

1. Log into okx.com
2. Click your profile icon → **API** (or go to Assets → API)
3. Click **Create V5 API Key**
4. Give it a name: `trading-bot`
5. **Set a Passphrase** — this is required by OKX. Write it down now. You cannot recover it.

### Permissions to enable
- ✅ Read
- ✅ Trade
- ❌ Withdrawal — **NEVER enable**

6. Link a Trading Account (your main trading account)
7. Under IP Whitelist — leave blank unless you have a static IP
8. Click **Confirm** and complete 2FA verification
9. Copy your **API Key**, **Secret Key**, and **Passphrase**

> ⚠️ OKX uses all three credentials. Make sure you copy the passphrase you set — OKX cannot recover it.

## What to enter in .env
```
EXCHANGE=okx
API_KEY=your_api_key
API_SECRET=your_secret_key
API_PASSPHRASE=your_passphrase   # Required for OKX
```
