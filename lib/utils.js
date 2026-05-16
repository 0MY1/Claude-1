'use strict';

function formatCurrency(value, decimals = 2) {
  return `$${Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

function formatPct(value) {
  return `${Number(value).toFixed(2)}%`;
}

module.exports = { formatCurrency, formatPct };
