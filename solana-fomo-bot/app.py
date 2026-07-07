"""Flask entrypoint: receives Helius webhook POSTs, runs convergence detection, and
fires Telegram approval alerts."""
import logging

from flask import Flask, jsonify, request

import config
import telegram_bot
import webhook
from convergence import ConvergenceDetector

app = Flask(__name__)
detector = ConvergenceDetector()


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


def main():
    logging.basicConfig(level=logging.INFO)
    telegram_bot.start_polling()
    app.run(host="0.0.0.0", port=config.PORT)


if __name__ == "__main__":
    main()
