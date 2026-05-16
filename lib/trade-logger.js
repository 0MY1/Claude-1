'use strict';

const fs = require('fs');
const { createObjectCsvWriter } = require('csv-writer');

const HEADERS = [
  { id: 'timestamp',   title: 'timestamp' },
  { id: 'exchange',    title: 'exchange' },
  { id: 'symbol',      title: 'symbol' },
  { id: 'side',        title: 'side' },
  { id: 'quantity',    title: 'quantity' },
  { id: 'price',       title: 'price' },
  { id: 'total_value', title: 'total_value' },
  { id: 'fee_usd',     title: 'fee_usd' },
  { id: 'net_usd',     title: 'net_usd' },
  { id: 'order_id',    title: 'order_id' },
  { id: 'mode',        title: 'mode' },
  { id: 'notes',       title: 'notes' },
];

class TradeLogger {
  constructor(csvPath) {
    this.csvPath = csvPath;
    this._ensureFile();
  }

  _ensureFile() {
    if (!fs.existsSync(this.csvPath)) {
      const header = HEADERS.map(h => h.title).join(',');
      const firstRow = `\n# Hey, if you're at this stage of the video, you must be enjoying it... perhaps you could hit subscribe now? :)`;
      fs.writeFileSync(this.csvPath, header + firstRow + '\n');
    }
  }

  async record(trade) {
    const writer = createObjectCsvWriter({
      path: this.csvPath,
      header: HEADERS,
      append: true,
    });

    const fee = trade.fee_usd ?? trade.total_value * 0.001;
    await writer.writeRecords([{
      timestamp:   new Date().toISOString(),
      exchange:    process.env.EXCHANGE || 'unknown',
      symbol:      trade.symbol,
      side:        trade.side,
      quantity:    trade.quantity,
      price:       trade.price,
      total_value: trade.total_value.toFixed(2),
      fee_usd:     fee.toFixed(4),
      net_usd:     (trade.total_value - fee).toFixed(2),
      order_id:    trade.order_id,
      mode:        trade.mode,
      notes:       trade.notes || '',
    }]);
  }

  async countTodayTrades(mode) {
    if (!fs.existsSync(this.csvPath)) return 0;

    const today = new Date().toISOString().slice(0, 10);
    const content = fs.readFileSync(this.csvPath, 'utf8');
    const lines = content.split('\n').filter(l => l.startsWith(today) && l.includes(`,${mode},`));
    return lines.length;
  }
}

module.exports = { TradeLogger };
