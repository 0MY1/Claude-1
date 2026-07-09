"""Flask entrypoint: receives Helius webhook POSTs, runs convergence detection, and
fires Telegram approval alerts."""
import functools
import hmac
import logging
import time

from flask import Flask, Response, jsonify, request

import config
import dashboard
import telegram_bot
import webhook
from convergence import ConvergenceDetector

app = Flask(__name__)
detector = ConvergenceDetector()
START_TIME = time.time()


@app.route("/webhook", methods=["POST"])
def helius_webhook():
    payload = request.get_json(force=True, silent=True) or []
    if not isinstance(payload, list):
        payload = [payload]

    for buy in webhook.parse_helius_payload(payload):
        convergence = detector.record_buy(buy.token_mint, buy.wallet, buy.usd_value, buy.timestamp)
        if convergence:
            try:
                telegram_bot.send_convergence_alert(convergence)
            except Exception:
                app.logger.exception("failed to send telegram alert")

    return jsonify({"status": "ok"})


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


def _require_dashboard_auth(view):
    @functools.wraps(view)
    def wrapped(*args, **kwargs):
        if not config.DASHBOARD_PASSWORD:
            return Response("DASHBOARD_PASSWORD is not set — dashboard disabled.", status=503)

        auth = request.authorization
        password_ok = bool(auth) and hmac.compare_digest(auth.password or "", config.DASHBOARD_PASSWORD)
        if not password_ok:
            return Response(
                "Authentication required",
                status=401,
                headers={"WWW-Authenticate": 'Basic realm="dashboard"'},
            )
        return view(*args, **kwargs)

    return wrapped


@app.route("/dashboard", methods=["GET"])
@_require_dashboard_auth
def dashboard_view():
    context = {
        "now": time.time(),
        "uptime_seconds": time.time() - START_TIME,
        "paper_trading": config.PAPER_TRADING,
        "min_buy_usd": config.MIN_BUY_USD,
        "window_seconds": config.CONVERGENCE_WINDOW_SECONDS,
        "min_wallets": config.MIN_CONVERGENCE_WALLETS,
        "approval_ttl_seconds": config.APPROVAL_TTL_SECONDS,
        "tracked_wallets": config.TRACKED_WALLETS,
        "recent_events": detector.get_recent_events(),
        "pending": telegram_bot.get_pending(),
        "trade_history": telegram_bot.get_trade_history(),
    }
    return Response(dashboard.render(context), mimetype="text/html")


def main():
    logging.basicConfig(level=logging.INFO)
    telegram_bot.start_polling()
    app.run(host="0.0.0.0", port=config.PORT)


if __name__ == "__main__":
    main()
