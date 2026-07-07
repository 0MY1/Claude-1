"""Price lookups and swap execution via Jupiter's Swap API.

Uses the free lite-api.jup.ag tier by default (no key, 60 req/min). Set
JUPITER_API_KEY (from portal.jup.ag) to switch to the higher-rate-limit api.jup.ag tier.
"""
import asyncio
import base64
import time

import requests
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Commitment
from solana.rpc.core import TxOptsModel
from solders.keypair import Keypair
from solders.transaction import VersionedTransaction

import config

SOL_MINT = "So11111111111111111111111111111111111111112"

_PRICE_CACHE_TTL_SECONDS = 30
_price_cache = {}  # mint -> (price, fetched_at)


def _base_url():
    return "https://api.jup.ag" if config.JUPITER_API_KEY else "https://lite-api.jup.ag"


def _headers():
    return {"x-api-key": config.JUPITER_API_KEY} if config.JUPITER_API_KEY else {}


def get_price_usd(mint):
    """Returns the USD price of a token mint, or None if unavailable. Cached briefly
    to avoid hammering the API when many buys land in a short window."""
    cached = _price_cache.get(mint)
    if cached and time.time() - cached[1] < _PRICE_CACHE_TTL_SECONDS:
        return cached[0]

    try:
        resp = requests.get(
            f"{_base_url()}/price/v3",
            params={"ids": mint},
            headers=_headers(),
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json().get(mint)
        price = float(data["usdPrice"]) if data else None
    except (requests.RequestException, KeyError, TypeError, ValueError):
        price = None

    if price is not None:
        _price_cache[mint] = (price, time.time())
    return price


def _get_quote(output_mint, amount_lamports, input_mint=SOL_MINT):
    resp = requests.get(
        f"{_base_url()}/swap/v1/quote",
        params={
            "inputMint": input_mint,
            "outputMint": output_mint,
            "amount": amount_lamports,
            "slippageBps": config.SLIPPAGE_BPS,
        },
        headers=_headers(),
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()


def _get_swap_transaction(quote, user_public_key):
    resp = requests.post(
        f"{_base_url()}/swap/v1/swap",
        json={
            "quoteResponse": quote,
            "userPublicKey": user_public_key,
            "wrapAndUnwrapSol": True,
        },
        headers=_headers(),
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()["swapTransaction"]


def execute_buy(token_mint, amount_sol=None):
    """Buys token_mint with amount_sol SOL. Returns a human-readable result string.
    Refuses to run unless PAPER_TRADING is explicitly disabled and a wallet key is set."""
    amount_sol = amount_sol if amount_sol is not None else config.BUY_AMOUNT_SOL

    if config.PAPER_TRADING:
        return f"[paper trading] would swap {amount_sol} SOL -> {token_mint}"

    if not config.SOLANA_PRIVATE_KEY:
        raise RuntimeError("SOLANA_PRIVATE_KEY not set in .env — required for live trading")

    keypair = Keypair.from_base58_string(config.SOLANA_PRIVATE_KEY)
    amount_lamports = int(amount_sol * 1_000_000_000)

    quote = _get_quote(token_mint, amount_lamports)
    swap_tx_b64 = _get_swap_transaction(quote, str(keypair.pubkey()))

    unsigned_tx = VersionedTransaction.from_bytes(base64.b64decode(swap_tx_b64))
    signed_tx = VersionedTransaction(unsigned_tx.message, [keypair])

    result = asyncio.run(_send_raw_transaction(bytes(signed_tx)))
    return f"tx submitted: {result.value}"


async def _send_raw_transaction(raw_tx):
    opts = TxOptsModel(skip_preflight=True, preflight_commitment=Commitment("confirmed"))
    async with AsyncClient(config.SOLANA_RPC_URL) as client:
        return await client.send_raw_transaction(raw_tx, opts=opts)
