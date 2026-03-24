# QQQ Portfolio Lab

一个静态的 `QQQ + 现金` 回测网页，适合直接部署到 GitHub Pages，也支持本地直接打开 `index.html` 预览。

## 功能

- 支持 `QQQ / 现金` 比例配置，滑杆和数字输入同步联动。
- 支持起始资金、开始年份、结束年份设置。
- 支持每月或每年的定投 / 提取。
- 支持年度再平衡。
- 所有金额统一用人民币符号显示。
- 输出净值曲线、关键绩效指标和年度资产明细表。

## 数据更新

在 PowerShell 中运行：

```powershell
.\scripts\refresh-qqq-data.ps1
```

运行后会同时更新：

- `data/qqq-monthly.json`
- `data/qqq-history.js`

说明：

- 历史数据使用 Yahoo Finance 的 QQQ 月度复权收盘价。
- 页面中的金额统一显示为人民币，但回测收益路径不做汇率换算。
- `qqq-history.js` 用于浏览器直接加载，保证本地双击打开页面时也能正常使用。

## GitHub Pages 发布

1. 将仓库推送到 GitHub。
2. 在仓库的 `Settings > Pages` 中确认来源使用 `GitHub Actions`。
3. 推送到 `main` 或 `master` 分支后，`.github/workflows/deploy.yml` 会自动部署静态站点。

本地如果想验证和线上一致的发布目录，可以运行：

```powershell
.\scripts\build-site.ps1
```

生成结果会输出到 `site/`，目录结构与 GitHub Pages 实际上传的 artifact 一致。

## 回测假设

- QQQ 使用 Yahoo Finance 的月度复权收盘价。
- 当前未结束月份不会写入本地数据文件。
- 现金收益率按 `0%` 处理。
- 定投 / 提取在执行月份的月底处理。
- 提取时优先使用现金，不足部分卖出 QQQ。
- 年度再平衡在 12 月月底、现金流之后执行。
