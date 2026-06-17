const state = {
  filter: "all",
  status: null,
  history: [],
  derived: [],
};

const STAGES = ["em", "nvt", "npt", "md"];
const HISTORY_LIMIT = 1000;
const $ = (selector) => document.querySelector(selector);

function finite(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function num(value) {
  return finite(value) ? Number(value) : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNumber(value, digits = 1) {
  if (!finite(value)) return "–";
  const numeric = Number(value);
  if (Math.abs(numeric) >= 1000000) return numeric.toExponential(2);
  if (Math.abs(numeric) >= 1000) return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(numeric);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(numeric);
}

function formatPercent(value) {
  if (!finite(value)) return "–";
  const numeric = Number(value);
  if (numeric >= 99.95) return "100%";
  if (numeric < 1) return `${numeric.toFixed(2)}%`;
  return `${numeric.toFixed(1)}%`;
}

function formatNs(value) {
  if (!finite(value)) return "–";
  const numeric = Number(value);
  if (Math.abs(numeric) >= 100) return `${numeric.toFixed(1)} ns`;
  if (Math.abs(numeric) >= 1) return `${numeric.toFixed(2)} ns`;
  return `${(numeric * 1000).toFixed(0)} ps`;
}

function formatRate(value) {
  if (!finite(value)) return "–";
  const numeric = Number(value);
  if (Math.abs(numeric) >= 10) return `${numeric.toFixed(1)} ns/h`;
  return `${numeric.toFixed(2)} ns/h`;
}

function formatDateTime(value) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatClock(value) {
  if (!value) return "–";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(hours) {
  if (!finite(hours)) return "–";
  const h = Number(hours);
  if (h < 0) return "–";
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

function cleanEta(text) {
  if (!text) return "–";
  return String(text).replace(/\s+/g, " ").trim();
}

function cacheBust(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}t=${Date.now()}`;
}

function statusText(status) {
  return status || "unknown";
}

function activeSimulation(status = state.status) {
  const simulations = status?.simulations || [];
  return simulations.find((sim) => sim.status === "running") || simulations[0] || null;
}

function activeStage(simulation) {
  return simulation?.active_stage || null;
}

function normalPath(value) {
  return String(value || "").replace(/^\/+/, "").replace(/^gromacs_run\//, "");
}

function samePath(a, b) {
  const aa = normalPath(a);
  const bb = normalPath(b);
  if (!aa || !bb) return false;
  return aa === bb || aa.endsWith(`/${bb}`) || bb.endsWith(`/${aa}`);
}

function snapshotFromStatus(status) {
  const sim = activeSimulation(status);
  const stage = activeStage(sim);
  return {
    generated_at: status?.generated_at || new Date().toISOString(),
    source_root: status?.source_root || null,
    running: status?.summary?.running ?? null,
    attention: status?.summary?.attention ?? null,
    complete: status?.summary?.complete ?? null,
    simulations: status?.summary?.simulations ?? status?.simulations?.length ?? null,
    latest_path: status?.summary?.latest_path || sim?.path || null,
    active: stage ? {
      name: sim?.name || sim?.id || "simulation",
      path: sim?.path || sim?.id || null,
      status: sim?.status || stage.status || "unknown",
      stage: stage.stage || null,
      label: stage.label || null,
      percent: num(stage.percent),
      current_step: num(stage.current_step),
      total_steps: num(stage.total_steps),
      current_ns: num(stage.current_ns),
      total_ns: num(stage.total_ns),
      eta_text: stage.eta_text || null,
      performance_ns_per_day: num(stage.performance_ns_per_day),
      temperature_k: num(stage.temperature_k),
      pressure_bar: num(stage.pressure_bar),
      potential_kj_mol: num(stage.potential_kj_mol),
      total_energy_kj_mol: num(stage.total_energy_kj_mol),
      process_id: stage.process_id ?? null,
      process_alive: stage.process_alive ?? null,
      log_path: stage.log_path || null,
      age_seconds: num(stage.age_seconds ?? sim?.age_seconds),
      updated_at: stage.updated_at || sim?.updated_at || null,
    } : null,
  };
}

function normalizeHistory(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload.filter((row) => row?.generated_at).slice(-HISTORY_LIMIT);

  const samples = Array.isArray(payload.samples) ? payload.samples.filter((row) => row?.generated_at) : [];

  // Backward compatibility with the accidental per-simulation dictionary format:
  // { "sim_id": [{ timestamp, ns, temperature_k, ... }] }
  const converted = [];
  for (const [path, rows] of Object.entries(payload)) {
    if (path === "samples" || !Array.isArray(rows)) continue;
    for (const row of rows) {
      if (!row || !row.timestamp) continue;
      converted.push({
        generated_at: row.timestamp,
        latest_path: path,
        active: {
          name: path.split("/").slice(-3).join(" / "),
          path,
          current_ns: num(row.ns),
          temperature_k: num(row.temperature_k),
          pressure_bar: num(row.pressure_bar),
          performance_ns_per_day: num(row.performance_ns_per_day),
          potential_kj_mol: num(row.potential_kj_mol),
        },
      });
    }
  }

  const byKey = new Map();
  [...converted, ...samples].forEach((sample) => {
    const path = sample?.active?.path || sample?.latest_path || "unknown";
    byKey.set(`${sample.generated_at}|${path}`, sample);
  });

  return Array.from(byKey.values())
    .sort((a, b) => new Date(a.generated_at) - new Date(b.generated_at))
    .slice(-HISTORY_LIMIT);
}

function mergeCurrentSample(samples, current) {
  if (!current?.generated_at) return samples;
  const key = `${current.generated_at}|${current.active?.path || current.latest_path || "unknown"}`;
  const byKey = new Map(samples.map((sample) => [`${sample.generated_at}|${sample.active?.path || sample.latest_path || "unknown"}`, sample]));
  byKey.set(key, current);
  return Array.from(byKey.values())
    .sort((a, b) => new Date(a.generated_at) - new Date(b.generated_at))
    .slice(-HISTORY_LIMIT);
}

function deriveSamples(samples, activePath = null) {
  const rows = samples
    .filter((sample) => sample?.active && sample.generated_at)
    .filter((sample) => !activePath || samePath(sample.active.path || sample.latest_path, activePath))
    .map((sample) => ({ ...sample, t: new Date(sample.generated_at).getTime() }))
    .filter((sample) => Number.isFinite(sample.t))
    .sort((a, b) => a.t - b.t);

  let previous = null;
  return rows.map((sample) => {
    const active = sample.active || {};
    const row = {
      generated_at: sample.generated_at,
      t: sample.t,
      name: active.name || "simulation",
      path: active.path || sample.latest_path,
      status: active.status || "unknown",
      stage: active.stage || null,
      percent: num(active.percent),
      current_ns: num(active.current_ns),
      total_ns: num(active.total_ns),
      current_step: num(active.current_step),
      total_step: num(active.total_steps),
      temperature_k: num(active.temperature_k),
      pressure_bar: num(active.pressure_bar),
      potential_kj_mol: num(active.potential_kj_mol),
      total_energy_kj_mol: num(active.total_energy_kj_mol),
      log_rate_ns_day: num(active.performance_ns_per_day),
      eta_text: active.eta_text || null,
      log_path: active.log_path || null,
      updated_at: active.updated_at || sample.generated_at,
      raw: sample,
    };

    if (previous && samePath(previous.path, row.path)) {
      const dtHours = (row.t - previous.t) / 36e5;
      const dNs = finite(row.current_ns) && finite(previous.current_ns) ? row.current_ns - previous.current_ns : null;
      const dPercent = finite(row.percent) && finite(previous.percent) ? row.percent - previous.percent : null;
      const dStep = finite(row.current_step) && finite(previous.current_step) ? row.current_step - previous.current_step : null;

      row.dt_hours = dtHours > 0 ? dtHours : null;
      row.delta_ns = dNs !== null && dNs >= 0 ? dNs : null;
      row.delta_percent = dPercent !== null && dPercent >= 0 ? dPercent : null;
      row.delta_step = dStep !== null && dStep >= 0 ? dStep : null;
      row.ns_per_hour = row.delta_ns !== null && row.dt_hours ? row.delta_ns / row.dt_hours : null;
      row.ns_per_day_derived = finite(row.ns_per_hour) ? row.ns_per_hour * 24 : null;
      row.percent_per_hour = row.delta_percent !== null && row.dt_hours ? row.delta_percent / row.dt_hours : null;
      row.steps_per_hour = row.delta_step !== null && row.dt_hours ? row.delta_step / row.dt_hours : null;
    } else {
      row.dt_hours = null;
      row.delta_ns = null;
      row.delta_percent = null;
      row.delta_step = null;
      row.ns_per_hour = null;
      row.ns_per_day_derived = null;
      row.percent_per_hour = null;
      row.steps_per_hour = null;
    }

    previous = row;
    return row;
  });
}

function latestValid(rows, key) {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (finite(rows[i][key])) return Number(rows[i][key]);
  }
  return null;
}

function mean(values) {
  const valid = values.filter(finite).map(Number);
  if (!valid.length) return null;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}

function std(values) {
  const valid = values.filter(finite).map(Number);
  if (valid.length < 2) return null;
  const m = mean(valid);
  const variance = valid.reduce((acc, value) => acc + (value - m) ** 2, 0) / (valid.length - 1);
  return Math.sqrt(variance);
}

function rollingMean(rows, key, count = 6) {
  return mean(rows.slice(-count).map((row) => row[key]));
}

function estimateFinish(row, rateNsHour) {
  if (!row || !finite(row.total_ns) || !finite(row.current_ns) || !finite(rateNsHour) || rateNsHour <= 0) return null;
  const remainingNs = Math.max(0, row.total_ns - row.current_ns);
  const hours = remainingNs / rateNsHour;
  return { remainingNs, hours, date: new Date(Date.now() + hours * 36e5) };
}

function renderActivePanel(status, rows) {
  const sim = activeSimulation(status);
  const stage = activeStage(sim);
  const latest = rows[rows.length - 1];
  if (!sim || !stage) {
    $("#activePanel").innerHTML = `
      <div>
        <p class="kicker">No active log</p>
        <h2 class="active-title">No simulation detected</h2>
        <p class="subtle">Expected status.json to contain simulations with active_stage entries.</p>
      </div>
    `;
    return;
  }

  const percent = clamp(num(stage.percent) ?? 0, 0, 100);
  const rollingRate = rollingMean(rows, "ns_per_hour", 6);
  const finish = estimateFinish(latest, rollingRate);
  const pid = stage.process_id ? `pid ${stage.process_id}${stage.process_alive ? " live" : ""}` : "pid unknown";

  $("#activePanel").innerHTML = `
    <div>
      <p class="kicker">${escapeHtml(statusText(sim.status))} / ${escapeHtml(stage.stage || "stage unknown")}</p>
      <h2 class="active-title">${escapeHtml(sim.name || sim.id || "simulation")}</h2>
      <div class="active-meta">
        <span>${escapeHtml(stage.label || "current stage")}</span>
        <span>${escapeHtml(pid)}</span>
        <span>${escapeHtml(stage.log_path || "log path unavailable")}</span>
      </div>
    </div>
    <div class="progress-block">
      <div class="progress-label"><span>${formatNs(stage.current_ns)} / ${formatNs(stage.total_ns)}</span><strong>${formatPercent(stage.percent)}</strong></div>
      <div class="progress-bar" aria-label="Progress"><span style="--value: ${percent}%"></span></div>
      <p class="progress-note">Derived rate: ${formatRate(rollingRate)}. Projected remaining: ${finish ? formatDuration(finish.hours) : "–"}.</p>
    </div>
  `;
}

function updateStats(status, rows) {
  const sim = activeSimulation(status);
  const stage = activeStage(sim) || {};
  const latest = rows[rows.length - 1] || {};
  const rate = rollingMean(rows, "ns_per_hour", 6) ?? latestValid(rows, "ns_per_hour");
  const finish = estimateFinish(latest, rate);
  const progressSub = stage.stage ? `${stage.stage} / ${stage.label || "stage"}` : "current stage";

  $("#statProgress").textContent = formatPercent(stage.percent);
  $("#statProgressSub").textContent = progressSub;
  $("#statNs").textContent = `${formatNs(stage.current_ns)} / ${formatNs(stage.total_ns)}`;
  $("#statNsSub").textContent = stage.current_step ? `${formatNumber(stage.current_step, 0)} / ${formatNumber(stage.total_steps, 0)} steps` : "ns completed";
  $("#statNsHour").textContent = formatRate(rate);
  $("#statEta").textContent = finish ? formatDuration(finish.hours) : cleanEta(stage.eta_text);
  $("#statEtaSub").textContent = finish ? finish.date.toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" }) : "GROMACS ETA";
  $("#statTemp").textContent = finite(stage.temperature_k) ? `${Number(stage.temperature_k).toFixed(2)}` : "–";
  $("#statPressure").textContent = finite(stage.pressure_bar) ? `${Number(stage.pressure_bar).toFixed(2)}` : "–";
  $("#statEnergy").textContent = finite(stage.potential_kj_mol) ? Number(stage.potential_kj_mol).toExponential(3) : "–";
  $("#statSamples").textContent = `${rows.length}`;
  $("#lastUpdated").textContent = `updated ${formatDateTime(status?.generated_at)}`;
}

function renderStages(status) {
  const sim = activeSimulation(status);
  const stages = sim?.stages || [];
  const active = activeStage(sim);
  const byStage = new Map(stages.map((stage) => [stage.stage, stage]));
  const stageOrder = [...new Set([...STAGES, ...stages.map((stage) => stage.stage).filter(Boolean)])];

  $("#stageGrid").innerHTML = stageOrder.map((name) => {
    const stage = byStage.get(name) || {};
    const percent = clamp(num(stage.percent) ?? (stage.status === "complete" ? 100 : 0), 0, 100);
    const classes = ["stage-card"];
    if (active?.stage === name) classes.push("current");
    if (["failed", "stale"].includes(stage.status)) classes.push("failed");
    return `
      <article class="${classes.join(" ")}">
        <strong>${escapeHtml(name || "stage")}</strong>
        <span>${escapeHtml(statusText(stage.status || "not seen"))} · ${formatPercent(percent)}</span>
        <span>${formatNs(stage.current_ns)} / ${formatNs(stage.total_ns)}</span>
        <div class="mini-bar"><i style="--value:${percent}%"></i></div>
      </article>
    `;
  }).join("");
}

function niceDomain(values) {
  const valid = values.filter(finite).map(Number);
  if (!valid.length) return [0, 1];
  let min = Math.min(...valid);
  let max = Math.max(...valid);
  if (min === max) {
    const pad = Math.abs(min || 1) * 0.05;
    min -= pad;
    max += pad;
  }
  const pad = (max - min) * 0.08;
  return [min - pad, max + pad];
}

function renderLineChart(target, rows, options) {
  const el = $(target);
  const series = options.series || [];
  const validRowsAll = rows
    .filter((row) => finite(row.t) && series.some((s) => finite(row[s.key])));
  const validRows = options.limit ? validRowsAll.slice(-options.limit) : validRowsAll;

  if (validRows.length < 2) {
    el.innerHTML = `<div class="chart-empty">Need at least two samples with ${escapeHtml(options.emptyLabel || "valid values")}.</div>`;
    return;
  }

  const width = 820;
  const height = options.height || 260;
  const margin = { top: 18, right: 22, bottom: 42, left: 62 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const times = validRows.map((row) => row.t);
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const yValues = validRows.flatMap((row) => series.map((s) => row[s.key])).filter(finite).map(Number);
  let [minY, maxY] = options.domain || niceDomain(yValues);
  if (finite(options.minY)) minY = Number(options.minY);
  if (finite(options.maxY)) maxY = Number(options.maxY);

  const x = (t) => margin.left + ((t - minT) / Math.max(1, maxT - minT)) * innerW;
  const y = (value) => margin.top + (1 - (Number(value) - minY) / Math.max(1e-12, maxY - minY)) * innerH;

  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const yy = margin.top + f * innerH;
    const value = maxY - f * (maxY - minY);
    return `<line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${yy}" y2="${yy}"/><text class="tick-label" x="${margin.left - 10}" y="${yy + 4}" text-anchor="end">${formatNumber(value, options.yDigits ?? 1)}</text>`;
  }).join("");

  const xTicks = [validRows[0], validRows[Math.floor(validRows.length / 2)], validRows[validRows.length - 1]];
  const xLabels = xTicks.map((row) => `<text class="tick-label" x="${x(row.t)}" y="${height - 14}" text-anchor="middle">${formatClock(row.generated_at)}</text>`).join("");

  const paths = series.map((s, idx) => {
    const points = validRows.filter((row) => finite(row[s.key]));
    const d = points.map((row, i) => `${i === 0 ? "M" : "L"}${x(row.t).toFixed(2)},${y(row[s.key]).toFixed(2)}`).join(" ");
    const point = points[points.length - 1];
    return `
      <path class="data-line ${idx ? "secondary" : ""}" d="${d}"/>
      <circle class="data-point" cx="${x(point.t)}" cy="${y(point[s.key])}" r="3"/>
      <text class="point-label" x="${x(point.t) - 5}" y="${y(point[s.key]) - 9}" text-anchor="end">${formatNumber(point[s.key], options.yDigits ?? 1)}${s.suffix || ""}</text>
    `;
  }).join("");

  const primary = series[0];
  const areaPoints = validRows.filter((row) => finite(row[primary.key]));
  const area = areaPoints.length > 1 ? `<path class="data-area" d="${areaPoints.map((row, i) => `${i === 0 ? "M" : "L"}${x(row.t).toFixed(2)},${y(row[primary.key]).toFixed(2)}`).join(" ")} L${x(areaPoints.at(-1).t).toFixed(2)},${height - margin.bottom} L${x(areaPoints[0].t).toFixed(2)},${height - margin.bottom} Z"/>` : "";

  const legend = series.map((s, idx) => `<text class="legend" x="${margin.left + idx * 150}" y="14">${escapeHtml(s.label || s.key)}</text>`).join("");

  el.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(options.label || "line chart")}">
      ${grid}
      <line class="grid-line" x1="${margin.left}" x2="${width - margin.right}" y1="${height - margin.bottom}" y2="${height - margin.bottom}"/>
      ${xLabels}
      ${area}
      ${paths}
      ${legend}
    </svg>
  `;
}

function renderCharts(rows) {
  renderLineChart("#chartProgress", rows, {
    label: "Progress over time",
    emptyLabel: "progress values",
    minY: 0,
    maxY: 100,
    yDigits: 0,
    series: [{ key: "percent", label: "Percent", suffix: "%" }],
  });

  renderLineChart("#chartNs", rows, {
    label: "Trajectory time",
    emptyLabel: "trajectory values",
    yDigits: 2,
    series: [{ key: "current_ns", label: "Current ns" }],
  });

  renderLineChart("#chartRate", rows, {
    label: "Derived throughput",
    emptyLabel: "consecutive ns values",
    yDigits: 2,
    series: [{ key: "ns_per_hour", label: "ns/hour" }],
  });

  renderLineChart("#chartTemp", rows, {
    label: "Temperature",
    emptyLabel: "temperature values",
    yDigits: 1,
    series: [{ key: "temperature_k", label: "Temperature K" }],
  });

  renderLineChart("#chartPressure", rows, {
    label: "Pressure",
    emptyLabel: "pressure values",
    yDigits: 1,
    series: [{ key: "pressure_bar", label: "Pressure bar" }],
  });

  renderLineChart("#chartPotential", rows, {
    label: "Potential energy",
    emptyLabel: "energy values",
    yDigits: 0,
    series: [{ key: "potential_kj_mol", label: "Potential" }],
  });

  renderLineChart("#chartSteps", rows, {
    label: "Step throughput",
    emptyLabel: "step increments",
    yDigits: 0,
    height: 220,
    series: [{ key: "steps_per_hour", label: "Steps/hour" }],
  });
}

function renderRecentRows(rows) {
  const recent = rows.slice(-12).reverse();
  $("#recentRows").innerHTML = recent.map((row) => `
    <tr>
      <td>${formatClock(row.generated_at)}</td>
      <td>${formatNumber(row.current_ns, 2)}</td>
      <td>${finite(row.delta_ns) ? `+${formatNumber(row.delta_ns, 3)}` : "–"}</td>
      <td>${finite(row.ns_per_hour) ? formatNumber(row.ns_per_hour, 2) : "–"}</td>
      <td>${finite(row.temperature_k) ? formatNumber(row.temperature_k, 2) : "–"}</td>
      <td>${finite(row.pressure_bar) ? formatNumber(row.pressure_bar, 2) : "–"}</td>
    </tr>
  `).join("") || `<tr><td colspan="6">No history samples available yet.</td></tr>`;
}

function renderDiagnostics(status, rows) {
  const latest = rows[rows.length - 1] || {};
  const rates = rows.slice(-12).map((row) => row.ns_per_hour).filter(finite).map(Number);
  const temps = rows.slice(-12).map((row) => row.temperature_k).filter(finite).map(Number);
  const pressures = rows.slice(-12).map((row) => row.pressure_bar).filter(finite).map(Number);
  const rate = rollingMean(rows, "ns_per_hour", 6);
  const finish = estimateFinish(latest, rate);
  const sim = activeSimulation(status);
  const stage = activeStage(sim) || {};

  const diagnostics = [
    ["Active path", sim?.path || "–"],
    ["Log file", stage.log_path || "–"],
    ["Process", stage.process_id ? `${stage.process_id} / ${stage.process_alive ? "alive" : "not alive"}` : "–"],
    ["Rate mean", finite(mean(rates)) ? `${formatNumber(mean(rates), 2)} ns/h` : "–"],
    ["Rate SD", finite(std(rates)) ? `${formatNumber(std(rates), 2)} ns/h` : "–"],
    ["Temp range", temps.length ? `${formatNumber(Math.min(...temps), 2)}–${formatNumber(Math.max(...temps), 2)} K` : "–"],
    ["Pressure range", pressures.length ? `${formatNumber(Math.min(...pressures), 2)}–${formatNumber(Math.max(...pressures), 2)} bar` : "–"],
    ["Remaining", finish ? `${formatNs(finish.remainingNs)} / ${formatDuration(finish.hours)}` : "–"],
    ["GROMACS ETA", cleanEta(stage.eta_text)],
  ];

  $("#diagnostics").innerHTML = diagnostics.map(([key, value]) => `
    <dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>
  `).join("");
}

function simulationMatches(sim) {
  if (state.filter === "all") return true;
  if (state.filter === "attention") return ["failed", "stale", "partial"].includes(sim.status);
  return sim.status === state.filter;
}

function renderSimulationRows(status) {
  const sims = (status?.simulations || []).filter(simulationMatches).slice(0, 80);
  $("#simulationRows").innerHTML = sims.map((sim) => {
    const stage = activeStage(sim) || {};
    return `
      <tr>
        <td>${escapeHtml(sim.name || sim.id || sim.path || "simulation")}<br><span class="subtle">${escapeHtml(sim.path || "")}</span></td>
        <td><span class="status-text ${escapeHtml(sim.status || "")}">${escapeHtml(statusText(sim.status))}</span></td>
        <td>${escapeHtml(stage.stage || "–")}</td>
        <td>${formatPercent(stage.percent)}</td>
        <td>${formatNs(stage.current_ns)}</td>
        <td>${formatDateTime(sim.updated_at || stage.updated_at)}</td>
      </tr>
    `;
  }).join("") || `<tr><td colspan="6">No matching simulations.</td></tr>`;
}

function updateHealth(status) {
  const chip = $("#healthState");
  const summary = status?.summary || {};
  chip.className = "status-chip";
  if ((summary.attention ?? 0) > 0) {
    chip.classList.add("warn");
    chip.textContent = `${summary.attention} attention`;
  } else if ((summary.running ?? 0) > 0) {
    chip.classList.add("good");
    chip.textContent = `${summary.running} running`;
  } else {
    chip.textContent = "idle";
  }
}

function render() {
  const status = state.status;
  if (!status) return;
  const sim = activeSimulation(status);
  const activePath = sim?.path || status?.summary?.latest_path || null;
  state.derived = deriveSamples(state.history, activePath);

  $("#sourceRoot").textContent = `${status.source_root || "unknown source"} · ${status?.summary?.simulations ?? status?.simulations?.length ?? 0} simulations`;
  $("#refreshState").textContent = `Last refreshed ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;

  updateHealth(status);
  renderActivePanel(status, state.derived);
  updateStats(status, state.derived);
  renderStages(status);
  renderCharts(state.derived);
  renderRecentRows(state.derived);
  renderDiagnostics(status, state.derived);
  renderSimulationRows(status);
}

async function loadJson(path, fallback = null) {
  try {
    const response = await fetch(cacheBust(path), { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } catch (error) {
    console.warn(`Could not load ${path}`, error);
    return fallback;
  }
}

async function refresh() {
  $("#healthState").textContent = "loading";
  const [status, historyPayload] = await Promise.all([
    loadJson("status.json", null),
    loadJson("history.json", { samples: [] }),
  ]);

  if (!status) {
    $("#healthState").className = "status-chip bad";
    $("#healthState").textContent = "status error";
    $("#sourceRoot").textContent = "Could not load sim-progress/status.json";
    return;
  }

  state.status = status;
  const samples = normalizeHistory(historyPayload);
  state.history = mergeCurrentSample(samples, snapshotFromStatus(status));
  render();
}

function setupEvents() {
  $("#refreshButton")?.addEventListener("click", refresh);
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
      button.classList.add("active");
      state.filter = button.dataset.filter || "all";
      renderSimulationRows(state.status);
    });
  });
}

setupEvents();
refresh();
setInterval(refresh, 60_000);
