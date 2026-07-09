"""Builds the plain HTML/CSS /dashboard page. No JS beyond a meta-refresh tag.

Values sourced from Helius webhook payloads (wallet, token_mint, result strings) are
attacker-controlled — /webhook has no signature verification — so everything dynamic
is HTML-escaped before being embedded here to prevent stored XSS.
"""
from html import escape
from datetime import datetime, timezone


def render(context):
    return f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="10">
<title>Solana FOMO Bot — Dashboard</title>
<style>
{_CSS}
</style>
</head>
<body>
<div class="page">
  <h1>Solana FOMO Bot</h1>
  {_render_status(context)}
  {_render_wallets(context)}
  {_render_recent_events(context)}
  {_render_pending(context)}
  {_render_trade_history(context)}
  <p class="footer">Auto-refreshes every 10s · last rendered {_fmt_ts(context["now"])}</p>
</div>
</body>
</html>
"""


def _render_status(c):
    mode = (
        '<span class="badge badge-live">LIVE TRADING</span>'
        if not c["paper_trading"]
        else '<span class="badge badge-paper">PAPER TRADING</span>'
    )
    return f"""
  <div class="card">
    <h2>Status</h2>
    <table class="kv">
      <tr><th>Running</th><td><span class="badge badge-ok">UP</span></td></tr>
      <tr><th>Mode</th><td>{mode}</td></tr>
      <tr><th>Uptime</th><td>{escape(_fmt_duration(c["uptime_seconds"]))}</td></tr>
      <tr><th>Min buy size</th><td>${c["min_buy_usd"]:.2f}</td></tr>
      <tr><th>Convergence window</th><td>{c["window_seconds"] // 60} min</td></tr>
      <tr><th>Wallets required</th><td>{c["min_wallets"]}</td></tr>
      <tr><th>Approval TTL</th><td>{c["approval_ttl_seconds"] // 60} min</td></tr>
    </table>
  </div>
"""


def _render_wallets(c):
    wallets = c["tracked_wallets"]
    if not wallets:
        body = '<p class="empty">No wallets configured — set TRACKED_WALLETS in .env.</p>'
    else:
        rows = "\n".join(f"<li><code>{escape(w)}</code></li>" for w in wallets)
        body = f'<ul class="wallet-list">{rows}</ul>'
    return f"""
  <div class="card">
    <h2>Wallets tracked ({len(wallets)})</h2>
    {body}
  </div>
"""


def _render_recent_events(c):
    events = c["recent_events"]
    if not events:
        rows = '<tr><td colspan="6" class="empty">No buys observed yet.</td></tr>'
    else:
        rows = "\n".join(
            f"""<tr>
        <td>{_fmt_ts(e["timestamp"])}</td>
        <td><code>{escape(e["wallet"])}</code></td>
        <td><code>{escape(e["token_mint"])}</code></td>
        <td>${e["usd_value"]:.2f}</td>
        <td>{e["distinct_wallets"]}</td>
        <td>{_event_flag(e)}</td>
      </tr>"""
            for e in events
        )
    return f"""
  <div class="card">
    <h2>Recent convergence events (last {len(events)})</h2>
    <div class="table-wrap">
    <table>
      <tr><th>Time</th><th>Wallet</th><th>Token</th><th>Buy size</th><th>Distinct wallets</th><th>Result</th></tr>
      {rows}
    </table>
    </div>
  </div>
"""


def _event_flag(e):
    if e["flagged"]:
        return '<span class="badge badge-flag">🚩 FLAGGED</span>'
    if not e["met_threshold"]:
        return '<span class="badge badge-muted">below threshold</span>'
    return '<span class="badge badge-muted">watching</span>'


def _render_pending(c):
    pending = c["pending"]
    if not pending:
        rows = '<tr><td colspan="5" class="empty">No pending approvals.</td></tr>'
    else:
        rows = "\n".join(
            f"""<tr>
        <td><code>{escape(p["token_mint"])}</code></td>
        <td>{len(p["wallets"])}</td>
        <td>${p["total_usd"]:.2f}</td>
        <td>{_fmt_ts(p["created_at"])}</td>
        <td>{_fmt_remaining(p["created_at"], c["approval_ttl_seconds"], c["now"])}</td>
      </tr>"""
            for p in pending
        )
    return f"""
  <div class="card">
    <h2>Pending Telegram approvals ({len(pending)})</h2>
    <div class="table-wrap">
    <table>
      <tr><th>Token</th><th>Wallets</th><th>Total</th><th>Sent</th><th>Expires in</th></tr>
      {rows}
    </table>
    </div>
  </div>
"""


def _render_trade_history(c):
    trades = c["trade_history"]
    if not trades:
        rows = '<tr><td colspan="5" class="empty">No trades yet.</td></tr>'
    else:
        rows = "\n".join(
            f"""<tr>
        <td>{_fmt_ts(t["timestamp"])}</td>
        <td><code>{escape(t["token_mint"])}</code></td>
        <td>{_decision_badge(t["decision"])}</td>
        <td>{"paper" if t["paper_trading"] else "real"}</td>
        <td>{f'{t["amount_sol"]:.4f} SOL' if t["amount_sol"] is not None else "—"}</td>
      </tr>"""
            for t in trades
        )
    return f"""
  <div class="card">
    <h2>Trade history (last {len(trades)})</h2>
    <div class="table-wrap">
    <table>
      <tr><th>Time</th><th>Token</th><th>Decision</th><th>Type</th><th>Amount</th></tr>
      {rows}
    </table>
    </div>
  </div>
"""


def _decision_badge(decision):
    css_class = {
        "approved": "badge-ok",
        "skipped": "badge-muted",
        "expired": "badge-muted",
        "failed": "badge-live",
    }.get(decision, "badge-muted")
    return f'<span class="badge {css_class}">{escape(decision)}</span>'


def _fmt_ts(ts):
    return datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")


def _fmt_duration(seconds):
    seconds = int(seconds)
    days, seconds = divmod(seconds, 86400)
    hours, seconds = divmod(seconds, 3600)
    minutes, seconds = divmod(seconds, 60)
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours or days:
        parts.append(f"{hours}h")
    if minutes or hours or days:
        parts.append(f"{minutes}m")
    parts.append(f"{seconds}s")
    return " ".join(parts)


def _fmt_remaining(created_at, ttl_seconds, now):
    remaining = int(created_at + ttl_seconds - now)
    if remaining <= 0:
        return '<span class="badge badge-live">expired</span>'
    return _fmt_duration(remaining)


_CSS = """
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 2rem 1rem;
  background: #0f1115;
  color: #e6e6e6;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
}
.page { max-width: 960px; margin: 0 auto; }
h1 { margin: 0 0 1.5rem; font-size: 1.5rem; }
h2 { margin: 0 0 0.75rem; font-size: 1rem; color: #9aa4b2; text-transform: uppercase; letter-spacing: 0.05em; }
.card {
  background: #171a21;
  border: 1px solid #2a2f3a;
  border-radius: 8px;
  padding: 1.25rem;
  margin-bottom: 1.25rem;
}
table { border-collapse: collapse; width: 100%; font-size: 0.9rem; }
table.kv th { text-align: left; width: 220px; color: #9aa4b2; font-weight: normal; padding: 0.3rem 0; }
table.kv td { padding: 0.3rem 0; }
table:not(.kv) th {
  text-align: left;
  border-bottom: 1px solid #2a2f3a;
  padding: 0.5rem 0.6rem;
  color: #9aa4b2;
  font-weight: normal;
  white-space: nowrap;
}
table:not(.kv) td {
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid #1f232c;
  white-space: nowrap;
}
.table-wrap { overflow-x: auto; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.85em; color: #c8d1e0; }
.empty { color: #6b7280; font-style: italic; white-space: normal; }
.wallet-list { list-style: none; margin: 0; padding: 0; }
.wallet-list li { padding: 0.25rem 0; }
.badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
}
.badge-ok { background: #103b25; color: #4ade80; }
.badge-live { background: #3b1010; color: #f87171; }
.badge-paper { background: #1e293b; color: #93c5fd; }
.badge-flag { background: #3b2a10; color: #fbbf24; }
.badge-muted { background: #23262e; color: #9aa4b2; }
.footer { color: #6b7280; font-size: 0.8rem; text-align: center; margin-top: 1rem; }
"""
