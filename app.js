(function () {
  const dataset = window.__QQQ_MONTHLY_DATA__;
  const storageKey = "qqq-portfolio-lab-state-v4";

  const currencyFormatter = new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  });

  const percentFormatter = new Intl.NumberFormat("zh-CN", {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const numberFormatter = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const controls = {
    qqqRatio: document.querySelector("#qqqRatio"),
    qqqRatioInput: document.querySelector("#qqqRatioInput"),
    qqqRatioDisplay: document.querySelector("#qqqRatioDisplay"),
    cashRatioDisplay: document.querySelector("#cashRatioDisplay"),
    startCapital: document.querySelector("#startCapital"),
    startYear: document.querySelector("#startYear"),
    endYear: document.querySelector("#endYear"),
    cashFlowAmount: document.querySelector("#cashFlowAmount"),
    cashFlowFrequency: document.querySelector("#cashFlowFrequency"),
    cashYield: document.querySelector("#cashYield"),
    annualRebalance: document.querySelector("#annualRebalance"),
    runButton: document.querySelector("#runBacktestButton"),
    resetButton: document.querySelector("#resetButton"),
  };

  const elements = {
    datasetRange: document.querySelector("#datasetRange"),
    datasetUpdated: document.querySelector("#datasetUpdated"),
    datasetFx: document.querySelector("#datasetFx"),
    simulationNote: document.querySelector("#simulationNote"),
    validationBox: document.querySelector("#validationBox"),
    heroMetricStrip: document.querySelector("#heroMetricStrip"),
    statsGrid: document.querySelector("#statsGrid"),
    yearTableBody: document.querySelector("#yearTableBody"),
    chart: document.querySelector("#resultChart"),
    tooltip: document.querySelector("#chartTooltip"),
    chartEmptyState: document.querySelector("#chartEmptyState"),
  };

  const defaultState = {
    qqqRatio: 80,
    startCapital: 100000,
    cashFlowAmount: 0,
    cashFlowFrequency: "monthly",
    cashYield: 0,
    annualRebalance: "true",
  };

  if (!dataset || !Array.isArray(dataset.records) || dataset.records.length < 2) {
    elements.simulationNote.textContent = "数据未加载成功，请确认本地数据文件存在。";
    showValidation(["未找到可用的历史数据文件。"]);
    return;
  }

  const yearBounds = buildYearBounds(dataset.records);
  const availableYears = [...yearBounds.keys()];

  setupDatasetMeta(dataset.meta);
  initializeControls();
  attachEvents();
  runSimulation();

  function setupDatasetMeta(meta) {
    elements.datasetRange.textContent = `历史范围：${meta.startDate} 到 ${meta.endDate}`;
    elements.datasetUpdated.textContent = `数据更新时间：${meta.retrievedAt.slice(0, 10)}`;
    elements.datasetFx.textContent = "金额统一以人民币显示，不做汇率换算";
  }

  function initializeControls() {
    const savedState = loadState();
    const mergedState = { ...defaultState, ...savedState };
    const firstYear = availableYears[0];
    const lastYear = availableYears[availableYears.length - 1];

    controls.qqqRatio.value = String(mergedState.qqqRatio);
    controls.qqqRatioInput.value = String(mergedState.qqqRatio);
    controls.startCapital.value = String(mergedState.startCapital);
    controls.cashFlowAmount.value = String(mergedState.cashFlowAmount);
    controls.cashFlowFrequency.value = mergedState.cashFlowFrequency;
    controls.cashYield.value = String(mergedState.cashYield ?? 0);
    controls.annualRebalance.value = mergedState.annualRebalance;
    controls.startYear.innerHTML = availableYears.map((year) => `<option value="${year}">${year} 年</option>`).join("");
    controls.endYear.innerHTML = availableYears.map((year) => `<option value="${year}">${year} 年</option>`).join("");
    controls.startYear.value = String(mergedState.startYear || firstYear);
    controls.endYear.value = String(mergedState.endYear || lastYear);

    syncRatioDisplay(Number(mergedState.qqqRatio));
    setDirtyState(false);
  }

  function attachEvents() {
    controls.qqqRatio.addEventListener("input", () => {
      const value = clampRatio(controls.qqqRatio.value);
      controls.qqqRatioInput.value = String(value);
      syncRatioDisplay(value);
      setDirtyState(true);
    });

    controls.qqqRatioInput.addEventListener("input", () => {
      const value = clampRatio(controls.qqqRatioInput.value);
      controls.qqqRatioInput.value = String(value);
      controls.qqqRatio.value = String(value);
      syncRatioDisplay(value);
      setDirtyState(true);
    });

    [
      controls.startCapital,
      controls.startYear,
      controls.endYear,
      controls.cashFlowAmount,
      controls.cashFlowFrequency,
      controls.cashYield,
      controls.annualRebalance,
    ].forEach((control) => {
      control.addEventListener("input", () => setDirtyState(true));
      control.addEventListener("change", () => setDirtyState(true));
    });

    controls.runButton.addEventListener("click", runSimulation);
    controls.resetButton.addEventListener("click", () => {
      localStorage.removeItem(storageKey);
      initializeControls();
      runSimulation();
    });
  }

  function runSimulation() {
    const config = readConfig();
    const validationMessages = validateConfig(config);

    if (validationMessages.length) {
      showValidation(validationMessages);
      renderEmptyState();
      return;
    }

    hideValidation();
    const result = simulateBacktest(dataset.records, config);

    saveState(config);
    renderHeroMetrics(result.metrics);
    renderStats(result.metrics);
    renderYearTable(result.years);
    renderChart(result.timeline);

    const notes = [
      `区间 ${config.startYear} → ${config.endYear}`,
      `${result.timeline.length - 1} 个观测月`,
    ];

    if (result.depletedAt) {
      notes.push(`组合在 ${result.depletedAt} 被提取耗尽`);
    }

    elements.simulationNote.textContent = notes.join(" · ");
    setDirtyState(false);
  }

  function readConfig() {
    const startYear = Number(controls.startYear.value);
    const endYear = Number(controls.endYear.value);

    return {
      qqqRatio: clampRatio(controls.qqqRatio.value) / 100,
      startCapital: Math.max(0, Number(controls.startCapital.value) || 0),
      startYear,
      endYear,
      startDate: yearBounds.get(startYear).startDate,
      endDate: yearBounds.get(endYear).endDate,
      cashFlowAmount: Number(controls.cashFlowAmount.value) || 0,
      cashFlowFrequency: controls.cashFlowFrequency.value,
      cashYieldAnnual: (Number(controls.cashYield.value) || 0) / 100,
      annualRebalance: controls.annualRebalance.value === "true",
    };
  }

  function validateConfig(config) {
    const messages = [];

    if (config.startCapital < 0) {
      messages.push("起始资金不能小于 0。");
    }

    if (config.startYear > config.endYear) {
      messages.push("开始时间不能晚于结束时间。");
    }

    if (!yearBounds.has(config.startYear) || !yearBounds.has(config.endYear)) {
      messages.push("所选年份不在可回测范围内。");
    }

    if (!["monthly", "yearly"].includes(config.cashFlowFrequency)) {
      messages.push("现金流频率设置无效。");
    }

    if (!Number.isFinite(config.cashYieldAnnual) || config.cashYieldAnnual <= -1) {
      messages.push("现金年化收益率必须大于 -100%。");
    }

    return messages;
  }

  function setDirtyState(isDirty) {
    if (isDirty) {
      controls.runButton.classList.add("ready");
      elements.simulationNote.textContent = "参数已修改，点击“运行回测”更新结果。";
    } else {
      controls.runButton.classList.remove("ready");
    }
  }

  function syncRatioDisplay(qqqRatio) {
    controls.qqqRatioDisplay.textContent = `${qqqRatio}%`;
    controls.cashRatioDisplay.textContent = `${100 - qqqRatio}%`;
  }

  function clampRatio(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  function buildYearBounds(records) {
    const map = new Map();
    records.forEach((record) => {
      if (!map.has(record.year)) {
        map.set(record.year, { startDate: record.date, endDate: record.date });
      } else {
        map.get(record.year).endDate = record.date;
      }
    });
    return map;
  }

  function simulateBacktest(records, config) {
    const startIndex = records.findIndex((record) => record.date === config.startDate);
    const endIndex = records.findIndex((record) => record.date === config.endDate);
    const startRecord = records[startIndex];
    const targetQqqWeight = config.qqqRatio;
    const targetCashWeight = 1 - targetQqqWeight;
    const timeline = [];
    const monthReturns = [];
    const cashFlowsForIrr = [-config.startCapital];
    const years = [];

    let qqqUnits = startRecord.price > 0 ? (config.startCapital * targetQqqWeight) / startRecord.price : 0;
    let cash = config.startCapital * targetCashWeight;
    let cumulativeNetContribution = config.startCapital;
    let peakValue = config.startCapital;
    let currentValue = config.startCapital;
    let depletedAt = null;
    let yearState = createYearState();
    const cashMonthlyRate = monthlyRateFromAnnual(config.cashYieldAnnual);

    timeline.push({ date: startRecord.date, value: currentValue, netContribution: cumulativeNetContribution, drawdown: 0 });

    for (let index = startIndex + 1; index <= endIndex; index += 1) {
      const record = records[index];
      const monthStartValue = currentValue;
      cash = cash * (1 + cashMonthlyRate);
      const qqqValueBeforeFlow = qqqUnits * record.price;
      const cashValueBeforeFlow = cash;
      const portfolioBeforeFlow = qqqValueBeforeFlow + cashValueBeforeFlow;
      const monthlyReturn = monthStartValue > 0 ? (portfolioBeforeFlow / monthStartValue) - 1 : 0;

      monthReturns.push(monthlyReturn);
      yearState.compoundedReturn *= 1 + monthlyReturn;

      const scheduledFlow = getScheduledFlow(record, config.cashFlowAmount, config.cashFlowFrequency);
      const cashFlowResult = applyCashFlow({
        amount: scheduledFlow,
        price: record.price,
        qqqUnits,
        cash,
        targetQqqWeight,
        targetCashWeight,
      });

      qqqUnits = cashFlowResult.qqqUnits;
      cash = cashFlowResult.cash;
      cumulativeNetContribution += cashFlowResult.actualFlow;
      yearState.netFlow += cashFlowResult.actualFlow;
      cashFlowsForIrr.push(-cashFlowResult.actualFlow);

      const qqqAfterFlow = qqqUnits * record.price;
      const cashAfterFlow = cash;

      let qqqAfterRebalance = qqqAfterFlow;
      let cashAfterRebalance = cashAfterFlow;

      if (config.annualRebalance && record.month === 12 && (qqqAfterFlow + cashAfterFlow) > 0) {
        const rebalanced = rebalancePortfolio({
          price: record.price,
          qqqUnits,
          cash,
          targetQqqWeight,
        });

        qqqUnits = rebalanced.qqqUnits;
        cash = rebalanced.cash;
        qqqAfterRebalance = qqqUnits * record.price;
        cashAfterRebalance = cash;
      }

      currentValue = qqqUnits * record.price + cash;

      if (!depletedAt && currentValue <= 0.01 && scheduledFlow < 0) {
        depletedAt = record.date;
      }

      peakValue = Math.max(peakValue, currentValue);
      const drawdown = peakValue > 0 ? (currentValue / peakValue) - 1 : 0;

      timeline.push({
        date: record.date,
        value: currentValue,
        netContribution: cumulativeNetContribution,
        drawdown,
      });

      if (record.month === 12 || index === endIndex) {
        years.push({
          year: record.year,
          yearlyReturn: yearState.compoundedReturn - 1,
          endValue: currentValue,
          netFlow: yearState.netFlow,
          preRebalanceQqq: qqqAfterFlow,
          preRebalanceCash: cashAfterFlow,
          postRebalanceQqq: qqqAfterRebalance,
          postRebalanceCash: cashAfterRebalance,
        });
        yearState = createYearState();
      }
    }

    cashFlowsForIrr.push(currentValue);

    return {
      metrics: buildMetrics({
        currentValue,
        startCapital: config.startCapital,
        monthReturns,
        timeline,
        cashFlowsForIrr,
      }),
      years,
      timeline,
      depletedAt,
    };
  }

  function createYearState() {
    return { netFlow: 0, compoundedReturn: 1 };
  }

  function monthlyRateFromAnnual(annualRate) {
    if (!Number.isFinite(annualRate)) return 0;
    return (1 + annualRate) ** (1 / 12) - 1;
  }

  function getScheduledFlow(record, amount, frequency) {
    if (!amount) return 0;
    if (frequency === "monthly") return amount;
    return record.month === 12 ? amount : 0;
  }

  function applyCashFlow({ amount, price, qqqUnits, cash, targetQqqWeight, targetCashWeight }) {
    if (!amount) {
      return { actualFlow: 0, qqqUnits, cash };
    }

    if (amount > 0) {
      const qqqBuyValue = amount * targetQqqWeight;
      const cashAddition = amount * targetCashWeight;
      return {
        actualFlow: amount,
        qqqUnits: qqqUnits + (price > 0 ? qqqBuyValue / price : 0),
        cash: cash + cashAddition,
      };
    }

    const qqqValue = qqqUnits * price;
    const portfolioValue = qqqValue + cash;
    const requested = Math.abs(amount);
    const actualWithdrawal = Math.min(requested, portfolioValue);
    const cashWithdrawal = Math.min(cash, actualWithdrawal);
    const remaining = actualWithdrawal - cashWithdrawal;
    const qqqSaleValue = Math.min(qqqValue, remaining);

    return {
      actualFlow: -actualWithdrawal,
      qqqUnits: Math.max(0, qqqUnits - (price > 0 ? qqqSaleValue / price : 0)),
      cash: Math.max(0, cash - cashWithdrawal),
    };
  }

  function rebalancePortfolio({ price, qqqUnits, cash, targetQqqWeight }) {
    const totalValue = qqqUnits * price + cash;
    const targetQqqValue = totalValue * targetQqqWeight;
    return {
      qqqUnits: price > 0 ? targetQqqValue / price : 0,
      cash: totalValue - targetQqqValue,
    };
  }

  function buildMetrics({ currentValue, startCapital, monthReturns, timeline, cashFlowsForIrr }) {
    const totalReturn = startCapital > 0 ? (currentValue / startCapital) - 1 : null;
    const annualizedReturn = monthReturns.length ? (1 + totalReturn) ** (12 / monthReturns.length) - 1 : null;
    const volatility = monthReturns.length > 1 ? standardDeviation(monthReturns) * Math.sqrt(12) : 0;
    const sharpe = volatility > 0 ? (mean(monthReturns) * 12) / volatility : null;
    const maxDrawdown = timeline.reduce((minimum, point) => Math.min(minimum, point.drawdown), 0);
    const irrMonthly = solveIrr(cashFlowsForIrr);
    const irrAnnual = Number.isFinite(irrMonthly) ? (1 + irrMonthly) ** 12 - 1 : null;
    const years = monthReturns.length / 12;

    return [
      metricCard("最终资产规模", formatCurrency(currentValue), currentValue),
      metricCard("总收益率", formatPercent(totalReturn), totalReturn),
      metricCard("年化收益率", formatPercent(annualizedReturn), annualizedReturn),
      metricCard("内部收益率 IRR", formatPercent(irrAnnual), irrAnnual),
      metricCard("最大回撤", formatPercent(maxDrawdown), maxDrawdown),
      metricCard("年化波动率", formatPercent(volatility), volatility),
      metricCard("夏普比率", formatNumber(sharpe), sharpe),
      metricCard("回测年数", `${numberFormatter.format(years)} 年`, years),
    ];
  }

  function metricCard(label, value, numericValue) {
    let tone = "";
    if (typeof numericValue === "number" && Number.isFinite(numericValue)) {
      if (numericValue > 0) tone = "positive";
      if (numericValue < 0) tone = "negative";
    }
    return { label, value, tone };
  }

  function renderHeroMetrics(metrics) {
    const topMetrics = metrics.slice(0, 4);
    elements.heroMetricStrip.innerHTML = topMetrics.map((metric) => `
      <article class="hero-metric-card">
        <span>${metric.label}</span>
        <strong class="${metric.tone}">${metric.value}</strong>
      </article>
    `).join("");
  }

  function renderStats(metrics) {
    elements.statsGrid.innerHTML = metrics.map((metric) => `
      <article class="stat-card">
        <span class="stat-label">${metric.label}</span>
        <strong class="stat-value ${metric.tone}">${metric.value}</strong>
      </article>
    `).join("");
  }

  function renderYearTable(years) {
    elements.yearTableBody.innerHTML = years.map((row) => `
      <tr>
        <td>${row.year}</td>
        <td class="${row.yearlyReturn >= 0 ? "positive" : "negative"}">${formatPercent(row.yearlyReturn)}</td>
        <td>${formatCurrency(row.endValue)}</td>
        <td class="${row.netFlow >= 0 ? "positive" : "negative"}">${formatCurrency(row.netFlow)}</td>
        <td>${formatCurrency(row.preRebalanceQqq)}</td>
        <td>${formatCurrency(row.preRebalanceCash)}</td>
        <td>${formatCurrency(row.postRebalanceQqq)}</td>
        <td>${formatCurrency(row.postRebalanceCash)}</td>
      </tr>
    `).join("");
  }

  function renderChart(points) {
    if (!points.length) {
      renderEmptyState();
      return;
    }

    elements.chartEmptyState.classList.add("hidden");
    const width = 860;
    const height = 500;
    const isMobile = window.innerWidth < 760;
    const margin = { top: 28, right: 28, bottom: 72, left: isMobile ? 128 : 120 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const values = points.flatMap((point) => [point.value, point.netContribution]);
    const maxValue = Math.max(...values, 1);
    const minValue = Math.min(...values, 0);
    const yMin = minValue * 0.94;
    const yMax = maxValue * 1.08;
    const yRange = yMax - yMin || 1;
    const xStep = innerWidth / Math.max(points.length - 1, 1);

    const xAt = (index) => margin.left + xStep * index;
    const yAt = (value) => margin.top + innerHeight - ((value - yMin) / yRange) * innerHeight;

    const valuePath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${xAt(index).toFixed(2)} ${yAt(point.value).toFixed(2)}`).join(" ");
    const contributionPath = points.map((point, index) => `${index === 0 ? "M" : "L"} ${xAt(index).toFixed(2)} ${yAt(point.netContribution).toFixed(2)}`).join(" ");

    const yTickCount = 5;
    const xTickCount = Math.min(isMobile ? 4 : 5, points.length);

    const yTicks = Array.from({ length: yTickCount }, (_, index) => {
      const value = yMin + (yRange * index) / (yTickCount - 1);
      return { value, y: yAt(value) };
    });

    const xLabels = Array.from({ length: xTickCount }, (_, index) => {
      const pointIndex = Math.round((index * (points.length - 1)) / Math.max(xTickCount - 1, 1));
      return { label: formatXAxisLabel(points[pointIndex].date, isMobile), x: xAt(pointIndex) };
    });

    elements.chart.innerHTML = `
      <defs>
        <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(10, 79, 143, 0.30)"></stop>
          <stop offset="100%" stop-color="rgba(10, 79, 143, 0.03)"></stop>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${width}" height="${height}" rx="26" fill="rgba(255,255,255,0.42)"></rect>
      ${yTicks.map((tick) => `
        <g>
          <line x1="${margin.left}" y1="${tick.y}" x2="${width - margin.right}" y2="${tick.y}" stroke="rgba(88, 63, 31, 0.12)" stroke-dasharray="4 10"></line>
          <text x="${margin.left - 18}" y="${tick.y + 7}" text-anchor="end" fill="rgba(110, 91, 74, 0.9)" font-size="${isMobile ? 19 : 20}" font-weight="700">${formatCompactCurrency(tick.value)}</text>
        </g>
      `).join("")}
      ${xLabels.map((tick) => `<line x1="${tick.x}" y1="${margin.top}" x2="${tick.x}" y2="${height - margin.bottom}" stroke="rgba(88, 63, 31, 0.08)" stroke-dasharray="4 12"></line>`).join("")}
      <line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="rgba(88, 63, 31, 0.18)"></line>
      ${xLabels.map((tick) => `<text x="${tick.x}" y="${height - 24}" text-anchor="middle" fill="rgba(110, 91, 74, 0.95)" font-size="${isMobile ? 18 : 20}" font-weight="700">${tick.label}</text>`).join("")}
      <path d="${valuePath} L ${xAt(points.length - 1)} ${height - margin.bottom} L ${xAt(0)} ${height - margin.bottom} Z" fill="url(#portfolioGradient)"></path>
      <path d="${contributionPath}" fill="none" stroke="#0f766e" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="8 8"></path>
      <path d="${valuePath}" fill="none" stroke="#0a4f8f" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"></path>
      <g id="focusLayer" class="focus-layer hidden">
        <line id="focusLine" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="rgba(10, 79, 143, 0.28)" stroke-width="2" stroke-dasharray="6 6"></line>
        <circle id="focusValueDotOuter" cx="${margin.left}" cy="${margin.top}" r="11" fill="rgba(10, 79, 143, 0.18)"></circle>
        <circle id="focusValueDot" cx="${margin.left}" cy="${margin.top}" r="6.5" fill="#0a4f8f" stroke="#ffffff" stroke-width="2"></circle>
        <circle id="focusCapitalDotOuter" cx="${margin.left}" cy="${margin.top}" r="10" fill="rgba(15, 118, 110, 0.16)"></circle>
        <circle id="focusCapitalDot" cx="${margin.left}" cy="${margin.top}" r="5.5" fill="#0f766e" stroke="#ffffff" stroke-width="2"></circle>
      </g>
    `;

    bindChartHover(points, xAt, yAt, width, height, margin, innerWidth);
  }

  function bindChartHover(points, xAt, yAt, width, height, margin, innerWidth) {
    const focusLayer = elements.chart.querySelector("#focusLayer");
    const focusLine = elements.chart.querySelector("#focusLine");
    const focusValueDot = elements.chart.querySelector("#focusValueDot");
    const focusValueDotOuter = elements.chart.querySelector("#focusValueDotOuter");
    const focusCapitalDot = elements.chart.querySelector("#focusCapitalDot");
    const focusCapitalDotOuter = elements.chart.querySelector("#focusCapitalDotOuter");
    let activePointerId = null;

    elements.chart.onpointerdown = null;
    elements.chart.onpointermove = null;
    elements.chart.onpointerleave = null;
    elements.chart.onpointerup = null;
    elements.chart.onpointercancel = null;

    elements.chart.addEventListener("pointerdown", handlePointerDown);
    elements.chart.addEventListener("pointermove", handlePointerMove);
    elements.chart.addEventListener("pointerleave", handlePointerLeave);
    elements.chart.addEventListener("pointerup", handlePointerUp);
    elements.chart.addEventListener("pointercancel", handlePointerUp);

    function handlePointerDown(event) {
      activePointerId = event.pointerId;
      if (elements.chart.setPointerCapture) {
        elements.chart.setPointerCapture(event.pointerId);
      }
      updateFocusFromEvent(event);
    }

    function handlePointerMove(event) {
      if (event.pointerType === "mouse" || activePointerId === event.pointerId) {
        updateFocusFromEvent(event);
      }
    }

    function handlePointerLeave(event) {
      if (event.pointerType !== "mouse") return;
      elements.tooltip.classList.add("hidden");
      focusLayer.classList.add("hidden");
    }

    function handlePointerUp(event) {
      if (activePointerId === event.pointerId) {
        activePointerId = null;
        if (elements.chart.releasePointerCapture && elements.chart.hasPointerCapture(event.pointerId)) {
          elements.chart.releasePointerCapture(event.pointerId);
        }
        if (event.pointerType !== "mouse") {
          elements.tooltip.classList.add("hidden");
          focusLayer.classList.add("hidden");
        }
      }
    }

    function updateFocusFromEvent(event) {
      const chartRect = elements.chart.getBoundingClientRect();
      const relativeX = ((event.clientX - chartRect.left) / chartRect.width) * width;
      const clampedX = Math.max(margin.left, Math.min(width - margin.right, relativeX));
      const ratio = innerWidth > 0 ? (clampedX - margin.left) / innerWidth : 0;
      const index = Math.max(0, Math.min(points.length - 1, Math.round(ratio * (points.length - 1))));
      const selectedPoint = points[index];
      const scaleX = chartRect.width / width;
      const scaleY = chartRect.height / height;
      const left = Math.min(chartRect.width - 190, xAt(index) * scaleX + 18);
      const top = Math.max(12, yAt(selectedPoint.value) * scaleY - 18);
      const valueY = yAt(selectedPoint.value);
      const contributionY = yAt(selectedPoint.netContribution);
      const x = xAt(index);

      focusLayer.classList.remove("hidden");
      focusLine.setAttribute("x1", x);
      focusLine.setAttribute("x2", x);
      focusValueDot.setAttribute("cx", x);
      focusValueDot.setAttribute("cy", valueY);
      focusValueDotOuter.setAttribute("cx", x);
      focusValueDotOuter.setAttribute("cy", valueY);
      focusCapitalDot.setAttribute("cx", x);
      focusCapitalDot.setAttribute("cy", contributionY);
      focusCapitalDotOuter.setAttribute("cx", x);
      focusCapitalDotOuter.setAttribute("cy", contributionY);

      elements.tooltip.innerHTML = `
        <strong>${selectedPoint.date}</strong><br>
        组合资产：${formatCurrency(selectedPoint.value)}<br>
        累计净投入：${formatCurrency(selectedPoint.netContribution)}<br>
        回撤：${formatPercent(selectedPoint.drawdown)}
      `;
      elements.tooltip.classList.remove("hidden");
      elements.tooltip.style.left = `${left}px`;
      elements.tooltip.style.top = `${top}px`;
    }
  }

  function renderEmptyState() {
    elements.heroMetricStrip.innerHTML = "";
    elements.statsGrid.innerHTML = "";
    elements.yearTableBody.innerHTML = "";
    elements.chart.innerHTML = "";
    elements.chartEmptyState.classList.remove("hidden");
    elements.simulationNote.textContent = "当前参数无法形成有效结果，请先修正配置。";
  }

  function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }

  function standardDeviation(values) {
    if (values.length < 2) return 0;
    const average = mean(values);
    const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
    return Math.sqrt(Math.max(variance, 0));
  }

  function solveIrr(cashFlows) {
    if (!cashFlows.some((value) => value < 0) || !cashFlows.some((value) => value > 0)) {
      return null;
    }

    const candidates = [-0.9999, -0.95, -0.9, -0.8, -0.7, -0.6, -0.5, -0.4, -0.3, -0.2, -0.1, 0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.5, 0.75, 1, 1.5, 2, 3, 5, 8, 12, 20, 50, 100];
    let previousRate = candidates[0];
    let previousValue = npv(previousRate, cashFlows);

    for (let index = 1; index < candidates.length; index += 1) {
      const rate = candidates[index];
      const value = npv(rate, cashFlows);

      if (!Number.isFinite(previousValue) || !Number.isFinite(value)) {
        previousRate = rate;
        previousValue = value;
        continue;
      }

      if (previousValue === 0) return previousRate;
      if (value === 0) return rate;

      if (previousValue * value < 0) {
        return bisectIrr(previousRate, rate, cashFlows);
      }

      previousRate = rate;
      previousValue = value;
    }

    return null;
  }

  function bisectIrr(low, high, cashFlows) {
    let lowValue = npv(low, cashFlows);

    for (let index = 0; index < 100; index += 1) {
      const mid = (low + high) / 2;
      const midValue = npv(mid, cashFlows);

      if (Math.abs(midValue) < 1e-8) return mid;

      if (lowValue * midValue < 0) {
        high = mid;
      } else {
        low = mid;
        lowValue = midValue;
      }
    }

    return (low + high) / 2;
  }

  function npv(rate, cashFlows) {
    return cashFlows.reduce((sum, cashFlow, index) => sum + cashFlow / ((1 + rate) ** index), 0);
  }

  function formatCurrency(value) {
    return Number.isFinite(value) ? currencyFormatter.format(value) : "N/A";
  }

  function formatCompactCurrency(value) {
    if (!Number.isFinite(value)) return "N/A";
    const absolute = Math.abs(value);
    if (absolute >= 1e8) {
      return `${value < 0 ? "-" : ""}¥${Math.round(absolute / 1e8)}亿`;
    }
    if (absolute >= 1e4) {
      return `${value < 0 ? "-" : ""}¥${Math.round(absolute / 1e4)}万`;
    }
    return `${value < 0 ? "-" : ""}¥${Math.round(absolute)}`;
  }

  function formatXAxisLabel(date, isMobile) {
    if (!isMobile) return date;
    return date.slice(0, 4);
  }

  function formatPercent(value) {
    return Number.isFinite(value) ? percentFormatter.format(value) : "N/A";
  }

  function formatNumber(value) {
    return Number.isFinite(value) ? numberFormatter.format(value) : "N/A";
  }

  function showValidation(messages) {
    elements.validationBox.classList.remove("hidden");
    elements.validationBox.innerHTML = messages.map((message) => `<p>${message}</p>`).join("");
  }

  function hideValidation() {
    elements.validationBox.classList.add("hidden");
    elements.validationBox.innerHTML = "";
  }

  function loadState() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch {
      return {};
    }
  }

  function saveState(config) {
    localStorage.setItem(storageKey, JSON.stringify({
      qqqRatio: Math.round(config.qqqRatio * 100),
      startCapital: config.startCapital,
      startYear: config.startYear,
      endYear: config.endYear,
      cashFlowAmount: config.cashFlowAmount,
      cashFlowFrequency: config.cashFlowFrequency,
      cashYield: config.cashYieldAnnual * 100,
      annualRebalance: String(config.annualRebalance),
    }));
  }
})();
