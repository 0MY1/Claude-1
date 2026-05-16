#!/usr/bin/env node
'use strict';

/**
 * Interactive onboarding agent for the claude-execute trading bot.
 * Run with: node onboard.js
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { execSync, exec } = require('child_process');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(prompt) {
  return new Promise(resolve => rl.question(prompt, answer => resolve(answer.trim())));
}

function openUrl(url) {
  const platform = process.platform;
  if (platform === 'darwin') execSync(`open "${url}"`);
  else if (platform === 'win32') execSync(`start "${url}"`);
  else execSync(`xdg-open "${url}"`);
}

function writeEnvLine(key, value) {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) fs.copyFileSync(path.join(__dirname, '.env.example'), envPath);
  let content = fs.readFileSync(envPath, 'utf8');

  const regex = new RegExp(`^${key}=.*`, 'm');
  if (regex.test(content)) {
    content = content.replace(regex, `${key}=${value}`);
  } else {
    content += `\n${key}=${value}`;
  }
  fs.writeFileSync(envPath, content);
}

function readEnvValue(key) {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return '';
  const match = fs.readFileSync(envPath, 'utf8').match(new RegExp(`^${key}=(.*)`, 'm'));
  return match ? match[1].trim() : '';
}

function hr() { console.log('\n' + '─'.repeat(50) + '\n'); }
function title(t) { console.log('\n╔' + '═'.repeat(t.length + 2) + '╗'); console.log(`║ ${t} ║`); console.log('╚' + '═'.repeat(t.length + 2) + '╝\n'); }

async function stepWispr() {
  title('STEP 0 — Wispr Flow (optional)');
  console.log('Before we start — one quick thing. Talking to Claude is often faster than typing.');
  console.log('There\'s a tool called Wispr Flow — it turns your voice into text anywhere on your');
  console.log('computer, so you can just speak your instructions and Claude hears them.\n');
  console.log('You don\'t need it. You can type everything. But if you want it, I\'ll open it now.\n');

  const answer = await ask('Do you want to set up Wispr Flow? Type "yes" to open it, or "skip" to continue: ');

  if (answer.toLowerCase() === 'yes') {
    openUrl('https://ref.wisprflow.ai/vaughan-fawcett');
    console.log('\nI\'ve opened Wispr Flow. Download it, install it, and come back when it\'s running.');
    console.log('Once it\'s set up you can speak the rest of this setup instead of typing.\n');
    await ask('Type "done" when you\'re ready: ');
  }
}

async function stepClone() {
  title('STEP 1 — Getting started');
  console.log('Welcome. I\'m going to walk you through setting up your automated trading bot.');
  console.log('By the end of this, you\'ll have a bot running on a schedule that reads your');
  console.log('TradingView chart, checks your strategy conditions, and executes trades on your');
  console.log('exchange automatically. Let\'s go.\n');

  console.log('Your bot files are already here. Here\'s what you\'re working with:\n');
  const files = fs.readdirSync(__dirname).filter(f => !f.startsWith('.') && f !== 'node_modules');
  files.forEach(f => console.log(`  ${f}`));
}

async function stepExchange() {
  title('STEP 2 — Choose your exchange');

  const exchanges = [
    'BitGet (default — bot is pre-configured for it)',
    'Binance', 'Bybit', 'OKX', 'Coinbase Advanced',
    'Kraken', 'KuCoin', 'Gate.io', 'MEXC', 'Bitfinex',
  ];
  exchanges.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  console.log('');

  const choice = await ask('Which exchange are you going to use? (name or number): ');
  const idx = parseInt(choice) - 1;
  let exchangeName = isNaN(idx) ? choice.toLowerCase() : exchanges[idx].split(' ')[0].toLowerCase();
  exchangeName = exchangeName.replace('.', '').replace(' ', '');

  if (exchangeName === 'bitget' || idx === 0) {
    console.log('\nGreat — BitGet is the bot\'s default. If you don\'t have an account, sign up here:');
    openUrl('https://bonus.bitget.com/GreymatterAI');
    console.log('I\'ve opened BitGet for you. Create your account if you haven\'t already.\n');
    await ask('Type "done" when ready: ');

    console.log('\nNow let\'s get your API key. Follow these steps in the BitGet app:\n');
    console.log('  1. Open the BitGet app');
    console.log('  2. Tap the Home button at the bottom left');
    console.log('  3. Tap your profile picture at the top left');
    console.log('  4. Scroll all the way down and tap More Services');
    console.log('  5. Along the top menu, find and tap Tools');
    console.log('  6. Tap API Keys');
    console.log('  7. Tap Create API Key → Automatically Generated API Keys');
    console.log('  8. Give it a name — call it something like \'Trader Thing\'');
    console.log('  9. Set a Passphrase — write it down now. You can\'t recover it later.');
    console.log(' 10. Bind IP Address — optional, skip it if you\'re not sure');
    console.log(' 11. Permissions: select Spot Trading. Leave Withdrawals OFF — always.');
    console.log(' 12. Tap Confirm and complete the verification');
    console.log(' 13. Copy your API Key and Secret Key\n');

    await ask('Type "ready" when you have your API Key, Secret Key, and Passphrase: ');
  } else {
    const docsMap = {
      binance: 'docs/exchanges/binance.md', bybit: 'docs/exchanges/bybit.md',
      okx: 'docs/exchanges/okx.md', coinbase: 'docs/exchanges/coinbase.md',
      kraken: 'docs/exchanges/kraken.md', kucoin: 'docs/exchanges/kucoin.md',
      gateio: 'docs/exchanges/gateio.md', mexc: 'docs/exchanges/mexc.md',
      bitfinex: 'docs/exchanges/bitfinex.md',
    };
    const docPath = docsMap[exchangeName];
    if (docPath && fs.existsSync(path.join(__dirname, docPath))) {
      console.log('\n' + fs.readFileSync(path.join(__dirname, docPath), 'utf8'));
    } else {
      console.log(`\nNo specific guide for ${exchangeName} — check their API documentation.`);
    }
    await ask('Type "ready" when you have your credentials: ');
  }

  writeEnvLine('EXCHANGE', exchangeName === 'bitget' || idx === 0 ? 'bitget' : exchangeName);

  // Create .env and prompt for credentials
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) fs.copyFileSync(path.join(__dirname, '.env.example'), envPath);

  console.log('\nI\'ve created your .env file. Let\'s fill in your credentials now.\n');

  const apiKey = await ask('Paste your API Key: ');
  const apiSecret = await ask('Paste your API Secret: ');
  const passphrase = await ask('Passphrase (press Enter if your exchange doesn\'t use one): ');

  writeEnvLine('API_KEY', apiKey);
  writeEnvLine('API_SECRET', apiSecret);
  if (passphrase) writeEnvLine('API_PASSPHRASE', passphrase);

  console.log('\n✅ Credentials saved to .env');
}

async function stepTradingPrefs() {
  title('STEP 2b — Trading preferences');

  const portfolio = await ask('How much of your portfolio are you working with in USD? (e.g. 1000): ');
  const maxTrade = await ask('Maximum size of any single trade in USD? (e.g. 50): ');
  const maxPerDay = await ask('Maximum number of trades per day? (e.g. 3): ');

  writeEnvLine('PORTFOLIO_VALUE_USD', portfolio);
  writeEnvLine('MAX_TRADE_SIZE_USD', maxTrade);
  writeEnvLine('MAX_TRADES_PER_DAY', maxPerDay);

  console.log('\n📊 Trading guardrails set:');
  console.log(`  Portfolio:    $${portfolio}`);
  console.log(`  Max trade:    $${maxTrade}`);
  console.log(`  Max per day:  ${maxPerDay} trades`);
  console.log('\nYour bot will never place a trade bigger than $' + maxTrade +
    ' and will stop after ' + maxPerDay + ' trades per day regardless of what the market is doing.');
  console.log('These are your guardrails.');
}

async function stepTradingView() {
  title('STEP 3 — Connect TradingView');

  console.log('Now we need TradingView connected to Claude via the MCP.');
  console.log('If you haven\'t set that up yet, watch this first:\n');
  console.log('  Setup video: https://youtu.be/CrgISHUiYUw\n');
  console.log('Windows/Linux? See:');
  console.log('  Windows: https://github.com/vaughanf1/claude-execute/blob/main/docs/setup-windows.md');
  console.log('  Linux:   https://github.com/vaughanf1/claude-execute/blob/main/docs/setup-linux.md\n');
  console.log('If you already have it set up, run tv_health_check in Claude Code.');
  console.log('If it returns cdp_connected: true — you\'re good.\n');

  await ask('Type "connected" to continue: ');
  console.log('\n✅ TradingView connection confirmed. Moving on.');
}

async function stepStrategy() {
  title('STEP 4 — Choose your strategy');

  console.log('You\'ve got three options:\n');
  console.log('  1. Use the demo strategy — VWAP + RSI(3) + EMA(8) scalping on 1-minute chart.');
  console.log('     Good for getting started, already loaded in rules.json.');
  console.log('  2. I already have my own strategy — tell me what it is.');
  console.log('  3. Scrape a strategy from a YouTube trader — I\'ll extract it automatically.\n');

  const choice = await ask('Type 1, 2, or 3: ');

  if (choice === '1') {
    console.log('\n✅ Demo strategy already loaded in rules.json. Moving to Step 5.');
  } else if (choice === '2') {
    console.log('');
    const desc = await ask('Describe your strategy (indicators, buy conditions, sell conditions, risk rules):\n> ');
    console.log('\nGot it. Updating rules.json to reflect your strategy...');

    // Preserve structure, update description
    const rules = JSON.parse(fs.readFileSync(path.join(__dirname, 'rules.json'), 'utf8'));
    rules.strategy_name = 'Custom Strategy';
    rules.description = desc;
    fs.writeFileSync(path.join(__dirname, 'rules.json'), JSON.stringify(rules, null, 2));

    console.log('✅ rules.json updated. Review it and refine the conditions as needed.');
  } else if (choice === '3') {
    await stepApify();
  }
}

async function stepApify() {
  console.log('\nWe\'re going to use Apify to pull transcripts from a YouTube trader\'s channel.');
  openUrl('https://apify.com');
  console.log('I\'ve opened Apify. Create your free account if you don\'t have one.\n');
  await ask('Type "done" when you have an account: ');

  console.log('\nNow get your API token:\n');
  console.log('  1. In Apify, click the search icon on the left');
  console.log('  2. Type "API" and click API tokens');
  console.log('  3. Click "Create a new token"');
  console.log('  4. Name it "trading bot" and click Create');
  console.log('  5. Copy your new token\n');
  await ask('Type "ready" when you have it copied: ');

  const apiKey = await ask('Paste your Apify API token: ');
  writeEnvLine('APIFY_API_KEY', apiKey);
  console.log('\n✅ Apify key saved.\n');

  const channelUrl = await ask('Paste the YouTube channel URL of the trader you want to clone: ');
  console.log('\nOn it. Scraping their transcripts and extracting a strategy...');
  console.log('This takes about 10–20 minutes. Sit tight.\n');

  await scrapeYoutubeStrategy(channelUrl, apiKey);
}

async function scrapeYoutubeStrategy(channelUrl, apiKey) {
  const axios = require('axios');

  // Start the Apify actor run
  const runRes = await axios.post(
    'https://api.apify.com/v2/acts/streamers~youtube-transcript/runs',
    { startUrls: [{ url: channelUrl }], maxVideos: 100 },
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  const runId = runRes.data.data.id;
  console.log(`  Apify run started (ID: ${runId}). Waiting for results...`);

  // Poll for completion
  let status = 'RUNNING';
  while (status === 'RUNNING' || status === 'READY') {
    await new Promise(r => setTimeout(r, 15000));
    const statusRes = await axios.get(
      `https://api.apify.com/v2/actor-runs/${runId}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    status = statusRes.data.data.status;
    process.stdout.write('.');
  }

  console.log('\n  Transcripts collected. Extracting strategy...');

  const datasetRes = await axios.get(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?limit=100`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );

  const transcripts = datasetRes.data.map(item => item.transcript || item.text || '').join('\n\n---\n\n');

  // Load the extraction prompt
  const promptPath = path.join(__dirname, 'prompts', '01-extract-strategy.md');
  const extractPrompt = fs.existsSync(promptPath) ? fs.readFileSync(promptPath, 'utf8') : '';

  console.log('  Transcripts ready. Use the following with Claude to extract the strategy:');
  console.log('\n  Copy the contents of prompts/01-extract-strategy.md and paste it to Claude');
  console.log('  along with the transcripts. Then paste Claude\'s rules.json output into your rules.json.\n');

  // Save raw transcripts for the user
  const transcriptPath = path.join(__dirname, 'transcripts-raw.txt');
  fs.writeFileSync(transcriptPath, transcripts);
  console.log(`  Raw transcripts saved to: ${transcriptPath}`);
}

async function stepRailway() {
  title('STEP 5 — Deploy to Railway (24/7 cloud)');

  console.log('Now let\'s get this running in the cloud so it works even when your laptop is closed.\n');

  // Check Railway CLI
  try {
    execSync('railway --version', { stdio: 'pipe' });
    console.log('✅ Railway CLI is already installed.');
  } catch {
    console.log('Installing Railway CLI...');
    execSync('npm install -g @railway/cli', { stdio: 'inherit' });
  }

  // Check login
  try {
    const whoami = execSync('railway whoami', { stdio: 'pipe' }).toString().trim();
    console.log(`✅ Logged into Railway as: ${whoami}`);
  } catch {
    console.log('Opening Railway login...');
    execSync('railway login', { stdio: 'inherit' });
    await ask('Type "done" when you\'re logged in: ');
  }

  console.log('\nHow often do you want the bot to check for trades?\n');
  console.log('  1. Every 4 hours (recommended for 4H charts)');
  console.log('  2. Once a day at 9am UTC');
  console.log('  3. Every hour');
  console.log('  4. Custom — describe what you want\n');

  const scheduleChoice = await ask('Type 1, 2, 3, or describe your schedule: ');

  const cronMap = { '1': '0 */4 * * *', '2': '0 9 * * *', '3': '0 * * * *' };
  const descMap = {
    '1': 'every 4 hours', '2': 'once a day at 9am UTC', '3': 'every hour',
  };

  let cron = cronMap[scheduleChoice];
  let desc = descMap[scheduleChoice];

  if (!cron) {
    // Interpret custom schedule
    const input = scheduleChoice.toLowerCase();
    if (input.includes('minute')) {
      const m = input.match(/(\d+)/);
      cron = m ? `*/${m[1]} * * * *` : '*/15 * * * *';
      desc = `every ${m ? m[1] : 15} minutes`;
    } else {
      cron = '0 */4 * * *';
      desc = 'every 4 hours (default)';
    }
  }

  // Update railway.json
  const railwayPath = path.join(__dirname, 'railway.json');
  const railwayConfig = JSON.parse(fs.readFileSync(railwayPath, 'utf8'));
  railwayConfig.deploy.cronSchedule = cron;
  fs.writeFileSync(railwayPath, JSON.stringify(railwayConfig, null, 2));
  console.log(`\n✅ Schedule set to: ${desc} (${cron})`);

  console.log('\nDeploying to Railway...');
  try {
    execSync('railway init', { stdio: 'inherit' });
    execSync('railway up', { stdio: 'inherit' });
    console.log('\n✅ Deployed successfully!');
  } catch (err) {
    console.log('\n⚠️  Deployment failed. Run these commands manually:');
    console.log('   railway init');
    console.log('   railway up');
  }

  console.log('\nYour bot is now live in PAPER TRADING mode — no real money moves yet.');
  console.log('Watch it for a few days. When you\'re happy, run:');
  console.log('\n  railway variables set PAPER_TRADING=false\n');
  console.log('And it goes live.');
}

async function stepTax() {
  title('STEP 6 — Tax accounting setup');

  const csvPath = path.join(__dirname, 'trades.csv');
  console.log('Every trade your bot places is automatically recorded in trades.csv.');
  console.log('\nEach row contains:');
  console.log('  • Date and time');
  console.log('  • Exchange, symbol, side (buy/sell)');
  console.log('  • Quantity, price, total value');
  console.log('  • Estimated fee (0.1%) and net amount');
  console.log('  • Order ID, paper vs live mode');
  console.log('  • Notes\n');
  console.log('At tax time, open the file and hand it to your accountant.');
  console.log('Or import it directly into Google Sheets, Excel, or your accounting software.\n');
  console.log(`📄 Trade log: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    // Create the file now so they can see it
    const { TradeLogger } = require('./lib/trade-logger');
    new TradeLogger(csvPath);
  }

  console.log('\nOpen it now in Google Sheets or Excel — you\'ll see it\'s ready and waiting.');
  console.log('\nTo get a running tax summary any time, run:');
  console.log('  node bot.js --tax-summary');
}

async function stepSafetyExplain() {
  title('STEP 7 — Your safety check conditions');

  const rules = JSON.parse(fs.readFileSync(path.join(__dirname, 'rules.json'), 'utf8'));
  const conditions = rules.entry_rules?.conditions ?? [];

  console.log('Before we run this, here\'s what your bot will check before every single trade.');
  console.log(`These conditions come directly from your strategy in rules.json:\n`);
  console.log(`Strategy: ${rules.strategy_name}`);
  console.log(`Timeframe: ${rules.timeframe}\n`);
  console.log('Your bot will only trade when ALL of the following are true:\n');

  conditions.forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.description}`);
  });

  console.log('\nIf any single one of those fails, no trade happens.');
  console.log('It tells you which one failed and the actual value it saw.\n');
  console.log('This is an exact mirror of your strategy — not a generic filter.');
}

async function stepFirstRun() {
  title('STEP 8 — Watch it run');

  console.log('Let\'s run the bot once right now so you can see it working.\n');
  await ask('Press Enter to run the bot: ');

  try {
    execSync('node bot.js', { stdio: 'inherit', cwd: __dirname });
  } catch {
    console.log('\nThe bot run completed (exit code ignored in paper mode).');
  }

  console.log('\nEvery condition you just saw checked — those came from your rules.json.');
  console.log('This is your strategy running, not a generic bot.\n');
  console.log('Every decision is logged to safety-check-log.json — that\'s your full audit trail.\n');

  const exchange = readEnvValue('EXCHANGE');
  if (exchange) {
    console.log(`Open ${exchange.charAt(0).toUpperCase() + exchange.slice(1)} → Order History.`);
    console.log('As real trades execute over time, you\'ll see them appear there automatically.\n');
  }

  console.log('╔═══════════════════════════════════════╗');
  console.log('║   YOU\'RE DONE. YOUR BOT IS LIVE. 🎉  ║');
  console.log('╚═══════════════════════════════════════╝\n');
}

async function main() {
  console.clear();
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║   CLAUDE TRADING BOT — ONBOARDING AGENT     ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  try {
    await stepWispr();
    await stepClone();
    await stepExchange();
    await stepTradingPrefs();
    await stepTradingView();
    await stepStrategy();
    await stepRailway();
    await stepTax();
    await stepSafetyExplain();
    await stepFirstRun();
  } catch (err) {
    if (err.code === 'ERR_USE_AFTER_CLOSE') {
      // User closed stdin — normal exit
    } else {
      console.error('\n[ERROR]', err.message);
    }
  } finally {
    rl.close();
  }
}

main();
