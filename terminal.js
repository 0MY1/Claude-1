#!/usr/bin/env node
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const { SafetyCheck } = require('./lib/safety-check');
const { TradingViewClient } = require('./lib/tradingview');
const { formatCurrency } = require('./lib/utils');

const TRADES_CSV = path.join(__dirname, 'trades.csv');
const RULES_FILE = path.join(__dirname, 'rules.json');
const SAFETY_LOG = path.join(__dirname, 'safety-check-log.json');
const REFRESH_MS = parseInt(process.env.TERMINAL_REFRESH_MS || '30000', 10);

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  white:  '\x1b[37m',
};

const clrscr = () => process.stdout.write('\x1Bc');

function pad(str, width) {
  const plain = str.replace(/\x1b\[[0-9;]*m/g, '');
  return str + ' '.repeat(Math.max(0, width - plain.length));
}

// ── Data helpers ──────────────────────────────────────────────────────────────

function loadRules() {
  if (!fs.existsSync(RULES_FILE)) {
    console.error('rules.json not found. Run node onboard.js first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
}

function recentTrades(n = 6) {
  if (!fs.existsSync(TRADES_CSV)) return [];
  const lines = fs
    .readFileSync(TRADES_CSV, 'utf8')
    .split('\n')
    .filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('timestamp'));
  return lines.slice(-n).reverse().map(line => {
    const [timestamp, exchange, symbol, side, quantity, price, total_value, , , order_id, mode] =
      line.split(',');
    return { timestamp, exchange, symbol, side, quantity, price, total_value, order_id, mode };
  });
}

function todayTradeCount() {
  if (!fs.existsSync(TRADES_CSV)) return 0;
  const today = new Date().toISOString().slice(0, 10);
  return fs
    .readFileSync(TRADES_CSV, 'utf8')
    .split('\n')
    .filter(l => l.startsWith(today)).length;
}

// ── Rendering ─────────────────────────────────────────────────────────────────

function drawDashboard(state) {
  const { rules, indicators, checks, lastUpdated, error, loading } = state;
  const isPaper = process.env.PAPER_TRADING !== 'false';
  const modeLabel = isPaper
    ? `${c.yellow}PAPER${c.reset}`
    : `${c.red}${c.bold}LIVE${c.reset}`;

  clrscr();

  // ── Header ──
  console.log(`${c.cyan}╔══════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.cyan}║    ${c.bold}CLAUDE TRADING BOT  —  TERMINAL DASHBOARD${c.reset}${c.cyan}  ║${c.reset}`);
  console.log(`${c.cyan}╚══════════════════════════════════════════════╝${c.reset}`);
  console.log(
    `  Strategy : ${c.bold}${rules.strategy_name}${c.reset}   Mode : ${modeLabel}`,
  );
  console.log(
    `  Symbol   : ${rules.symbol || 'BTC/USDT'}   Timeframe : ${rules.timeframe || '1m'}   Exchange : ${(process.env.EXCHANGE || 'not set').toUpperCase()}`,
  );
  console.log(
    `  Updated  : ${lastUpdated || '—'}   Refresh every ${REFRESH_MS / 1000}s   ${c.dim}[r] refresh  [q] quit${c.reset}`,
  );
  console.log('');

  // ── Error ──
  if (error) {
    console.log(`  ${c.red}⚠  ${error}${c.reset}`);
    console.log('');
  }

  if (loading) {
    console.log(`  ${c.dim}Fetching market data…${c.reset}`);
    console.log('');
  }

  // ── Market snapshot ──
  if (indicators) {
    const slopeUp = indicators.ema_8_slope > 0;
    console.log(`${c.yellow}  ── MARKET SNAPSHOT ────────────────────────────${c.reset}`);
    console.log(`  Close price  ${c.bold}${formatCurrency(indicators.close)}${c.reset}`);
    console.log(`  VWAP         ${formatCurrency(indicators.vwap)}`);
    console.log(`  EMA(8)       ${formatCurrency(indicators.ema_8)}`);
    console.log(`  RSI(3)       ${indicators.rsi_3.toFixed(2)}`);
    console.log(
      `  EMA slope    ${slopeUp ? c.green + '▲ positive' : c.red + '▼ negative'}${c.reset}`,
    );
    console.log('');
  }

  // ── Safety check ──
  if (checks) {
    const allPassed = checks.every(ch => ch.passed);
    console.log(`${c.yellow}  ── SAFETY CHECK ─────────────────────────────${c.reset}`);
    for (const ch of checks) {
      const icon = ch.passed ? `${c.green}✅${c.reset}` : `${c.red}❌${c.reset}`;
      console.log(`  ${icon}  ${ch.description}`);
      if (!ch.passed) {
        console.log(
          `${c.dim}       → Got: ${ch.actual}  |  Needed: ${ch.condition}${c.reset}`,
        );
      }
    }
    console.log('');
    if (allPassed) {
      console.log(`  ${c.green}${c.bold}✔  ALL CONDITIONS MET — bot would place a trade${c.reset}`);
    } else {
      const blocked = checks.filter(ch => !ch.passed).length;
      console.log(
        `  ${c.red}✗  BLOCKED — ${blocked} condition${blocked === 1 ? '' : 's'} not met${c.reset}`,
      );
    }
    console.log('');
  }

  // ── Recent trades ──
  const trades = recentTrades(6);
  const todayCount = todayTradeCount();
  const maxPerDay = parseInt(process.env.MAX_TRADES_PER_DAY || '3', 10);
  console.log(`${c.yellow}  ── RECENT TRADES  (today: ${todayCount}/${maxPerDay}) ──────────────${c.reset}`);
  if (trades.length === 0) {
    console.log(`  ${c.dim}No trades recorded yet.${c.reset}`);
  } else {
    for (const t of trades) {
      const ts = (t.timestamp || '').replace('T', ' ').slice(0, 19);
      const sideColour = t.side === 'buy' ? c.green : c.red;
      const modeTag = t.mode === 'paper'
        ? `${c.yellow}[P]${c.reset}`
        : `${c.green}[L]${c.reset}`;
      const qty = parseFloat(t.quantity || 0).toFixed(6);
      const px  = parseFloat(t.price || 0);
      console.log(
        `  ${modeTag} ${c.dim}${ts}${c.reset}  ${sideColour}${pad(t.side || '', 4)}${c.reset}  ${t.symbol}  ${qty} @ ${formatCurrency(px)}`,
      );
    }
  }
  console.log('');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function fetchAndDraw(tv, safetyCheck, rules, state) {
  let indicators = null;
  let checks = null;
  let error = null;

  try {
    indicators = await tv.getIndicators(rules.symbol || 'BTC/USDT', rules.timeframe || '1m');
    const result = safetyCheck.evaluate(indicators);
    checks = result.checks;
  } catch (err) {
    error = err.message;
  }

  Object.assign(state, {
    indicators,
    checks,
    error,
    loading: false,
    lastUpdated: new Date().toLocaleTimeString(),
  });
  drawDashboard(state);
}

async function main() {
  const rules = loadRules();
  const tv = new TradingViewClient();
  const safetyCheck = new SafetyCheck(rules, SAFETY_LOG);

  const state = {
    rules,
    indicators: null,
    checks: null,
    lastUpdated: null,
    error: null,
    loading: true,
  };

  drawDashboard(state);

  await fetchAndDraw(tv, safetyCheck, rules, state);

  let timer = setInterval(() => fetchAndDraw(tv, safetyCheck, rules, state), REFRESH_MS);

  if (process.stdin.isTTY) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);

    process.stdin.on('keypress', async (str, key) => {
      if (key.name === 'q' || (key.ctrl && key.name === 'c')) {
        clearInterval(timer);
        clrscr();
        console.log('Terminal closed.');
        process.exit(0);
      }
      if (key.name === 'r') {
        clearInterval(timer);
        state.loading = true;
        drawDashboard(state);
        await fetchAndDraw(tv, safetyCheck, rules, state);
        timer = setInterval(() => fetchAndDraw(tv, safetyCheck, rules, state), REFRESH_MS);
      }
    });
  }
}

main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
