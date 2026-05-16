'use strict';

const fs = require('fs');
const path = require('path');

class SafetyCheck {
  constructor(rules, logFile) {
    this.rules = rules;
    this.logFile = logFile;
  }

  evaluate(indicators) {
    const conditions = this.rules.entry_rules?.conditions ?? [];
    const checks = conditions.map(cond => this._evalCondition(cond, indicators));
    const allPassed = checks.every(c => c.passed);
    return { allPassed, checks };
  }

  _evalCondition(cond, indicators) {
    const actual = indicators[cond.indicator];
    let target;
    let conditionStr;

    if (cond.compare_to) {
      target = indicators[cond.compare_to];
      conditionStr = `${cond.operator} ${cond.compare_to} (${target?.toFixed(4)})`;
    } else {
      target = cond.value;
      conditionStr = `${cond.operator} ${target}`;
    }

    const passed = this._compare(actual, cond.operator, target);

    return {
      id: cond.id,
      description: cond.description,
      passed,
      actual: actual?.toFixed ? actual.toFixed(4) : String(actual),
      condition: conditionStr,
    };
  }

  _compare(a, op, b) {
    if (a == null || b == null) return false;
    switch (op) {
      case '>': return a > b;
      case '>=': return a >= b;
      case '<': return a < b;
      case '<=': return a <= b;
      case '==': return a === b;
      case '!=': return a !== b;
      default: return false;
    }
  }

  log(symbol, indicators, result, order) {
    let history = [];
    if (fs.existsSync(this.logFile)) {
      try { history = JSON.parse(fs.readFileSync(this.logFile, 'utf8')); } catch {}
    }

    history.push({
      timestamp: new Date().toISOString(),
      symbol,
      indicators,
      result: {
        allPassed: result.allPassed,
        checks: result.checks,
      },
      order: order ? { id: order.id, side: order.side, amount: order.amount } : null,
    });

    // Keep last 1000 entries
    if (history.length > 1000) history = history.slice(-1000);
    fs.writeFileSync(this.logFile, JSON.stringify(history, null, 2));
  }
}

module.exports = { SafetyCheck };
