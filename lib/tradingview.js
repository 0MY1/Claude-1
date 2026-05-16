'use strict';

/**
 * TradingView MCP client.
 *
 * In production this talks to the TradingView MCP server started by
 * `tv_health_check`. During local testing it falls back to a mock so
 * the rest of the bot can be exercised without a live connection.
 */
class TradingViewClient {
  constructor() {
    this.mcpAvailable = this._detectMcp();
  }

  _detectMcp() {
    // The MCP bridge writes a socket path to the environment when active
    return !!process.env.TV_MCP_SOCKET || !!process.env.TV_MCP_HOST;
  }

  async getIndicators(symbol, timeframe = '1m') {
    if (this.mcpAvailable) {
      return this._fetchFromMcp(symbol, timeframe);
    }

    // Warn and use mock data for paper-trading / dev runs
    if (process.env.PAPER_TRADING !== 'false') {
      console.log('[TV] MCP not detected — using simulated indicator values (paper mode)');
      return this._mockIndicators(symbol);
    }

    throw new Error(
      'TradingView MCP is not connected. Run tv_health_check to verify the connection, ' +
      'or set PAPER_TRADING=true to use mock data.'
    );
  }

  async _fetchFromMcp(symbol, timeframe) {
    const net = require('net');
    const socket = process.env.TV_MCP_SOCKET;
    const host = process.env.TV_MCP_HOST || 'localhost';
    const port = parseInt(process.env.TV_MCP_PORT || '9999', 10);

    const payload = JSON.stringify({
      method: 'get_indicators',
      params: { symbol, timeframe, indicators: ['close', 'vwap', 'ema_8', 'rsi_3'] },
    });

    return new Promise((resolve, reject) => {
      let data = '';
      const client = socket
        ? net.createConnection(socket)
        : net.createConnection(port, host);

      client.on('connect', () => client.write(payload + '\n'));
      client.on('data', chunk => { data += chunk; });
      client.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid response from TradingView MCP')); }
      });
      client.on('error', reject);
      client.setTimeout(10000, () => {
        client.destroy();
        reject(new Error('TradingView MCP timed out'));
      });
    });
  }

  _mockIndicators(symbol) {
    const close = 65000 + (Math.random() - 0.5) * 2000;
    const vwap = close * (1 + (Math.random() - 0.5) * 0.005);
    const ema_8 = close * (1 + (Math.random() - 0.5) * 0.003);
    const rsi_3 = 30 + Math.random() * 40;
    const ema_8_prev = ema_8 * (1 - Math.random() * 0.001);

    return {
      symbol,
      close,
      vwap,
      ema_8,
      ema_8_slope: ema_8 - ema_8_prev,
      rsi_3,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = { TradingViewClient };
