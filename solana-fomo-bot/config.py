"""Loads and validates configuration from the repo-root .env file."""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
load_dotenv(ROOT_DIR / ".env")


def _require(name):
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


# Required
HELIUS_API_KEY = _require("HELIUS_API_KEY")
TELEGRAM_BOT_TOKEN = _require("TELEGRAM_BOT_TOKEN")
TELEGRAM_CHAT_ID = _require("TELEGRAM_CHAT_ID")

# Optional — Jupiter API key raises the free rate limit (portal.jup.ag). Unset uses the
# public lite-api.jup.ag tier.
JUPITER_API_KEY = os.environ.get("JUPITER_API_KEY")

# Optional — only needed to actually submit swaps. Without it the bot still detects
# convergences and asks for approval, but execute_buy() will refuse to run.
SOLANA_PRIVATE_KEY = os.environ.get("SOLANA_PRIVATE_KEY")
SOLANA_RPC_URL = os.environ.get(
    "SOLANA_RPC_URL", f"https://mainnet.helius-rpc.com/?api-key={HELIUS_API_KEY}"
)

# Safety default: mirrors the paper-trading convention used elsewhere in this repo.
# Must be explicitly set to "false" to let execute_buy() send a real transaction.
PAPER_TRADING = os.environ.get("PAPER_TRADING", "true").lower() != "false"

BUY_AMOUNT_SOL = float(os.environ.get("BUY_AMOUNT_SOL", "0.1"))
SLIPPAGE_BPS = int(os.environ.get("SLIPPAGE_BPS", "100"))

PORT = int(os.environ.get("PORT", "5000"))

MIN_BUY_USD = float(os.environ.get("MIN_BUY_USD", "150"))
CONVERGENCE_WINDOW_SECONDS = int(os.environ.get("CONVERGENCE_WINDOW_SECONDS", str(8 * 60)))
MIN_CONVERGENCE_WALLETS = int(os.environ.get("MIN_CONVERGENCE_WALLETS", "3"))
APPROVAL_TTL_SECONDS = int(os.environ.get("APPROVAL_TTL_SECONDS", str(10 * 60)))

# Display-only list for the /dashboard — doesn't affect what Helius forwards (that's
# controlled by the webhook's own accountAddresses config), just what's shown as "tracked".
TRACKED_WALLETS = [w.strip() for w in os.environ.get("TRACKED_WALLETS", "").split(",") if w.strip()]

# Only needed by tunnel_supervisor.py, to auto-update the webhook's URL when the
# Cloudflare quick tunnel restarts under a new hostname.
HELIUS_WEBHOOK_ID = os.environ.get("HELIUS_WEBHOOK_ID")

# Required to access /dashboard (HTTP Basic Auth, any username). Unset disables the
# dashboard entirely rather than serving it unprotected — the tunnel URL is public.
DASHBOARD_PASSWORD = os.environ.get("DASHBOARD_PASSWORD")
