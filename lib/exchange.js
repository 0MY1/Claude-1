'use strict';

const ccxt = require('ccxt');

const EXCHANGE_MAP = {
  bitget: 'bitget',
  binance: 'binance',
  bybit: 'bybit',
  okx: 'okx',
  coinbase: 'coinbaseinternational',
  kraken: 'kraken',
  kucoin: 'kucoin',
  gateio: 'gateio',
  mexc: 'mexc',
  bitfinex: 'bitfinex',
};

class ExchangeClient {
  constructor(exchangeName, apiKey, apiSecret, passphrase) {
    const id = EXCHANGE_MAP[exchangeName.toLowerCase()];
    if (!id) throw new Error(`Unsupported exchange: ${exchangeName}`);

    const config = { apiKey, secret: apiSecret };
    if (passphrase) config.password = passphrase;

    this.client = new ccxt[id](config);
    this.name = exchangeName;
  }

  async createMarketBuy(symbol, amount) {
    return this.client.createMarketBuyOrder(symbol, amount);
  }

  async createMarketSell(symbol, amount) {
    return this.client.createMarketSellOrder(symbol, amount);
  }

  async getBalance() {
    return this.client.fetchBalance();
  }

  async getTicker(symbol) {
    return this.client.fetchTicker(symbol);
  }
}

module.exports = { ExchangeClient };
