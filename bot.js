#!/usr/bin/env node
'use strict';

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { ExchangeClient } = require('./lib/exchange');
const { SafetyCheck } = require('./lib/safety-check');
const { TradeLogger } = require('./lib/trade-logger');
const { TradingViewClient } = require('./lib/tradingview');
const { formatCurrency, formatPct } = require('./lib/utils');

const TRADES_CSV = path.join(__dirname, 'trades.csv');
const SAFETY_LOG = path.join(__dirname, 'safety-check-log.json');
const RULES_FILE = path.join(__dirname, 'rules.json');

// ── Bootstrap ────────────────────────────────────────────────────────────────

function loadRules() {
  if (!fs.existsSync(RULES_FILE)) {
    console.error('[ERROR] rules.json not found. Run the onboarding first.');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(RULES_FILE, 'utf8'));
}

function validateEnv() {
  const required = ['EXCHANGE', 'API_KEY', 'API_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`[ERROR] Missing required environment variables: ${missing.join(', ')}`);
    console.error('Copy .env.example to .env and fill in your credentials.');
    process.exit(1);
  }
}

// ── Tax summary ───────────────────────────────────────────────────────────────

async function printTaxSummary() {
  if (!fs.existsSync(TRADES_CSV)) {
    console.log('No trades recorded yet. trades.csv will be created on first run.');
    return;
  }

  const csvParser = require('csv-parser');
  const rows = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(TRADES_CSV)
      .pipe(csvParser())
      .on('data', row => rows.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  const live = rows.filter(r => r.mode === 'live');
  const totalVolume = live.reduce((s, r) => s + parseFloat(r.total_value || 0), 0);
  const totalFees = live.reduce((s, r) => s + parseFloat(r.fee_usd || 0), 0);
  const buys = live.filter(r => r.side === 'buy').length;
  const sells = live.filter(r => r.side === 'sell').length;

  console.log('\n═══════════════════════════════════');
  console.log('         TAX SUMMARY');
  console.log('═══════════════════════════════════');
  console.log(`Total trades (live):   ${live.length} (${buys} buys / ${sells} sells)`);
  console.log(`Total volume:          ${formatCurrency(totalVolume)}`);
  console.log(`Estimated fees paid:   ${formatCurrency(totalFees)}`);
  console.log(`Paper trades logged:   ${rows.length - live.length}`);
  console.log(`\nFull trade log: ${TRADES_CSV}`);
  console.log('═══════════════════════════════════\n');
}

// ── Main trading loop ─────────────────────────────────────────────────────────

async function run() {
  if (process.argv.includes('--tax-summary')) {
    await printTaxSummary();
    return;
  }

  validateEnv();
  const rules = loadRules();
  const isPaper = process.env.PAPER_TRADING !== 'false';
  const symbol = process.env.SYMBOL || rules.symbol || 'BTC/USDT';
  const maxTradesPerDay = parseInt(process.env.MAX_TRADES_PER_DAY || '3', 10);
  const maxTradeSizeUsd = parseFloat(process.env.MAX_TRADE_SIZE_USD || '50');

  const logger = new TradeLogger(TRADES_CSV);
  const safetyCheck = new SafetyCheck(rules, SAFETY_LOG);
  const tv = new TradingViewClient();
  const exchange = new ExchangeClient(
    process.env.EXCHANGE,
    process.env.API_KEY,
    process.env.API_SECRET,
    process.env.API_PASSPHRASE
  );

  console.log('\n╔═══════════════════════════════════════╗');
  console.log('║     CLAUDE TRADING BOT — STARTING     ║');
  console.log('╚═══════════════════════════════════════╝');
  console.log(`Strategy:    ${rules.strategy_name}`);
  console.log(`Symbol:      ${symbol}`);
  console.log(`Exchange:    ${process.env.EXCHANGE.toUpperCase()}`);
  console.log(`Mode:        ${isPaper ? '📋 PAPER TRADING (no real money)' : '⚡ LIVE TRADING'}`);
  console.log(`Max trade:   ${formatCurrency(maxTradeSizeUsd)}`);
  console.log(`Max/day:     ${maxTradesPerDay} trades`);
  console.log(`📄 Trade log: ${TRADES_CSV}`);
  console.log('');

  // Guard: daily trade cap
  const todayCount = await logger.countTodayTrades(isPaper ? 'paper' : 'live');
  if (todayCount >= maxTradesPerDay) {
    console.log(`[GUARD] Daily trade cap reached (${todayCount}/${maxTradesPerDay}). Stopping.`);
    return;
  }

  // Pull market data from TradingView
  console.log(`[1/4] Fetching ${symbol} indicators from TradingView...`);
  let indicators;
  try {
    indicators = await tv.getIndicators(symbol, rules.timeframe || '1m');
  } catch (err) {
    console.error(`[ERROR] TradingView fetch failed: ${err.message}`);
    console.error('Make sure your TradingView MCP connection is active (tv_health_check).');
    process.exit(1);
  }

  console.log('');
  console.log('       MARKET SNAPSHOT');
  console.log('─────────────────────────────────────');
  console.log(`  Close price:  ${formatCurrency(indicators.close)}`);
  console.log(`  VWAP:         ${formatCurrency(indicators.vwap)}`);
  console.log(`  EMA(8):       ${formatCurrency(indicators.ema_8)}`);
  console.log(`  RSI(3):       ${indicators.rsi_3.toFixed(2)}`);
  console.log(`  EMA slope:    ${indicators.ema_8_slope > 0 ? '▲ positive' : '▼ negative'}`);
  console.log('');

  // Run safety check
  console.log('[2/4] Running safety check...');
  console.log('');
  const result = safetyCheck.evaluate(indicators);

  console.log('       SAFETY CHECK RESULTS');
  console.log('─────────────────────────────────────');
  for (const check of result.checks) {
    const icon = check.passed ? '✅' : '❌';
    console.log(`  ${icon}  ${check.description}`);
    if (!check.passed) {
      console.log(`       → Got: ${check.actual}  |  Needed: ${check.condition}`);
    }
  }
  console.log('');

  if (!result.allPassed) {
    const failures = result.checks.filter(c => !c.passed);
    console.log(`[BLOCK] Trade blocked — ${failures.length} condition(s) not met.`);
    console.log(`        This is your strategy working exactly as intended.`);
    safetyCheck.log(symbol, indicators, result, null);
    return;
  }

  // Calculate position size
  console.log('[3/4] Calculating position size...');
  const portfolioUsd = parseFloat(process.env.PORTFOLIO_VALUE_USD || '1000');
  const riskPct = rules.risk_rules?.max_position_size_pct ?? 5;
  const calculatedSize = portfolioUsd * (riskPct / 100);
  const tradeSizeUsd = Math.min(calculatedSize, maxTradeSizeUsd);
  const quantity = tradeSizeUsd / indicators.close;

  console.log(`  Portfolio:   ${formatCurrency(portfolioUsd)}`);
  console.log(`  Risk %:      ${formatPct(riskPct)}`);
  console.log(`  Trade size:  ${formatCurrency(tradeSizeUsd)} (${quantity.toFixed(6)} ${symbol.split('/')[0]})`);
  console.log('');

  // Execute (or simulate)
  console.log('[4/4] Executing trade...');
  let order = null;
  if (isPaper) {
    order = {
      id: `PAPER-${Date.now()}`,
      symbol,
      side: 'buy',
      amount: quantity,
      price: indicators.close,
      status: 'filled',
      paper: true,
    };
    console.log(`  [PAPER] Would BUY ${quantity.toFixed(6)} ${symbol.split('/')[0]} at ${formatCurrency(indicators.close)}`);
  } else {
    try {
      order = await exchange.createMarketBuy(symbol, quantity);
      console.log(`  [LIVE] BUY order placed — ID: ${order.id}`);
    } catch (err) {
      console.error(`[ERROR] Order failed: ${err.message}`);
      process.exit(1);
    }
  }

  // Log trade
  await logger.record({
    symbol,
    side: 'buy',
    quantity,
    price: indicators.close,
    total_value: tradeSizeUsd,
    fee_usd: tradeSizeUsd * 0.001,
    order_id: order.id,
    mode: isPaper ? 'paper' : 'live',
    notes: `Strategy: ${rules.strategy_name}`,
  });

  safetyCheck.log(symbol, indicators, result, order);

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(isPaper
    ? '✅ PAPER TRADE LOGGED — no real money moved'
    : '✅ LIVE TRADE EXECUTED — check your exchange order history');
  console.log(`   Order ID: ${order.id}`);
  console.log(`   Trades today: ${todayCount + 1}/${maxTradesPerDay}`);
  console.log('═══════════════════════════════════════\n');
}

run().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
