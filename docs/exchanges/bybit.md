# Bybit API Key Setup

## What you'll need
- Bybit account (sign up at bybit.com)
- 2FA enabled on your account
- **Credentials you'll end up with:** API Key + API Secret (no passphrase)

## Step-by-step

1. Log into bybit.com
2. Click your profile icon (top right) → **API**
3. Click **Create New Key**
4. Select **System-generated API Keys**
5. Set the name: `trading-bot`
6. Choose **API Transaction** permissions

### Permissions to enable
- ✅ Read-Write
- ✅ Spot
- ✅ Unified Trading (if you use unified account)
- ❌ Asset Transfer — leave off
- ❌ Withdrawal — **NEVER enable**

7. Set IP restriction to **No IP restriction** unless you have a static IP
8. Click **Submit** and complete your 2FA verification
9. Copy your **API Key** and **API Secret** — shown once

> ⚠️ The secret is shown only once. Store it immediately.

## What to enter in .env
```
EXCHANGE=bybit
API_KEY=your_api_key
API_SECRET=your_secret_key
API_PASSPHRASE=          # Leave blank — Bybit doesn't use a passphrase
```
