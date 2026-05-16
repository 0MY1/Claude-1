#!/usr/bin/env node
'use strict';

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const { SafetyCheck } = require('./lib/safety-check');
const { TradingViewClient } = require('./lib/tradingview');
const { formatCurrency } = require('./lib/utils');

const TRADES_CSV = path.join(__dirname, 'trades.csv');
const RULES_FILE = path.join(__dirname, 'rules.json');
const SAFETY_LOG = path.join(__dirname, 'safety-check-log.json');
const PORT = parseInt(process.env.DASHBOARD_PORT || '3000', 10);
const REFRESH_MS = parseInt(process.env.TERMINAL_REFRESH_MS || '15000', 10);

function loadRules() {
  if (!fs.existsSync(RULES_FILE)) {
    console.error('rules.json not found. Run node onboard.js first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
}

function recentTrades(n = 8) {
  if (!fs.existsSync(TRADES_CSV)) return [];
  const lines = fs
    .readFileSync(TRADES_CSV, 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('timestamp'));
  return lines.slice(-n).reverse().map(line => {
    const [timestamp, exchange, symbol, side, quantity, price, total_value, , , order_id, mode] =
      line.split(',');
    return { timestamp, exchange, symbol, side, quantity: parseFloat(quantity), price: parseFloat(price), total_value: parseFloat(total_value), order_id, mode };
  });
}

function todayTradeCount() {
  if (!fs.existsSync(TRADES_CSV)) return 0;
  const today = new Date().toISOString().slice(0, 10);
  return fs.readFileSync(TRADES_CSV, 'utf8').split('\n').filter(l => l.startsWith(today)).length;
}

// ── State refreshed in background ────────────────────────────────────────────

const state = {
  indicators: null,
  checks: null,
  allPassed: null,
  error: null,
  lastUpdated: null,
  rules: null,
};

async function poll(tv, safetyCheck) {
  try {
    const ind = await tv.getIndicators(state.rules.symbol || 'BTC/USDT', state.rules.timeframe || '1m');
    const result = safetyCheck.evaluate(ind);
    state.indicators = ind;
    state.checks = result.checks;
    state.allPassed = result.allPassed;
    state.error = null;
  } catch (err) {
    state.error = err.message;
  }
  state.lastUpdated = new Date().toISOString();
}

// ── HTML page ─────────────────────────────────────────────────────────────────

function html() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Claude Trading Bot — Dashboard</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f1117; --surface: #1a1d27; --border: #2a2d3a;
    --text: #c9d1d9; --muted: #6e7681;
    --green: #3fb950; --red: #f85149; --yellow: #d29922; --blue: #58a6ff; --cyan: #39d0d8;
    --pass-bg: #1a2d1a; --fail-bg: #2d1a1a;
  }
  body { background: var(--bg); color: var(--text); font-family: 'Segoe UI', system-ui, sans-serif; font-size: 14px; }
  header {
    background: var(--surface); border-bottom: 1px solid var(--border);
    padding: 14px 24px; display: flex; align-items: center; justify-content: space-between;
  }
  header h1 { font-size: 16px; font-weight: 600; color: var(--cyan); letter-spacing: .5px; }
  .meta { color: var(--muted); font-size: 12px; }
  .meta strong { color: var(--text); }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: .5px; }
  .badge.paper { background: #2d2400; color: var(--yellow); border: 1px solid #5a4800; }
  .badge.live  { background: #2d0d0d; color: var(--red);    border: 1px solid #5a1a1a; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 20px 24px; }
  @media(max-width:700px){ .grid { grid-template-columns: 1fr; } }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 18px; }
  .card h2 { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 14px; }
  .stat { display: flex; justify-content: space-between; align-items: baseline; padding: 5px 0; border-bottom: 1px solid var(--border); }
  .stat:last-child { border-bottom: none; }
  .stat .label { color: var(--muted); }
  .stat .value { font-weight: 600; font-size: 15px; }
  .value.up { color: var(--green); }
  .value.down { color: var(--red); }
  .value.big { font-size: 22px; color: var(--cyan); }
  .check-row { display: flex; align-items: flex-start; gap: 10px; padding: 8px 10px; border-radius: 6px; margin-bottom: 6px; }
  .check-row.pass { background: var(--pass-bg); }
  .check-row.fail { background: var(--fail-bg); }
  .check-icon { font-size: 16px; flex-shrink: 0; margin-top: 1px; }
  .check-text { flex: 1; }
  .check-desc { font-size: 13px; }
  .check-detail { font-size: 11px; color: var(--muted); margin-top: 3px; }
  .verdict { margin-top: 14px; padding: 10px 14px; border-radius: 6px; font-weight: 700; font-size: 13px; text-align: center; }
  .verdict.pass { background: var(--pass-bg); color: var(--green); border: 1px solid #2a5a2a; }
  .verdict.block { background: var(--fail-bg); color: var(--red); border: 1px solid #5a2a2a; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { text-align: left; color: var(--muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; padding: 0 0 8px; border-bottom: 1px solid var(--border); }
  td { padding: 7px 0; border-bottom: 1px solid var(--border); color: var(--text); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  .tag { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 700; }
  .tag.paper { background: #2d2400; color: var(--yellow); }
  .tag.live  { background: #2d0d0d; color: var(--red); }
  .buy  { color: var(--green); font-weight: 600; }
  .sell { color: var(--red);   font-weight: 600; }
  .footer { text-align: center; color: var(--muted); font-size: 11px; padding: 12px 24px 24px; }
  .pulse { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--green); animation: pulse 2s infinite; margin-right: 6px; }
  @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:.3;} }
  .error-bar { background: #2d0d0d; border: 1px solid #5a1a1a; color: var(--red); padding: 10px 24px; font-size: 13px; }
  .countdown { font-size: 11px; color: var(--muted); }
</style>
</head>
<body>
<header>
  <div>
    <h1>⚡ Claude Trading Bot — Live Dashboard</h1>
    <div class="meta" id="meta">Loading…</div>
  </div>
  <div style="text-align:right">
    <span id="mode-badge"></span>
    <div class="countdown" id="countdown"></div>
  </div>
</header>

<div id="error-bar" class="error-bar" style="display:none"></div>

<div class="grid">
  <!-- Market snapshot -->
  <div class="card">
    <h2>Market Snapshot</h2>
    <div id="snapshot">
      <div class="stat"><span class="label">Close price</span><span class="value big" id="close">—</span></div>
      <div class="stat"><span class="label">VWAP</span><span class="value" id="vwap">—</span></div>
      <div class="stat"><span class="label">EMA(8)</span><span class="value" id="ema8">—</span></div>
      <div class="stat"><span class="label">RSI(3)</span><span class="value" id="rsi3">—</span></div>
      <div class="stat"><span class="label">EMA slope</span><span class="value" id="slope">—</span></div>
    </div>
  </div>

  <!-- Safety check -->
  <div class="card">
    <h2>Safety Check</h2>
    <div id="checks">Loading conditions…</div>
    <div id="verdict"></div>
  </div>

  <!-- Recent trades — full width -->
  <div class="card" style="grid-column:1/-1">
    <h2>Recent Trades &nbsp;<span id="trade-count" style="font-weight:400;font-size:11px;color:var(--muted)"></span></h2>
    <table>
      <thead><tr><th>Time</th><th>Mode</th><th>Side</th><th>Symbol</th><th>Quantity</th><th>Price</th><th>Value</th></tr></thead>
      <tbody id="trades"><tr><td colspan="7" style="color:var(--muted);text-align:center;padding:16px">No trades yet</td></tr></tbody>
    </table>
  </div>
</div>

<div class="footer"><span class="pulse"></span>Auto-refreshes every <span id="refresh-label"></span></div>

<script>
const fmt = n => '$' + Number(n).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
let countdown = 0;

async function refresh() {
  try {
    const res = await fetch('/data');
    const d = await res.json();

    // Error bar
    const eb = document.getElementById('error-bar');
    if (d.error) { eb.textContent = '⚠  ' + d.error; eb.style.display = 'block'; }
    else { eb.style.display = 'none'; }

    // Meta
    const updated = d.lastUpdated ? new Date(d.lastUpdated).toLocaleTimeString() : '—';
    document.getElementById('meta').innerHTML =
      'Strategy: <strong>' + d.strategyName + '</strong> &nbsp;·&nbsp; ' +
      d.symbol + ' / ' + d.timeframe + ' &nbsp;·&nbsp; ' +
      'Exchange: <strong>' + (d.exchange || 'not set').toUpperCase() + '</strong> &nbsp;·&nbsp; Updated: ' + updated;

    // Mode badge
    const mb = document.getElementById('mode-badge');
    mb.className = 'badge ' + (d.isPaper ? 'paper' : 'live');
    mb.textContent = d.isPaper ? 'PAPER' : 'LIVE';

    // Market snapshot
    if (d.indicators) {
      const ind = d.indicators;
      document.getElementById('close').textContent = fmt(ind.close);
      document.getElementById('vwap').textContent  = fmt(ind.vwap);
      document.getElementById('ema8').textContent  = fmt(ind.ema_8);
      document.getElementById('rsi3').textContent  = ind.rsi_3.toFixed(2);
      const slopeEl = document.getElementById('slope');
      slopeEl.textContent = ind.ema_8_slope > 0 ? '▲ positive' : '▼ negative';
      slopeEl.className   = 'value ' + (ind.ema_8_slope > 0 ? 'up' : 'down');
    }

    // Safety checks
    if (d.checks) {
      const box = document.getElementById('checks');
      box.innerHTML = d.checks.map(ch => {
        const cls = ch.passed ? 'pass' : 'fail';
        const icon = ch.passed ? '✅' : '❌';
        const detail = !ch.passed
          ? '<div class="check-detail">Got: ' + ch.actual + ' &nbsp;|&nbsp; Needed: ' + ch.condition + '</div>'
          : '';
        return '<div class="check-row ' + cls + '"><span class="check-icon">' + icon + '</span><div class="check-text"><div class="check-desc">' + ch.description + '</div>' + detail + '</div></div>';
      }).join('');

      const vd = document.getElementById('verdict');
      if (d.allPassed) {
        vd.innerHTML = '<div class="verdict pass">✔ ALL CONDITIONS MET — bot would place a trade</div>';
      } else {
        const n = d.checks.filter(c => !c.passed).length;
        vd.innerHTML = '<div class="verdict block">✗ BLOCKED — ' + n + ' condition' + (n===1?'':'s') + ' not met</div>';
      }
    }

    // Trades
    document.getElementById('trade-count').textContent =
      '(today: ' + d.todayCount + ' / ' + d.maxPerDay + ')';
    const tbody = document.getElementById('trades');
    if (!d.trades || d.trades.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="color:var(--muted);text-align:center;padding:16px">No trades yet</td></tr>';
    } else {
      tbody.innerHTML = d.trades.map(t => {
        const ts = (t.timestamp||'').replace('T',' ').slice(0,19);
        const modeTag = '<span class="tag ' + (t.mode||'paper') + '">' + (t.mode||'—').toUpperCase() + '</span>';
        const side = '<span class="' + t.side + '">' + (t.side||'—') + '</span>';
        return '<tr><td>' + ts + '</td><td>' + modeTag + '</td><td>' + side + '</td><td>' + t.symbol + '</td><td>' + (t.quantity||0).toFixed(6) + '</td><td>' + fmt(t.price||0) + '</td><td>' + fmt(t.total_value||0) + '</td></tr>';
      }).join('');
    }
  } catch(e) {
    document.getElementById('error-bar').textContent = '⚠ Could not reach server: ' + e.message;
    document.getElementById('error-bar').style.display = 'block';
  }
}

const REFRESH = REFRESH_SECONDS;
document.getElementById('refresh-label').textContent = REFRESH + 's';
refresh();

setInterval(refresh, REFRESH * 1000);

// countdown timer
countdown = REFRESH;
setInterval(() => {
  countdown--;
  if (countdown <= 0) countdown = REFRESH;
  document.getElementById('countdown').textContent = 'Next refresh in ' + countdown + 's';
}, 1000);
</script>
</body>
</html>`;
}

// ── HTTP server ───────────────────────────────────────────────────────────────

function serveData(res) {
  const rules = state.rules;
  const payload = {
    strategyName: rules.strategy_name,
    symbol: rules.symbol || 'BTC/USDT',
    timeframe: rules.timeframe || '1m',
    exchange: process.env.EXCHANGE || '',
    isPaper: process.env.PAPER_TRADING !== 'false',
    indicators: state.indicators,
    checks: state.checks,
    allPassed: state.allPassed,
    error: state.error,
    lastUpdated: state.lastUpdated,
    trades: recentTrades(8),
    todayCount: todayTradeCount(),
    maxPerDay: parseInt(process.env.MAX_TRADES_PER_DAY || '3', 10),
  };
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  if (req.url === '/data') return serveData(res);

  const page = html().replace('REFRESH_SECONDS', Math.round(REFRESH_MS / 1000));
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(page);
});

// ── Boot ──────────────────────────────────────────────────────────────────────

async function main() {
  state.rules = loadRules();
  const tv = new TradingViewClient();
  const safetyCheck = new SafetyCheck(state.rules, SAFETY_LOG);

  await poll(tv, safetyCheck);
  setInterval(() => poll(tv, safetyCheck), REFRESH_MS);

  server.listen(PORT, () => {
    console.log(`\n  ✅ Dashboard running → http://localhost:${PORT}`);
    console.log(`  Strategy : ${state.rules.strategy_name}`);
    console.log(`  Symbol   : ${state.rules.symbol || 'BTC/USDT'}`);
    console.log(`  Refresh  : every ${REFRESH_MS / 1000}s`);
    console.log(`\n  Press Ctrl+C to stop.\n`);
  });
}

main().catch(err => { console.error('[FATAL]', err.message); process.exit(1); });
