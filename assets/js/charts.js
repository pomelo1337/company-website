/* =========================================================
   POMELO ETF 量化 - 图表层 (ECharts)
   ========================================================= */

window.POMELO = window.POMELO || {};

(function () {
  "use strict";

  var echartsPromise = null;

  function loadEcharts() {
    if (echartsPromise) return echartsPromise;
    echartsPromise = new Promise(function (resolve, reject) {
      var urls = [
        "https://cdn.bootcdn.net/ajax/libs/echarts/5.5.1/echarts.min.js",
        "https://cdn.jsdelivr.net/npm/echarts@5.5.1/dist/echarts.min.js",
        "https://unpkg.com/echarts@5.5.1/dist/echarts.min.js",
        "assets/vendor/echarts.min.js"
      ];
      var idx = 0;

      function tryNext() {
        if (idx >= urls.length) { reject(new Error("ECharts 加载失败")); return; }
        var s = document.createElement("script");
        s.src = urls[idx++];
        s.onload = function () {
          if (window.echarts) resolve(window.echarts);
          else tryNext();
        };
        s.onerror = tryNext;
        document.head.appendChild(s);
      }
      tryNext();
    });
    return echartsPromise;
  }

  // 格式化工具
  function fmtAmount(v) {
    if (v === null || v === undefined) return "-";
    if (v >= 1e12) return (v / 1e12).toFixed(2) + " 万亿";
    if (v >= 1e8) return (v / 1e8).toFixed(2) + " 亿";
    if (v >= 1e4) return (v / 1e4).toFixed(2) + " 万";
    return v.toFixed(0);
  }

  var UP = "#f23645", DOWN = "#089981";

  // ---------- K线图 ----------
  // data: { bars:[{date,open,close,high,low,volume}], ma:{ma5,ma10,ma20,ma60}, macd:{dif,dea,hist} }
  function drawKline(el, data, opts) {
    opts = opts || {};
    var bars = data.bars;
    var dates = bars.map(function (b) { return b.date; });
    var ohlc = bars.map(function (b) { return [b.open, b.close, b.low, b.high]; });
    var vols = bars.map(function (b, i) {
      return { value: b.volume, itemStyle: { color: b.close >= b.open ? UP : DOWN } };
    });

    function maSeries(name, arr, color) {
      return {
        name: name, type: "line", data: arr, smooth: true, showSymbol: false,
        lineStyle: { width: 1, color: color }, itemStyle: { color: color },
        xAxisIndex: 0, yAxisIndex: 0, z: 3
      };
    }

    var series = [
      {
        name: "K线", type: "candlestick", data: ohlc,
        itemStyle: {
          color: UP, color0: DOWN, borderColor: UP, borderColor0: DOWN
        }
      }
    ];

    var legendData = ["K线"];
    var colors = ["#f7b731", "#26a69a", "#2962ff", "#d24dff"];
    if (data.ma) {
      var maKeys = ["ma5", "ma10", "ma20", "ma60"];
      maKeys.forEach(function (k, i) {
        if (data.ma[k]) {
          var label = k.toUpperCase();
          series.push(maSeries(label, data.ma[k], colors[i % colors.length]));
          legendData.push(label);
        }
      });
    }

    var macdData = null;
    if (data.macd) {
      macdData = {
        dif: data.macd.dif, dea: data.macd.dea,
        hist: data.macd.hist.map(function (v) {
          return { value: v, itemStyle: { color: v >= 0 ? UP : DOWN } };
        })
      };
      series.push({ name: "MACD", type: "bar", data: macdData.hist, xAxisIndex: 2, yAxisIndex: 2, barWidth: "60%" });
      series.push({ name: "DIF", type: "line", data: macdData.dif, showSymbol: false, lineStyle: { width: 1, color: "#f7b731" }, xAxisIndex: 2, yAxisIndex: 2, z: 3 });
      series.push({ name: "DEA", type: "line", data: macdData.dea, showSymbol: false, lineStyle: { width: 1, color: "#d24dff" }, xAxisIndex: 2, yAxisIndex: 2, z: 3 });
      legendData.push("MACD", "DIF", "DEA");
    }

    // 成交量
    series.push({ name: "成交量", type: "bar", data: vols, xAxisIndex: 1, yAxisIndex: 1, barWidth: "60%" });
    legendData.push("成交量");

    var option = {
      animation: false,
      backgroundColor: "transparent",
      legend: {
        data: legendData, top: 0, textStyle: { color: "#787b86", fontSize: 11 },
        selectedMode: true, itemWidth: 14, itemHeight: 8
      },
      tooltip: {
        trigger: "axis", axisPointer: { type: "cross" },
        backgroundColor: "#1a1f2e", borderColor: "#2a3142", textStyle: { color: "#d1d4dc", fontSize: 12 },
        formatter: function (ps) {
          var i = ps[0].dataIndex;
          var b = bars[i];
          var lines = ["<b>" + b.date + "</b>"];
          lines.push("开 " + b.open.toFixed(3) + "　收 " + b.close.toFixed(3));
          lines.push("高 " + b.high.toFixed(3) + "　低 " + b.low.toFixed(3));
          lines.push("量 " + fmtAmount(b.volume * 100));
          ps.forEach(function (p) {
            if (p.seriesName && p.seriesName !== "成交量" && p.seriesName !== "K线") {
              var v = typeof p.value === "number" ? p.value.toFixed(3) : p.value;
              lines.push(p.marker + p.seriesName + "　" + v);
            }
          });
          return lines.join("<br>");
        }
      },
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      grid: [
        { left: 60, right: 20, top: 30, height: "52%" },
        { left: 60, right: 20, top: "66%", height: "12%" },
        { left: 60, right: 20, top: "82%", height: "13%" }
      ],
      xAxis: [
        { type: "category", data: dates, boundaryGap: true, axisLine: { lineStyle: { color: "#2a3142" } }, axisLabel: { color: "#787b86", fontSize: 10 }, splitLine: { show: false }, min: "dataMin", max: "dataMax" },
        { type: "category", gridIndex: 1, data: dates, axisLine: { lineStyle: { color: "#2a3142" } }, axisLabel: { show: false }, splitLine: { show: false } },
        { type: "category", gridIndex: 2, data: dates, axisLine: { lineStyle: { color: "#2a3142" } }, axisLabel: { show: false }, splitLine: { show: false } }
      ],
      yAxis: [
        { scale: true, position: "left", axisLabel: { color: "#787b86", fontSize: 10, formatter: function (v) { return v.toFixed(2); } }, splitLine: { lineStyle: { color: "#1f2533" } } },
        { gridIndex: 1, axisLabel: { show: false }, splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false } },
        { gridIndex: 2, axisLabel: { color: "#787b86", fontSize: 10 }, splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false } }
      ],
      dataZoom: [
        { type: "inside", xAxisIndex: [0, 1, 2], start: opts.zoomStart !== undefined ? opts.zoomStart : 60, end: 100 },
        { type: "slider", xAxisIndex: [0, 1, 2], bottom: 2, height: 16, borderColor: "#2a3142", fillerColor: "rgba(41,98,255,0.15)", handleStyle: { color: "#2962ff" }, textStyle: { color: "#787b86", fontSize: 10 } }
      ],
      series: series
    };

    return loadEcharts().then(function (echarts) {
      var chart = echarts.getInstanceByDom(el) || echarts.init(el);
      chart.setOption(option, true);
      return chart;
    });
  }

  // ---------- 净值曲线 ----------
  // series: [{name, color, data:[{date, value}]}]
  function drawEquity(el, series) {
    var dates = series[0].data.map(function (d) { return d.date; });
    var option = {
      animation: false,
      backgroundColor: "transparent",
      legend: { top: 0, textStyle: { color: "#787b86", fontSize: 11 }, itemWidth: 14, itemHeight: 8 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#1a1f2e", borderColor: "#2a3142", textStyle: { color: "#d1d4dc", fontSize: 12 },
        valueFormatter: function (v) { return v.toFixed(2); }
      },
      grid: { left: 70, right: 20, top: 34, bottom: 40 },
      xAxis: {
        type: "category", data: dates,
        axisLine: { lineStyle: { color: "#2a3142" } }, axisLabel: { color: "#787b86", fontSize: 10 },
        splitLine: { show: false }
      },
      yAxis: {
        scale: true,
        axisLabel: { color: "#787b86", fontSize: 10 }, splitLine: { lineStyle: { color: "#1f2533" } }
      },
      dataZoom: [
        { type: "inside", start: 0, end: 100 },
        { type: "slider", bottom: 2, height: 16, borderColor: "#2a3142", fillerColor: "rgba(41,98,255,0.15)", handleStyle: { color: "#2962ff" }, textStyle: { color: "#787b86", fontSize: 10 } }
      ],
      series: series.map(function (s) {
        return {
          name: s.name, type: "line", data: s.data.map(function (d) { return d.value; }),
          showSymbol: false, lineStyle: { width: s.width || 1.5, color: s.color },
          itemStyle: { color: s.color }, areaStyle: s.area ? { opacity: 0.08, color: s.color } : undefined
        };
      })
    };
    return loadEcharts().then(function (echarts) {
      var chart = echarts.getInstanceByDom(el) || echarts.init(el);
      chart.setOption(option, true);
      return chart;
    });
  }

  // ---------- 涨跌分布 ----------
  function drawDistribution(el, counts) {
    var option = {
      animation: false,
      backgroundColor: "transparent",
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, backgroundColor: "#1a1f2e", borderColor: "#2a3142", textStyle: { color: "#d1d4dc" } },
      grid: { left: 70, right: 30, top: 10, bottom: 24 },
      xAxis: { type: "value", axisLabel: { color: "#787b86", fontSize: 10 }, splitLine: { lineStyle: { color: "#1f2533" } } },
      yAxis: {
        type: "category",
        data: ["下跌", "平盘", "上涨"],
        axisLine: { lineStyle: { color: "#2a3142" } }, axisLabel: { color: "#787b86", fontSize: 12 }
      },
      series: [{
        type: "bar",
        barWidth: 18,
        label: { show: true, position: "right", color: "#d1d4dc", fontSize: 12, formatter: "{c} 只" },
        itemStyle: { color: function (p) { return ["#089981", "#9598a1", "#f23645"][p.dataIndex]; } },
        data: [counts.down, counts.flat, counts.up]
      }]
    };
    return loadEcharts().then(function (echarts) {
      var chart = echarts.getInstanceByDom(el) || echarts.init(el);
      chart.setOption(option, true);
      return chart;
    });
  }

  // ---------- 环形图（仓位分布） ----------
  function drawDonut(el, data) {
    var option = {
      animation: true,
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        backgroundColor: "#1a1f2e", borderColor: "#2a3142", textStyle: { color: "#d1d4dc", fontSize: 12 },
        formatter: "{b}<br/>{c} 元（{d}%）"
      },
      legend: { bottom: 0, textStyle: { color: "#787b86", fontSize: 11 }, itemWidth: 12, itemHeight: 12 },
      series: [{
        type: "pie",
        radius: ["52%", "74%"],
        center: ["50%", "42%"],
        itemStyle: { borderRadius: 6, borderColor: "#131722", borderWidth: 2 },
        label: { show: false },
        data: data
      }]
    };
    return loadEcharts().then(function (echarts) {
      var chart = echarts.getInstanceByDom(el) || echarts.init(el);
      chart.setOption(option, true);
      return chart;
    });
  }

  window.POMELO.Chart = {
    load: loadEcharts,
    drawKline: drawKline,
    drawEquity: drawEquity,
    drawDistribution: drawDistribution,
    drawDonut: drawDonut,
    fmtAmount: fmtAmount
  };
})();
