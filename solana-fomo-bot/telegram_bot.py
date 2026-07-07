"""Sends convergence alerts to Telegram with inline Buy/Skip buttons, and long-polls
for the button press. Long-polling (rather than a Telegram webhook) means only the
Helius webhook needs to be exposed publicly — Telegram approvals work anywhere."""
import threading
import time
import uuid

import requests

import config
import jupiter

_API_BASE = f"https://api.telegram.org/bot{config.TELEGRAM_BOT_TOKEN}"

_pending = {}  # request_id -> {**convergence, "created_at": float}
_pending_lock = threading.Lock()
_update_offset = 0


def send_convergence_alert(convergence):
    """Posts an alert with Buy/Skip buttons and registers it for approval. Returns
    the request_id."""
    request_id = uuid.uuid4().hex[:12]
    with _pending_lock:
        _pending[request_id] = {**convergence, "created_at": time.time()}

    keyboard = {
        "inline_keyboard": [
            [
                {"text": "✅ Buy", "callback_data": f"approve:{request_id}"},
                {"text": "❌ Skip", "callback_data": f"reject:{request_id}"},
            ]
        ]
    }
    resp = requests.post(
        f"{_API_BASE}/sendMessage",
        json={
            "chat_id": config.TELEGRAM_CHAT_ID,
            "text": _format_alert(convergence),
            "parse_mode": "HTML",
            "reply_markup": keyboard,
        },
        timeout=10,
    )
    resp.raise_for_status()
    return request_id


def _format_alert(c):
    wallets = "\n".join(f"• <code>{w}</code>" for w in c["wallets"])
    return (
        "<b>⚡ FOMO convergence detected</b>\n"
        f"Token: <code>{c['token_mint']}</code>\n"
        f"{len(c['wallets'])} wallets bought within the window (${c['total_usd']:.0f} total)\n\n"
        f"{wallets}\n\nApprove buy?"
    )


def start_polling():
    """Starts the background long-polling thread. Call once at app startup."""
    thread = threading.Thread(target=_poll_loop, daemon=True)
    thread.start()
    return thread


def _poll_loop():
    global _update_offset
    while True:
        try:
            resp = requests.get(
                f"{_API_BASE}/getUpdates",
                params={
                    "offset": _update_offset,
                    "timeout": 30,
                    "allowed_updates": '["callback_query"]',
                },
                timeout=35,
            )
            resp.raise_for_status()
            for update in resp.json().get("result", []):
                _update_offset = update["update_id"] + 1
                callback_query = update.get("callback_query")
                if callback_query:
                    _handle_callback(callback_query)
        except requests.RequestException as exc:
            print(f"[telegram] poll error: {exc}")
            time.sleep(5)


def _handle_callback(callback_query):
    action, _, request_id = callback_query.get("data", "").partition(":")
    message = callback_query["message"]
    chat_id = message["chat"]["id"]
    message_id = message["message_id"]

    with _pending_lock:
        pending = _pending.pop(request_id, None)

    _answer_callback(callback_query["id"])

    if not pending:
        _edit_message(chat_id, message_id, "This request already expired or was handled.")
        return

    if time.time() - pending["created_at"] > config.APPROVAL_TTL_SECONDS:
        _edit_message(chat_id, message_id, "⏱ Approval expired — signal is stale, skipping.")
        return

    if action == "approve":
        _edit_message(chat_id, message_id, f"⏳ Buying <code>{pending['token_mint']}</code>...")
        try:
            result = jupiter.execute_buy(pending["token_mint"])
            _edit_message(chat_id, message_id, f"✅ {result}")
        except Exception as exc:
            _edit_message(chat_id, message_id, f"❌ Buy failed: {exc}")
    else:
        _edit_message(chat_id, message_id, f"Skipped <code>{pending['token_mint']}</code>.")


def _answer_callback(callback_query_id):
    requests.post(
        f"{_API_BASE}/answerCallbackQuery", json={"callback_query_id": callback_query_id}, timeout=10
    )


def _edit_message(chat_id, message_id, text):
    requests.post(
        f"{_API_BASE}/editMessageText",
        json={"chat_id": chat_id, "message_id": message_id, "text": text, "parse_mode": "HTML"},
        timeout=10,
    )
