/* =========================================================
   POMELO ETF 量化 - 页面逻辑
   ========================================================= */

window.POMELO = window.POMELO || {};

(function () {
  "use strict";

  var API = window.POMELO.API;
  var Chart = window.POMELO.Chart;
  var St = window.POMELO.Strategy;

  // ---------- 通用格式化 ----------
  function fmtPrice(v) { return v === null || v === undefined ? "-" : v.toFixed(3); }
  function fmtPct(v) {
    if (v === null || v === undefined) return "-";
    return (v > 0 ? "+" : "") + v.toFixed(2) + "%";
  }
  function pctClass(v) { return v > 0 ? "up" : v < 0 ? "down" : "flat"; }
  function fmtAmount(v) { return Chart.fmtAmount(v); }
  function fmtNum(v) {
    if (v === null || v === undefined) return "-";
    if (v >= 1e8) return (v / 1e8).toFixed(2) + " 亿";
    if (v >= 1e4) return (v / 1e4).toFixed(2) + " 万";
    return v.toFixed(0);
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // ---------- 导航 & 搜索 ----------
  function initNav() {
    var toggle = document.getElementById("navToggle");
    var nav = document.getElementById("mainNav");
    if (toggle && nav) {
      toggle.addEventListener("click", function () { nav.classList.toggle("open"); });
    }
    var form = document.getElementById("searchForm");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = document.getElementById("searchInput").value.trim();
        var m = v.match(/(\d{6})/);
        if (m) window.location.href = "etf.html?code=" + m[1];
        else showNotice("notice", "请输入 6 位 ETF 代码，例如 510300");
      });
    }
    initUserBox();
  }

  var noticeEl = null;
  function showNotice(type, msg) {
    var host = noticeEl || (noticeEl = document.getElementById("pageNotice"));
    if (!host) return;
    host.className = "notice " + type;
    host.textContent = msg;
    host.style.display = "block";
  }
  function hideNotice() {
    if (noticeEl) noticeEl.style.display = "none";
  }

  // =========================================================
  // 首页：仪表盘
  // =========================================================
  var TOP_PICKS = [
    { code: "512480", name: "半导体ETF", theme: "半导体", note: "半导体设备材料，自主可控核心" },
    { code: "159995", name: "芯片ETF", theme: "半导体", note: "芯片设计制造龙头" },
    { code: "159819", name: "人工智能ETF", theme: "AI/软件", note: "AI 算力与应用" },
    { code: "588000", name: "科创50ETF", theme: "科创/宽基", note: "科创板硬科技 50 强" },
    { code: "159915", name: "创业板ETF", theme: "科创/宽基", note: "创业板科技成长" },
    { code: "515880", name: "通信ETF", theme: "通信/5G", note: "5G 与光通信" },
    { code: "159852", name: "软件ETF", theme: "AI/软件", note: "国产软件与信创" },
    { code: "516160", name: "新能源ETF", theme: "新能源", note: "新能源全产业链" },
    { code: "515790", name: "光伏ETF", theme: "新能源", note: "光伏产业链" },
    { code: "562500", name: "机器人ETF", theme: "机器人/制造", note: "人形机器人智能制造" },
    { code: "512660", name: "军工ETF", theme: "军工/航天", note: "国防军工科技" },
    { code: "515050", name: "5G通信ETF", theme: "通信/5G", note: "5G 设备与应用" }
  ];

  function renderTopPicks() {
    var wrap = document.getElementById("topPicks");
    if (!wrap) return;
    wrap.innerHTML = TOP_PICKS.map(function (p) {
      return '<div class="index-card" data-code="' + p.code + '" style="cursor:pointer">' +
        '<div class="idx-name">' + esc(p.name) + ' <span class="muted num">' + p.code + "</span></div>" +
        '<div class="idx-price num" data-price>—</div>' +
        '<div class="idx-chg num" data-pct>—</div>' +
        '<div class="idx-amount">' + esc(p.theme) + " · " + esc(p.note) + "</div>" +
        "</div>";
    }).join("");
    wrap.querySelectorAll(".index-card").forEach(function (c) {
      c.addEventListener("click", function () {
        window.location.href = "etf.html?code=" + c.getAttribute("data-code");
      });
    });
    // 填充实时价格
    Promise.all(TOP_PICKS.map(function (p) {
      return API.getQuote(p.code).catch(function () { return null; });
    })).then(function (quotes) {
      var cards = wrap.querySelectorAll(".index-card");
      quotes.forEach(function (q, i) {
        if (!q || !cards[i]) return;
        cards[i].querySelector("[data-price]").textContent = fmtPrice(q.price);
        var el = cards[i].querySelector("[data-pct]");
        el.textContent = fmtPct(q.pct);
        el.className = "idx-chg num " + pctClass(q.pct);
      });
    });
  }

  // ---------- 风险风格配置 ----------
  var RISK_STYLES = [
    {
      key: "conservative",
      name: "稳健型", icon: "🛡️", color: "#26a69a",
      tagline: "稳字当头 · 控制回撤",
      crowd: "适合新手 / 风险承受力低 / 追求平稳增值的投资者",
      expect: "预期年化波动 12~18%，最大回撤约 15~25%",
      alloc: [
        { theme: "科创/宽基", pct: 50, note: "科创50、创业板等科技宽基打底" },
        { theme: "通信/5G", pct: 25, note: "5G、通信设备，波动相对温和" },
        { theme: "电子/消费电子", pct: 15, note: "消费电子复苏周期" },
        { theme: "新能源", pct: 10, note: "新能源龙头分散" }
      ],
      picks: [
        { code: "588000", name: "科创50ETF" },
        { code: "159915", name: "创业板ETF" },
        { code: "515880", name: "通信ETF" },
        { code: "515050", name: "5G通信ETF" }
      ]
    },
    {
      key: "balanced",
      name: "平衡型", icon: "⚖️", color: "#2962ff",
      tagline: "攻守兼备 · 稳中求进",
      crowd: "适合有一定经验 / 能承受中等波动 / 追求长期增长的投资者",
      expect: "预期年化波动 18~25%，最大回撤约 25~35%",
      alloc: [
        { theme: "科创/宽基", pct: 35, note: "科技宽基打底" },
        { theme: "半导体", pct: 25, note: "半导体设备与材料" },
        { theme: "AI/软件", pct: 20, note: "AI 算力与应用" },
        { theme: "新能源", pct: 20, note: "新能源产业链" }
      ],
      picks: [
        { code: "588000", name: "科创50ETF" },
        { code: "512480", name: "半导体ETF" },
        { code: "159819", name: "人工智能ETF" },
        { code: "516160", name: "新能源ETF" }
      ]
    },
    {
      key: "aggressive",
      name: "激进型", icon: "🚀", color: "#ff9800",
      tagline: "高弹进攻 · 博取超额",
      crowd: "适合有投资经验 / 能承受较大回撤 / 追求高收益的投资者",
      expect: "预期年化波动 25~35%，最大回撤约 35~45%",
      alloc: [
        { theme: "半导体", pct: 35, note: "芯片、半导体设备" },
        { theme: "AI/软件", pct: 30, note: "AI、云计算、信创" },
        { theme: "机器人/制造", pct: 20, note: "人形机器人、智能制造" },
        { theme: "军工/航天", pct: 15, note: "国防军工科技" }
      ],
      picks: [
        { code: "512480", name: "半导体ETF" },
        { code: "159995", name: "芯片ETF" },
        { code: "159819", name: "人工智能ETF" },
        { code: "562500", name: "机器人ETF" }
      ]
    },
    {
      key: "extreme",
      name: "非常激进", icon: "🔥", color: "#f23645",
      tagline: "梭哈科技 · 高风险高回报",
      crowd: "适合资深玩家 / 可承受腰斩级回撤 / 资金长期不用的投资者",
      expect: "预期年化波动 35%+，最大回撤可达 50%+",
      alloc: [
        { theme: "半导体", pct: 50, note: "高弹性主线" },
        { theme: "AI/软件", pct: 30, note: "AI、算力、软件" },
        { theme: "机器人/制造", pct: 20, note: "题材弹性最大" }
      ],
      picks: [
        { code: "159995", name: "芯片ETF" },
        { code: "512480", name: "半导体ETF" },
        { code: "159819", name: "人工智能ETF" },
        { code: "562500", name: "机器人ETF" }
      ]
    }
  ];

  function renderRiskStyles() {
    var grid = document.getElementById("riskGrid");
    if (!grid) return;
    grid.innerHTML = RISK_STYLES.map(function (s) {
      return '<div class="risk-card" data-key="' + s.key + '" style="--rc:' + s.color + '">' +
        '<div class="risk-icon">' + s.icon + "</div>" +
        '<div class="risk-head"><h3>' + s.name + "</h3><span>" + s.tagline + "</span></div>" +
        '<div class="risk-expect num">' + s.expect + "</div>" +
        '<div class="risk-more">点击查看配置 →</div>' +
        "</div>";
    }).join("");
    grid.querySelectorAll(".risk-card").forEach(function (card) {
      card.addEventListener("click", function () {
        grid.querySelectorAll(".risk-card").forEach(function (c) { c.classList.remove("active"); });
        card.classList.add("active");
        renderRiskDetail(card.getAttribute("data-key"));
      });
    });
    var def = grid.querySelector('[data-key="balanced"]');
    if (def) { def.classList.add("active"); renderRiskDetail("balanced"); }
  }

  function renderRiskDetail(key) {
    var detail = document.getElementById("riskDetail");
    if (!detail) return;
    var s = RISK_STYLES.filter(function (x) { return x.key === key; })[0];
    if (!s) return;
    var allocHtml = s.alloc.map(function (a) {
      return '<div class="alloc-row">' +
        '<div class="alloc-info"><span>' + esc(a.theme) + '</span><em>' + esc(a.note) + "</em></div>" +
        '<div class="alloc-bar"><i style="width:' + a.pct + "%;background:" + s.color + '"></i></div>' +
        '<div class="alloc-pct num">' + a.pct + "%</div>" +
        "</div>";
    }).join("");
    var picksHtml = s.picks.map(function (p) {
      return '<a class="pick-chip" href="etf.html?code=' + p.code + '">' + esc(p.name) +
        ' <span class="num">' + p.code + "</span></a>";
    }).join("");
    detail.innerHTML =
      '<div class="risk-detail-head" style="border-color:' + s.color + '">' +
      "<div><h3>" + s.icon + " " + s.name + " · " + s.tagline + "</h3>" +
      '<p class="muted">' + esc(s.crowd) + "</p></div>" +
      '<a class="btn btn-accent btn-sm" href="strategy.html?code=' + s.picks[0].code + '">用策略验证 →</a>' +
      "</div>" +
      '<div class="risk-detail-body">' +
      '<div class="alloc-wrap">' + allocHtml + "</div>" +
      '<div class="risk-picks"><div class="label">代表性 ETF：</div>' +
      '<div class="pick-wrap">' + picksHtml + "</div></div>" +
      "</div>";
  }

  // ---------- 深度分析（ETF 详情页） ----------
  function renderAnalysis(bars) {
    var host = document.getElementById("analysisPanel");
    if (!host) return;
    var a = St.analyze(bars);
    if (!a) { host.innerHTML = '<div class="muted">数据不足，无法分析</div>'; return; }

    var posCls = a.pos >= 75 ? "up" : a.pos >= 40 ? "flat" : "down";
    var orderCls = a.order === "多头排列" ? "up" : a.order === "空头排列" ? "down" : "flat";

    function chip(label, v) {
      var cls = v === null ? "flat" : v > 0 ? "up" : v < 0 ? "down" : "flat";
      var txt = v === null ? "-" : (v > 0 ? "+" : "") + v.toFixed(2) + "%";
      return '<div class="ret-chip"><span class="label">' + label + '</span><span class="num ' + cls + '">' + txt + "</span></div>";
    }

    var posTxt = a.pos >= 75 ? "处于近一年区间的较高位置（" + a.pos.toFixed(0) + "%），追高需谨慎"
      : a.pos >= 40 ? "处于近一年区间中部（" + a.pos.toFixed(0) + "%），估值中性"
      : "处于近一年区间的低位（" + a.pos.toFixed(0) + "%），相对便宜";
    var trendTxt = a.order === "多头排列" ? "均线呈多头排列，中期趋势向上"
      : a.order === "空头排列" ? "均线呈空头排列，中期趋势偏弱" : "均线纠缠，方向未明";
    var volTxt = a.vol20 >= 30 ? "20日年化波动率 " + a.vol20.toFixed(0) + "%，属于高波动品种"
      : a.vol20 >= 18 ? "20日年化波动率 " + a.vol20.toFixed(0) + "%，波动中等"
      : "20日年化波动率 " + a.vol20.toFixed(0) + "%，波动相对温和";
    function mret(v, upWord) {
      if (v === null) return "-";
      return (v > 0 ? "上涨 " : "下跌 ") + Math.abs(v).toFixed(1) + "%";
    }
    var summary = "当前价 " + a.price.toFixed(3) + "，" + posTxt + "；" + trendTxt + "；" + volTxt +
      "。近1月" + mret(a.r1m) + "，近3月" + mret(a.r3m) + "，近6月" + mret(a.r6m) + "。" +
      (a.dev20 > 5 ? "价格高于20日均线约 " + a.dev20.toFixed(1) + "%，短线偏热。" :
        a.dev20 < -5 ? "价格低于20日均线约 " + Math.abs(a.dev20).toFixed(1) + "%，短线超跌。" : "价格贴近20日均线运行。");

    host.innerHTML =
      '<div class="analysis-top">' +
      '<div class="pos-box"><div class="label">近一年区间位置</div>' +
      '<div class="pos-bar"><i style="left:' + a.pos.toFixed(0) + '%"></i></div>' +
      '<div class="pos-labels num"><span>' + a.lo.toFixed(2) + '</span><span class="pos-val ' + posCls + '">' + a.pos.toFixed(0) + "%</span><span>" + a.hi.toFixed(2) + "</span></div></div>" +
      '<div class="ret-chips">' +
      chip("近1月", a.r1m) + chip("近3月", a.r3m) + chip("近6月", a.r6m) + chip("近1年", a.r1y) +
      "</div>" +
      '<div class="ana-meta"><div class="meta-item"><span class="label">均线结构</span><span class="v ' + orderCls + '">' + a.order + "</span></div>" +
      '<div class="meta-item"><span class="label">20日年化波动</span><span class="v num">' + a.vol20.toFixed(1) + "%</span></div>" +
      '<div class="meta-item"><span class="label">偏离 MA20</span><span class="v num ' + (a.dev20 >= 0 ? "up" : "down") + '">' + (a.dev20 >= 0 ? "+" : "") + a.dev20.toFixed(1) + "%</span></div>" +
      '<div class="meta-item"><span class="label">偏离 MA60</span><span class="v num ' + (a.dev60 >= 0 ? "up" : "down") + '">' + (a.dev60 >= 0 ? "+" : "") + a.dev60.toFixed(1) + "%</span></div></div>" +
      "</div>" +
      '<div class="analysis-text">' + summary + "</div>";
  }

  function initIndex() {
    renderRiskStyles();
    renderTopPicks();
    loadIndexes();
    loadETFTable();
    subscribeWS(TOP_PICKS.map(function (p) { return p.code; }));
  }

  function loadIndexes() {
    return API.getIndexQuotes().then(function (list) {
      var wrap = document.getElementById("indexCards");
      if (!wrap) return;
      if (!list.length) { wrap.innerHTML = '<div class="muted" style="padding:20px">指数行情暂不可用</div>'; return; }
      wrap.innerHTML = list.map(function (idx) {
        return '<div class="index-card" title="' + esc(idx.name) + ' 指数">' +
          '<div class="idx-name">' + esc(idx.name) + "</div>" +
          '<div class="idx-price num">' + idx.price.toFixed(2) + "</div>" +
          '<div class="idx-chg num ' + pctClass(idx.pct) + '">' +
          (idx.chg >= 0 ? "+" : "") + idx.chg.toFixed(2) + "　" + fmtPct(idx.pct) + "</div>" +
          '<div class="idx-amount">成交额 ' + fmtAmount(idx.amount) + "</div>" +
          "</div>";
      }).join("");
    }).catch(function () {
      var wrap = document.getElementById("indexCards");
      if (wrap) wrap.innerHTML = '<div class="muted" style="padding:20px">指数行情暂不可用</div>';
    });
  }

  var etfList = [];
  var etfFiltered = [];
  var etfSort = { key: "pct", dir: -1 };
  var etfPage = 1;
  var PAGE_SIZE = 50;

  function loadETFTable() {
    var tbody = document.getElementById("etfBody");
    if (tbody) tbody.innerHTML = '<tr class="empty-row"><td colspan="10"><div class="loading"><div class="spin"></div><div>正在加载全市场 ETF 行情…</div></div></td></tr>';

    return API.getETFList().then(function (res) {
      etfList = res.list;
      if (res.total && res.list.length < res.total) {
        showNotice("info", "已加载成交额最大的 " + res.list.length + " 只 ETF（共 " + res.total + " 只）。数据来自东方财富公开接口，非实时，可能存在延迟。");
      }
      applyFilterAndRender();
    }).catch(function () {
      // 降级：本地快照
      API.loadSnapshot().then(function (snap) {
        if (snap && snap.list) {
          etfList = snap.list;
          showNotice("info", "实时接口暂不可用，当前显示本地快照数据（更新于 " + (snap.updated || "未知") + "）。");
          applyFilterAndRender();
        } else {
          if (tbody) tbody.innerHTML = '<tr class="empty-row"><td colspan="10">数据加载失败，请稍后刷新重试</td></tr>';
        }
      });
    });
  }

  function applyFilterAndRender() {
    var kw = (document.getElementById("etfSearch") || {}).value || "";
    var theme = (document.getElementById("themeFilter") || {}).value || "all";
    kw = kw.trim().toLowerCase();

    etfFiltered = etfList.filter(function (e) {
      if (!e.theme) return false;                 // 仅展示科技主题 ETF
      if (theme !== "all" && e.theme !== theme) return false;
      if (!kw) return true;
      return e.code.indexOf(kw) >= 0 || e.name.toLowerCase().indexOf(kw) >= 0;
    });

    // 预计算量化评分（用于展示与排序）
    etfFiltered.forEach(function (e) {
      if (e.score === undefined) {
        var s = St.lightScore(e);
        e.score = s.value;
        e.scoreLabel = s.label;
        e.scoreParts = s.parts;
      }
    });

    etfFiltered.sort(function (a, b) {
      var av = a[etfSort.key], bv = b[etfSort.key];
      if (av === null || av === undefined) av = -Infinity;
      if (bv === null || bv === undefined) bv = -Infinity;
      return (av - bv) * etfSort.dir;
    });

    var totalPages = Math.max(1, Math.ceil(etfFiltered.length / PAGE_SIZE));
    if (etfPage > totalPages) etfPage = totalPages;
    renderDistribution(etfFiltered);
    renderTable();
    updatePagination(totalPages);
  }

  function renderDistribution(list) {
    var up = 0, down = 0, flat = 0;
    list.forEach(function (e) {
      if (e.pct > 0) up++; else if (e.pct < 0) down++; else flat++;
    });
    var el = document.getElementById("distributionChart");
    if (el) {
      Chart.drawDistribution(el, { up: up, down: down, flat: flat }).catch(function () {});
      document.getElementById("distInfo").textContent = "上涨 " + up + " · 平盘 " + flat + " · 下跌 " + down + "（共 " + list.length + " 只）";
    }
  }

  function renderTable() {
    var tbody = document.getElementById("etfBody");
    if (!tbody) return;
    var start = (etfPage - 1) * PAGE_SIZE;
    var page = etfFiltered.slice(start, start + PAGE_SIZE);
    if (!page.length) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="10">没有匹配的 ETF</td></tr>';
      return;
    }
    tbody.innerHTML = page.map(function (e) {
      var scoreCls = e.score >= 70 ? "up" : e.score >= 55 ? "accent" : e.score >= 40 ? "flat" : "down";
      return "<tr data-code='" + e.code + "'>" +
        '<td><span class="num code-cell">' + e.code + "</span></td>" +
        '<td class="name-cell" data-code="' + e.code + '" data-name="' + esc(e.name) + '">' + esc(e.name) +
        '<span class="badge badge-etf">' + esc(e.theme || "") + "</span></td>" +
        '<td class="num" data-f="price">' + fmtPrice(e.price) + "</td>" +
        '<td class="num ' + pctClass(e.pct) + '" data-f="pct">' + fmtPct(e.pct) + "</td>" +
        '<td class="num ' + pctClass(e.chg) + '">' + (e.chg >= 0 ? "+" : "") + fmtPrice(e.chg) + "</td>" +
        '<td class="num">' + fmtAmount(e.amount) + "</td>" +
        '<td class="num">' + fmtNum(e.volume * 100) + "</td>" +
        '<td class="num">' + (e.turnover === null ? "-" : e.turnover.toFixed(2) + "%") + "</td>" +
        '<td class="num">' + fmtAmount(e.mcap) + "</td>" +
        '<td class="num"><span class="score-chip ' + scoreCls + '" title="动量' + Math.round(e.scoreParts ? e.scoreParts.momentum : 0) + ' · 资金' + Math.round(e.scoreParts ? e.scoreParts.capital : 0) + ' · 活跃' + Math.round(e.scoreParts ? e.scoreParts.activity : 0) + '">' + e.score + "</span></td>" +
        "</tr>";
    }).join("");

    tbody.querySelectorAll(".name-cell").forEach(function (td) {
      td.addEventListener("click", function () {
        window.location.href = "etf.html?code=" + td.getAttribute("data-code");
      });
    });
    subscribeWS(page.map(function (e) { return e.code; }));
  }

  function updatePagination(totalPages) {
    var info = document.getElementById("pageInfo");
    var prev = document.getElementById("pagePrev");
    var next = document.getElementById("pageNext");
    if (!info) return;
    info.textContent = "第 " + etfPage + " / " + totalPages + " 页 · 共 " + etfFiltered.length + " 只";
    prev.disabled = etfPage <= 1;
    next.disabled = etfPage >= totalPages;
  }

  function initETFTools() {
    var search = document.getElementById("etfSearch");
    if (search) search.addEventListener("input", function () { etfPage = 1; applyFilterAndRender(); });
    var theme = document.getElementById("themeFilter");
    if (theme) theme.addEventListener("change", function () { etfPage = 1; applyFilterAndRender(); });
    var prev = document.getElementById("pagePrev");
    var next = document.getElementById("pageNext");
    if (prev) prev.addEventListener("click", function () { if (etfPage > 1) { etfPage--; renderTable(); updatePagination(Math.ceil(etfFiltered.length / PAGE_SIZE)); } });
    if (next) next.addEventListener("click", function () { if (etfPage < Math.ceil(etfFiltered.length / PAGE_SIZE)) { etfPage++; renderTable(); updatePagination(Math.ceil(etfFiltered.length / PAGE_SIZE)); } });
    document.querySelectorAll("th[data-sort]").forEach(function (th) {
      th.addEventListener("click", function () {
        var key = th.getAttribute("data-sort");
        if (etfSort.key === key) etfSort.dir = -etfSort.dir;
        else { etfSort.key = key; etfSort.dir = key === "code" ? 1 : -1; }
        document.querySelectorAll("th[data-sort]").forEach(function (t) { t.classList.remove("sorted"); });
        th.classList.add("sorted");
        applyFilterAndRender();
      });
    });
  }

  // =========================================================
  // ETF 详情页
  // =========================================================
  var currentCode = null;
  var currentPeriod = "daily";
  var klineCache = {};
  var PERIODS = { daily: { klt: 101, lmt: 800, label: "日K" }, weekly: { klt: 102, lmt: 600, label: "周K" }, monthly: { klt: 103, lmt: 400, label: "月K" } };

  function initETF() {
    var q = new URLSearchParams(window.location.search);
    currentCode = q.get("code") || "512480";
    document.getElementById("etfName").textContent = "加载中…";
    initWatchlist().then(function () {
      var btn = document.getElementById("btnStar");
      if (btn) {
        var on = watchlist.indexOf(currentCode) >= 0;
        btn.textContent = on ? "★ 已自选" : "☆ 自选";
        btn.classList.toggle("star-on", on);
      }
    });
    initStar();
    loadQuote();
    loadKline("daily");
    initPeriodTabs();
    subscribeWS([currentCode]);
  }

  function loadQuote() {
    API.getQuote(currentCode).then(function (q) {
      document.title = q.name + " (" + q.code + ") - POMELO ETF 量化";
      document.getElementById("etfName").textContent = q.name;
      document.getElementById("etfCode").textContent = q.code;
      var priceEl = document.getElementById("price");
      priceEl.textContent = fmtPrice(q.price);
      priceEl.className = "price num " + pctClass(q.pct);
      var chgEl = document.getElementById("chg");
      chgEl.textContent = (q.chg >= 0 ? "+" : "") + fmtPrice(q.chg) + "　" + fmtPct(q.pct);
      chgEl.className = "chg num " + pctClass(q.pct);
      var stats = [
        { label: "今开", value: fmtPrice(q.open) },
        { label: "最高", value: fmtPrice(q.high) },
        { label: "最低", value: fmtPrice(q.low) },
        { label: "昨收", value: fmtPrice(q.prevClose) },
        { label: "成交额", value: fmtAmount(q.amount) },
        { label: "成交量", value: fmtNum(q.volume * 100) },
        { label: "换手率", value: q.turnover === null ? "-" : q.turnover.toFixed(2) + "%" },
        { label: "振幅", value: q.amplitude === null ? "-" : q.amplitude.toFixed(2) + "%" }
      ];
      document.getElementById("statGrid").innerHTML = stats.map(function (s) {
        return '<div class="stat-cell"><div class="label">' + s.label + '</div><div class="value num">' + s.value + "</div></div>";
      }).join("");
      var bt = document.getElementById("backtestLink");
      if (bt) bt.href = "strategy.html?code=" + currentCode;
    }).catch(function () {
      document.getElementById("etfName").textContent = "行情加载失败";
      showNotice("error", "实时行情加载失败（数据源可能暂不可用），K线图仍可尝试加载。");
    });
  }

  function initPeriodTabs() {
    var tabs = document.getElementById("periodTabs");
    if (!tabs) return;
    tabs.querySelectorAll("button").forEach(function (b) {
      b.addEventListener("click", function () {
        tabs.querySelectorAll("button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        loadKline(b.getAttribute("data-period"));
      });
    });
  }

  function loadKline(periodKey) {
    currentPeriod = periodKey;
    var p = PERIODS[periodKey];
    var box = document.getElementById("klineChart");
    box.innerHTML = '<div class="loading"><div class="spin"></div><div>加载 K 线数据…</div></div>';
    return API.getKline(currentCode, p.klt, p.lmt).then(function (res) {
      klineCache[periodKey] = res;
      renderKline(res);
    }).catch(function () {
      box.innerHTML = '<div class="loading">K 线数据加载失败（数据源暂不可用）</div>';
    });
  }

  function renderKline(res) {
    var bars = res.bars;
    var closes = bars.map(function (b) { return b.close; });
    var ind = St.indicators;
    var ma = {
      ma5: ind.sma(closes, 5), ma10: ind.sma(closes, 10),
      ma20: ind.sma(closes, 20), ma60: ind.sma(closes, 60)
    };
    var m = ind.macd(closes, 12, 26, 9);
    Chart.drawKline(document.getElementById("klineChart"), {
      bars: bars, ma: ma, macd: m
    }, {}).catch(function (e) {
      document.getElementById("klineChart").innerHTML = '<div class="loading">图表加载失败：' + esc(e.message) + "</div>";
    });
    renderIndicators(bars);
    renderAnalysis(bars);
  }

  function renderIndicators(bars) {
    var s = St.signals(bars);
    var sc = St.score(bars);
    var price = bars[bars.length - 1].close;
    var ind = St.indicators;
    var m = ind.macd(bars.map(function (b) { return b.close; }), 12, 26, 9);

    var html = "";

    // MA 卡片
    var maHtml = ["ma20", "ma60"].map(function (k) {
      var cls = price >= s[k] ? "up" : "down";
      return '<div class="row"><span class="k">' + k.toUpperCase() + "</span><span class='v " + cls + "'>" + fmtPrice(s[k]) + "</span></div>";
    }).join("");
    html += card("均线 MA", maHtml);

    // MACD 卡片
    var dif = s.dif, dea = s.dea, hist = s.hist;
    var macdSignal = hist > 0 ? '<span class="signal buy">多头</span>' : hist < 0 ? '<span class="signal sell">空头</span>' : '<span class="signal neutral">观望</span>';
    html += card("MACD", macdSignal +
      '<div class="row"><span class="k">DIF</span><span class="v num">' + fmtPrice(dif) + "</span></div>" +
      '<div class="row"><span class="k">DEA</span><span class="v num">' + fmtPrice(dea) + "</span></div>" +
      '<div class="row"><span class="k">柱</span><span class="v num ' + (hist >= 0 ? "up" : "down") + '">' + fmtPrice(hist) + "</span></div>");

    // RSI 卡片
    var rsiV = s.rsi;
    var rsiSignal = rsiV === null ? '<span class="signal neutral">-</span>' : rsiV > 70 ? '<span class="signal sell">超买</span>' : rsiV < 30 ? '<span class="signal buy">超卖</span>' : '<span class="signal neutral">中性</span>';
    html += card("RSI(14)", rsiSignal +
      '<div class="row"><span class="k">RSI</span><span class="v num ' + (rsiV !== null && rsiV > 70 ? "up" : rsiV !== null && rsiV < 30 ? "down" : "") + '">' + (rsiV === null ? "-" : rsiV.toFixed(2)) + "</span></div>");

    // KDJ 卡片
    var kdjSignal = s.k > s.d ? '<span class="signal buy">金叉</span>' : s.k < s.d ? '<span class="signal sell">死叉</span>' : '<span class="signal neutral">-</span>';
    html += card("KDJ(9,3,3)", kdjSignal +
      '<div class="row"><span class="k">K</span><span class="v num">' + s.k.toFixed(2) + "</span></div>" +
      '<div class="row"><span class="k">D</span><span class="v num">' + s.d.toFixed(2) + "</span></div>" +
      '<div class="row"><span class="k">J</span><span class="v num">' + s.j.toFixed(2) + "</span></div>");

    // 布林带卡片
    var pos = (price - s.bollL) / (s.bollU - s.bollL || 1);
    var bollSignal = price > s.bollU ? '<span class="signal sell">突破上轨</span>' : price < s.bollL ? '<span class="signal buy">跌破下轨</span>' : '<span class="signal neutral">区间内</span>';
    html += card("布林带(20,2)", bollSignal +
      '<div class="row"><span class="k">上轨</span><span class="v num">' + fmtPrice(s.bollU) + "</span></div>" +
      '<div class="row"><span class="k">中轨</span><span class="v num">' + fmtPrice(s.bollM) + "</span></div>" +
      '<div class="row"><span class="k">下轨</span><span class="v num">' + fmtPrice(s.bollL) + "</span></div>" +
      '<div class="row"><span class="k">位置</span><span class="v num">' + (pos * 100).toFixed(0) + "%</span></div>");

    document.getElementById("indicatorGrid").innerHTML = html;

    // 评分卡片
    if (sc) {
      var scoreDesc = sc.value >= 75 ? "强势 · 趋势与动量俱佳" : sc.value >= 55 ? "偏强 · 可关注回调机会" : sc.value >= 35 ? "中性 · 观望为主" : "偏弱 · 注意下行风险";
      var scoreCls = sc.value >= 55 ? "up" : sc.value >= 35 ? "flat" : "down";
      document.getElementById("scorePanel").innerHTML =
        '<h3>综合量化评分（0-100）</h3>' +
        '<div class="score-ring"><div><div class="score-value num ' + scoreCls + '">' + sc.value + "</div>" +
        '<div class="score-desc">' + scoreDesc + "</div></div><div>" +
        '<div class="row"><span class="k">趋势</span><span class="v num">' + sc.trend + "/50</span></div>" +
        '<div class="row"><span class="k">动量</span><span class="v num">' + sc.mom + "/30</span></div>" +
        '<div class="row"><span class="k">RSI</span><span class="v num">' + sc.rsi + "/20</span></div>" +
        '<div class="row"><span class="k">波动</span><span class="v num">' + sc.vol + "/10</span></div>" +
        "</div></div>";
    }
  }

  function card(title, inner) {
    return '<div class="indicator-card"><h3>' + title + "</h3><div class='rows'>" + inner + "</div></div>";
  }

  // =========================================================
  // 策略实验室
  // =========================================================
  var stratKey = "ma";
  var stratBars = null;      // 单资产回测用
  var stratData = null;      // {code,name,bars}
  var RANGES = { y1: 250, y3: 750, y5: 1250, all: 5000 };

  function initStrategy() {
    var q = new URLSearchParams(window.location.search);
    var code = q.get("code") || "512480";
    document.getElementById("etfInput").value = code;
    buildStrategyGrid();
    renderParams();
    loadStrategyData(code);
    bindStrategyActions();
  }

  function buildStrategyGrid() {
    var wrap = document.getElementById("strategyGrid");
    wrap.innerHTML = Object.keys(St.STRATEGIES).map(function (k) {
      var s = St.STRATEGIES[k];
      return '<div class="strategy-option' + (k === stratKey ? " active" : "") + '" data-key="' + k + '">' +
        "<h3>" + s.name + "</h3><p>" + s.desc + "</p></div>";
    }).join("");
    wrap.querySelectorAll(".strategy-option").forEach(function (opt) {
      opt.addEventListener("click", function () {
        stratKey = opt.getAttribute("data-key");
        wrap.querySelectorAll(".strategy-option").forEach(function (x) { x.classList.remove("active"); });
        opt.classList.add("active");
        renderParams();
      });
    });
  }

  function renderParams() {
    var s = St.STRATEGIES[stratKey];
    var grid = document.getElementById("paramGrid");
    grid.innerHTML = s.params.map(function (p) {
      var step = p.step !== undefined ? p.step : 1;
      return '<div class="param-item"><label>' + p.label + '</label><input type="number" id="param_' + p.key +
        '" value="' + p.def + '" min="' + p.min + '" max="' + p.max + '" step="' + step + '"></div>';
    }).join("");
    var mom = document.getElementById("momentumPanel");
    if (mom) mom.style.display = stratKey === "momentum" ? "block" : "none";
    updateStrategyInfo();
  }

  function updateStrategyInfo() {
    var s = St.STRATEGIES[stratKey];
    var el = document.getElementById("strategyExplain");
    if (!el || !s) return;
    el.innerHTML = '<div class="explain-desc">💡 ' + esc(s.desc) + "</div>" +
      (s.suits ? '<div class="explain-suits">👤 适合人群：' + esc(s.suits) + "</div>" : "");
  }

  function getParams() {
    var out = {};
    (St.STRATEGIES[stratKey].params || []).forEach(function (p) {
      var el = document.getElementById("param_" + p.key);
      out[p.key] = el ? parseFloat(el.value) : p.def;
    });
    out.initial = 100000;
    return out;
  }

  function loadStrategyData(code) {
    var host = document.getElementById("strategyName");
    if (host) host.textContent = "加载 " + code + " …";
    var lmt = RANGES[document.getElementById("rangeSelect").value] || 750;
    return API.getKline(code, 101, lmt).then(function (res) {
      stratData = { code: res.code, name: res.name, bars: res.bars };
      stratBars = res.bars;
      if (host) host.textContent = res.name + " (" + res.code + ")";
      showNotice("info", "回测数据：日线 " + res.bars.length + " 根（" + res.bars[0].date + " ~ " + res.bars[res.bars.length - 1].date + "）。费率假设单边 " + (St.FEES * 100).toFixed(2) + "%。");
    }).catch(function () {
      if (host) host.textContent = code + " 加载失败";
      showNotice("error", "K线数据加载失败：请检查代码是否正确，或稍后重试（数据源为东方财富公开接口）。");
    });
  }

  function bindStrategyActions() {
    var input = document.getElementById("etfInput");
    var range = document.getElementById("rangeSelect");
    var go = document.getElementById("btnLoad");
    var run = document.getElementById("btnRun");
    var cmp = document.getElementById("btnCompare");
    var codes = document.getElementById("momentumCodes");

    if (go) go.addEventListener("click", function () {
      var m = input.value.match(/(\d{6})/);
      if (m) loadStrategyData(m[1]);
    });
    if (range) range.addEventListener("change", function () {
      if (stratData) loadStrategyData(stratData.code);
    });
    if (run) run.addEventListener("click", runBacktest);
    if (cmp) cmp.addEventListener("click", runCompare);
    if (codes) codes.addEventListener("keydown", function (e) { if (e.key === "Enter") runBacktest(); });
  }

  function runBacktest() {
    if (stratKey === "momentum") { runMomentumBacktest(); return; }
    if (!stratBars || !stratBars.length) { showNotice("error", "请先加载 ETF 数据"); return; }
    var params = getParams();
    var result = St.run(stratKey, stratBars, params);
    var bench = St.buyAndHold(stratBars, params);
    renderResult(result, bench, stratData.name + " · " + St.STRATEGIES[stratKey].name + "（" + JSON.stringify(params).replace(/[{}"]/g, " ") + "）");
  }

  function runMomentumBacktest() {
    var codes = document.getElementById("momentumCodes").value
      .match(/\d{6}/g) || [];
    if (codes.length < 2) { showNotice("error", "动量轮动至少需要 2 只 ETF，用逗号分隔代码"); return; }
    var lmt = RANGES[document.getElementById("rangeSelect").value] || 750;
    var params = getParams();
    showNotice("info", "正在加载 " + codes.length + " 只 ETF 数据用于轮动回测…");
    Promise.all(codes.map(function (c) { return API.getKline(c, 101, lmt); })).then(function (res) {
      var datas = res.map(function (r) { return { code: r.code, name: r.name, bars: r.bars }; });
      var result = St.runMomentum(datas, params);
      // 基准：第一只 ETF 买入持有
      var bench = St.buyAndHold(datas[0].bars, params);
      var label = datas.map(function (d) { return d.name; }).join("、") + " · 动量轮动";
      renderResult(result, bench, label);
    }).catch(function () {
      showNotice("error", "轮动数据加载失败，请检查代码是否正确");
    });
  }

  function renderResult(result, bench, label) {
    var bars = stratBars || [];
    var m = St.metrics(result, bars, { initial: 100000 });
    var mb = St.metrics(bench, bars, { initial: 100000 });
    document.getElementById("resultLabel").textContent = label;

    var metrics = [
      { label: "策略总收益", value: (m.totalRet > 0 ? "+" : "") + m.totalRet + "%", cls: m.totalRet > 0 ? "up" : m.totalRet < 0 ? "down" : "" },
      { label: "买入持有", value: (mb.totalRet > 0 ? "+" : "") + mb.totalRet + "%", cls: mb.totalRet > 0 ? "up" : mb.totalRet < 0 ? "down" : "" },
      { label: "年化收益", value: (m.annual > 0 ? "+" : "") + m.annual + "%", cls: m.annual > 0 ? "up" : "down" },
      { label: "最大回撤", value: "-" + m.maxDD + "%", cls: "down" },
      { label: "夏普比率", value: m.sharpe, cls: m.sharpe >= 1 ? "up" : m.sharpe > 0 ? "flat" : "down" },
      { label: "胜率", value: m.winRate + "%", cls: m.winRate >= 50 ? "up" : "flat" },
      { label: "交易次数", value: m.trades + " 次", cls: "" },
      { label: "期末资产", value: fmtNum(m.finalValue) + " 元", cls: "" }
    ];
    document.getElementById("metricsGrid").innerHTML = metrics.map(function (x) {
      return '<div class="metric-cell"><div class="label">' + x.label + '</div><div class="value num ' + x.cls + '">' + x.value + "</div></div>";
    }).join("");

    // 净值曲线
    Chart.drawEquity(document.getElementById("equityChart"), [
      { name: "策略净值", color: "#2962ff", data: result.equity, width: 2 },
      { name: "买入持有", color: "#787b86", data: bench.equity }
    ]).catch(function () {});

    // 交易记录
    var trades = result.trades.filter(function (t) { return t.type === "sell"; }).slice(-20);
    var tw = document.getElementById("tradesWrap");
    if (trades.length) {
      tw.style.display = "block";
      document.getElementById("tradesTable").innerHTML = '<tr><th style="text-align:left">日期</th><th>类型</th><th>价格</th><th>单笔收益</th></tr>' +
        trades.reverse().map(function (t) {
          var cls = t.ret > 0 ? "up" : t.ret < 0 ? "down" : "flat";
          return "<tr><td style='text-align:left'>" + t.date + "</td><td>卖出</td><td class='num'>" + fmtPrice(t.price) + "</td>" +
            '<td class="num ' + cls + '">' + (t.ret >= 0 ? "+" : "") + (t.ret * 100).toFixed(2) + "%</td></tr>";
        }).join("");
    } else {
      tw.style.display = "none";
    }
    hideNotice();
  }

  function runCompare() {
    if (!stratBars || !stratBars.length) { showNotice("error", "请先加载 ETF 数据"); return; }
    var keys = Object.keys(St.STRATEGIES).filter(function (k) { return k !== "momentum"; });
    var results = {};
    keys.forEach(function (k) {
      var defs = {};
      St.STRATEGIES[k].params.forEach(function (p) { defs[p.key] = p.def; });
      defs.initial = 100000;
      results[k] = St.run(k, stratBars, defs);
    });
    var bench = St.buyAndHold(stratBars, { initial: 100000 });

    // 表格
    var rows = keys.map(function (k) {
      var m = St.metrics(results[k], stratBars, { initial: 100000 });
      return "<tr><td style='text-align:left'>" + St.STRATEGIES[k].name + "</td>" +
        '<td class="num ' + (m.totalRet > 0 ? "up" : "down") + '">' + (m.totalRet > 0 ? "+" : "") + m.totalRet + "%</td>" +
        '<td class="num">' + (m.annual > 0 ? "+" : "") + m.annual + "%</td>" +
        '<td class="num down">-' + m.maxDD + "%</td>" +
        '<td class="num">' + m.sharpe + "</td>" +
        '<td class="num">' + m.winRate + "%</td>" +
        '<td class="num">' + m.trades + "</td></tr>";
    }).join("");
    var mb = St.metrics(bench, stratBars, { initial: 100000 });
    rows += "<tr><td style='text-align:left'><b>买入持有</b></td>" +
      '<td class="num ' + (mb.totalRet > 0 ? "up" : "down") + '"><b>' + (mb.totalRet > 0 ? "+" : "") + mb.totalRet + "%</b></td>" +
      '<td class="num"><b>' + (mb.annual > 0 ? "+" : "") + mb.annual + "%</b></td>" +
      '<td class="num down"><b>-' + mb.maxDD + "%</b></td>" +
      '<td class="num"><b>' + mb.sharpe + "</b></td>" +
      '<td class="num"><b>' + mb.winRate + "%</b></td>" +
      '<td class="num"><b>-</b></td></tr>';

    document.getElementById("compareWrap").style.display = "block";
    document.getElementById("compareTable").innerHTML =
      "<tr><th style='text-align:left'>策略</th><th>总收益</th><th>年化</th><th>最大回撤</th><th>夏普</th><th>胜率</th><th>次数</th></tr>" + rows;

    // 对比图
    var colors = ["#2962ff", "#26a69a", "#f7b731", "#d24dff", "#f23645"];
    var series = keys.map(function (k, i) {
      return { name: St.STRATEGIES[k].name, color: colors[i % colors.length], data: results[k].equity };
    });
    series.push({ name: "买入持有", color: "#787b86", data: bench.equity });
    Chart.drawEquity(document.getElementById("compareChart"), series).catch(function () {});
    document.getElementById("compareChart").scrollIntoView({ behavior: "smooth" });
  }

  // =========================================================
  // 持仓管理（本地存储，类似同花顺持仓页）
  // =========================================================
  var STORE_PF = "pomelo_portfolio";
  var STORE_STYLE = "pomelo_style";
  var THEME_COLORS = {
    "半导体": "#f23645", "AI/软件": "#2962ff", "通信/5G": "#00b8d4",
    "新能源": "#26a69a", "机器人/制造": "#ff9800", "电子/消费电子": "#7aa2ff",
    "军工/航天": "#d24dff", "传媒/游戏": "#f7b731", "科创/宽基": "#089981",
    "其他": "#787b86"
  };

  // 不同风险风格的操作纪律
  var STYLE_OPS = {
    conservative: {
      rules: [
        "单一 ETF 仓位不超过 20%",
        "总仓位建议控制在 60% 以内，保留足够现金",
        "单只亏损超 10% 考虑止损",
        "优先科创宽基、通信等低波动主题",
        "止盈纪律：盈利超 20% 分批落袋，不贪"
      ],
      rhythm: "以定投为主：每周或每两周分批买入，越跌越买；单笔盈利超 20% 分批止盈落袋。",
      tiers: [
        { range: "盈利 +20% 以上", act: "分批止盈 1/3，落袋为安" },
        { range: "盈利 +10%~+20%", act: "继续持有，按计划定投" },
        { range: "亏损 -5%~-10%", act: "减仓 1/3，降低暴露" },
        { range: "亏损 -10% 以上", act: "止损离场，等待企稳" }
      ]
    },
    balanced: {
      rules: [
        "单一科技主题不超过 30%",
        "总仓位 60%~80%",
        "每月做一次再平衡：涨多的减一点、跌多的补一点",
        "单只亏损超 15% 重新评估逻辑",
        "回调加仓：跌 5% 补一次（不超计划仓位）"
      ],
      rhythm: "回调 5% 加仓一次（不超计划仓位）；盈利超 30% 启动移动止盈，回撤 10% 卖出。",
      tiers: [
        { range: "盈利 +30% 以上", act: "止盈 1/3，余仓移动止盈（回撤 10% 卖）" },
        { range: "盈利 +15%~+30%", act: "持有，回撤 12% 触发止盈" },
        { range: "亏损 -10%~-15%", act: "评估基本面，可逢低补 1/3" },
        { range: "亏损 -15% 以上", act: "止损离场，重新评估" }
      ]
    },
    aggressive: {
      rules: [
        "重仓半导体/AI 主线，但至少分散 3 只 ETF",
        "均线保护：跌破 20 日均线减半仓，跌破 60 日均线清仓",
        "总仓位不超过 90%",
        "单笔止损 -15%，不补仓摊平",
        "仓位结构：核心仓（主线 2 只）60% + 卫星仓（波段 1~2 只）30% + 现金 10%",
        "加仓触发：放量突破 20 日新高时加核心仓；回踩 MA20 不破可低吸"
      ],
      rhythm: "趋势持有为主，移动止盈回撤阈值 10%~15%；大盘破位时整体降仓避险。",
      tiers: [
        { range: "盈利 +30% 以上", act: "止盈 1/2 锁利，余仓移动止盈（回撤 12% 卖）" },
        { range: "盈利 +15%~+30%", act: "持有，跌破 20 日线减半，回撤 15% 止盈" },
        { range: "盈利 0~+15%", act: "持有，跌破 20 日线减半仓" },
        { range: "亏损 0~-8%", act: "观察，不补仓摊平" },
        { range: "亏损 -8%~-15%", act: "减半仓，跌破 60 日线清仓" },
        { range: "亏损 -15% 以下", act: "无条件清仓止损，离场休息" }
      ]
    },
    extreme: {
      rules: [
        "集中 2~3 只高弹性 ETF 即可",
        "只使用可长期不动的闲钱",
        "单笔止损 -10%，无条件执行",
        "可用网格交易高抛低吸",
        "总仓位 100% 满仓可用，但单笔亏损绝不补仓摊平",
        "强势期用移动止盈，弱势期切网格或空仓等待"
      ],
      rhythm: "波段 + 网格结合：盈利 +30% 至少止盈一半；亏损 -10% 坚决止损，绝不补仓摊平。",
      tiers: [
        { range: "盈利 +30% 以上", act: "止盈 1/2 以上，余仓转网格高抛低吸" },
        { range: "盈利 +15%~+30%", act: "持有，移动止盈回撤 10% 卖出" },
        { range: "盈利 0~+15%", act: "持有，跌破 10 日线减半" },
        { range: "亏损 0~-5%", act: "观察，准备离场信号" },
        { range: "亏损 -5%~-10%", act: "无条件止损，绝不等反弹" },
        { range: "亏损 -10% 以下", act: "已破止损线，清仓并休息一周" }
      ]
    }
  };

  function loadPortfolio() {
    try { return JSON.parse(localStorage.getItem(STORE_PF)) || []; } catch (e) { return []; }
  }
  function savePortfolio(list) { localStorage.setItem(STORE_PF, JSON.stringify(list)); }
  function loadStylePref() { return localStorage.getItem(STORE_STYLE) || "balanced"; }
  function saveStylePref(k) { localStorage.setItem(STORE_STYLE, k); }

  function initPortfolio() {
    renderStyleChips();
    bindPortfolioForm();
    initWatchlist().then(function () { renderWatchlist(); });
    renderPortfolio();
  }

  function renderStyleChips() {
    var wrap = document.getElementById("styleChips");
    if (!wrap) return;
    var pref = loadStylePref();
    wrap.innerHTML = RISK_STYLES.map(function (s) {
      return '<button class="style-chip' + (s.key === pref ? " active" : "") + '" data-key="' + s.key + '" style="--rc:' + s.color + '">' +
        s.icon + " " + s.name + "</button>";
    }).join("");
    wrap.querySelectorAll(".style-chip").forEach(function (b) {
      b.addEventListener("click", function () {
        saveStylePref(b.getAttribute("data-key"));
        wrap.querySelectorAll(".style-chip").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        renderAdvice(loadPortfolio());
      });
    });
  }

  function bindPortfolioForm() {
    var btn = document.getElementById("pfAdd");
    if (btn) btn.addEventListener("click", addPosition);
  }

  function addPosition() {
    var code = document.getElementById("pfCode").value.trim();
    var shares = parseFloat(document.getElementById("pfShares").value);
    var cost = parseFloat(document.getElementById("pfCost").value);
    var date = document.getElementById("pfDate").value || new Date().toISOString().slice(0, 10);
    if (!/^\d{6}$/.test(code)) { showNotice("error", "请输入 6 位 ETF 代码"); return; }
    if (!(shares > 0)) { showNotice("error", "请输入有效的持仓数量（份）"); return; }
    if (!(cost > 0)) { showNotice("error", "请输入有效的成本价（元）"); return; }
    var list = loadPortfolio();
    if (list.some(function (p) { return p.code === code; })) {
      showNotice("error", "该 ETF 已在持仓中，可用下方「调整」修改数量或成本");
      return;
    }
    var name = code;
    showNotice("info", "正在获取 " + code + " 信息…");
    API.getQuote(code).then(function (q) {
      name = q.name || code;
    }).catch(function () {
      return API.loadSnapshot().then(function (snap) {
        if (snap) {
          var f = snap.list.filter(function (x) { return x.code === code; })[0];
          if (f) name = f.name;
        }
      });
    }).then(function () {
      list.push({ code: code, name: name, shares: shares, cost: cost, date: date, lastPrice: cost, lastPct: 0 });
      savePortfolio(list);
      syncPortfolio();
      document.getElementById("pfCode").value = "";
      document.getElementById("pfShares").value = "";
      document.getElementById("pfCost").value = "";
      hideNotice();
      renderPortfolio();
    });
  }

  function removePosition(code) {
    var list = loadPortfolio().filter(function (p) { return p.code !== code; });
    savePortfolio(list);
    syncPortfolio();
    renderPortfolio();
  }

  function adjustPosition(code) {
    var list = loadPortfolio();
    var p = list.filter(function (x) { return x.code === code; })[0];
    if (!p) return;
    var shares = window.prompt("调整持仓数量（份），当前：" + p.shares, p.shares);
    if (shares === null) return;
    shares = parseFloat(shares);
    var cost = window.prompt("调整成本价（元），当前：" + p.cost, p.cost);
    if (cost === null) return;
    cost = parseFloat(cost);
    if (shares > 0) p.shares = shares;
    if (cost > 0) p.cost = cost;
    savePortfolio(list);
    syncPortfolio();
    renderPortfolio();
  }

  function refreshPortfolio() {
    return renderPortfolio();
  }

  function renderPortfolio() {
    var list = loadPortfolio();
    var empty = document.getElementById("pfEmpty");
    var wrap = document.getElementById("pfTableWrap");
    var summary = document.getElementById("pfSummary");
    var alloc = document.getElementById("allocChart");
    if (!list.length) {
      if (empty) empty.style.display = "block";
      if (wrap) wrap.style.display = "none";
      if (summary) summary.innerHTML = '<div class="stat-cell" style="grid-column:1/-1"><div class="label">暂无持仓</div><div class="value" style="font-size:14px;font-family:inherit">在上方添加第一笔持仓后，这里会显示组合盈亏</div></div>';
      if (alloc) alloc.innerHTML = '<div class="muted" style="padding:80px 0;text-align:center">暂无持仓数据</div>';
      renderAdvice(list);
      return Promise.resolve();
    }

    var jobs = list.map(function (p) {
      return API.getQuote(p.code).then(function (q) {
        p.lastPrice = q.price;
        p.lastPct = q.pct;
        if (!p.name || p.name === p.code) p.name = q.name || p.code;
        return p;
      }).catch(function () { return p; });
    });

    // 深度量化评分（拉K线计算，失败则降级为轻量评分）
    var scoreJobs = list.map(function (p) {
      return API.getKline(p.code, 101, 250).then(function (res) {
        var sc = St.score(res.bars);
        p.deepScore = sc ? sc.value : null;
        return p;
      }).catch(function () {
        p.deepScore = null;
        return p;
      });
    });

    return Promise.all(jobs.concat(scoreJobs)).then(function (updated) {
      savePortfolio(updated);
      renderPortfolioTable(updated);
      renderPortfolioSummary(updated);
      renderAllocChart(updated);
      renderAdvice(updated);
      subscribeWS(updated.map(function (p) { return p.code; }));
      if (empty) empty.style.display = "none";
      if (wrap) wrap.style.display = "block";
    }).catch(function () {});
  }

  function renderPortfolioTable(list) {
    var t = document.getElementById("pfTable");
    if (!t) return;
    t.innerHTML =
      "<tr><th style='text-align:left'>名称/代码</th><th>数量(份)</th><th>成本价</th><th>现价</th><th>当日涨跌</th><th>市值</th><th>浮动盈亏</th><th>盈亏比例</th><th>今日盈亏</th><th>量化评分</th><th>操作</th></tr>" +
      list.map(function (p) {
        var price = p.lastPrice || p.cost;
        var pnl = (price - p.cost) * p.shares;
        var pnlPct = (price / p.cost - 1) * 100;
        var todayPnl = price * p.shares * (p.lastPct || 0) / 100;
        var pnlCls = pnl > 0 ? "up" : pnl < 0 ? "down" : "flat";
        var scoreTxt = "-", scoreCls = "flat";
        if (p.deepScore !== undefined && p.deepScore !== null) {
          scoreTxt = p.deepScore;
          scoreCls = p.deepScore >= 70 ? "up" : p.deepScore >= 55 ? "accent" : p.deepScore >= 40 ? "flat" : "down";
        }
        return "<tr>" +
          '<td style="text-align:left"><span class="name-cell" style="cursor:pointer" data-goto="' + p.code + '">' + esc(p.name) + '</span><span class="num code-cell" style="margin-left:8px">' + p.code + "</span></td>" +
          '<td class="num">' + p.shares.toLocaleString() + "</td>" +
          '<td class="num">' + p.cost.toFixed(3) + "</td>" +
          '<td class="num">' + price.toFixed(3) + "</td>" +
          '<td class="num ' + pctClass(p.lastPct || 0) + '">' + fmtPct(p.lastPct || 0) + "</td>" +
          '<td class="num">' + fmtNum(price * p.shares) + "</td>" +
          '<td class="num ' + pnlCls + '">' + (pnl >= 0 ? "+" : "") + fmtNum(pnl) + "</td>" +
          '<td class="num ' + pnlCls + '">' + (pnlPct >= 0 ? "+" : "") + pnlPct.toFixed(2) + "%</td>" +
          '<td class="num ' + pctClass(todayPnl) + '">' + (todayPnl >= 0 ? "+" : "") + fmtNum(todayPnl) + "</td>" +
          '<td class="num"><span class="score-chip ' + scoreCls + '">' + scoreTxt + "</span></td>" +
          '<td><button class="btn btn-ghost btn-sm" data-act="adj" data-code="' + p.code + '">调整</button> ' +
          '<button class="btn btn-ghost btn-sm" data-act="del" data-code="' + p.code + '">删除</button></td>' +
          "</tr>";
      }).join("");
    t.querySelectorAll("[data-goto]").forEach(function (el) {
      el.addEventListener("click", function () { window.location.href = "etf.html?code=" + el.getAttribute("data-goto"); });
    });
    t.querySelectorAll("[data-act]").forEach(function (b) {
      b.addEventListener("click", function () {
        var code = b.getAttribute("data-code");
        if (b.getAttribute("data-act") === "del") removePosition(code);
        else adjustPosition(code);
      });
    });
  }

  function renderPortfolioSummary(list) {
    var el = document.getElementById("pfSummary");
    if (!el) return;
    var mv = 0, cost = 0, today = 0;
    list.forEach(function (p) {
      var price = p.lastPrice || p.cost;
      mv += price * p.shares;
      cost += p.cost * p.shares;
      today += price * p.shares * (p.lastPct || 0) / 100;
    });
    var pnl = mv - cost;
    var pnlPct = cost > 0 ? pnl / cost * 100 : 0;
    var cells = [
      { label: "总市值", value: fmtNum(mv) + " 元", cls: "" },
      { label: "总成本", value: fmtNum(cost) + " 元", cls: "" },
      { label: "浮动盈亏", value: (pnl >= 0 ? "+" : "") + fmtNum(pnl) + " 元", cls: pnl > 0 ? "up" : pnl < 0 ? "down" : "" },
      { label: "盈亏比例", value: (pnlPct >= 0 ? "+" : "") + pnlPct.toFixed(2) + "%", cls: pnlPct > 0 ? "up" : pnlPct < 0 ? "down" : "" },
      { label: "今日盈亏", value: (today >= 0 ? "+" : "") + fmtNum(today) + " 元", cls: today > 0 ? "up" : today < 0 ? "down" : "" },
      { label: "持仓数量", value: list.length + " 只", cls: "" }
    ];
    el.innerHTML = cells.map(function (c) {
      return '<div class="stat-cell"><div class="label">' + c.label + '</div><div class="value num ' + c.cls + '">' + c.value + "</div></div>";
    }).join("");
  }

  function renderAllocChart(list) {
    var byTheme = {};
    list.forEach(function (p) {
      var price = p.lastPrice || p.cost;
      var theme = API.themeOf(p.name) || "其他";
      byTheme[theme] = (byTheme[theme] || 0) + price * p.shares;
    });
    var entries = Object.keys(byTheme).map(function (k) {
      return { name: k, value: Math.round(byTheme[k]), itemStyle: { color: THEME_COLORS[k] || "#787b86" } };
    });
    Chart.drawDonut(document.getElementById("allocChart"), entries).catch(function () {});
    var legend = document.getElementById("allocLegend");
    if (legend) {
      var total = entries.reduce(function (s, e) { return s + e.value; }, 0);
      legend.innerHTML = entries.map(function (e) {
        var pct = total ? (e.value / total * 100).toFixed(1) : 0;
        return '<div class="alloc-legend-item"><span class="dot" style="background:' + e.itemStyle.color + '"></span>' +
          e.name + ' <span class="num muted">' + fmtNum(e.value) + " 元 · " + pct + "%</span></div>";
      }).join("");
    }
  }

  function renderAdvice(list) {
    var styleKey = loadStylePref();
    var style = RISK_STYLES.filter(function (s) { return s.key === styleKey; })[0] || RISK_STYLES[1];
    var ops = STYLE_OPS[styleKey] || STYLE_OPS.balanced;
    var nameEl = document.getElementById("adviceStyleName");
    if (nameEl) nameEl.textContent = "当前风格：" + style.icon + " " + style.name + " · " + style.tagline;

    var rules = document.getElementById("adviceRules");
    if (rules) rules.innerHTML = ops.rules.map(function (r) { return "<li>" + r + "</li>"; }).join("");
    var rhythm = document.getElementById("adviceRhythm");
    if (rhythm) rhythm.textContent = ops.rhythm;

    // 分档操作表
    var tiers = document.getElementById("adviceTiers");
    if (tiers) {
      if (ops.tiers && ops.tiers.length) {
        tiers.style.display = "block";
        tiers.innerHTML =
          '<div class="tier-head"><h3>🎚️ 分档操作表（按持仓盈亏）</h3>' +
          '<span class="sub">' + style.name + "专属 · 触发即执行</span></div>" +
          '<table class="data-table"><tr><th style="text-align:left">持仓盈亏区间</th><th style="text-align:left">应执行操作</th></tr>' +
          ops.tiers.map(function (t) {
            var cls = t.range.indexOf("盈利") >= 0 ? "up" : "down";
            return "<tr><td class='num " + cls + "'>" + t.range + '</td><td style="text-align:left">' + t.act + "</td></tr>";
          }).join("") +
          "</table>";
      } else {
        tiers.style.display = "none";
      }
    }

    var feat = document.getElementById("pfFeature");
    if (feat && list && list.length) {
      var total = 0;
      list.forEach(function (p) { total += (p.lastPrice || p.cost) * p.shares; });
      var maxW = 0;
      list.forEach(function (p) { maxW = Math.max(maxW, (p.lastPrice || p.cost) * p.shares / total); });
      var conc = maxW > 0.6 ? "非常高" : maxW > 0.4 ? "较高" : maxW > 0.25 ? "中等" : "分散";
      var vibe = maxW > 0.6 ? "非常激进" : maxW > 0.4 ? "激进" : list.length >= 4 ? "平衡/稳健" : "偏激进";
      feat.style.display = "block";
      feat.innerHTML = "当前组合特征：持仓 " + list.length + " 只，最大单一持仓占比 " + (maxW * 100).toFixed(0) + "%，集中度" + conc + "，风格更接近「" + vibe + "」。" +
        (vibe !== style.name ? ' 与你当前选择的「' + style.name + '」不完全匹配，建议调整风格或仓位配置。' : " 与你当前选择的风格匹配。");
    } else if (feat) {
      feat.style.display = "none";
    }

    var at = document.getElementById("adviceTable");
    if (!at) return;
    if (!list || !list.length) {
      at.innerHTML = '<tr><td class="empty-row" colspan="3" style="text-align:center">添加持仓后显示逐笔建议</td></tr>';
      return;
    }
    at.innerHTML = "<tr><th style='text-align:left'>持仓</th><th>盈亏比例</th><th>操作建议</th></tr>" +
      list.map(function (p) {
        var price = p.lastPrice || p.cost;
        var pnlPct = (price / p.cost - 1) * 100;
        var advice = positionAdvice(pnlPct, styleKey);
        return "<tr><td style='text-align:left'>" + esc(p.name) + ' <span class="num code-cell">' + p.code + "</span></td>" +
          '<td class="num ' + (pnlPct >= 0 ? "up" : "down") + '">' + (pnlPct >= 0 ? "+" : "") + pnlPct.toFixed(2) + "%</td>" +
          "<td>" + advice + "</td></tr>";
      }).join("");
  }

  function positionAdvice(pnl, styleKey) {
    if (styleKey === "conservative") {
      if (pnl >= 20) return "盈利达标，分批止盈落袋";
      if (pnl >= 0) return "持有观察，按计划继续定投";
      if (pnl >= -10) return "小幅亏损，控制仓位观察";
      return "亏损超10%，建议止损离场";
    }
    if (styleKey === "balanced") {
      if (pnl >= 30) return "盈利丰厚，启动移动止盈";
      if (pnl >= 0) return "持有，回调可分批补仓";
      if (pnl >= -15) return "亏损中，逢低分批补仓摊薄";
      return "亏损较大，重新评估基本面";
    }
    if (styleKey === "aggressive") {
      if (pnl >= 30) return "止盈 1/2 锁利，余仓移动止盈（回撤 12% 卖）";
      if (pnl >= 15) return "持有，跌破 20 日线减半，回撤 15% 止盈";
      if (pnl >= 0) return "持有，跌破 20 日线减半仓";
      if (pnl >= -8) return "观察，不补仓摊平";
      if (pnl >= -15) return "减半仓，跌破 60 日线清仓";
      return "无条件清仓止损，离场休息";
    }
    if (pnl >= 30) return "止盈 1/2 以上，余仓转网格高抛低吸";
    if (pnl >= 15) return "持有，移动止盈回撤 10% 卖出";
    if (pnl >= 0) return "持有，跌破 10 日线减半";
    if (pnl >= -5) return "观察，准备离场信号";
    if (pnl >= -10) return "无条件止损，绝不等反弹";
    return "已破止损线，清仓并休息一周";
  }

  window.POMELO.removePosition = removePosition;
  window.POMELO.adjustPosition = adjustPosition;

  // =========================================================
  // 后端集成：登录 / 云同步 / 自选股 / WebSocket 实时行情
  // =========================================================
  var API_BASE = (window.POMELO_CONFIG && window.POMELO_CONFIG.apiBase) || "";
  var TOKEN_KEY = "pomelo_token";
  var WL_KEY = "pomelo_watchlist";
  var authToken = localStorage.getItem(TOKEN_KEY) || "";
  var currentUser = null;
  var watchlist = [];
  var ws = null;
  var wsSubscribed = {};

  function hasBackend() { return !!API_BASE; }

  function authFetch(path, opts) {
    opts = opts || {};
    opts.headers = opts.headers || {};
    if (authToken) opts.headers.Authorization = "Bearer " + authToken;
    if (opts.body) opts.headers["Content-Type"] = "application/json";
    return fetch(API_BASE + path, opts).then(function (r) {
      return r.json().then(function (d) {
        if (!r.ok) throw new Error(d.error || ("HTTP " + r.status));
        return d;
      });
    });
  }

  function initUserBox() {
    var box = document.getElementById("userBox");
    if (!box) return;
    if (!hasBackend()) {
      // 纯静态模式：直连公开行情接口，无需服务器
      box.innerHTML = '<span class="muted" style="font-size:12px" title="直接调用公开行情接口，无需服务器">接口直连</span>';
      return;
    }
    if (authToken) {
      authFetch("/api/auth/me").then(function (u) {
        currentUser = u;
        box.innerHTML = '<span class="user-name">👤 ' + esc(u.username) + '</span>' +
          '<button class="btn btn-ghost btn-sm" id="btnLogout">退出</button>';
        var lo = document.getElementById("btnLogout");
        if (lo) lo.addEventListener("click", logout);
        onUserReady();
      }).catch(function () {
        authToken = "";
        localStorage.removeItem(TOKEN_KEY);
        renderLoginBtn(box);
      });
    } else {
      renderLoginBtn(box);
    }
  }

  function renderLoginBtn(box) {
    box.innerHTML = '<button class="btn btn-ghost btn-sm" id="btnLogin">登录 / 注册</button>';
    var b = document.getElementById("btnLogin");
    if (b) b.addEventListener("click", showAuthModal);
  }

  function onUserReady() {
    var page = document.body.getAttribute("data-page");
    if (page === "portfolio") {
      syncCloudToLocal().then(function () { renderPortfolio(); renderWatchlist(); });
    }
  }

  function logout() {
    authToken = "";
    currentUser = null;
    localStorage.removeItem(TOKEN_KEY);
    initUserBox();
    var page = document.body.getAttribute("data-page");
    if (page === "portfolio") { renderPortfolio(); renderWatchlist(); }
  }

  function showAuthModal() {
    var modal = document.createElement("div");
    modal.className = "modal-mask";
    modal.innerHTML =
      '<div class="modal-box">' +
      '<button class="modal-close" id="modalClose">✕</button>' +
      '<h3>登录 / 注册</h3>' +
      '<p class="muted" style="font-size:12px;margin-bottom:14px">注册后持仓与自选云端同步，换设备不丢失</p>' +
      '<div class="tabs" id="authTabs" style="margin-bottom:14px">' +
      '<button data-mode="login" class="active">登录</button><button data-mode="register">注册</button></div>' +
      '<input type="text" id="authUser" placeholder="用户名（2-20位）" style="width:100%;margin-bottom:10px">' +
      '<input type="password" id="authPass" placeholder="密码（至少6位）" style="width:100%;margin-bottom:10px">' +
      '<div class="auth-error" id="authError"></div>' +
      '<button class="btn btn-accent btn-block" id="authSubmit">登录</button>' +
      "</div>";
    document.body.appendChild(modal);
    var mode = "login";
    modal.querySelectorAll("#authTabs button").forEach(function (b) {
      b.addEventListener("click", function () {
        mode = b.getAttribute("data-mode");
        modal.querySelectorAll("#authTabs button").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        document.getElementById("authSubmit").textContent = mode === "login" ? "登录" : "注册";
      });
    });
    document.getElementById("modalClose").addEventListener("click", function () { modal.remove(); });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.remove(); });
    document.getElementById("authSubmit").addEventListener("click", function () {
      var username = document.getElementById("authUser").value.trim();
      var password = document.getElementById("authPass").value;
      var err = document.getElementById("authError");
      err.textContent = "";
      authFetch("/api/auth/" + mode, {
        method: "POST",
        body: JSON.stringify({ username: username, password: password })
      }).then(function (d) {
        authToken = d.token;
        currentUser = d.user;
        localStorage.setItem(TOKEN_KEY, authToken);
        modal.remove();
        return pushLocalToCloud().then(function () {
          initUserBox();
          var page = document.body.getAttribute("data-page");
          if (page === "portfolio") {
            syncCloudToLocal().then(function () { renderPortfolio(); renderWatchlist(); });
          }
          showNotice("info", "已登录：" + d.user.username + "，持仓与自选已云同步");
        });
      }).catch(function (e) {
        err.textContent = e.message;
      });
    });
  }

  // ---------- 持仓云同步 ----------
  function pushLocalToCloud() {
    if (!authToken) return Promise.resolve();
    return authFetch("/api/portfolio", { method: "PUT", body: JSON.stringify(loadPortfolio()) })
      .catch(function () {});
  }

  function syncCloudToLocal() {
    if (!authToken) return Promise.resolve();
    return authFetch("/api/portfolio").then(function (d) {
      if (!d || !d.list) return;
      var merged = loadPortfolio();
      d.list.forEach(function (cp) {
        if (!merged.some(function (p) { return p.code === cp.code; })) merged.push(cp);
      });
      savePortfolio(merged);
      return authFetch("/api/portfolio", { method: "PUT", body: JSON.stringify(merged) }).catch(function () {});
    }).catch(function () {});
  }

  function syncPortfolio() {
    if (authToken) pushLocalToCloud();
  }

  // ---------- 自选股 ----------
  function initWatchlist() {
    if (!authToken) {
      try { watchlist = JSON.parse(localStorage.getItem(WL_KEY)) || []; } catch (e) { watchlist = []; }
      return Promise.resolve();
    }
    return authFetch("/api/watchlist").then(function (d) {
      watchlist = (d && d.list) || [];
    }).catch(function () { watchlist = []; });
  }

  function toggleWatch(code) {
    var i = watchlist.indexOf(code);
    if (i >= 0) watchlist.splice(i, 1); else watchlist.push(code);
    if (authToken) {
      authFetch("/api/watchlist", { method: "PUT", body: JSON.stringify(watchlist) }).catch(function () {});
    } else {
      localStorage.setItem(WL_KEY, JSON.stringify(watchlist));
    }
    return watchlist.indexOf(code) >= 0;
  }

  function renderWatchlist() {
    var box = document.getElementById("watchlistBox");
    if (!box) return;
    if (!watchlist.length) {
      box.innerHTML = '<span class="muted" style="font-size:13px">暂无自选，去 ETF 详情页点 ☆ 添加</span>';
      return;
    }
    box.innerHTML = watchlist.map(function (code) {
      return '<a class="pick-chip" href="etf.html?code=' + code + '"><span class="num">' + code + "</span></a>";
    }).join("");
  }

  function initStar() {
    var btn = document.getElementById("btnStar");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var on = toggleWatch(currentCode);
      btn.textContent = on ? "★ 已自选" : "☆ 自选";
      btn.classList.toggle("star-on", on);
    });
  }

  // ---------- WebSocket 实时行情 ----------
  function initWS() {
    if (!hasBackend() || !("WebSocket" in window)) return;
    var url = API_BASE.replace(/^http/, "ws") + "/ws";
    try { ws = new WebSocket(url); } catch (e) { return; }
    ws.onopen = function () {
      var codes = Object.keys(wsSubscribed).filter(function (c) { return wsSubscribed[c]; });
      if (codes.length) sendWS({ action: "subscribe", codes: codes });
    };
    ws.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (e) { return; }
      if (msg.type === "quote" && msg.data) onWSQuote(msg.data);
    };
    ws.onclose = function () { setTimeout(initWS, 10000); };
    ws.onerror = function () { try { ws.close(); } catch (e) {} };
  }

  function sendWS(obj) {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
  }

  function subscribeWS(codes) {
    var changed = [];
    codes.forEach(function (c) {
      if (!wsSubscribed[c]) { wsSubscribed[c] = true; changed.push(c); }
    });
    if (changed.length && ws && ws.readyState === 1) {
      sendWS({ action: "subscribe", codes: changed });
    }
  }

  function onWSQuote(q) {
    var page = document.body.getAttribute("data-page");
    if (page === "index") {
      // 精选推荐卡片
      document.querySelectorAll('.index-card[data-code="' + q.code + '"]').forEach(function (card) {
        var pe = card.querySelector("[data-price]");
        if (pe) pe.textContent = fmtPrice(q.price);
        var pc = card.querySelector("[data-pct]");
        if (pc) { pc.textContent = fmtPct(q.pct); pc.className = "idx-chg num " + pctClass(q.pct); }
      });
      // 行情列表行
      var tr = document.querySelector('tr[data-code="' + q.code + '"]');
      if (tr) {
        var pr = tr.querySelector('[data-f="price"]');
        if (pr) pr.textContent = fmtPrice(q.price);
        var pc2 = tr.querySelector('[data-f="pct"]');
        if (pc2) { pc2.textContent = fmtPct(q.pct); pc2.className = "num " + pctClass(q.pct); }
      }
    } else if (page === "etf") {
      if (q.code === currentCode) {
        var priceEl = document.getElementById("price");
        if (priceEl) { priceEl.textContent = fmtPrice(q.price); priceEl.className = "price num " + pctClass(q.pct); }
        var chgEl = document.getElementById("chg");
        if (chgEl) {
          chgEl.textContent = (q.chg >= 0 ? "+" : "") + fmtPrice(q.chg) + "　" + fmtPct(q.pct);
          chgEl.className = "chg num " + pctClass(q.pct);
        }
      }
    } else if (page === "portfolio") {
      var list = loadPortfolio();
      var p = list.filter(function (x) { return x.code === q.code; })[0];
      if (p) {
        p.lastPrice = q.price;
        p.lastPct = q.pct;
        savePortfolio(list);
        renderPortfolioTable(list);
        renderPortfolioSummary(list);
        renderAdvice(list);
      }
    }
  }

  // =========================================================
  // 刷新数据
  // =========================================================
  function setUpdatedAt() {
    var el = document.getElementById("updatedAt");
    if (el) {
      el.textContent = "更新于 " + new Date().toLocaleTimeString("zh-CN", { hour12: false });
    }
  }

  function refreshIndex() {
    renderTopPicks();
    loadIndexes();
    return loadETFTable();
  }

  function refreshETF() {
    loadQuote();
    return loadKline(currentPeriod);
  }

  function refreshStrategy() {
    if (!stratData) return Promise.resolve();
    return loadStrategyData(stratData.code).then(function () {
      // 数据更新后自动重跑当前策略回测，确保结果基于最新数据
      if (stratBars && stratBars.length) runBacktest();
    });
  }

  function bindRefresh() {
    var btn = document.getElementById("btnRefresh");
    if (!btn) return;
    btn.addEventListener("click", function () {
      if (btn.disabled) return;
      var page = document.body.getAttribute("data-page");
      // 静态页（数据说明等）：直接重新加载页面
      if (page === "about") { window.location.reload(); return; }
      btn.disabled = true;
      var original = btn.innerHTML;
      btn.innerHTML = "刷新中…";
      var job = page === "index" ? refreshIndex()
        : page === "etf" ? refreshETF()
        : page === "strategy" ? refreshStrategy()
        : page === "portfolio" ? refreshPortfolio()
        : Promise.resolve();
      Promise.resolve(job).catch(function () {}).then(function () {
        btn.disabled = false;
        btn.innerHTML = original;
        setUpdatedAt();
      });
    });
    setUpdatedAt();
  }

  // =========================================================
  // 启动
  // =========================================================
  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    var page = document.body.getAttribute("data-page");
    if (page === "index") { initIndex(); initETFTools(); }
    if (page === "etf") initETF();
    if (page === "strategy") initStrategy();
    if (page === "portfolio") initPortfolio();
    bindRefresh();
    initWS();
  });
})();
