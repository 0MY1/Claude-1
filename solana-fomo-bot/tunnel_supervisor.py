"""Supervises a Cloudflare quick tunnel (`cloudflared tunnel --url ...`).

Free quick tunnels have no uptime guarantee and have been observed to silently die
(stuck retrying a broken control stream) while the process itself keeps running.
This restarts cloudflared when that happens and re-points the Helius webhook at
the new URL automatically — quick tunnels get a new random hostname every restart.

Run this instead of `cloudflared tunnel --url ...` directly:
    python tunnel_supervisor.py

Requires HELIUS_WEBHOOK_ID in .env (the webhook created for this bot) so it knows
which Helius webhook to update.
"""
import re
import signal
import subprocess
import threading
import time

import requests

import config

HEALTH_CHECK_INTERVAL_SECONDS = 60
HEALTH_CHECK_FAILURES_BEFORE_RESTART = 3
STARTUP_TIMEOUT_SECONDS = 30
URL_PATTERN = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")


class TunnelDied(Exception):
    pass


def _drain_output(proc):
    def _drain():
        for line in proc.stdout:
            print(f"[cloudflared] {line}", end="")

    threading.Thread(target=_drain, daemon=True).start()


def _start_tunnel():
    print("[supervisor] starting cloudflared...")
    proc = subprocess.Popen(
        ["cloudflared", "tunnel", "--url", f"http://localhost:{config.PORT}"],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    url = None
    deadline = time.time() + STARTUP_TIMEOUT_SECONDS
    for line in proc.stdout:
        print(f"[cloudflared] {line}", end="")
        match = URL_PATTERN.search(line)
        if match:
            url = match.group(0)
            break
        if time.time() > deadline:
            break

    if not url:
        proc.terminate()
        raise TunnelDied("cloudflared did not print a tunnel URL in time")

    print(f"[supervisor] tunnel is up: {url}")
    _drain_output(proc)
    return proc, url


def _stop_tunnel(proc):
    if proc.poll() is None:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()


def _update_helius_webhook(new_url):
    if not config.HELIUS_WEBHOOK_ID:
        print("[supervisor] HELIUS_WEBHOOK_ID not set in .env — skipping webhook update")
        return

    base = f"https://mainnet.helius-rpc.com/v0/webhooks/{config.HELIUS_WEBHOOK_ID}"
    resp = requests.get(base, params={"api-key": config.HELIUS_API_KEY}, timeout=15)
    resp.raise_for_status()
    webhook = resp.json()

    resp = requests.put(
        base,
        params={"api-key": config.HELIUS_API_KEY},
        json={
            "webhookURL": f"{new_url}/webhook",
            "webhookType": webhook["webhookType"],
            "transactionTypes": webhook["transactionTypes"],
            "accountAddresses": webhook["accountAddresses"],
            "active": True,
        },
        timeout=15,
    )
    resp.raise_for_status()
    print(f"[supervisor] Helius webhook {config.HELIUS_WEBHOOK_ID} -> {new_url}/webhook")


def _tunnel_healthy(url):
    try:
        return requests.get(f"{url}/health", timeout=10).status_code == 200
    except requests.RequestException:
        return False


def run():
    signal.signal(signal.SIGTERM, lambda signum, frame: (_ for _ in ()).throw(KeyboardInterrupt))

    proc, url = _start_tunnel()
    _update_helius_webhook(url)
    consecutive_failures = 0

    try:
        while True:
            time.sleep(HEALTH_CHECK_INTERVAL_SECONDS)

            restart_needed = proc.poll() is not None
            if restart_needed:
                print("[supervisor] cloudflared process exited unexpectedly")
            elif not _tunnel_healthy(url):
                consecutive_failures += 1
                print(
                    f"[supervisor] health check failed "
                    f"({consecutive_failures}/{HEALTH_CHECK_FAILURES_BEFORE_RESTART})"
                )
                restart_needed = consecutive_failures >= HEALTH_CHECK_FAILURES_BEFORE_RESTART
            else:
                consecutive_failures = 0

            if restart_needed:
                print("[supervisor] restarting tunnel...")
                _stop_tunnel(proc)
                proc, url = _start_tunnel()
                _update_helius_webhook(url)
                consecutive_failures = 0
    except KeyboardInterrupt:
        pass
    finally:
        print("[supervisor] shutting down cloudflared")
        _stop_tunnel(proc)


if __name__ == "__main__":
    run()
