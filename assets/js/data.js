/* =========================================================
   POMELO ETF 量化 - 数据层
   数据来源：东方财富公开行情接口 (push2.eastmoney.com)
   加载策略：fetch (CORS) -> JSONP (script 注入) -> 本地快照
   ========================================================= */

window.POMELO = window.POMELO || {};

(function () {
  "use strict";

  var API = {};

  // ---------- 工具 ----------
  function secidOf(code) {
    // 沪市 ETF/指数: 51/56/58/000xxx(指数) -> 1. ; 深市: 15/16/0xxxxx -> 0.
    if (/^(5|6|9)/.test(code)) return "1." + code;
    return "0." + code;
  }

  function num(v, d) {
    if (v === null || v === undefined || v === "-" || v === "") return null;
    var n = typeof v === "number" ? v : parseFloat(v);
    if (isNaN(n)) return null;
    return d === undefined ? n : round(n, d);
  }
  function round(n, d) {
    var p = Math.pow(10, d);
    return Math.round(n * p) / p;
  }

  // 通用 JSONP（东方财富支持 &cb= 回调）
  function jsonp(url, cbName, timeout) {
    return new Promise(function (resolve, reject) {
      var cb = "POMELO_CB_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
      var sep = url.indexOf("?") >= 0 ? "&" : "?";
      var script = document.createElement("script");
      var timer = setTimeout(function () {
        cleanup();
        reject(new Error("JSONP 超时"));
      }, timeout || 12000);

      function cleanup() {
        clearTimeout(timer);
        delete window[cb];
        if (script.parentNode) script.parentNode.removeChild(script);
      }

      window[cb] = function (data) {
        cleanup();
        resolve(data);
      };
      script.src = url + sep + "cb=" + cb;
      script.onerror = function () {
        cleanup();
        reject(new Error("JSONP 加载失败"));
      };
      document.head.appendChild(script);
    });
  }

  function fetchJSON(url, timeout) {
    timeout = timeout || 10000;
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeout) : null;
    return fetch(url, {
      headers: { Referer: "https://quote.eastmoney.com/" },
      signal: ctrl ? ctrl.signal : undefined,
      cache: "no-store"
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .catch(function (e) {
        // CORS 失败时回退 JSONP
        return jsonp(url, null, timeout);
      })
      .then(function (d) {
        if (timer) clearTimeout(timer);
        return d;
      });
  }

  // 依次尝试多个数据源（主站 -> 延迟站）
  function fetchJSONMulti(urls, timeout) {
    var i = 0;
    function next() {
      if (i >= urls.length) return Promise.reject(new Error("所有数据源均不可用"));
      return fetchJSON(urls[i++], timeout).catch(function () { return next(); });
    }
    return next();
  }

  // ---------- 后端优先模式（部署 server/ 后启用） ----------
  var API_BASE = (window.POMELO_CONFIG && window.POMELO_CONFIG.apiBase) || "";
  function backFetch(path) {
    if (!API_BASE) return Promise.reject(new Error("未配置后端"));
    return fetch(API_BASE + path, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }
  API.setApiBase = function (b) { API_BASE = b; };
  API.getApiBase = function () { return API_BASE; };

  // 后端列表补充主题分类字段
  function normalizeBackendList(d) {
    if (!d || !d.list) throw new Error("后端列表为空");
    d.list.forEach(function (e) {
      e.theme = themeOf(e.name);
      e.type = classifyETF(e.name);
    });
    return d;
  }

  // ---------- ETF 列表 ----------
  var LIST_FIELDS = "f12,f14,f2,f3,f4,f5,f6,f8,f15,f16,f17,f18,f20,f21";
  var FS = "b:MK0021,b:MK0022"; // 沪市 + 深市 ETF

  function listURL(host, fid, po, pn, pz) {
    return "https://" + host + "/api/qt/clist/get?pn=" + pn +
      "&pz=" + pz + "&po=" + po + "&np=1&fltt=2&invt=2&fid=" + fid +
      "&fs=" + FS + "&fields=" + LIST_FIELDS;
  }

  function mapETF(d) {
    return {
      code: d.f12,
      name: d.f14,
      price: num(d.f2, 3),
      pct: num(d.f3, 2),
      chg: num(d.f4, 3),
      volume: num(d.f5, 0),      // 手
      amount: num(d.f6, 0),      // 元
      turnover: num(d.f8, 2),    // 换手率 %
      high: num(d.f15, 3),
      low: num(d.f16, 3),
      open: num(d.f17, 3),
      prevClose: num(d.f18, 3),
      mcap: num(d.f20, 0),       // 总市值（规模）
      type: classifyETF(d.f14),
      theme: themeOf(d.f14)      // 科技主题分类，非科技为 null
    };
  }

  function classifyETF(name) {
    if (/债|国债|可转债/.test(name)) return "bond";
    if (/黄金|白银|豆粕|能源化工|有色金属|商品/.test(name)) return "commodity";
    if (/纳指|标普|日经|恒生|恒生科技|恒生互联网|德国|法国|沙特|东南亚|亚太|美国|全球|跨境|海外/.test(name)) return "cross";
    return "etf";
  }

  // ---------- 科技类 ETF 主题分类 ----------
  var TECH_THEMES = [
    { theme: "半导体", re: /半导体|芯片|集成电路|光刻/ },
    { theme: "AI/软件", re: /人工智能|AI|软件|计算机|云计算|大数据|网络安全|信创|数字经济|数据要素|算力|量子|服务器/ },
    { theme: "通信/5G", re: /通信|5G|6G|光通信|光模块/ },
    { theme: "新能源", re: /新能源|光伏|锂电|电池|储能|风电|碳中和|充电/ },
    { theme: "机器人/制造", re: /机器人|智能制造|工业母机|高端装备|智能汽车|机床/ },
    { theme: "电子/消费电子", re: /电子/ },
    { theme: "军工/航天", re: /军工|国防|航天|卫星|北斗/ },
    { theme: "传媒/游戏", re: /传媒|游戏|元宇宙|虚拟现实|VR|AR|互联网/ },
    { theme: "科创/宽基", re: /科创|创业板|科技/ }
  ];

  // 返回主题名；非科技类返回 null
  function themeOf(name) {
    for (var i = 0; i < TECH_THEMES.length; i++) {
      if (TECH_THEMES[i].re.test(name)) return TECH_THEMES[i].theme;
    }
    return null;
  }
  function isTech(name) { return themeOf(name) !== null; }

  // 拉取全部 ETF（分页，按成交额排序；主站失败自动切换延迟站）
  function fetchListFromHost(host) {
    var pages = [];
    for (var pn = 1; pn <= 10; pn++) pages.push(listURL(host, "f6", 1, pn, 100));
    return Promise.all(pages.map(function (u) { return fetchJSON(u); }));
  }

  API.getETFList = function () {
    return backFetch("/api/list")
      .then(normalizeBackendList)
      .catch(function () { return directGetETFList(); });
  };

  function directGetETFList() {
    return fetchListFromHost("push2.eastmoney.com")
      .catch(function () { return fetchListFromHost("push2delay.eastmoney.com"); })
      .then(function (res) {
        var list = [];
        res.forEach(function (r) {
          if (r && r.data && r.data.diff) {
            list = list.concat(r.data.diff.map(mapETF));
          }
        });
        var total = res[0] && res[0].data ? res[0].data.total : list.length;
        return { total: total, list: list };
      });
  }

  // ---------- K线 ----------
  // klt: 101 日 / 102 周 / 103 月
  API.getKline = function (code, klt, lmt) {
    klt = klt || 101;
    lmt = lmt || 400;
    return backFetch("/api/kline/" + code + "?klt=" + klt + "&lmt=" + lmt)
      .catch(function () { return directGetKline(code, klt, lmt); });
  };

  function directGetKline(code, klt, lmt) {
    var url = "https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=" +
      secidOf(code) + "&klt=" + klt + "&fqt=1&lmt=" + lmt + "&end=20500101" +
      "&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58";
    return fetchJSON(url).then(function (r) {
      if (!r || !r.data || !r.data.klines) throw new Error("K线数据为空");
      var d = r.data;
      var bars = d.klines.map(function (s) {
        var p = s.split(",");
        return {
          date: p[0],
          open: parseFloat(p[1]),
          close: parseFloat(p[2]),
          high: parseFloat(p[3]),
          low: parseFloat(p[4]),
          volume: parseFloat(p[5]),
          amount: parseFloat(p[6])
        };
      });
      return { code: d.code, name: d.name, market: d.market, bars: bars };
    });
  }

  // ---------- 实时快照 ----------
  var QUOTE_FIELDS = "f43,f44,f45,f46,f47,f48,f50,f57,f58,f60,f107,f168,f169,f170,f171,f116,f117";
  API.getQuote = function (code) {
    return backFetch("/api/quote/" + code)
      .catch(function () { return directGetQuote(code); });
  };

  function directGetQuote(code) {
    var u1 = "https://push2.eastmoney.com/api/qt/stock/get?secid=" + secidOf(code) +
      "&fltt=2&invt=2&fields=" + QUOTE_FIELDS;
    var u2 = "https://push2delay.eastmoney.com/api/qt/stock/get?secid=" + secidOf(code) +
      "&fltt=2&invt=2&fields=" + QUOTE_FIELDS;
    return fetchJSONMulti([u1, u2]).then(function (r) {
      var d = r && r.data;
      if (!d) throw new Error("行情数据为空");
      var price = num(d.f43, 3);
      var prev = num(d.f60, 3);
      return {
        code: d.f57 || code,
        name: d.f58,
        price: price,
        prevClose: prev,
        chg: num(d.f169, 3),
        pct: num(d.f170, 2),
        open: num(d.f46, 3),
        high: num(d.f44, 3),
        low: num(d.f45, 3),
        volume: num(d.f47, 0),
        amount: num(d.f48, 0),
        turnover: num(d.f168, 2),
        mcap: num(d.f116, 0),
        amplitude: num(d.f171, 2)
      };
    });
  };

  // ---------- 科技相关指数 ----------
  var INDEXES = [
    { secid: "1.000688", name: "科创50" },
    { secid: "1.000698", name: "科创100" },
    { secid: "1.000685", name: "科创芯片" },
    { secid: "0.399006", name: "创业板指" },
    { secid: "0.399673", name: "创业板50" }
  ];

  API.getIndexQuotes = function () {
    return backFetch("/api/indexes")
      .catch(function () { return directGetIndexQuotes(); });
  };

  function directGetIndexQuotes() {
    var jobs = INDEXES.map(function (idx) {
      var u1 = "https://push2.eastmoney.com/api/qt/stock/get?secid=" + idx.secid +
        "&fltt=2&invt=2&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170";
      var u2 = "https://push2delay.eastmoney.com/api/qt/stock/get?secid=" + idx.secid +
        "&fltt=2&invt=2&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f169,f170";
      return fetchJSONMulti([u1, u2]).then(function (r) {
        var d = r && r.data;
        if (!d) return null;
        var price = num(d.f43, 2);
        var prev = num(d.f60, 2);
        return {
          secid: idx.secid,
          code: d.f57,
          name: d.f58 || idx.name,
          price: price,
          chg: num(d.f169, 2),
          pct: num(d.f170, 2),
          amount: num(d.f48, 0)
        };
      });
    });
    return Promise.all(jobs).then(function (arr) {
      return arr.filter(Boolean);
    });
  };

  // ---------- 本地快照（最终降级） ----------
  API.snapshot = null;
  API.loadSnapshot = function () {
    if (API.snapshot) return Promise.resolve(API.snapshot);
    return fetch("data/etf-snapshot.json", { cache: "no-cache" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        API.snapshot = d;
        return d;
      })
      .catch(function () { return null; });
  };

  API.secidOf = secidOf;
  API.round = round;
  API.themeOf = themeOf;
  API.isTech = isTech;
  API.TECH_THEMES = TECH_THEMES;

  window.POMELO.API = API;
})();
