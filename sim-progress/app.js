const state = {
  filter: "all",
  status: null,
  history: [],
  clientHistory: [],
  timer: null,
  refreshMs: 5000,
};

const STAGES = ["em", "nvt", "npt", "md"];
const HISTORY_LIMIT = 1000;
const $ = (selector) => document.querySelector(selector);

if (window.location.protocol === "file:") {
  window.location.replace("http://127.0.0.1:8765/");
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

function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat().format(Number(value));
}

function formatScientific(value, decimals = 3) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return Number(value).toExponential(decimals);
}

function formatEnergy(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const numeric = Number(value);
  if (Math.abs(numeric) >= 100000) return `${(numeric / 1000000).toFixed(3)}e6`;
  return formatNumber(Math.round(numeric));
}

function formatRate(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const numeric = Number(value);
  if (Math.abs(numeric) >= 100) return numeric.toFixed(1);
  if (Math.abs(numeric) >= 10) return numeric.toFixed(2);
  return numeric.toFixed(3);
}

function formatBytes(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let numeric = Number(value);
  let unit = units[0];
  for (let index = 0; index < units.length; index += 1) {
    unit = units[index];
    if (Math.abs(numeric) < 1024 || index === units.length - 1) break;
    numeric /= 1024;
  }
  return unit === "B" ? `${Math.round(numeric)} B` : `${numeric.toFixed(1)} ${unit}`;
}

function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(Number(seconds))) return "-";
  let remaining = Math.max(0, Math.round(Number(seconds)));
  const days = Math.floor(remaining / 86400);
  remaining -= days * 86400;
  const hours = Math.floor(remaining / 3600);
  remaining -= hours * 3600;
  const minutes = Math.floor(remaining / 60);
  const secs = remaining - minutes * 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m ${secs}s`;
  return `${secs}s`;
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

function stageMapFor(simulation) {
  return Object.fromEntries((simulation?.stages || []).map((stage) => [stage.stage, stage]));
}

function stagePercent(simulation, stageName) {
  const stage = stageMapFor(simulation)[stageName];
  return stage?.completion_percent ?? stage?.percent ?? null;
}

function fileBytes(files, name) {
  return files?.[name]?.bytes ?? null;
}

function totalFileBytes(files) {
  if (!files) return null;
  const values = Object.values(files).map((item) => item?.bytes).filter((value) => defined(value));
  return values.length ? values.reduce((sum, value) => sum + Number(value), 0) : null;
}

function observable(sample, key) {
  return sample.active?.observables?.[key] ?? sample.active?.[key] ?? null;
}

function formatAxisValue(value, decimals, suffix) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "-";
  if (Math.abs(numeric) >= 100000 || (Math.abs(numeric) > 0 && Math.abs(numeric) < 0.001)) {
    return `${numeric.toExponential(1)}${suffix}`;
  }
  return `${numeric.toFixed(decimals)}${suffix}`;
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
  return window.location.protocol === "file:" || host.endsWith("github.io") || (host === "localhost" && !window.location.port);
}

function statusEndpoint() {
  if (window.location.protocol === "file:") return "../out/status.json";
  return isStaticHost() ? "status.json" : "/api/status";
}

function historyEndpoint() {
  if (window.location.protocol === "file:") return "../out/history.json";
  return isStaticHost() ? "history.json" : "/api/history";
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

function snapshotToTelemetry(data) {
  const { simulation, active } = getActive(data);
  const stagePercents = Object.fromEntries((simulation?.stages || []).map((stage) => [stage.stage, stage.completion_percent ?? stage.percent ?? null]));
  return {
    generated_at: data?.generated_at || new Date().toISOString(),
    source_root: data?.source_root || "-",
    running: data?.summary?.running ?? 0,
    attention: data?.summary?.attention ?? 0,
    complete: data?.summary?.complete ?? 0,
    simulations: data?.summary?.simulations ?? data?.simulations?.length ?? 0,
    latest_path: data?.summary?.latest_path || simulation?.path || "-",
    files: simulation?.files || {},
    stage_percents: stagePercents,
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
      pressure_coupling_bar: active.pressure_coupling_bar ?? null,
      potential_kj_mol: active.potential_kj_mol ?? null,
      kinetic_energy_kj_mol: active.kinetic_energy_kj_mol ?? null,
      total_energy_kj_mol: active.total_energy_kj_mol ?? null,
      conserved_energy_kj_mol: active.conserved_energy_kj_mol ?? null,
      constraint_rmsd: active.constraint_rmsd ?? null,
      observables: active.observables || {},
      observable_labels: active.observable_labels || {},
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
  if (Array.isArray(samples)) {
    return samples.filter((sample) => sample && sample.generated_at).slice(-2160);
  }
  if (typeof payload === "object") {
    return Object.entries(payload).flatMap(([path, rows]) => {
      if (!Array.isArray(rows)) return [];
      return rows.map((row) => ({
        generated_at: row.timestamp,
        latest_path: path,
        active: row ? {
          path,
          current_ns: row.ns,
          temperature_k: row.temperature_k,
          pressure_bar: row.pressure_bar,
          performance_ns_per_day: row.performance_ns_per_day,
          potential_kj_mol: row.potential_kj_mol,
        } : null,
      }));
    }).filter((sample) => sample.generated_at).slice(-2160);
  }
  return [];
}

function enrichHistory(samples) {
  const previousByRun = new Map();
  const lastPositiveRateByRun = new Map();
  const lastPositiveStepRateByRun = new Map();
  return samples.map((sample) => {
    const enriched = {
      ...sample,
      active: sample.active ? { ...sample.active } : null,
    };
    const active = enriched.active;
    if (!active) return enriched;

    const time = new Date(enriched.generated_at).getTime();
    const key = `${active.path || active.name || "run"}::${active.stage || "stage"}`;
    const previous = previousByRun.get(key);
    if (previous && Number.isFinite(time) && defined(active.current_ns) && defined(previous.active?.current_ns)) {
      const previousTime = new Date(previous.generated_at).getTime();
      const dtSeconds = (time - previousTime) / 1000;
      const deltaNs = Number(active.current_ns) - Number(previous.active.current_ns);
      if (dtSeconds > 0 && deltaNs > 0) {
        active.wall_speed_ns_per_day = deltaNs / (dtSeconds / 86400);
        lastPositiveRateByRun.set(key, active.wall_speed_ns_per_day);
      } else if (lastPositiveRateByRun.has(key)) {
        active.wall_speed_ns_per_day = lastPositiveRateByRun.get(key);
      }
      if (dtSeconds > 0 && defined(active.current_step) && defined(previous.active?.current_step)) {
        const deltaSteps = Number(active.current_step) - Number(previous.active.current_step);
        if (deltaSteps > 0) {
          active.steps_per_second = deltaSteps / dtSeconds;
          lastPositiveStepRateByRun.set(key, active.steps_per_second);
        } else if (lastPositiveStepRateByRun.has(key)) {
          active.steps_per_second = lastPositiveStepRateByRun.get(key);
        }
      }
      if (defined(active.total_ns) && defined(active.current_ns) && defined(active.wall_speed_ns_per_day) && active.wall_speed_ns_per_day > 0) {
        active.eta_seconds_from_rate = ((Number(active.total_ns) - Number(active.current_ns)) / active.wall_speed_ns_per_day) * 86400;
      }
    }
    previousByRun.set(key, enriched);
    return enriched;
  });
}

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
  return enrichHistory(Array.from(byTime.values())
    .sort((a, b) => new Date(a.generated_at) - new Date(b.generated_at))
    .slice(-2160));
}

function activeHero(data, history = []) {
  const { simulation, active } = getActive(data);
  if (!simulation || !active) {
    return `
      <div class="terminal-session">
        <pre><span class="prompt">$</span> gmx-watch --status
status: idle
scan_root: ${state.data?.source_root || "-"}
expected: em.log nvt.log npt.log md.log logs/*.run.log
endpoint: ${statusEndpoint()}</pre>
      </div>
    `;
    return;
  }

  const percent = clamp(active.percent ?? 0, 0, 100);
  const historyActive = [...history].reverse().find((sample) => sample.active?.path === simulation.path || sample.active?.name === simulation.name)?.active;
  const liveRate = active.performance_ns_per_day ?? historyActive?.wall_speed_ns_per_day;
  const speed = defined(liveRate) ? `${formatRate(liveRate)} ns/day` : "-";
  const eta = cleanEta(active.eta_text) !== "-" ? cleanEta(active.eta_text) : formatDuration(historyActive?.eta_seconds_from_rate);
  const timeLine = `${formatNs(active.current_ns)} / ${formatNs(active.total_ns)}`;
  const pid = active.process_id ? `pid ${active.process_id}${active.process_alive ? " live" : ""}` : "pid unknown";
  const barWidth = 36;
  const filled = Math.round((percent / 100) * barWidth);
  const asciiBar = `${"#".repeat(filled)}${".".repeat(Math.max(0, barWidth - filled))}`;
  const runtime = active.runtime || {};
  const mdp = active.mdp || {};
  return `
    <div class="terminal-session">
      <pre><span class="prompt">$</span> gmx-watch --root "${data.source_root || "."}" --tail
run: ${simulation.name}    status: ${statusLabel(simulation.status)}    phase: ${active.stage || "-"} / ${active.label || "-"}
progress: [${asciiBar}] ${formatPercent(active.percent)}    ${timeLine}
step: ${formatNumber(active.current_step)} / ${formatNumber(active.total_steps)}    ${pid}    samples: ${history.length}
speed: ${speed}    eta: ${eta}
thermo: T=${defined(active.temperature_k) ? Number(active.temperature_k).toFixed(3) : "-"} K    P=${defined(active.pressure_bar) ? Number(active.pressure_bar).toFixed(3) : "-"} bar    LINCS=${defined(active.constraint_rmsd) ? Number(active.constraint_rmsd).toExponential(2) : "-"}
energy: Pot=${defined(active.potential_kj_mol) ? Number(active.potential_kj_mol).toExponential(4) : "-"}    Kin=${defined(active.kinetic_energy_kj_mol) ? Number(active.kinetic_energy_kj_mol).toExponential(4) : "-"}    Tot=${defined(active.total_energy_kj_mol) ? Number(active.total_energy_kj_mol).toExponential(4) : "-"}
gpu: ${runtime.gpu_0 || runtime.gpu_support || "-"}    map=${runtime.gpu_task_mapping || "-"}    omp=${runtime.openmp_threads || "-"}
mdp: dt=${mdp.dt || "-"} ps    nsteps=${mdp.nsteps || "-"}    nstlog=${mdp.nstlog || "-"}    nstenergy=${mdp.nstenergy || "-"}
log: ${active.log_path || "-"}</pre>
      <div class="hero-stats">
        <div><span>phase</span><strong>${active.stage || "-"}</strong></div>
        <div><span>progress</span><strong>${formatPercent(active.percent)}</strong></div>
        <div><span>speed</span><strong>${speed}</strong></div>
        <div><span>eta</span><strong>${eta}</strong></div>
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

  const lines = [
    `[${formatClock(data?.generated_at)}] status=${statusLabel(simulation?.status)} endpoint=${statusEndpoint()} samples=${history.length}`,
    `scan_root=${data?.source_root || "-"}`,
  ];

  if (simulation && active) {
    const live = newest?.active || {};
    lines.push(`active=${simulation.name}`);
    lines.push(`stage=${active.stage || "-"} label="${active.label || "-"}" progress=${formatPercent(active.percent)} step=${formatNumber(active.current_step)}/${formatNumber(active.total_steps)}`);
    lines.push(`time=${formatNs(active.current_ns)}/${formatNs(active.total_ns)} gmx_speed=${defined(active.performance_ns_per_day) ? Number(active.performance_ns_per_day).toFixed(2) : "-"} ns/day wall_speed=${defined(live.wall_speed_ns_per_day) ? formatRate(live.wall_speed_ns_per_day) : "-"} ns/day eta="${cleanEta(active.eta_text)}"`);
    lines.push(`thermo temp=${defined(active.temperature_k) ? Number(active.temperature_k).toFixed(2) : "-"} K pressure=${defined(active.pressure_bar) ? Number(active.pressure_bar).toFixed(2) : "-"} bar potential=${defined(active.potential_kj_mol) ? Number(active.potential_kj_mol).toExponential(3) : "-"} kJ/mol constraint=${defined(active.constraint_rmsd) ? Number(active.constraint_rmsd).toExponential(2) : "-"}`);
    lines.push(`runtime gpu="${active.runtime?.gpu_0 || "-"}" pme="${active.runtime?.gpu_task_mapping || "-"}" threads="${active.runtime?.openmp_threads || "-"}"`);
    lines.push(`mdp dt=${active.mdp?.dt || "-"} ps nsteps=${active.mdp?.nsteps || "-"} nstlog=${active.mdp?.nstlog || "-"} nstenergy=${active.mdp?.nstenergy || "-"} tcoupl=${active.mdp?.tcoupl || "-"}`);
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

  const grid = yTicks.map((value) => {
    const yy = y(value);
    return `<line class="grid-line" x1="${margin.left}" y1="${yy.toFixed(1)}" x2="${width - margin.right}" y2="${yy.toFixed(1)}"></line><text class="tick-label" x="6" y="${(yy + 3).toFixed(1)}">${formatAxisValue(value, decimals, suffix)}</text>`;
  }).join("");

  const xTicks = [validRows[0], validRows[Math.floor(validRows.length / 2)], validRows[validRows.length - 1]];
  const xLabels = xTicks.map((row) => `<text class="tick-label" x="${x(row.t)}" y="${height - 14}" text-anchor="middle">${formatClock(row.generated_at)}</text>`).join("");

  const paths = series.map((item, index) => {
    const classNames = ["chart-line", "chart-line secondary", "chart-line tertiary", "chart-line quaternary", "chart-line fifth", "chart-line sixth"];
    const className = classNames[index] || "chart-line";
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
    const legendClasses = ["", "secondary", "tertiary", "quaternary", "fifth", "sixth"];
    const className = legendClasses[index] || "";
    return `<span class="${className}">${item.label}: ${formatAxisValue(value, decimals, suffix)}</span>`;
  }).join("");

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

function stageCell(stageName, stage) {
  if (!stage) {
    return `<div class="stage unknown"><strong>${stageName.toUpperCase()}</strong><span>-</span></div>`;
  }
  return `<div class="stage ${stage.status}"><strong>${stage.label}</strong><span>${formatPercent(stage.completion_percent ?? stage.percent)}</span></div>`;
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

function renderStageMatrix(data) {
  const simulations = data?.simulations || [];
  if (!simulations.length) return `<div class="empty-plot">No simulation stages found.</div>`;
  return simulations.slice(0, 40).map((simulation) => {
    const stageMap = Object.fromEntries((simulation.stages || []).map((stage) => [stage.stage, stage]));
    const cells = STAGES.map((name) => {
      const stage = stageMap[name];
      return `<div class="stage-box ${stage?.status || "unknown"}"><strong>${name}</strong><span>${stage ? formatPercent(stage.completion_percent ?? stage.percent) : "-"}</span></div>`;
    }).join("");
    return `<div class="stage-row"><div class="stage-name"><strong>${simulation.name}</strong><span>${simulation.path}</span></div>${cells}</div>`;
  }).join("");
}

function renderPhaseRibbon(data) {
  const { simulation } = getActive(data);
  if (!simulation) return `<div class="empty-plot">No active phase data.</div>`;
  return STAGES.map((name) => {
    const stage = stageMapFor(simulation)[name];
    const percent = clamp(stage?.completion_percent ?? stage?.percent ?? 0, 0, 100);
    return `
      <div class="phase-track ${name}">
        <strong>${name}</strong>
        <div class="phase-bar" style="--value: ${percent}"><i></i></div>
        <span>${stage ? formatPercent(stage.completion_percent ?? stage.percent) : "-"}</span>
      </div>
    `;
  }).join("");
}

function renderKeyValueRows(rows) {
  const visibleRows = rows.filter(([, value]) => value !== null && value !== undefined && value !== "");
  if (!visibleRows.length) return `<div class="empty-plot">No values parsed yet.</div>`;
  return visibleRows.map(([key, value]) => `<div class="stat-row"><span>${key}</span><strong>${value}</strong></div>`).join("");
}

function renderObservables(data) {
  const { active } = getActive(data);
  const observables = active?.observables || {};
  const labels = active?.observable_labels || {};
  const preferred = [
    "temperature_k",
    "pressure_bar",
    "pressure_coupling_bar",
    "constraint_rmsd",
    "potential_kj_mol",
    "kinetic_energy_kj_mol",
    "total_energy_kj_mol",
    "conserved_energy_kj_mol",
    "bond_kj_mol",
    "angle_kj_mol",
    "proper_dih_kj_mol",
    "improper_dih_kj_mol",
    "cmap_dih_kj_mol",
    "lj_14_kj_mol",
    "coulomb_14_kj_mol",
    "lj_sr_kj_mol",
    "coulomb_sr_kj_mol",
    "coulomb_recip_kj_mol",
    "dispersion_correction_kj_mol",
  ];
  const rows = preferred
    .filter((key) => Object.prototype.hasOwnProperty.call(observables, key))
    .map((key) => {
      const value = observables[key];
      let formatted = formatScientific(value, 4);
      if (key === "temperature_k") formatted = `${Number(value).toFixed(3)} K`;
      if (key.includes("pressure")) formatted = `${Number(value).toFixed(3)} bar`;
      if (key === "constraint_rmsd") formatted = Number(value).toExponential(3);
      if (key.endsWith("kj_mol")) formatted = `${formatScientific(value, 4)} kJ/mol`;
      return [labels[key] || key, formatted];
    });
  return renderKeyValueRows(rows);
}

function renderRuntime(data) {
  const { active } = getActive(data);
  const runtime = active?.runtime || {};
  const rows = [
    ["GROMACS", runtime.gromacs_version],
    ["command", runtime.command_line],
    ["hardware", runtime.hardware_summary],
    ["cpu", runtime.cpu_brand],
    ["gpu", runtime.gpu_0],
    ["gpu mapping", runtime.gpu_task_mapping],
    ["gpu kernels", runtime.gpu_kernels],
    ["gpu update", runtime.gpu_update],
    ["pme", runtime.pme_summary],
    ["mpi", runtime.mpi_threads || runtime.mpi_library],
    ["openmp", runtime.openmp_threads || runtime.openmp_support],
    ["simd", runtime.simd],
    ["cuda", runtime.cuda_driver && runtime.cuda_runtime ? `${runtime.cuda_driver} driver / ${runtime.cuda_runtime} runtime` : runtime.cuda_driver],
  ];
  return renderKeyValueRows(rows);
}

function renderMdp(data) {
  const { active } = getActive(data);
  const mdp = active?.mdp || {};
  const rows = [
    ["integrator", mdp.integrator],
    ["dt", mdp.dt ? `${mdp.dt} ps` : null],
    ["nsteps", mdp.nsteps],
    ["nstlog", mdp.nstlog],
    ["nstenergy", mdp.nstenergy],
    ["nstxout-compressed", mdp["nstxout-compressed"]],
    ["tcoupl", mdp.tcoupl],
    ["tc-grps", mdp["tc-grps"]],
    ["pcoupl", mdp.pcoupl],
    ["pcoupltype", mdp.pcoupltype],
    ["constraints", mdp.constraints || mdp["constraint-algorithm"]],
    ["coulombtype", mdp.coulombtype],
    ["vdw-type", mdp["vdw-type"]],
    ["pbc", mdp.pbc],
  ];
  return renderKeyValueRows(rows);
}

function renderStats(data, history) {
  const { simulation, active } = getActive(data);
  const latest = [...history].reverse().find((sample) => sample.active)?.active || {};
  const files = simulation?.files || {};
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
    ["wall speed", defined(latest.wall_speed_ns_per_day) ? `${formatRate(latest.wall_speed_ns_per_day)} ns/day` : "-"],
    ["sample eta", formatDuration(latest.eta_seconds_from_rate)],
    ["temperature", defined(active?.temperature_k) ? `${Number(active.temperature_k).toFixed(2)} K` : "-"],
    ["pressure", defined(active?.pressure_bar) ? `${Number(active.pressure_bar).toFixed(2)} bar` : "-"],
    ["potential", defined(active?.potential_kj_mol) ? `${Number(active.potential_kj_mol).toExponential(4)} kJ/mol` : "-"],
    ["kinetic", defined(active?.kinetic_energy_kj_mol) ? `${Number(active.kinetic_energy_kj_mol).toExponential(4)} kJ/mol` : "-"],
    ["conserved", defined(active?.conserved_energy_kj_mol) ? `${Number(active.conserved_energy_kj_mol).toExponential(4)} kJ/mol` : "-"],
    ["constraint rmsd", defined(active?.constraint_rmsd) ? Number(active.constraint_rmsd).toExponential(3) : "-"],
    ["artifact total", formatBytes(totalFileBytes(files))],
    ["samples", String(history.length)],
  ];

  $("#diagnostics").innerHTML = diagnostics.map(([key, value]) => `
    <dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd>
  `).join("");
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
  $("#plotStep").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "step / 1e6", value: (sample) => defined(sample.active?.current_step) ? sample.active.current_step / 1000000 : null },
      { label: "ns", value: (sample) => sample.active?.current_ns },
      { label: "ksteps/s", value: (sample) => defined(sample.active?.steps_per_second) ? sample.active.steps_per_second / 1000 : null },
    ],
    suffix: "",
    decimals: 2,
  });
  $("#plotSpeed").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "gmx ns/day", value: (sample) => sample.active?.performance_ns_per_day },
      { label: "wall ns/day", value: (sample) => sample.active?.wall_speed_ns_per_day },
      { label: "ksteps/s", value: (sample) => defined(sample.active?.steps_per_second) ? sample.active.steps_per_second / 1000 : null },
    ],
    suffix: "",
    decimals: 2,
  });
  $("#plotTemperature").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "temperature", value: (sample) => sample.active?.temperature_k },
      { label: "target 310K", value: () => 310 },
    ],
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
  $("#plotPressureControl").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "pressure", value: (sample) => sample.active?.pressure_bar },
      { label: "Pres. DC", value: (sample) => sample.active?.pressure_coupling_bar },
      { label: "target 1 bar", value: () => 1 },
    ],
    suffix: "",
    decimals: 1,
  });
  $("#plotEnergy").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "potential", value: (sample) => sample.active?.potential_kj_mol },
      { label: "total", value: (sample) => sample.active?.total_energy_kj_mol },
      { label: "kinetic", value: (sample) => sample.active?.kinetic_energy_kj_mol },
      { label: "conserved", value: (sample) => sample.active?.conserved_energy_kj_mol },
    ],
    suffix: "",
    decimals: 0,
  });
  $("#plotBonded").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "bond", value: (sample) => observable(sample, "bond_kj_mol") },
      { label: "angle", value: (sample) => observable(sample, "angle_kj_mol") },
      { label: "proper dih", value: (sample) => observable(sample, "proper_dih_kj_mol") },
      { label: "improper", value: (sample) => observable(sample, "improper_dih_kj_mol") },
      { label: "CMAP", value: (sample) => observable(sample, "cmap_dih_kj_mol") },
    ],
    suffix: "",
    decimals: 0,
  });
  $("#plotNonbonded").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "LJ SR", value: (sample) => observable(sample, "lj_sr_kj_mol") },
      { label: "Coul SR", value: (sample) => observable(sample, "coulomb_sr_kj_mol") },
      { label: "Coul recip", value: (sample) => observable(sample, "coulomb_recip_kj_mol") },
      { label: "LJ-14", value: (sample) => observable(sample, "lj_14_kj_mol") },
      { label: "Coul-14", value: (sample) => observable(sample, "coulomb_14_kj_mol") },
      { label: "DispCorr", value: (sample) => observable(sample, "dispersion_correction_kj_mol") },
    ],
    suffix: "",
    decimals: 0,
  });
  $("#plotConstraint").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "constraint rmsd", value: (sample) => sample.active?.constraint_rmsd },
      { label: "conserved / 1e6", value: (sample) => defined(sample.active?.conserved_energy_kj_mol) ? sample.active.conserved_energy_kj_mol / 1000000 : null },
    ],
    suffix: "",
    decimals: 3,
  });
  $("#plotArtifacts").innerHTML = makeLineChart({
    samples: history,
    series: [
      { label: "xtc MB", value: (sample) => defined(fileBytes(sample.files, "md.xtc")) ? fileBytes(sample.files, "md.xtc") / 1048576 : null },
      { label: "edr MB", value: (sample) => defined(fileBytes(sample.files, "md.edr")) ? fileBytes(sample.files, "md.edr") / 1048576 : null },
      { label: "log MB", value: (sample) => defined(fileBytes(sample.files, "md.log")) ? fileBytes(sample.files, "md.log") / 1048576 : null },
      { label: "cpt MB", value: (sample) => defined(fileBytes(sample.files, "md.cpt")) ? fileBytes(sample.files, "md.cpt") / 1048576 : null },
    ],
    suffix: "",
    decimals: 1,
  });

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
  const data = state.data;
  if (!data) return;
  const current = snapshotToTelemetry(data);
  const history = mergeHistory(state.history, state.clientHistory, current);
  const { simulation, active } = getActive(data);
  const latestActive = [...history].reverse().find((sample) => sample.active)?.active || {};

  $("#sourceRoot").textContent = data.source_root || "-";
  $("#activeHero").innerHTML = activeHero(data, history);
  $("#runningCount").textContent = String(data.summary?.running ?? 0);
  $("#activePercent").textContent = formatPercent(data.summary?.active_percent ?? active?.percent);
  $("#activeEta").textContent = cleanEta(data.summary?.active_eta ?? active?.eta_text);
  $("#speedStat").textContent = defined(active?.performance_ns_per_day) ? Number(active.performance_ns_per_day).toFixed(2) : defined(latestActive.wall_speed_ns_per_day) ? formatRate(latestActive.wall_speed_ns_per_day) : "-";
  $("#tempStat").textContent = defined(active?.temperature_k) ? `${Number(active.temperature_k).toFixed(1)} K` : "-";
  $("#pressureStat").textContent = defined(active?.pressure_bar) ? `${Number(active.pressure_bar).toFixed(1)} bar` : "-";
  $("#stepStat").textContent = `${formatNumber(active?.current_step)} / ${formatNumber(active?.total_steps)}`;
  $("#samplesCount").textContent = String(history.length);
  $("#emPercent").textContent = formatPercent(stagePercent(simulation, "em"));
  $("#nvtPercent").textContent = formatPercent(stagePercent(simulation, "nvt"));
  $("#nptPercent").textContent = formatPercent(stagePercent(simulation, "npt"));
  $("#mdPercent").textContent = formatPercent(stagePercent(simulation, "md"));
  $("#wallRateStat").textContent = defined(latestActive.wall_speed_ns_per_day) ? `${formatRate(latestActive.wall_speed_ns_per_day)}` : "-";
  $("#artifactStat").textContent = formatBytes(totalFileBytes(simulation?.files));
  $("#clockState").textContent = formatClock(new Date().toISOString());
  $("#generatedAt").textContent = formatClock(data.generated_at);
  $("#commitState").textContent = isStaticHost() ? "status.json + history.json" : "live /api/status";
  $("#lastRefresh").textContent = `refreshed ${formatClock(data.generated_at)} :: browser ${formatClock(new Date().toISOString())}`;
  $("#nsStat").textContent = simulation && active ? `${simulation.name} :: ${formatNs(active.current_ns)} / ${formatNs(active.total_ns)}` : "no active run";
  $("#terminalLines").textContent = terminalLog(data, history);
  $("#statsTable").innerHTML = renderStats(data, history);
  $("#observablesTable").innerHTML = renderObservables(data);
  $("#runtimeTable").innerHTML = renderRuntime(data);
  $("#mdpTable").innerHTML = renderMdp(data);
  $("#phaseRibbon").innerHTML = renderPhaseRibbon(data);
  $("#stageMatrix").innerHTML = renderStageMatrix(data);
  renderPlots(history);

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
  setHealth("updating", null);
  try {
    const endpoint = statusEndpoint();
    const response = await fetch(cacheBust(endpoint), { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    if (!isStaticHost()) {
      state.clientHistory.push(snapshotToTelemetry(state.data));
      state.clientHistory = state.clientHistory.slice(-2160);
    }
    await loadHistory();
    setHealth(endpoint === "status.json" ? "snapshot" : "live", true);
    render();
  } catch (error) {
    setHealth("offline", false);
    console.error(error);
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
state.timer = setInterval(refresh, state.refreshMs);
