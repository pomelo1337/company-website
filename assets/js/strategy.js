/* =========================================================
   POMELO ETF 量化 - 策略回测引擎
   策略: 双均线 / RSI反转 / 布林突破 / 定投 / 网格 / 动量轮动
   ========================================================= */

window.POMELO = window.POMELO || {};

(function () {
  "use strict";

  var FEES = 0.0006; // 单边费率(佣金+滑点近似)，ETF 无印花税

  // ---------- 技术指标 ----------
  function sma(arr, period) {
    var out = new Array(arr.length).fill(null);
    var sum = 0;
    for (var i = 0; i < arr.length; i++) {
      sum += arr[i];
      if (i >= period) sum -= arr[i - period];
      if (i >= period - 1) out[i] = sum / period;
    }
    return out;
  }

  function ema(arr, period) {
    var out = new Array(arr.length).fill(null);
    var k = 2 / (period + 1);
    var prev = null;
    for (var i = 0; i < arr.length; i++) {
      if (prev === null) prev = arr[i];
      else prev = arr[i] * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  }

  function rsi(closes, period) {
    var out = new Array(closes.length).fill(null);
    var gains = [], losses = [];
    for (var i = 1; i < closes.length; i++) {
      var diff = closes[i] - closes[i - 1];
      gains.push(Math.max(diff, 0));
      losses.push(Math.max(-diff, 0));
    }
    var avgG = 0, avgL = 0;
    for (i = 0; i < gains.length; i++) {
      if (i < period) {
        avgG += gains[i];
        avgL += losses[i];
        if (i === period - 1) { avgG /= period; avgL /= period; }
      } else {
        avgG = (avgG * (period - 1) + gains[i]) / period;
        avgL = (avgL * (period - 1) + losses[i]) / period;
      }
      if (i >= period - 1) {
        out[i + 1] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
      }
    }
    return out;
  }

  function macd(closes, fast, slow, signal) {
    var ef = ema(closes, fast);
    var es = ema(closes, slow);
    var dif = closes.map(function (_, i) {
      return (ef[i] === null || es[i] === null) ? null : ef[i] - es[i];
    });
    // 用有效段计算 DEA
    var start = 0;
    while (start < dif.length && dif[start] === null) start++;
    var valid = dif.slice(start);
    var deaValid = ema(valid, signal);
    var dea = new Array(dif.length).fill(null);
    for (var i = 0; i < deaValid.length; i++) dea[start + i] = deaValid[i];
    var hist = dif.map(function (v, i) {
      return (v === null || dea[i] === null) ? null : (v - dea[i]) * 2;
    });
    return { dif: dif, dea: dea, hist: hist };
  }

  function boll(closes, period, k) {
    var mid = sma(closes, period);
    var upper = new Array(closes.length).fill(null);
    var lower = new Array(closes.length).fill(null);
    for (var i = period - 1; i < closes.length; i++) {
      var sum = 0;
      for (var j = i - period + 1; j <= i; j++) sum += closes[j];
      var m = sum / period;
      var v = 0;
      for (j = i - period + 1; j <= i; j++) v += (closes[j] - m) * (closes[j] - m);
      var sd = Math.sqrt(v / period);
      upper[i] = m + k * sd;
      lower[i] = m - k * sd;
    }
    return { mid: mid, upper: upper, lower: lower };
  }

  // ---------- 回测框架 ----------
  // bars: [{date, open, close, high, low, volume}]
  // signals: [{i, action: 'buy'|'sell'}] 由各策略生成
  function runBacktest(bars, signals, opts) {
    opts = opts || {};
    var fee = opts.fee !== undefined ? opts.fee : FEES;
    var initial = opts.initial !== undefined ? opts.initial : 100000;

    var cash = initial;
    var shares = 0;
    var equity = [];
    var trades = [];
    var position = 0; // 0 空仓 / 1 持仓
    var entryIdx = -1;
    var entryPrice = 0;
    var win = 0, loss = 0;

    var sigMap = {};
    signals.forEach(function (s) { sigMap[s.i] = s.action; });

    for (var i = 0; i < bars.length; i++) {
      var px = bars[i].close;
      var action = sigMap[i];
      if (action === "buy" && position === 0) {
        shares = (cash * (1 - fee)) / px;
        cash = 0;
        position = 1;
        entryIdx = i;
        entryPrice = px;
        trades.push({ i: i, date: bars[i].date, type: "buy", price: px });
      } else if (action === "sell" && position === 1) {
        cash = shares * px * (1 - fee);
        var profit = cash - initial; // 简化：相对初始本金
        var ret = (px - entryPrice) / entryPrice;
        if (ret > 0) win++; else loss++;
        shares = 0;
        position = 0;
        trades.push({ i: i, date: bars[i].date, type: "sell", price: px, ret: ret });
      }
      equity.push({
        i: i,
        date: bars[i].date,
        value: cash + shares * px
      });
    }
    // 期末强制平仓（便于计算）
    if (position === 1) {
      var lastPx = bars[bars.length - 1].close;
      var finalRet = (lastPx - entryPrice) / entryPrice;
      if (finalRet > 0) win++; else loss++;
      trades.push({ i: bars.length - 1, date: bars[bars.length - 1].date, type: "sell", price: lastPx, ret: finalRet, forced: true });
    }

    return {
      equity: equity,
      trades: trades,
      finalValue: equity.length ? equity[equity.length - 1].value : initial
    };
  }

  // 买入持有基准
  function buyAndHold(bars, opts) {
    var initial = (opts && opts.initial) || 100000;
    var fee = (opts && opts.fee !== undefined) ? opts.fee : FEES;
    var first = bars[0].close;
    var last = bars[bars.length - 1].close;
    var equity = bars.map(function (b) {
      return { i: b.i, date: b.date, value: initial * (b.close / first) };
    });
    return {
      equity: equity,
      trades: [{ date: bars[0].date, type: "buy", price: first }, { date: bars[bars.length - 1].date, type: "sell", price: last }],
      finalValue: initial * (last / first) * (1 - fee)
    };
  }

  // ---------- 绩效指标 ----------
  function metrics(result, bars, opts) {
    var equity = result.equity;
    var n = equity.length;
    var initial = (opts && opts.initial) || 100000;
    var finalVal = equity[n - 1].value;
    var totalRet = (finalVal / initial - 1) * 100;

    var years = n / 252;
    var annual = years > 0 ? (Math.pow(finalVal / initial, 1 / years) - 1) * 100 : 0;

    // 最大回撤
    var peak = -Infinity, maxDD = 0;
    for (var i = 0; i < n; i++) {
      if (equity[i].value > peak) peak = equity[i].value;
      var dd = (peak - equity[i].value) / peak * 100;
      if (dd > maxDD) maxDD = dd;
    }

    // 夏普（日收益）
    var rets = [];
    for (i = 1; i < n; i++) {
      rets.push(equity[i].value / equity[i - 1].value - 1);
    }
    var meanR = 0;
    rets.forEach(function (r) { meanR += r; });
    meanR /= rets.length || 1;
    var varR = 0;
    rets.forEach(function (r) { varR += (r - meanR) * (r - meanR); });
    varR /= rets.length || 1;
    var sd = Math.sqrt(varR);
    var sharpe = sd > 0 ? (meanR / sd) * Math.sqrt(252) : 0;

    var sellTrades = result.trades.filter(function (t) { return t.type === "sell"; });
    var wins = sellTrades.filter(function (t) { return t.ret > 0; }).length;
    var winRate = sellTrades.length ? (wins / sellTrades.length) * 100 : 0;

    return {
      totalRet: round2(totalRet),
      annual: round2(annual),
      maxDD: round2(maxDD),
      sharpe: round2(sharpe),
      winRate: round2(winRate),
      trades: sellTrades.length,
      finalValue: Math.round(finalVal)
    };
  }

  function round2(v) { return Math.round(v * 100) / 100; }

  // ---------- 策略 1: 双均线趋势 ----------
  function strategyMA(bars, p) {
    var fast = sma(bars.map(function (b) { return b.close; }), p.fast);
    var slow = sma(bars.map(function (b) { return b.close; }), p.slow);
    var signals = [];
    for (var i = 1; i < bars.length; i++) {
      if (fast[i] === null || slow[i] === null || fast[i - 1] === null || slow[i - 1] === null) continue;
      if (fast[i - 1] <= slow[i - 1] && fast[i] > slow[i]) signals.push({ i: i, action: "buy" });
      else if (fast[i - 1] >= slow[i - 1] && fast[i] < slow[i]) signals.push({ i: i, action: "sell" });
    }
    return runBacktest(bars, signals);
  }

  // ---------- 策略 2: RSI 反转 ----------
  function strategyRSI(bars, p) {
    var closes = bars.map(function (b) { return b.close; });
    var r = rsi(closes, p.period);
    var signals = [];
    for (var i = 1; i < bars.length; i++) {
      if (r[i] === null || r[i - 1] === null) continue;
      if (r[i - 1] < p.oversold && r[i] >= p.oversold) signals.push({ i: i, action: "buy" });
      else if (r[i - 1] > p.overbought && r[i] <= p.overbought) signals.push({ i: i, action: "sell" });
    }
    return runBacktest(bars, signals);
  }

  // ---------- 策略 3: 布林带突破 ----------
  function strategyBOLL(bars, p) {
    var closes = bars.map(function (b) { return b.close; });
    var bb = boll(closes, p.period, p.k);
    var signals = [];
    for (var i = 1; i < bars.length; i++) {
      if (bb.upper[i] === null || bb.mid[i] === null) continue;
      if (closes[i - 1] <= bb.upper[i - 1] && closes[i] > bb.upper[i]) signals.push({ i: i, action: "buy" });
      else if (closes[i - 1] >= bb.mid[i - 1] && closes[i] < bb.mid[i]) signals.push({ i: i, action: "sell" });
    }
    return runBacktest(bars, signals);
  }

  // ---------- 策略 4: 定投 DCA ----------
  function strategyDCA(bars, p) {
    var initial = p.initial || 100000;
    var amount = p.amount || 10000;   // 每期投入
    var interval = p.interval || 5;   // 交易日间隔
    var cash = initial;
    var shares = 0;
    var equity = [];
    for (var i = 0; i < bars.length; i++) {
      if (i % interval === 0 && cash >= amount) {
        shares += (amount * (1 - FEES)) / bars[i].close;
        cash -= amount;
      }
      equity.push({ i: i, date: bars[i].date, value: cash + shares * bars[i].close });
    }
    return {
      equity: equity,
      trades: [{ date: "定期买入", type: "buy", price: 0 }],
      finalValue: equity[equity.length - 1].value
    };
  }

  // ---------- 策略 5: 网格交易 ----------
  function strategyGRID(bars, p) {
    var initial = p.initial || 100000;
    var grids = p.grids || 10;            // 网格数量
    var range = (p.range !== undefined ? p.range : 10) / 100; // 上下区间比例
    var base = bars[0].close;
    var high = base * (1 + range);
    var low = base * (1 - range);
    var step = (high - low) / grids;
    var cash = initial;
    var shares = 0;
    var perGrid = initial / grids;        // 每格预算
    var levels = [];
    var levelShares = [];
    for (var g = 0; g <= grids; g++) {
      levels.push(low + g * step);
      levelShares.push(0);
    }
    var equity = [];

    function buyAt(px, idx) {
      var budget = Math.min(perGrid, cash);
      if (budget <= 0) return;
      shares += (budget * (1 - FEES)) / px;
      cash -= budget;
      levelShares[idx] = budget;
    }
    function sellAt(px, idx) {
      if (levelShares[idx] <= 0) return;
      cash += levelShares[idx] * (1 - FEES) * (px / levels[idx]);
      shares -= levelShares[idx] / levels[idx];
      levelShares[idx] = 0;
    }

    for (var i = 0; i < bars.length; i++) {
      var px = bars[i].close;
      for (var g = 0; g < levels.length; g++) {
        if (px <= levels[g] && levelShares[g] === 0) buyAt(px, g);
      }
      for (g = levels.length - 1; g >= 0; g--) {
        if (px >= levels[g] && levelShares[g] > 0) sellAt(px, g);
      }
      equity.push({ i: i, date: bars[i].date, value: cash + shares * px });
    }
    return {
      equity: equity,
      trades: [{ date: "网格", type: "buy", price: 0 }],
      finalValue: equity[equity.length - 1].value
    };
  }

  // ---------- 策略 6: 智能定投（越跌越买） ----------
  function strategySmartDCA(bars, p) {
    var initial = p.initial || 100000;
    var amount = p.amount || 10000;
    var interval = p.interval || 5;
    var period = p.period || 20;
    var closes = bars.map(function (b) { return b.close; });
    var ma = sma(closes, period);
    var cash = initial, shares = 0, equity = [];
    for (var i = 0; i < bars.length; i++) {
      if (i % interval === 0 && cash >= amount) {
        var invest = amount;
        // 价格低于均线（相对便宜）时加倍买入
        if (ma[i] !== null && closes[i] < ma[i]) invest = Math.min(amount * 2, cash);
        shares += (invest * (1 - FEES)) / closes[i];
        cash -= invest;
      }
      equity.push({ i: i, date: bars[i].date, value: cash + shares * closes[i] });
    }
    return {
      equity: equity,
      trades: [{ date: "智能定投", type: "buy", price: 0 }],
      finalValue: equity[equity.length - 1].value
    };
  }

  // ---------- 策略 7: 移动止盈（回撤保护） ----------
  function strategyTrailing(bars, p) {
    var initial = p.initial || 100000;
    var drop = p.drop / 100;
    var lookback = p.lookback || 20;
    var closes = bars.map(function (b) { return b.close; });
    var cash = initial, shares = 0, position = 0, peak = 0;
    var equity = [];
    for (var i = 0; i < bars.length; i++) {
      var px = closes[i];
      if (position === 0) {
        // 等待价格创 N 日新高后买入
        var start = Math.max(0, i - lookback);
        var prevHigh = -Infinity;
        for (var j = start; j < i; j++) if (closes[j] > prevHigh) prevHigh = closes[j];
        if (i > 0 && px > prevHigh) {
          shares = (cash * (1 - FEES)) / px;
          cash = 0;
          position = 1;
          peak = px;
        }
      } else {
        if (px > peak) peak = px;
        // 从最高点回撤超过阈值即卖出
        if (px < peak * (1 - drop)) {
          cash = shares * px * (1 - FEES);
          shares = 0;
          position = 0;
        }
      }
      equity.push({ i: i, date: bars[i].date, value: cash + shares * px });
    }
    return {
      equity: equity,
      trades: [{ date: "移动止盈", type: "sell", price: 0 }],
      finalValue: equity[equity.length - 1].value
    };
  }

  // ---------- 策略 8: 均线保护（跌破离场） ----------
  function strategyTrendExit(bars, p) {
    var initial = p.initial || 100000;
    var period = p.period || 20;
    var closes = bars.map(function (b) { return b.close; });
    var ma = sma(closes, period);
    var cash = 0;
    var shares = (initial * (1 - FEES)) / closes[0];
    var position = 1;
    var equity = [];
    for (var i = 0; i < bars.length; i++) {
      if (i > 0 && ma[i] !== null && ma[i - 1] !== null) {
        if (position === 1 && closes[i] < ma[i] && closes[i - 1] >= ma[i - 1]) {
          // 跌破均线：离场
          cash = shares * closes[i] * (1 - FEES);
          shares = 0;
          position = 0;
        } else if (position === 0 && closes[i] > ma[i] && closes[i - 1] <= ma[i - 1]) {
          // 重回均线上方：买回
          shares = (cash * (1 - FEES)) / closes[i];
          cash = 0;
          position = 1;
        }
      }
      equity.push({ i: i, date: bars[i].date, value: cash + shares * closes[i] });
    }
    return {
      equity: equity,
      trades: [{ date: "均线保护", type: "sell", price: 0 }],
      finalValue: equity[equity.length - 1].value
    };
  }

  // ---------- 深度分析 ----------
  function analyze(bars) {
    var closes = bars.map(function (b) { return b.close; });
    var n = closes.length;
    if (n < 30) return null;
    var price = closes[n - 1];

    // 近一年区间位置
    var window = Math.min(n, 250);
    var hi = -Infinity, lo = Infinity;
    for (var i = n - window; i < n; i++) {
      if (closes[i] > hi) hi = closes[i];
      if (closes[i] < lo) lo = closes[i];
    }
    var pos = hi === lo ? 50 : (price - lo) / (hi - lo) * 100;

    // 多周期涨跌幅
    function ret(days) {
      var j = n - 1 - days;
      if (j < 0) return null;
      return (price / closes[j] - 1) * 100;
    }

    // 20日年化波动率
    var rets = [];
    for (i = n - 20; i < n; i++) rets.push(closes[i] / closes[i - 1] - 1);
    var mean = 0;
    rets.forEach(function (r) { mean += r; });
    mean /= rets.length || 1;
    var v = 0;
    rets.forEach(function (r) { v += (r - mean) * (r - mean); });
    var vol20 = Math.sqrt(v / (rets.length || 1)) * Math.sqrt(252) * 100;

    // 均线排列
    var ma5 = sma(closes, 5)[n - 1], ma10 = sma(closes, 10)[n - 1];
    var ma20 = sma(closes, 20)[n - 1], ma60 = sma(closes, 60)[n - 1];
    var order = "均线纠缠";
    if (ma5 > ma10 && ma10 > ma20 && ma20 > ma60) order = "多头排列";
    else if (ma5 < ma10 && ma10 < ma20 && ma20 < ma60) order = "空头排列";

    return {
      price: price, hi: hi, lo: lo, pos: pos,
      r1m: ret(21), r3m: ret(63), r6m: ret(126), r1y: ret(250),
      vol20: vol20, order: order,
      dev20: (price / ma20 - 1) * 100,
      dev60: (price / ma60 - 1) * 100
    };
  }

  // ---------- 策略 9: 动量轮动（多资产） ----------
  // datas: [{code, name, bars:[{date,close}]}] 取共同交易日
  function strategyMOMENTUM(datas, p) {
    var lookback = p.lookback || 20;
    var rebalance = p.rebalance || 5;     // 每 N 日调仓
    var topN = p.topN || 1;
    var initial = p.initial || 100000;

    // 对齐日期
    var dateSet = {};
    var dateList = [];
    datas.forEach(function (d) {
      d.bars.forEach(function (b) {
        if (!dateSet[b.date]) { dateSet[b.date] = {}; dateList.push(b.date); }
      });
    });
    dateList.sort();

    var prices = {}; // code -> {date -> close}
    datas.forEach(function (d) {
      prices[d.code] = {};
      d.bars.forEach(function (b) { prices[d.code][b.date] = b.close; });
    });

    var cash = initial;
    var holdings = {}; // code -> shares
    var equity = [];
    var lastPick = null;

    dateList.forEach(function (date, idx) {
      // 每 rebalance 天重新选择
      if (idx % rebalance === 0 && idx >= lookback) {
        var mom = datas.map(function (d) {
          var prev = prices[d.code][dateList[idx - lookback]];
          var cur = prices[d.code][date];
          return { code: d.code, name: d.name, m: prev && cur ? cur / prev - 1 : -Infinity };
        }).sort(function (a, b) { return b.m - a.m; });

        // 清仓旧持仓
        Object.keys(holdings).forEach(function (c) {
          if (!mom.slice(0, topN).some(function (x) { return x.code === c; })) {
            var px = prices[c][date];
            if (px) { cash += holdings[c] * px * (1 - FEES); holdings[c] = 0; }
          }
        });

        // 建仓新标的
        var picks = mom.slice(0, topN).filter(function (x) { return isFinite(x.m); });
        var totalCash = cash + Object.keys(holdings).reduce(function (s, c) {
          return s + holdings[c] * (prices[c][date] || 0);
        }, 0);
        if (picks.length && totalCash > 100) {
          var per = totalCash / picks.length;
          picks.forEach(function (pick) {
            var curVal = holdings[pick.code] ? holdings[pick.code] * prices[pick.code][date] : 0;
            var diff = per - curVal;
            var px = prices[pick.code][date];
            if (diff > 100 && px && cash > 0) {
              var buyAmt = Math.min(diff, cash);
              holdings[pick.code] = (holdings[pick.code] || 0) + (buyAmt * (1 - FEES)) / px;
              cash -= buyAmt;
            }
          });
        }
        lastPick = picks.map(function (x) { return x.code; });
      }

      var value = cash;
      Object.keys(holdings).forEach(function (c) {
        var px = prices[c][date];
        if (px) value += holdings[c] * px;
      });
      equity.push({ i: idx, date: date, value: value });
    });

    return {
      equity: equity,
      trades: [{ date: "轮动", type: "buy", price: 0 }],
      finalValue: equity.length ? equity[equity.length - 1].value : initial
    };
  }

  // ---------- 轻量量化评分（基于实时行情字段，覆盖全列表，无需K线） ----------
  // 输入：列表中的单只 ETF 字段 {pct, amount, turnover, volume, mcap}
  // 输出：0-100 分 + 分项 + 标签
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function lightScore(e) {
    var pct = e.pct, amount = e.amount, turnover = e.turnover, volume = e.volume, mcap = e.mcap;
    var parts = {};
    // 当日动量 0-30：涨幅越高分越高
    parts.momentum = clamp(15 + (isFinite(pct) ? pct : 0) * 3, 0, 30);
    // 资金关注 0-25：成交额对数分档（1亿→8分，10亿→17分，100亿→25分）
    parts.capital = isFinite(amount) && amount > 0 ? clamp(25 * (Math.log10(amount) - 7) / 3, 0, 25) : 0;
    // 活跃度 0-20：换手率
    parts.activity = isFinite(turnover) ? clamp(turnover * 3.5, 0, 20) : 0;
    // 量能 0-15：成交量对数
    parts.volume = isFinite(volume) && volume > 0 ? clamp(15 * Math.log10(volume) / 6, 0, 15) : 0;
    // 规模稳定 0-10：规模越大越稳
    parts.scale = isFinite(mcap) && mcap > 0 ? clamp(10 * (Math.log10(mcap) - 8) / 3, 0, 10) : 0;
    var value = Math.round(parts.momentum + parts.capital + parts.activity + parts.volume + parts.scale);
    value = Math.max(0, Math.min(100, value));
    var label = value >= 70 ? "强势" : value >= 55 ? "偏强" : value >= 40 ? "中性" : "偏弱";
    return { value: value, parts: parts, label: label };
  }

  // ---------- 策略注册表 ----------
  var STRATEGIES = {
    dca: {
      name: "定投 DCA",
      desc: "每隔 N 个交易日投入固定金额，无卖出信号。",
      suits: "适合每月有固定收入、想长期积累、不想盯盘的投资者；规则简单，最能坚持。",
      params: [
        { key: "interval", label: "定投间隔(日)", def: 5, min: 1, max: 60 },
        { key: "amount", label: "每期金额(元)", def: 10000, min: 100, max: 1000000, step: 100 }
      ],
      run: strategyDCA
    },
    smartdca: {
      name: "智能定投",
      desc: "定投基础上，价格低于均线（相对便宜）时加倍买入。",
      suits: "适合想定投又怕买在高点的投资者；越跌越买，自动摊低成本。",
      params: [
        { key: "interval", label: "定投间隔(日)", def: 5, min: 1, max: 60 },
        { key: "amount", label: "每期金额(元)", def: 10000, min: 100, max: 1000000, step: 100 },
        { key: "period", label: "低估判断均线", def: 20, min: 5, max: 120 }
      ],
      run: strategySmartDCA
    },
    ma: {
      name: "双均线趋势",
      desc: "快线上穿慢线买入，下穿卖出。经典趋势跟随。",
      suits: "适合趋势行情中想抓住主升浪的投资者；震荡市会频繁打脸，要有心理准备。",
      params: [
        { key: "fast", label: "快线周期", def: 10, min: 2, max: 60 },
        { key: "slow", label: "慢线周期", def: 30, min: 5, max: 250 }
      ],
      run: strategyMA
    },
    trendexit: {
      name: "均线保护",
      desc: "只要价格在均线上方就一直持有，跌破均线先离场，站回均线再回来。",
      suits: "适合长期看好某只 ETF、又想避开大级别下跌的投资者；规则简单、容易执行。",
      params: [
        { key: "period", label: "保护均线", def: 20, min: 5, max: 120 }
      ],
      run: strategyTrendExit
    },
    trailing: {
      name: "移动止盈",
      desc: "买入持有，但从最高点回撤超过阈值就卖出避险，再创新高再买回。",
      suits: "适合想抓住大趋势、又担心利润坐过山车的投资者；用纪律锁住收益。",
      params: [
        { key: "drop", label: "回撤卖出(%)", def: 10, min: 3, max: 30 },
        { key: "lookback", label: "创新高观察(日)", def: 20, min: 5, max: 60 }
      ],
      run: strategyTrailing
    },
    rsi: {
      name: "RSI 反转",
      desc: "RSI 上穿超卖线买入，下穿超买线卖出，捕捉超跌反弹。",
      suits: "适合震荡行情中低吸高抛的投资者；单边下跌时抄底可能被套。",
      params: [
        { key: "period", label: "RSI 周期", def: 14, min: 3, max: 60 },
        { key: "oversold", label: "超卖阈值", def: 30, min: 10, max: 45 },
        { key: "overbought", label: "超买阈值", def: 70, min: 55, max: 90 }
      ],
      run: strategyRSI
    },
    boll: {
      name: "布林带突破",
      desc: "收盘价突破上轨买入，跌破中轨卖出，适合震荡转趋势。",
      suits: "适合波动放大初期果断行动的投资者；需要接受假突破的损耗。",
      params: [
        { key: "period", label: "布林周期", def: 20, min: 5, max: 120 },
        { key: "k", label: "标准差倍数", def: 2, min: 1, max: 4, step: 0.1 }
      ],
      run: strategyBOLL
    },
    grid: {
      name: "网格交易",
      desc: "在基准价上下区间内布网格，跌买涨卖，震荡市吃波段。",
      suits: "适合区间震荡行情中赚波动的投资者；单边大涨会卖飞、单边大跌会满仓被套。",
      params: [
        { key: "grids", label: "网格数量", def: 10, min: 3, max: 50 },
        { key: "range", label: "区间幅度(%)", def: 10, min: 3, max: 40 }
      ],
      run: strategyGRID
    },
    momentum: {
      name: "动量轮动",
      desc: "多只 ETF 中选近 N 日涨幅最强的持有，定期调仓，追强弃弱。",
      suits: "适合能同时跟踪多只 ETF、追求超额收益的进阶投资者；轮动滞后时会追高。",
      params: [
        { key: "lookback", label: "动量回看(日)", def: 20, min: 5, max: 120 },
        { key: "rebalance", label: "调仓间隔(日)", def: 5, min: 1, max: 60 },
        { key: "topN", label: "持有数量", def: 1, min: 1, max: 5 }
      ],
      run: strategyMOMENTUM
    }
  };

  // ---------- 综合评分（ETF 详情页用） ----------
  function score(bars) {
    var closes = bars.map(function (b) { return b.close; });
    var n = closes.length;
    if (n < 60) return null;
    var price = closes[n - 1];
    var ma20 = sma(closes, 20)[n - 1];
    var ma60 = sma(closes, 60)[n - 1];
    var r = rsi(closes, 14)[n - 1];

    var trendScore = 0;
    if (price > ma20) trendScore += 20;
    if (price > ma60) trendScore += 20;
    trendScore += Math.max(0, Math.min(10, ((price / ma20 - 1) * 100) / 2));

    var mom = (price / closes[n - 21] - 1) * 100;
    var momScore = Math.max(0, Math.min(30, 15 + mom * 3));

    var rsiScore = r === null ? 15 : Math.max(0, Math.min(20, (100 - Math.abs(r - 55)) * 0.5));

    var vol = 0;
    for (var i = n - 20; i < n; i++) vol += Math.abs(closes[i] / closes[i - 1] - 1);
    var volScore = Math.max(0, Math.min(10, 10 - vol * 120));

    var total = Math.round(trendScore + momScore + rsiScore + volScore);
    return {
      value: Math.max(0, Math.min(100, total)),
      trend: trendScore, mom: momScore, rsi: rsiScore, vol: volScore,
      rsiVal: r === null ? null : Math.round(r * 10) / 10,
      ma20: round2(ma20), ma60: round2(ma60)
    };
  }

  // ---------- 信号汇总（详情页用） ----------
  function signals(bars) {
    var closes = bars.map(function (b) { return b.close; });
    var n = closes.length;
    var out = {};
    out.ma20 = round2(sma(closes, 20)[n - 1]);
    out.ma60 = round2(sma(closes, 60)[n - 1]);
    var m = macd(closes, 12, 26, 9);
    out.dif = round2(m.dif[n - 1]); out.dea = round2(m.dea[n - 1]); out.hist = round2(m.hist[n - 1]);
    var r = rsi(closes, 14);
    out.rsi = r[n - 1] === null ? null : round2(r[n - 1]);
    var bb = boll(closes, 20, 2);
    out.bollU = round2(bb.upper[n - 1]); out.bollM = round2(bb.mid[n - 1]); out.bollL = round2(bb.lower[n - 1]);
    // KDJ
    var k = 50, d = 50;
    for (var i = 1; i < n; i++) {
      var ll = Math.min(bars[i].low, i > 8 ? Math.min.apply(null, closes.slice(i - 8, i + 1)) : bars[i].low);
      var hh = Math.max(bars[i].high, i > 8 ? Math.max.apply(null, closes.slice(i - 8, i + 1)) : bars[i].high);
      var rsv = hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100;
      k = (2 / 3) * k + (1 / 3) * rsv;
      d = (2 / 3) * d + (1 / 3) * k;
    }
    out.k = round2(k); out.d = round2(d); out.j = round2(3 * k - 2 * d);
    return out;
  }

  window.POMELO.Strategy = {
    STRATEGIES: STRATEGIES,
    metrics: metrics,
    buyAndHold: buyAndHold,
    run: function (key, bars, params) {
      var s = STRATEGIES[key];
      if (!s) throw new Error("未知策略: " + key);
      return s.run(bars, params);
    },
    runMomentum: function (datas, params) {
      return strategyMOMENTUM(datas, params);
    },
    indicators: { sma: sma, ema: ema, rsi: rsi, macd: macd, boll: boll },
    score: score,
    signals: signals,
    analyze: analyze,
    lightScore: lightScore,
    FEES: FEES
  };
})();
