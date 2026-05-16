# Binance API Key Setup

## What you'll need
- Binance account (sign up at binance.com)
- Google Authenticator or similar 2FA app
- **Credentials you'll end up with:** API Key + API Secret (no passphrase)

## Step-by-step

1. Log into your Binance account at binance.com
2. Click your profile icon (top right) → **API Management**
3. Click **Create API** → choose **System generated**
4. Give it a label: `trading-bot`
5. Complete the security verification (email + 2FA)
6. On the next screen, click **Edit restrictions**

### Permissions to enable
- ✅ Enable Reading
- ✅ Enable Spot & Margin Trading
- ❌ Enable Withdrawals — **NEVER enable this**

7. Under **IP access restrictions**, choose **Unrestricted** unless you know your static IP
8. Click **Save** and complete verification again
9. Your **API Key** and **Secret Key** will be shown — **copy both immediately**

> ⚠️ Binance only shows your Secret Key once. If you miss it, you'll need to delete and recreate the key.

## What to enter in .env
```
EXCHANGE=binance
API_KEY=your_api_key
API_SECRET=your_secret_key
API_PASSPHRASE=          # Leave blank — Binance doesn't use a passphrase
```
