# MEXC API Key Setup

## What you'll need
- MEXC account (sign up at mexc.com)
- **Credentials you'll end up with:** API Key + API Secret (no passphrase)

## Step-by-step

1. Log into mexc.com
2. Click your profile icon → **API** (or go to Account Center → API Management)
3. Click **Create API**
4. Set a name: `trading-bot`

### Permissions to enable
- ✅ Read
- ✅ Trade (Spot)
- ❌ Withdraw — **NEVER enable**

5. IP Restriction — leave blank
6. Complete email verification
7. Copy your **Access Key** and **Secret Key**

> ⚠️ The secret key is shown once. Copy it before closing the dialog.

## What to enter in .env
```
EXCHANGE=mexc
API_KEY=your_access_key
API_SECRET=your_secret_key
API_PASSPHRASE=          # Leave blank — MEXC doesn't use a passphrase
```
