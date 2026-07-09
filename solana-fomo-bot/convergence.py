"""Sliding-window detector: flags a token once enough distinct wallets buy it in a
short window. Thread-safe since Flask may process requests concurrently."""
import threading
import time
from collections import defaultdict, deque

import config


class ConvergenceDetector:
    def __init__(
        self,
        min_wallets=None,
        min_usd=None,
        window_seconds=None,
        cooldown_seconds=None,
    ):
        self.min_wallets = min_wallets or config.MIN_CONVERGENCE_WALLETS
        self.min_usd = min_usd if min_usd is not None else config.MIN_BUY_USD
        self.window_seconds = window_seconds or config.CONVERGENCE_WINDOW_SECONDS
        # Once a token is flagged, don't re-flag it again until the window rolls over —
        # otherwise every subsequent qualifying buy on the same token re-fires an alert.
        self.cooldown_seconds = cooldown_seconds or self.window_seconds

        self._buys = defaultdict(deque)  # token_mint -> deque[(timestamp, wallet, usd_value)]
        self._last_flagged = {}  # token_mint -> timestamp
        self._recent_events = deque(maxlen=20)
        self._lock = threading.Lock()

    def record_buy(self, token_mint, wallet, usd_value, timestamp=None):
        """Records a buy attempt (even if it's below min_usd) and returns a convergence
        dict if it just crossed the threshold, else None."""
        timestamp = timestamp if timestamp is not None else time.time()
        met_threshold = usd_value >= self.min_usd
        flagged_result = None

        with self._lock:
            distinct_wallets = set()

            if met_threshold:
                buys = self._buys[token_mint]
                buys.append((timestamp, wallet, usd_value))
                self._prune(buys, timestamp)
                distinct_wallets = {w for _, w, _ in buys}

                last_flag = self._last_flagged.get(token_mint, 0)
                if (
                    timestamp - last_flag >= self.cooldown_seconds
                    and len(distinct_wallets) >= self.min_wallets
                ):
                    self._last_flagged[token_mint] = timestamp
                    flagged_result = {
                        "token_mint": token_mint,
                        "wallets": sorted(distinct_wallets),
                        "buys": [{"wallet": w, "usd_value": v} for _, w, v in buys],
                        "total_usd": sum(v for _, _, v in buys),
                    }

            self._recent_events.append(
                {
                    "timestamp": timestamp,
                    "wallet": wallet,
                    "token_mint": token_mint,
                    "usd_value": usd_value,
                    "met_threshold": met_threshold,
                    "distinct_wallets": len(distinct_wallets),
                    "flagged": flagged_result is not None,
                }
            )

        return flagged_result

    def get_recent_events(self):
        """Last 20 buy attempts (newest first), including sub-threshold ones."""
        with self._lock:
            events = list(self._recent_events)
        return list(reversed(events))

    def _prune(self, buys, now):
        cutoff = now - self.window_seconds
        while buys and buys[0][0] < cutoff:
            buys.popleft()
