const state = {
  filter: "all",
  data: null,
  history: [],
  clientHistory: [],
  timer: null,
};

const STAGES = ["em", "nvt", "npt", "md"];
const $ = (selector) => document.querySelector(selector);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function defined(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const numeric = Number(value);
  if (numeric >= 99.95) return "100%";
  if (numeric < 1) return `${numeric.toFixed(2)}%`;
  return `${numeric.toFixed(1)}%`;
}

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat().format(Number(value));
}

function formatNs(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const numeric = Number(value);
  if (Math.abs(numeric) >= 100) return `${numeric.toFixed(1)} ns`;
  if (Math.abs(numeric) >= 1) return `${numeric.toFixed(2)} ns`;
  return `${(numeric * 1000).toFixed(0)} ps`;
}

function formatAge(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return "-";
  const numeric = Number(seconds);
  if (numeric < 60) return `${Math.floor(numeric)}s ago`;
  if (numeric < 3600) return `${Math.floor(numeric / 60)}m ago`;
  if (numeric < 86400) return `${Math.floor(numeric / 3600)}h ago`;
  return `${Math.floor(numeric / 86400)}d ago`;
}

function formatClock(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatShortTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function cleanEta(text) {
  if (!text) return "-";
  return String(text).replace(/\s+/g, " ").trim();
}

function statusLabel(status) {
  const labels = {
    running: "running",
    complete: "done",
    partial: "partial",
    stale: "stale",
    failed: "failed",
    unknown: "unknown",
  };
  return labels[status] || status || "unknown";
}

function isStaticHost() {
  const host = window.location.hostname;
  return host.endsWith("github.io") || (host === "localhost" && !window.location.port);
}

function statusEndpoint() {
  return isStaticHost() ? "status.json" : "/api/status";
}

function historyEndpoint() {
  return isStaticHost() ? "history.json" : null;
}

function cacheBust(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}t=${Date.now()}`;
}

function simulationMatches(simulation) {
  if (state.filter === "all") return true;
  if (state.filter === "attention") return ["failed", "stale"].includes(simulation.status);
  return simulation.status === state.filter;
}

function getActive(data = state.data) {
  const simulation = data?.simulations?.[0] || null;
  return { simulation, active: simulation?.active_stage || null };
}

function snapshotToTelemetry(data) {
  const { simulation, active } = getActive(data);
  return {
    generated_at: data?.generated_at || new Date().toISOString(),
    source_root: data?.source_root || "-",
    running: data?.summary?.running ?? 0,
    attention: data?.summary?.attention ?? 0,
    complete: data?.summary?.complete ?? 0,
    simulations: data?.summary?.simulations ?? data?.simulations?.length ?? 0,
    latest_path: data?.summary?.latest_path || simulation?.path || "-",
    active: active ? {
      name: simulation?.name || "-",
      path: simulation?.path || "-",
      status: simulation?.status || "unknown",
      stage: active.stage || "-",
      label: active.label || "-",
      percent: active.percent ?? null,
      current_step: active.current_step ?? null,
      total_steps: active.total_steps ?? null,
      current_ns: active.current_ns ?? null,
      total_ns: active.total_ns ?? null,
      eta_text: active.eta_text || null,
      performance_ns_per_day: active.performance_ns_per_day ?? null,
      temperature_k: active.temperature_k ?? null,
      pressure_bar: active.pressure_bar ?? null,
      potential_kj_mol: active.potential_kj_mol ?? null,
      total_energy_kj_mol: active.total_energy_kj_mol ?? null,
      process_id: active.process_id ?? null,
      process_alive: active.process_alive ?? null,
      log_path: active.log_path || null,
      age_seconds: simulation?.age_seconds ?? active.age_seconds ?? null,
      updated_at: simulation?.updated_at || active.updated_at || null,
    } : null,
  };
}

function normalizeHistory(payload) {
  if (!payload) return [];
  const samples = Array.isArray(payload) ? payload : payload.samples;
  if (!Array.isArray(samples)) return [];
  return samples.filter((sample) => sample && sample.generated_at).slice(-720);
}

function mergeHistory(staticHistory, clientHistory, current) {
  const byTime = new Map();
  [...staticHistory, ...clientHistory, current].filter(Boolean).forEach((sample) => {
    byTime.set(sample.generated_at, sample);
  });
  return Array.from(byTime.values())
    .sort((a, b) => new Date(a.generated_at) - new Date(b.generated_at))
    .slice(-720);
}

function activeHero(data) {
  const { simulation, active } = getActive(data);
  if (!simulation || !active) {
    return `
      <div class="hero-copy">
        <span class="eyebrow">idle</span>
        <h2>NO LOG STREAM</h2>
        <p>Expected files: em.log, nvt.log, npt.log, md.log or *.run.log under the scan root.</p>
      </div>
      <div class="hero-progress">
        <div class="hero-ring" style="--value: 0"><span>0%</span></div>
        <div class="hero-stats">
          <div><span>endpoint</span><strong>${statusEndpoint()}</strong></div>
          <div><span>mode</span><strong>${isStaticHost() ? "github pages snapshot" : "local live api"}</strong></div>
        </div>
      </div>
    `;
  }

  const percent = clamp(active.percent ?? 0, 0, 100);
  const speed = defined(active.performance_ns_per_day) ? `${Number(active.performance_ns_per_day).toFixed(2)} ns/day` : "-";
  const timeLine = `${formatNs(active.current_ns)} / ${formatNs(active.total_ns)}`;
  const pid = active.process_id ? `pid ${active.process_id}${active.process_alive ? " live" : ""}` : "pid unknown";
  return `
    <div class="hero-copy">
      <span class="eyebrow">${statusLabel(simulation.status)} :: ${active.stage || "stage?"}</span>
      <h2>${simulation.name}</h2>
      <p>${active.label || "current stage"} :: ${timeLine} :: ${pid}</p>
    </div>
    <div class="hero-progress">
      <div class="hero-ring" style="--value: ${percent}"><span>${formatPercent(active.percent)}</span></div>
      <div class="hero-stats">
        <div><span>eta</span><strong>${cleanEta(active.eta_text)}</strong></div>
        <div><span>speed</span><strong>${speed}</strong></div>
        <div><span>log</span><strong>${active.log_path || "-"}</strong></div>
      </div>
    </div>
  `;
}

function terminalLog(data, history) {
  const { simulation, active } = getActive(data);
  const newest = history[history.length - 1];
  const previous = history.length >= 2 ? history[history.length - 2] : null;
  const deltaPercent = previous?.active && newest?.active && defined(newest.active.percent) && defined(previous.active.percent)
    ? Number(newest.active.percent) - Number(previous.active.percent)
    : null;
  const deltaStep = previous?.active && newest?.active && defined(newest.active.current_step) && defined(previous.active.current_step)
    ? Number(newest.active.current_step) - Number(previous.active.current_step)
    : null;

  const lines = [
    `[${formatClock(data?.generated_at)}] status=${statusLabel(simulation?.status)} endpoint=${statusEndpoint()} samples=${history.length}`,
    `scan_root=${data?.source_root || "-"}`,
  ];

  if (simulation && active) {
    lines.push(`active=${simulation.name}`);
    lines.push(`stage=${active.stage || "-"} label="${active.label || "-"}" progress=${formatPercent(active.percent)} step=${formatNumber(active.current_step)}/${formatNumber(active.total_steps)}`);
    lines.push(`time=${formatNs(active.current_ns)}/${formatNs(active.total_ns)} speed=${defined(active.performance_ns_per_day) ? Number(active.performance_ns_per_day).toFixed(2) : "-"} ns/day eta="${cleanEta(active.eta_text)}"`);
    lines.push(`thermo temp=${defined(active.temperature_k) ? Number(active.temperature_k).toFixed(2) : "-"} K pressure=${defined(active.pressure_bar) ? Number(active.pressure_bar).toFixed(2) : "-"} bar potential=${defined(active.potential_kj_mol) ? Number(active.potential_kj_mol).toExponential(3) : "-"} kJ/mol`);
    lines.push(`process pid=${active.process_id || "-"} alive=${active.process_alive === null || active.process_alive === undefined ? "unknown" : String(active.process_alive)} log=${active.log_path || "-"}`);
  }
  if (deltaPercent !== null || deltaStep !== null) {
    lines.push(`delta_since_last_sample=${deltaPercent === null ? "-" : `${deltaPercent >= 0 ? "+" : ""}${deltaPercent.toFixed(3)}%`} steps=${deltaStep === null ? "-" : `${deltaStep >= 0 ? "+" : ""}${formatNumber(deltaStep)}`}`);
  }
  if (data?.summary) {
    lines.push(`queue simulations=${data.summary.simulations} running=${data.summary.running} attention=${data.summary.attention} complete=${data.summary.complete}`);
  }
  return lines.join("\n");
}

function linePath(points, getX, getY) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${getX(point).toFixed(2)},${getY(point).toFixed(2)}`).join(" ");
}

function areaPath(points, getX, getY, bottom) {
  if (!points.length) return "";
  return `${linePath(points, getX, getY)} L${getX(points[points.length - 1]).toFixed(2)},${bottom} L${getX(points[0]).toFixed(2)},${bottom} Z`;
}

function makeLineChart({ samples, series, yMin = null, yMax = null, suffix = "", decimals = 1 }) {
  const valid = samples
    .map((sample) => ({ ...sample, xDate: new Date(sample.generated_at) }))
    .filter((sample) => !Number.isNaN(sample.xDate.getTime()));

  const rows = valid.filter((sample) => series.some((item) => defined(item.value(sample))));
  if (rows.length < 2) {
    return `<div class="empty-plot">Need at least two telemetry samples for this trace.<br>Static GitHub Pages will fill this after a few publishes.</div>`;
  }

  const width = 720;
  const height = 230;
  const margin = { top: 14, right: 20, bottom: 34, left: 46 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const times = rows.map((row) => row.xDate.getTime());
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const values = [];
  rows.forEach((row) => series.forEach((item) => {
    const value = Number(item.value(row));
    if (Number.isFinite(value)) values.push(value);
  }));
  const rawMin = yMin ?? Math.min(...values);
  const rawMax = yMax ?? Math.max(...values);
  const span = rawMax - rawMin || 1;
  const pad = yMin === null && yMax === null ? span * 0.12 : 0;
  const minY = rawMin - pad;
  const maxY = rawMax + pad;

  const x = (row) => margin.left + ((row.xDate.getTime() - minT) / (maxT - minT || 1)) * innerW;
  const y = (value) => margin.top + (1 - ((Number(value) - minY) / (maxY - minY || 1))) * innerH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => minY + (maxY - minY) * fraction);
  const xTicks = [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]];

  const grid = yTicks.map((value) => {
    const yy = y(value);
    return `<line class="grid-line" x1="${margin.left}" y1="${yy.toFixed(1)}" x2="${width - margin.right}" y2="${yy.toFixed(1)}"></line><text class="tick-label" x="6" y="${(yy + 3).toFixed(1)}">${value.toFixed(decimals)}${suffix}</text>`;
  }).join("");

  const xLabels = xTicks.map((row) => `<text class="tick-label" x="${x(row).toFixed(1)}" y="${height - 9}" text-anchor="middle">${formatShortTime(row.generated_at)}</text>`).join("");

  const paths = series.map((item, index) => {
    const className = index === 0 ? "chart-line" : index === 1 ? "chart-line secondary" : "chart-line tertiary";
    const pointRows = rows.filter((row) => defined(item.value(row)));
    const path = linePath(pointRows, x, (row) => y(item.value(row)));
    const circles = pointRows.slice(-32).map((row) => `<circle class="point" cx="${x(row).toFixed(2)}" cy="${y(item.value(row)).toFixed(2)}" r="2.4"></circle>`).join("");
    const area = index === 0 ? `<path class="chart-area" d="${areaPath(pointRows, x, (row) => y(item.value(row)), height - margin.bottom)}"></path>` : "";
    return `${area}<path class="${className}" d="${path}"></path>${circles}`;
  }).join("");

  const latestLabels = series.map((item, index) => {
    const reversed = [...rows].reverse().find((row) => defined(item.value(row)));
    if (!reversed) return "";
    const value = Number(item.value(reversed));
    const className = index === 1 ? "secondary" : index === 2 ? "tertiary" : "";
    return `<span class="${className}">${item.label}: ${value.toFixed(decimals)}${suffix}</span>`;
  }).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${series.map((s) => s.label).join(", ")}">
      ${grid}
      <line class="axis" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"></line>
      <line class="axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"></line>
      ${xLabels}
      ${paths}
    </svg>
    <div class="legend">${latestLabels}</div>
  `;
}

function stageCell(stageName, stage) {
  if (!stage) {
    return `<div class="stage unknown"><strong>${stageName.toUpperCase()}</strong><span>-</span></div>`;
  }
  return `<div class="stage ${stage.status}"><strong>${stage.label}</strong><span>${formatPercent(stage.percent)}</span></div>`;
}

function simulationCard(simulation) {
  const active = simulation.active_stage || {};
  const percent = clamp(active.percent ?? 0, 0, 100);
  const stageMap = Object.fromEntries((simulation.stages || []).map((stage) => [stage.stage, stage]));
  const performance = defined(active.performance_ns_per_day) ? `${Number(active.performance_ns_per_day).toFixed(2)} ns/day` : "-";
  const temperature = defined(active.temperature_k) ? `${Number(active.temperature_k).toFixed(1)} K` : "-";
  const pressure = defined(active.pressure_bar) ? `${Number(active.pressure_bar).toFixed(1)} bar` : "-";
  const process = active.process_id ? `${active.process_id}${active.process_alive ? " live" : ""}` : "-";

  return `
    <article class="simulation">
      <div class="simulation-main">
        <div class="row">
          <div class="title-block">
            <h2>${simulation.name}</h2>
            <p>${simulation.path}</p>
          </div>
          <span class="status ${simulation.status}">${statusLabel(simulation.status)}</span>
        </div>
        <div class="progress-panel">
          <div class="ring" style="--value: ${percent}"><span>${formatPercent(active.percent)}</span></div>
          <div class="detail-grid">
            <div class="detail"><span class="detail-label">stage</span><strong>${active.label || "-"}</strong></div>
            <div class="detail"><span class="detail-label">time</span><strong>${formatNs(active.current_ns)} / ${formatNs(active.total_ns)}</strong></div>
            <div class="detail"><span class="detail-label">step</span><strong>${formatNumber(active.current_step)} / ${formatNumber(active.total_steps)}</strong></div>
            <div class="detail"><span class="detail-label">eta</span><strong>${cleanEta(active.eta_text)}</strong></div>
            <div class="detail"><span class="detail-label">speed</span><strong>${performance}</strong></div>
            <div class="detail"><span class="detail-label">updated</span><strong>${formatAge(simulation.age_seconds)}</strong></div>
            <div class="detail"><span class="detail-label">temp</span><strong>${temperature}</strong></div>
            <div class="detail"><span class="detail-label">pressure</span><strong>${pressure}</strong></div>
            <div class="detail"><span class="detail-label">pid</span><strong>${process}</strong></div>
            <div class="detail"><span class="detail-label">log</span><strong>${active.log_path || "-"}</strong></div>
          </div>
        </div>
      </div>
      <div class="stage-strip">
        ${STAGES.map((name) => stageCell(name, stageMap[name])).join("")}
      </div>
    </article>
  `;
}

function renderStageMatrix(data) {
  const simulations = data?.simulations || [];
  if (!simulations.length) return `<div class="empty-plot">No simulation stages found.</div>`;
  return simulations.slice(0, 40).map((simulation) => {
    const stageMap = Object.fromEntries((simulation.stages || []).map((stage) => [stage.stage, stage]));
    const cells = STAGES.map((name) => {
      const stage = stageMap[name];
      return `<div class="stage-box ${stage?.status || "unknown"}"><strong>${name}</strong><span>${stage ? formatPercent(stage.percent) : "-"}</span></div>`;
    }).join("");
    return `<div class="stage-row"><div class="stage-name"><strong>${simulation.name}</strong><span>${simulation.path}</span></div>${cells}</div>`;
  }).join("");
}

function renderStats(data, history) {
  const { simulation, active } = getActive(data);
  const rows = [
    ["mode", isStaticHost() ? "GitHub Pages snapshot" : "local live API"],
    ["endpoint", statusEndpoint()],
    ["generated", data?.generated_at || "-"],
    ["active run", simulation?.name || "-"],
    ["stage", active?.label || "-"],
    ["status", statusLabel(simulation?.status)],
    ["progress", formatPercent(active?.percent)],
    ["ns", `${formatNs(active?.current_ns)} / ${formatNs(active?.total_ns)}`],
    ["steps", `${formatNumber(active?.current_step)} / ${formatNumber(active?.total_steps)}`],
    ["speed", defined(active?.performance_ns_per_day) ? `${Number(active.performance_ns_per_day).toFixed(2)} ns/day` : "-"],
    ["temperature", defined(active?.temperature_k) ? `${Number(active.temperature_k).toFixed(2)} K` : "-"],
    ["pressure", defined(active?.pressure_bar) ? `${Number(active.pressure_bar).toFixed(2)} bar` : "-"],
    ["potential", defined(active?.potential_kj_mol) ? `${Number(active.potential_kj_mol).toExponential(4)} kJ/mol` : "-"],
    ["samples", String(history.length)],
  ];
  return rows.map(([key, value]) => `<div class="stat-row"><span>${key}</span><strong>${value}</strong></div>`).join("");
}

function renderPlots(history) {
  const activeSamples = history.filter((sample) => sample.active);
  $("#plotPercent").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [{ label: "progress", value: (sample) => sample.active?.percent }],
    yMin: 0,
    yMax: 100,
    suffix: "%",
    decimals: 0,
  });
  $("#plotSpeed").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [{ label: "speed", value: (sample) => sample.active?.performance_ns_per_day }],
    suffix: "",
    decimals: 2,
  });
  $("#plotTempPressure").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "temperature K", value: (sample) => sample.active?.temperature_k },
      { label: "pressure bar", value: (sample) => sample.active?.pressure_bar },
    ],
    suffix: "",
    decimals: 1,
  });

  const first = activeSamples[0]?.generated_at;
  const last = activeSamples[activeSamples.length - 1]?.generated_at;
  $("#progressRange").textContent = first && last ? `${formatShortTime(first)} → ${formatShortTime(last)}` : "-";
}

function render() {
  const data = state.data;
  if (!data) return;
  const current = snapshotToTelemetry(data);
  const history = mergeHistory(state.history, state.clientHistory, current);
  const { simulation, active } = getActive(data);

  $("#sourceRoot").textContent = data.source_root || "-";
  $("#activeHero").innerHTML = activeHero(data);
  $("#runningCount").textContent = String(data.summary?.running ?? 0);
  $("#activePercent").textContent = formatPercent(data.summary?.active_percent ?? active?.percent);
  $("#activeEta").textContent = cleanEta(data.summary?.active_eta ?? active?.eta_text);
  $("#speedStat").textContent = defined(active?.performance_ns_per_day) ? Number(active.performance_ns_per_day).toFixed(2) : "-";
  $("#tempStat").textContent = defined(active?.temperature_k) ? `${Number(active.temperature_k).toFixed(1)} K` : "-";
  $("#pressureStat").textContent = defined(active?.pressure_bar) ? `${Number(active.pressure_bar).toFixed(1)} bar` : "-";
  $("#stepStat").textContent = `${formatNumber(active?.current_step)} / ${formatNumber(active?.total_steps)}`;
  $("#samplesCount").textContent = String(history.length);
  $("#clockState").textContent = formatClock(new Date().toISOString());
  $("#generatedAt").textContent = formatClock(data.generated_at);
  $("#commitState").textContent = isStaticHost() ? "status.json + history.json" : "live /api/status";
  $("#lastRefresh").textContent = `refreshed ${formatClock(data.generated_at)} :: browser ${formatClock(new Date().toISOString())}`;
  $("#nsStat").textContent = simulation && active ? `${simulation.name} :: ${formatNs(active.current_ns)} / ${formatNs(active.total_ns)}` : "no active run";
  $("#terminalLines").textContent = terminalLog(data, history);
  $("#statsTable").innerHTML = renderStats(data, history);
  $("#stageMatrix").innerHTML = renderStageMatrix(data);
  renderPlots(history);

  const simulations = (data.simulations || []).filter(simulationMatches);
  $("#simulationList").innerHTML = simulations.map(simulationCard).join("");
  $("#emptyState").hidden = simulations.length !== 0;
}

async function loadHistory() {
  const endpoint = historyEndpoint();
  if (!endpoint) return;
  try {
    const response = await fetch(cacheBust(endpoint), { cache: "no-store" });
    if (!response.ok) return;
    const payload = await response.json();
    state.history = normalizeHistory(payload);
  } catch (error) {
    console.debug("history unavailable", error);
  }
}

function setHealth(label, ok) {
  $("#healthState").textContent = label;
  const dot = $("#healthDot");
  dot.classList.toggle("ok", ok === true);
  dot.classList.toggle("bad", ok === false);
}

async function refresh() {
  setHealth("updating", null);
  try {
    const endpoint = statusEndpoint();
    const response = await fetch(cacheBust(endpoint), { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    if (!isStaticHost()) {
      state.clientHistory.push(snapshotToTelemetry(state.data));
      state.clientHistory = state.clientHistory.slice(-720);
    } else {
      await loadHistory();
    }
    setHealth(endpoint === "status.json" ? "snapshot" : "live", true);
    render();
  } catch (error) {
    setHealth("offline", false);
    console.error(error);
  }
}

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");
    state.filter = button.dataset.filter;
    render();
  });
});

$("#refreshButton").addEventListener("click", refresh);
refresh();
state.timer = setInterval(refresh, 10000);
