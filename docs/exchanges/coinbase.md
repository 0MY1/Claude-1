# Coinbase Advanced Trade API Key Setup

## What you'll need
- Coinbase account with Advanced Trade enabled (go to advanced.coinbase.com)
- **Credentials you'll end up with:** API Key + API Secret (no passphrase)

## Step-by-step

1. Go to **advanced.coinbase.com**
2. Click your profile → **Settings** → **API**
3. Click **New API Key**
4. Choose a nickname: `trading-bot`

### Permissions to enable
- ✅ View
- ✅ Trade
- ❌ Transfer — **leave off**

5. Set IP Allowlist — leave blank for now
6. Click **Create & Download**
7. A JSON file will download containing your **API Key** and **Private Key (Secret)**

> ⚠️ The JSON file is the only copy of your private key. Store it securely.

## What to enter in .env
```
EXCHANGE=coinbase
API_KEY=organizations/xxx/apiKeys/yyy   # Full key path from the JSON
API_SECRET=-----BEGIN EC PRIVATE KEY-----\n...  # Private key from the JSON
API_PASSPHRASE=          # Leave blank — Coinbase Advanced doesn't use a passphrase
```

> Note: For Coinbase Advanced Trade, the API key is a long path string and the secret is an EC private key. Copy them exactly from the downloaded JSON.
