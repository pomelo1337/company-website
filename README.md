# POMELO 科技ETF 量化分析

A股 **科技主题 ETF** 综合量化分析平台。**纯静态站点，无需服务器**，GitHub Pages 托管。

## 功能

- **科技 ETF 专区** (`index.html`)：⭐ 精选科技 ETF 推荐（实时价格）、科技相关指数、471 只科技 ETF 行情列表（9 大主题筛选/搜索/排序/分页）、涨跌分布、🎯 风险风格配置（稳健/平衡/激进/非常激进）
- **ETF 详情** (`etf.html?code=512480`)：实时快照、日/周/月 K 线（MA+成交量+MACD）、技术指标信号、综合量化评分、🔬 深度分析（区间位置/多周期涨幅/波动率/均线结构/自动解读）
- **策略实验室** (`strategy.html`)：9 种策略（定投/智能定投/双均线/均线保护/移动止盈/RSI反转/布林突破/网格/动量轮动），每个策略配白话说明与适合人群，输出收益/年化/回撤/夏普/胜率/净值曲线，支持横向对比
- **持仓管理** (`portfolio.html`)：同花顺风格持仓页（组合盈亏/持仓明细/仓位主题分布/逐笔操作建议），数据保存在本机浏览器
- **数据说明** (`about.html`)：数据来源与免责声明

## 架构（纯静态，零服务器）

```
浏览器 → 东方财富公开行情接口（直连，无需服务器）
         └── 降级链路：直连 → JSONP → 本地快照 (data/etf-snapshot.json)
```

- 行情/K线/指数：浏览器直接调用东方财富公开接口
- 持仓/自选：保存在浏览器 localStorage（本机）
- 指标/评分/回测：浏览器本地计算
- 图表：ECharts 5（BootCDN → jsDelivr → unpkg → 本地备份）

## 本地预览

```bash
python -m http.server 8000   # 或任意静态服务器
# 访问 http://localhost:8000
```

## 文件结构

```
├── index.html / etf.html / strategy.html / portfolio.html / about.html
├── assets/
│   ├── css/style.css
│   ├── js/config.js          # 全局配置（apiBase 留空 = 纯静态直连模式）
│   ├── js/data.js            # 数据层（直连 → JSONP → 快照）
│   ├── js/strategy.js        # 指标 + 回测引擎 + 9 策略
│   ├── js/charts.js          # ECharts 封装
│   ├── js/main.js            # 页面逻辑
│   └── vendor/echarts.min.js
└── data/etf-snapshot.json    # 科技 ETF 快照（离线降级）
```

## 免责声明

本站所有内容仅供量化学习研究，不构成投资建议。股市有风险，投资需谨慎。
