"""Parses Helius enhanced-webhook payloads into normalized BuyEvent objects."""
import time
from dataclasses import dataclass

import jupiter

SOL_MINT = "So11111111111111111111111111111111111111112"
STABLECOIN_MINTS = {
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",  # USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",  # USDT
}


@dataclass
class BuyEvent:
    wallet: str
    token_mint: str
    usd_value: float
    timestamp: float


def parse_helius_payload(payload):
    """payload: list of Helius enhanced-transaction objects (the webhook POST body)."""
    events = []
    for tx in payload:
        event = _parse_transaction(tx)
        if event is not None:
            events.append(event)
    return events


def _parse_transaction(tx):
    if tx.get("type") != "SWAP":
        return None

    swap = (tx.get("events") or {}).get("swap")
    if not swap:
        return None

    wallet = tx.get("feePayer")
    if not wallet:
        return None

    token_mint = _bought_mint(swap)
    if token_mint is None:
        return None

    usd_value = _estimate_input_usd_value(swap)
    if usd_value is None:
        return None

    timestamp = tx.get("timestamp") or time.time()
    return BuyEvent(wallet=wallet, token_mint=token_mint, usd_value=usd_value, timestamp=timestamp)


def _bought_mint(swap):
    """The output token that isn't SOL or a stablecoin — i.e. the thing being FOMO-bought."""
    for output in swap.get("tokenOutputs") or []:
        mint = output.get("mint")
        if mint and mint != SOL_MINT and mint not in STABLECOIN_MINTS:
            return mint
    if swap.get("nativeOutput"):
        return None  # swapping into SOL is a sell, not a buy
    return None


def _estimate_input_usd_value(swap):
    native_input = swap.get("nativeInput")
    if native_input and int(native_input.get("amount", 0)) > 0:
        sol_amount = int(native_input["amount"]) / 1_000_000_000
        price = jupiter.get_price_usd(SOL_MINT)
        return sol_amount * price if price else None

    for token_input in swap.get("tokenInputs") or []:
        mint = token_input.get("mint")
        raw = token_input.get("rawTokenAmount") or {}
        decimals = raw.get("decimals", 0)
        amount = int(raw.get("tokenAmount", 0)) / (10**decimals) if decimals else 0
        if not amount:
            continue
        if mint in STABLECOIN_MINTS:
            return amount
        price = jupiter.get_price_usd(mint)
        if price:
            return amount * price

    return None
