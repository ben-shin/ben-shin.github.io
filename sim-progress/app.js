const state = {
  filter: "all",
  data: null,
  history: [],
  clientHistory: [],
  viz: null,
  vizGeneratedAt: null,
  timer: null,
  historyLoaded: false,
  historyLoading: false,
  historyFetchedAt: 0,
  vizLoading: false,
  vizFetchedAt: 0,
  plotTask: null,
  plotTaskType: null,
  lastPlotKey: null,
  refreshMs: 5000,
};

const STAGES = ["em", "nvt", "npt", "md_relax", "md"];
const ETA_SOURCE_TIME_ZONE = "Europe/London";
const LEGACY_TIMESTAMP_TIME_ZONE = "Europe/London";
const STATIC_HISTORY_REFRESH_MS = 5 * 60 * 1000;
const LIVE_HISTORY_REFRESH_MS = 30 * 1000;
const VIZ_METADATA_REFRESH_MS = 60 * 1000;
const TARGET_TEMP_K = 310;
const TARGET_PRESSURE_BAR = 1;
const MONTH_INDEX = {
  Jan: 0,
  Feb: 1,
  Mar: 2,
  Apr: 3,
  May: 4,
  Jun: 5,
  Jul: 6,
  Aug: 7,
  Sep: 8,
  Oct: 9,
  Nov: 10,
  Dec: 11,
};
const $ = (selector) => document.querySelector(selector);

if (window.location.protocol === "file:") {
  window.location.replace("http://127.0.0.1:8765/");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function asciiProgressBar(value, width = 32) {
  const percent = clamp(Number(value) || 0, 0, 100);
  const filled = Math.round((percent / 100) * width);
  return `[${"#".repeat(filled)}${".".repeat(Math.max(0, width - filled))}]`;
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

function viewerTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
}

function withViewerTimeZone(options = {}) {
  const zone = viewerTimeZone();
  return zone ? { ...options, timeZone: zone } : options;
}

function formatClock(value) {
  if (!value) return "-";
  const date = parseTimestamp(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleTimeString("en-GB", withViewerTimeZone({
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }));
}

function formatShortTime(value) {
  if (!value) return "-";
  const date = parseTimestamp(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("en-GB", withViewerTimeZone({
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }));
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = parseTimestamp(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", withViewerTimeZone({
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }));
}

function timeZoneOffsetMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return Math.round((asUtc - date.getTime()) / 60000);
}

function wallTimeToInstant({ year, month, day, hour, minute, second }, timeZone) {
  const wallUtc = Date.UTC(year, month, day, hour, minute, second);
  const firstOffset = timeZoneOffsetMinutes(new Date(wallUtc), timeZone);
  let instant = new Date(wallUtc - firstOffset * 60000);
  const revisedOffset = timeZoneOffsetMinutes(instant, timeZone);
  if (revisedOffset !== firstOffset) {
    instant = new Date(wallUtc - revisedOffset * 60000);
  }
  return instant;
}

function parseTimestamp(value) {
  if (!value) return new Date(Number.NaN);
  if (value instanceof Date) return value;
  if (typeof value !== "string") return new Date(value);
  const text = value.trim();
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) return new Date(text);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!match) return new Date(text);
  return wallTimeToInstant({
    year: Number(match[1]),
    month: Number(match[2]) - 1,
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] || 0),
  }, LEGACY_TIMESTAMP_TIME_ZONE);
}

function viewerTimeZoneLabel(value = new Date()) {
  const zone = viewerTimeZone();
  const date = parseTimestamp(value);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat(undefined, withViewerTimeZone({
    timeZoneName: "short",
    hour: "2-digit",
  })).formatToParts(safeDate);
  const abbreviation = parts.find((part) => part.type === "timeZoneName")?.value;
  if (abbreviation && zone) return `${abbreviation} (${zone})`;
  return abbreviation || zone || "local time";
}

function formatViewerDateTime(value) {
  const date = parseTimestamp(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, withViewerTimeZone({
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }));
}

function parseGromacsEtaText(text) {
  if (!text) return null;
  const match = String(text).trim().match(/^(?:[A-Za-z]{3}\s+)?([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTH_INDEX[match[1]];
  if (month === undefined) return null;
  const instant = wallTimeToInstant({
    year: Number(match[6]),
    month,
    day: Number(match[2]),
    hour: Number(match[3]),
    minute: Number(match[4]),
    second: Number(match[5]),
  }, ETA_SOURCE_TIME_ZONE);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

function etaInstant(etaAt, etaText) {
  if (etaAt) {
    const date = parseTimestamp(etaAt);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return parseGromacsEtaText(etaText);
}

function cleanEta(text) {
  if (!text) return "-";
  return String(text).replace(/\s+/g, " ").trim();
}

function formatEta(etaAt, etaText = etaAt) {
  const instant = etaInstant(etaAt, etaText);
  if (instant) {
    const localText = formatViewerDateTime(instant);
    if (localText) return `${localText} ${viewerTimeZoneLabel(instant)}`;
  }
  const cleaned = cleanEta(etaText);
  return cleaned === "-" ? "-" : cleaned;
}

function formatEstimatedEtaFromRate(seconds) {
  const duration = formatDuration(seconds);
  return duration === "-" ? "-" : `${duration} @ current wall rate`;
}

function formatStageEta(stage, fallbackSeconds = null) {
  if (!stage) return "-";
  if (stage.status === "complete") return "complete";
  if (stage.status === "stale") return `stale @ ${formatPercent(stage.percent)}`;
  if (stage.status === "failed") return "failed";
  if (stage.status === "queued") return "queued";
  if (cleanEta(stage.eta_text) !== "-" || stage.eta_at) return formatEta(stage.eta_at, stage.eta_text);
  return formatEstimatedEtaFromRate(fallbackSeconds);
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
    queued: "queued",
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

function vizMetadataEndpoint() {
  return "viz/md_preview.json";
}

function cacheBust(url) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}t=${Date.now()}`;
}

function historyRefreshMs() {
  return isStaticHost() ? STATIC_HISTORY_REFRESH_MS : LIVE_HISTORY_REFRESH_MS;
}

function shouldLoadHistory(force = false) {
  if (force) return true;
  if (state.historyLoading) return false;
  if (!state.historyLoaded) return !state.historyFetchedAt || Date.now() - state.historyFetchedAt > 15 * 1000;
  return Date.now() - state.historyFetchedAt > historyRefreshMs();
}

function shouldLoadVizMetadata(force = false) {
  if (force) return true;
  if (state.vizLoading) return false;
  return Date.now() - state.vizFetchedAt > VIZ_METADATA_REFRESH_MS;
}

function chartPointLimit() {
  if (window.matchMedia?.("(max-width: 600px)")?.matches) return 240;
  if (window.matchMedia?.("(max-width: 980px)")?.matches) return 420;
  return 720;
}

function thinSamples(samples, maxPoints = chartPointLimit()) {
  if (!Array.isArray(samples) || samples.length <= maxPoints) return samples;
  if (maxPoints < 2) return samples.slice(-maxPoints);
  const result = [];
  const stride = (samples.length - 1) / (maxPoints - 1);
  let lastIndex = -1;
  for (let index = 0; index < maxPoints; index += 1) {
    const sampleIndex = Math.min(samples.length - 1, Math.round(index * stride));
    if (sampleIndex !== lastIndex) {
      result.push(samples[sampleIndex]);
      lastIndex = sampleIndex;
    }
  }
  return result;
}

function cancelPlotTask() {
  if (!state.plotTask) return;
  if (state.plotTaskType === "idle" && window.cancelIdleCallback) {
    window.cancelIdleCallback(state.plotTask);
  } else {
    clearTimeout(state.plotTask);
  }
  state.plotTask = null;
  state.plotTaskType = null;
}

function scheduleRenderPlots(history) {
  const first = history[0]?.generated_at || "-";
  const last = history[history.length - 1]?.generated_at || "-";
  const key = `${history.length}:${first}:${last}:${chartPointLimit()}`;
  if (state.lastPlotKey === key) return;
  state.lastPlotKey = key;
  cancelPlotTask();
  const run = () => {
    state.plotTask = null;
    state.plotTaskType = null;
    renderPlots(history);
  };
  if (window.requestIdleCallback) {
    state.plotTaskType = "idle";
    state.plotTask = window.requestIdleCallback(run, { timeout: 1200 });
  } else {
    state.plotTaskType = "timeout";
    state.plotTask = setTimeout(run, 25);
  }
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
  const stagePercents = Object.fromEntries((simulation?.stages || []).map((stage) => [stage.stage, stage.completion_percent ?? stage.percent ?? null]));
  return {
    generated_at: data?.generated_at || new Date().toISOString(),
    source_root: data?.source_root || "-",
    running: data?.summary?.running ?? 0,
    queued: data?.summary?.queued ?? 0,
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
      eta_at: active.eta_at || null,
      status_detail: active.status_detail || null,
      performance_ns_per_day: active.performance_ns_per_day ?? null,
      wall_speed_ns_per_day: active.wall_speed_ns_per_day ?? null,
      steps_per_second: active.steps_per_second ?? null,
      eta_seconds_from_rate: active.eta_seconds_from_rate ?? null,
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

    const time = parseTimestamp(enriched.generated_at).getTime();
    const key = `${active.path || active.name || "run"}::${active.stage || "stage"}`;
    const previous = previousByRun.get(key);
    const artifactBytes = totalFileBytes(enriched.files);
    if (defined(artifactBytes)) {
      active.artifact_total_mb = Number(artifactBytes) / 1048576;
    }
    if (defined(active.total_ns) && defined(active.current_ns)) {
      active.ns_remaining = Math.max(0, Number(active.total_ns) - Number(active.current_ns));
    }
    if (defined(active.wall_speed_ns_per_day) && defined(active.performance_ns_per_day) && Number(active.performance_ns_per_day) > 0) {
      active.wall_to_gmx_ratio = Number(active.wall_speed_ns_per_day) / Number(active.performance_ns_per_day);
    }
    if (previous && Number.isFinite(time)) {
      const previousTime = parseTimestamp(previous.generated_at).getTime();
      const dtSeconds = (time - previousTime) / 1000;
      if (dtSeconds > 0) {
        active.sample_interval_seconds = dtSeconds;
        if (defined(active.percent) && defined(previous.active?.percent)) {
          active.progress_percent_per_hour = (Number(active.percent) - Number(previous.active.percent)) / (dtSeconds / 3600);
        }
        if (defined(artifactBytes) && defined(totalFileBytes(previous.files))) {
          active.artifact_mb_per_min = (Number(artifactBytes) - Number(totalFileBytes(previous.files))) / 1048576 / (dtSeconds / 60);
        }

        const fileRates = {};
        ["md.xtc", "md.edr", "md.log", "md.cpt"].forEach((name) => {
          const currentBytes = fileBytes(enriched.files, name);
          const previousBytes = fileBytes(previous.files, name);
          if (defined(currentBytes) && defined(previousBytes)) {
            fileRates[name] = (Number(currentBytes) - Number(previousBytes)) / 1048576 / (dtSeconds / 60);
          }
        });
        if (Object.keys(fileRates).length) {
          active.file_rates_mb_min = fileRates;
        }

        if (defined(active.current_ns) && defined(previous.active?.current_ns)) {
          const deltaNs = Number(active.current_ns) - Number(previous.active.current_ns);
          if (deltaNs > 0) {
            active.wall_speed_ns_per_day = deltaNs / (dtSeconds / 86400);
            lastPositiveRateByRun.set(key, active.wall_speed_ns_per_day);
          } else if (lastPositiveRateByRun.has(key)) {
            active.wall_speed_ns_per_day = lastPositiveRateByRun.get(key);
          }
        }
        if (defined(active.current_step) && defined(previous.active?.current_step)) {
          const deltaSteps = Number(active.current_step) - Number(previous.active.current_step);
          if (deltaSteps > 0) {
            active.steps_per_second = deltaSteps / dtSeconds;
            lastPositiveStepRateByRun.set(key, active.steps_per_second);
          } else if (lastPositiveStepRateByRun.has(key)) {
            active.steps_per_second = lastPositiveStepRateByRun.get(key);
          }
        }
      }
      if (defined(active.total_ns) && defined(active.current_ns) && defined(active.wall_speed_ns_per_day) && active.wall_speed_ns_per_day > 0) {
        active.eta_seconds_from_rate = ((Number(active.total_ns) - Number(active.current_ns)) / active.wall_speed_ns_per_day) * 86400;
      }
      if (defined(active.wall_speed_ns_per_day) && defined(active.performance_ns_per_day) && Number(active.performance_ns_per_day) > 0) {
        active.wall_to_gmx_ratio = Number(active.wall_speed_ns_per_day) / Number(active.performance_ns_per_day);
      }
    }
    previousByRun.set(key, enriched);
    return enriched;
  });
}

function mergeHistory(staticHistory, clientHistory, current) {
  const byTime = new Map();
  [...staticHistory, ...clientHistory, current].filter(Boolean).forEach((sample) => {
    byTime.set(sample.generated_at, sample);
  });
  return enrichHistory(Array.from(byTime.values())
    .sort((a, b) => parseTimestamp(a.generated_at) - parseTimestamp(b.generated_at))
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
  }

  const percent = clamp(active.percent ?? 0, 0, 100);
  const historyActive = [...history].reverse().find((sample) => sample.active?.path === simulation.path || sample.active?.name === simulation.name)?.active;
  const liveRate = active.wall_speed_ns_per_day ?? historyActive?.wall_speed_ns_per_day ?? active.performance_ns_per_day;
  const speed = defined(liveRate) ? `${formatRate(liveRate)} ns/day` : "-";
  const eta = formatStageEta(active, historyActive?.eta_seconds_from_rate);
  const timeLine = `${formatNs(active.current_ns)} / ${formatNs(active.total_ns)}`;
  const pid = active.process_id ? `pid ${active.process_id}${active.process_alive ? " live" : ""}` : "pid unknown";
  const runtime = active.runtime || {};
  const mdp = active.mdp || {};
  return `
    <div class="terminal-session">
      <pre><span class="prompt">$</span> gmx-watch --root "${data.source_root || "."}" --tail
run: ${simulation.name}    status: ${statusLabel(simulation.status)}    phase: ${active.stage || "-"} / ${active.label || "-"}
progress: ${asciiProgressBar(percent, 36)} ${formatPercent(active.percent)}    ${timeLine}
step: ${formatNumber(active.current_step)} / ${formatNumber(active.total_steps)}    ${pid}    samples: ${history.length}
speed: ${speed}    eta: ${eta}
state: ${active.status_detail || statusLabel(active.status)}
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
    `[${formatClock(data?.generated_at)} ${viewerTimeZoneLabel(data?.generated_at)}] status=${statusLabel(simulation?.status)} endpoint=${statusEndpoint()} samples=${history.length}`,
    `scan_root=${data?.source_root || "-"}`,
  ];

  if (simulation && active) {
    const live = newest?.active || {};
    lines.push(`active=${simulation.name}`);
    lines.push(`stage=${active.stage || "-"} label="${active.label || "-"}" progress=${formatPercent(active.percent)} step=${formatNumber(active.current_step)}/${formatNumber(active.total_steps)}`);
    lines.push(`time=${formatNs(active.current_ns)}/${formatNs(active.total_ns)} gmx_speed=${defined(active.performance_ns_per_day) ? Number(active.performance_ns_per_day).toFixed(2) : "-"} ns/day wall_speed=${defined(live.wall_speed_ns_per_day) ? formatRate(live.wall_speed_ns_per_day) : "-"} ns/day eta="${formatStageEta(active, live.eta_seconds_from_rate)}"`);
    if (active.status_detail) lines.push(`state_detail="${active.status_detail}"`);
    lines.push(`thermo temp=${defined(active.temperature_k) ? Number(active.temperature_k).toFixed(2) : "-"} K pressure=${defined(active.pressure_bar) ? Number(active.pressure_bar).toFixed(2) : "-"} bar potential=${defined(active.potential_kj_mol) ? Number(active.potential_kj_mol).toExponential(3) : "-"} kJ/mol constraint=${defined(active.constraint_rmsd) ? Number(active.constraint_rmsd).toExponential(2) : "-"}`);
    lines.push(`runtime gpu="${active.runtime?.gpu_0 || "-"}" pme="${active.runtime?.gpu_task_mapping || "-"}" threads="${active.runtime?.openmp_threads || "-"}"`);
    lines.push(`mdp dt=${active.mdp?.dt || "-"} ps nsteps=${active.mdp?.nsteps || "-"} nstlog=${active.mdp?.nstlog || "-"} nstenergy=${active.mdp?.nstenergy || "-"} tcoupl=${active.mdp?.tcoupl || "-"}`);
    lines.push(`process pid=${active.process_id || "-"} alive=${active.process_alive === null || active.process_alive === undefined ? "unknown" : String(active.process_alive)} log=${active.log_path || "-"}`);
  }
  if (deltaPercent !== null || deltaStep !== null) {
    lines.push(`delta_since_last_sample=${deltaPercent === null ? "-" : `${deltaPercent >= 0 ? "+" : ""}${deltaPercent.toFixed(3)}%`} steps=${deltaStep === null ? "-" : `${deltaStep >= 0 ? "+" : ""}${formatNumber(deltaStep)}`}`);
  }
  if (data?.summary) {
    lines.push(`queue simulations=${data.summary.simulations} running=${data.summary.running} queued=${data.summary.queued ?? 0} attention=${data.summary.attention} complete=${data.summary.complete}`);
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
    .map((sample) => ({ ...sample, xDate: parseTimestamp(sample.generated_at) }))
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
    return `<line class="grid-line" x1="${margin.left}" y1="${yy.toFixed(1)}" x2="${width - margin.right}" y2="${yy.toFixed(1)}"></line><text class="tick-label" x="6" y="${(yy + 3).toFixed(1)}">${formatAxisValue(value, decimals, suffix)}</text>`;
  }).join("");

  const xLabels = xTicks.map((row) => `<text class="tick-label" x="${x(row).toFixed(1)}" y="${height - 9}" text-anchor="middle">${formatShortTime(row.generated_at)}</text>`).join("");

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
  return `<div class="stage ${stage.status}"><strong>${stage.label}</strong><span>${formatPercent(stage.completion_percent ?? stage.percent)}</span></div>`;
}

function simulationCard(simulation) {
  const active = simulation.active_stage || {};
  const percent = clamp(active.percent ?? 0, 0, 100);
  const stageMap = Object.fromEntries((simulation.stages || []).map((stage) => [stage.stage, stage]));
  const liveSpeed = active.wall_speed_ns_per_day ?? active.performance_ns_per_day;
  const performance = defined(liveSpeed) ? `${formatRate(liveSpeed)} ns/day` : "-";
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
          <pre class="ascii-progress">${asciiProgressBar(percent, 28)} ${formatPercent(active.percent)}</pre>
          <div class="detail-grid">
            <div class="detail"><span class="detail-label">stage</span><strong>${active.label || "-"}</strong></div>
            <div class="detail"><span class="detail-label">time</span><strong>${formatNs(active.current_ns)} / ${formatNs(active.total_ns)}</strong></div>
            <div class="detail"><span class="detail-label">step</span><strong>${formatNumber(active.current_step)} / ${formatNumber(active.total_steps)}</strong></div>
            <div class="detail"><span class="detail-label">eta</span><strong>${formatStageEta(active)}</strong></div>
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

function stageStatusSummary(simulation) {
  const stages = simulation?.stages || [];
  if (!stages.length) return "-";
  return stages.map((stage) => `${stage.stage}:${statusLabel(stage.status)}:${formatPercent(stage.completion_percent ?? stage.percent)}`).join(" ");
}

function renderJobLedger(simulations, emptyText) {
  if (!simulations.length) return `<div class="empty-plot">${emptyText}</div>`;
  return simulations.slice(0, 12).map((simulation) => {
    const active = simulation.active_stage || {};
    const files = totalFileBytes(simulation.files);
    const liveSpeed = active.wall_speed_ns_per_day ?? active.performance_ns_per_day;
    const speed = defined(liveSpeed) ? `${formatRate(liveSpeed)} ns/day` : "-";
    const ns = defined(active.current_ns) || defined(active.total_ns) ? `${formatNs(active.current_ns)} / ${formatNs(active.total_ns)}` : "-";
    const queueInput = active.input_path ? `<span>input=${active.input_path}</span>` : "";
    const detail = active.status_detail ? ` :: ${active.status_detail}` : "";
    return `
      <div class="job-row ${simulation.status}">
        <div>
          <strong>${simulation.name}</strong>
          <span>${simulation.path}</span>
          ${queueInput}
        </div>
        <code>${statusLabel(simulation.status)} :: ${active.stage || "-"} :: ${formatPercent(active.percent)}${detail}</code>
        <code>${ns} :: ${speed} :: files=${formatBytes(files)} :: age=${formatAge(simulation.age_seconds)}</code>
        <code>${stageStatusSummary(simulation)}</code>
      </div>
    `;
  }).join("");
}

function renderQueuedJobs(data) {
  const queued = (data?.simulations || []).filter((simulation) => simulation.status === "queued");
  return renderJobLedger(queued, "No queued jobs detected from stage input/log scan.");
}

function renderCompleteJobs(data) {
  const complete = (data?.simulations || []).filter((simulation) => simulation.status === "complete");
  return renderJobLedger(complete, "No completed jobs detected yet.");
}

function renderStats(data, history) {
  const { simulation, active } = getActive(data);
  const latest = [...history].reverse().find((sample) => sample.active)?.active || {};
  const files = simulation?.files || {};
  const rows = [
    ["mode", isStaticHost() ? "GitHub Pages snapshot" : "local live API"],
    ["endpoint", statusEndpoint()],
    ["viewer tz", viewerTimeZoneLabel(data?.generated_at)],
    ["generated", formatDateTime(data?.generated_at)],
    ["simulations", data.summary?.simulations ?? "-"],
    ["running", data.summary?.running ?? 0],
    ["queued", data.summary?.queued ?? 0],
    ["complete", data.summary?.complete ?? 0],
    ["active run", simulation?.name || "-"],
    ["stage", active?.label || "-"],
    ["status", statusLabel(simulation?.status)],
    ["progress", formatPercent(active?.percent)],
    ["progress/hr", defined(latest.progress_percent_per_hour) ? `${formatRate(latest.progress_percent_per_hour)} %/hr` : "-"],
    ["viewer eta", formatStageEta(active, latest.eta_seconds_from_rate)],
    ["state detail", active?.status_detail || "-"],
    ["ns", `${formatNs(active?.current_ns)} / ${formatNs(active?.total_ns)}`],
    ["ns remaining", formatNs(latest.ns_remaining ?? (defined(active?.total_ns) && defined(active?.current_ns) ? Number(active.total_ns) - Number(active.current_ns) : null))],
    ["steps", `${formatNumber(active?.current_step)} / ${formatNumber(active?.total_steps)}`],
    ["speed", defined(active?.wall_speed_ns_per_day) ? `${formatRate(active.wall_speed_ns_per_day)} ns/day` : defined(latest.wall_speed_ns_per_day) ? `${formatRate(latest.wall_speed_ns_per_day)} ns/day` : "-"],
    ["gmx perf", defined(active?.performance_ns_per_day) ? `${Number(active.performance_ns_per_day).toFixed(2)} ns/day` : "-"],
    ["speed ratio", defined(latest.wall_to_gmx_ratio) ? `${Number(latest.wall_to_gmx_ratio).toFixed(3)} wall/gmx` : "-"],
    ["sample eta", formatEstimatedEtaFromRate(latest.eta_seconds_from_rate)],
    ["sample dt", defined(latest.sample_interval_seconds) ? `${Number(latest.sample_interval_seconds).toFixed(1)} s` : "-"],
    ["temperature", defined(active?.temperature_k) ? `${Number(active.temperature_k).toFixed(2)} K` : "-"],
    ["T error", defined(active?.temperature_k) ? `${(Number(active.temperature_k) - TARGET_TEMP_K).toFixed(2)} K` : "-"],
    ["pressure", defined(active?.pressure_bar) ? `${Number(active.pressure_bar).toFixed(2)} bar` : "-"],
    ["P error", defined(active?.pressure_bar) ? `${(Number(active.pressure_bar) - TARGET_PRESSURE_BAR).toFixed(2)} bar` : "-"],
    ["potential", defined(active?.potential_kj_mol) ? `${Number(active.potential_kj_mol).toExponential(4)} kJ/mol` : "-"],
    ["kinetic", defined(active?.kinetic_energy_kj_mol) ? `${Number(active.kinetic_energy_kj_mol).toExponential(4)} kJ/mol` : "-"],
    ["conserved", defined(active?.conserved_energy_kj_mol) ? `${Number(active.conserved_energy_kj_mol).toExponential(4)} kJ/mol` : "-"],
    ["constraint rmsd", defined(active?.constraint_rmsd) ? Number(active.constraint_rmsd).toExponential(3) : "-"],
    ["artifact total", formatBytes(totalFileBytes(files))],
    ["artifact rate", defined(latest.artifact_mb_per_min) ? `${formatRate(latest.artifact_mb_per_min)} MB/min` : "-"],
    ["samples", String(history.length)],
  ];
  return rows.map(([key, value]) => `<div class="stat-row"><span>${key}</span><strong>${value}</strong></div>`).join("");
}

function renderViz() {
  const video = $("#vizVideo");
  const meta = $("#vizMeta");
  const stateLabel = $("#vizState");
  const viz = state.viz;
  if (!video || !meta || !stateLabel) return;
  if (!viz) {
    stateLabel.textContent = "waiting";
    video.removeAttribute("src");
    meta.textContent = [
      "status: no preview video yet",
      "cadence: stats every 300s, video every 1800s",
      "expected: viz/md_preview.mp4 + viz/md_preview.json",
    ].join("\n");
    return;
  }
  stateLabel.textContent = `${formatClock(viz.generated_at)} ${viewerTimeZoneLabel(viz.generated_at)} :: ${formatBytes(viz.mp4_bytes)}`;
  if (viz.generated_at !== state.vizGeneratedAt) {
    state.vizGeneratedAt = viz.generated_at;
    video.poster = cacheBust("viz/md_preview.png");
    video.src = cacheBust("viz/md_preview.mp4");
    video.load();
  }
  meta.textContent = [
    `generated=${formatDateTime(viz.generated_at)} ${viewerTimeZoneLabel(viz.generated_at)}`,
    `window=${defined(viz.start_ns) && defined(viz.end_ns) ? `${Number(viz.start_ns).toFixed(2)}-${Number(viz.end_ns).toFixed(2)} ns` : "-"}`,
    `frames=${viz.frames ?? "-"} atoms/frame=${viz.atoms_per_frame ?? "-"}`,
    `duration=${defined(viz.duration_seconds) ? `${Number(viz.duration_seconds).toFixed(1)} s` : "-"} fps=${viz.fps ?? "-"}`,
    `size=${formatBytes(viz.mp4_bytes)} renderer=${viz.renderer || "-"}`,
    `cadence=stats:300s video:1800s`,
  ].join("\n");
}

function firstActiveValue(samples, key) {
  const row = samples.find((sample) => defined(sample.active?.[key]));
  return row ? Number(row.active[key]) : null;
}

function renderPlots(history) {
  const plotHistory = thinSamples(history);
  const activeSamples = thinSamples(history.filter((sample) => sample.active));
  const potential0 = firstActiveValue(activeSamples, "potential_kj_mol");
  const totalEnergy0 = firstActiveValue(activeSamples, "total_energy_kj_mol");
  const conserved0 = firstActiveValue(activeSamples, "conserved_energy_kj_mol");
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
  $("#plotEta").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "eta h", value: (sample) => defined(sample.active?.eta_seconds_from_rate) ? sample.active.eta_seconds_from_rate / 3600 : null },
      { label: "ns left", value: (sample) => sample.active?.ns_remaining },
    ],
    yMin: 0,
    suffix: "",
    decimals: 2,
  });
  $("#plotProgressRate").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "%/hr", value: (sample) => sample.active?.progress_percent_per_hour },
      { label: "ns/day wall", value: (sample) => sample.active?.wall_speed_ns_per_day },
      { label: "wall/gmx", value: (sample) => sample.active?.wall_to_gmx_ratio },
    ],
    suffix: "",
    decimals: 3,
  });
  $("#plotTemperature").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "temperature", value: (sample) => sample.active?.temperature_k },
      { label: "target 310K", value: () => TARGET_TEMP_K },
    ],
    suffix: "",
    decimals: 2,
  });
  $("#plotThermoError").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "T-310K", value: (sample) => defined(sample.active?.temperature_k) ? Number(sample.active.temperature_k) - TARGET_TEMP_K : null },
      { label: "|T-310K|", value: (sample) => defined(sample.active?.temperature_k) ? Math.abs(Number(sample.active.temperature_k) - TARGET_TEMP_K) : null },
      { label: "target", value: () => 0 },
    ],
    suffix: "",
    decimals: 3,
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
      { label: "target 1 bar", value: () => TARGET_PRESSURE_BAR },
    ],
    suffix: "",
    decimals: 1,
  });
  $("#plotBarostatError").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "P-1bar", value: (sample) => defined(sample.active?.pressure_bar) ? Number(sample.active.pressure_bar) - TARGET_PRESSURE_BAR : null },
      { label: "PresDC-1", value: (sample) => defined(sample.active?.pressure_coupling_bar) ? Number(sample.active.pressure_coupling_bar) - TARGET_PRESSURE_BAR : null },
      { label: "target", value: () => 0 },
    ],
    suffix: "",
    decimals: 2,
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
  $("#plotEnergyDrift").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "dPot / 1e3", value: (sample) => defined(sample.active?.potential_kj_mol) && defined(potential0) ? (Number(sample.active.potential_kj_mol) - potential0) / 1000 : null },
      { label: "dTotal / 1e3", value: (sample) => defined(sample.active?.total_energy_kj_mol) && defined(totalEnergy0) ? (Number(sample.active.total_energy_kj_mol) - totalEnergy0) / 1000 : null },
      { label: "dConserved / 1e3", value: (sample) => defined(sample.active?.conserved_energy_kj_mol) && defined(conserved0) ? (Number(sample.active.conserved_energy_kj_mol) - conserved0) / 1000 : null },
      { label: "baseline", value: () => 0 },
    ],
    suffix: "",
    decimals: 2,
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
    samples: plotHistory,
    series: [
      { label: "xtc MB", value: (sample) => defined(fileBytes(sample.files, "md.xtc")) ? fileBytes(sample.files, "md.xtc") / 1048576 : null },
      { label: "edr MB", value: (sample) => defined(fileBytes(sample.files, "md.edr")) ? fileBytes(sample.files, "md.edr") / 1048576 : null },
      { label: "log MB", value: (sample) => defined(fileBytes(sample.files, "md.log")) ? fileBytes(sample.files, "md.log") / 1048576 : null },
      { label: "cpt MB", value: (sample) => defined(fileBytes(sample.files, "md.cpt")) ? fileBytes(sample.files, "md.cpt") / 1048576 : null },
    ],
    suffix: "",
    decimals: 1,
  });
  $("#plotIoRate").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "xtc MB/min", value: (sample) => sample.active?.file_rates_mb_min?.["md.xtc"] },
      { label: "edr MB/min", value: (sample) => sample.active?.file_rates_mb_min?.["md.edr"] },
      { label: "log MB/min", value: (sample) => sample.active?.file_rates_mb_min?.["md.log"] },
      { label: "cpt MB/min", value: (sample) => sample.active?.file_rates_mb_min?.["md.cpt"] },
    ],
    suffix: "",
    decimals: 3,
  });
  $("#plotSamplerHealth").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "sample dt s", value: (sample) => sample.active?.sample_interval_seconds },
      { label: "log age s", value: (sample) => sample.active?.age_seconds },
      { label: "artifact MB", value: (sample) => sample.active?.artifact_total_mb },
    ],
    yMin: 0,
    suffix: "",
    decimals: 1,
  });

  const first = activeSamples[0]?.generated_at;
  const last = activeSamples[activeSamples.length - 1]?.generated_at;
  $("#progressRange").textContent = first && last ? `${formatShortTime(first)} -> ${formatShortTime(last)} ${viewerTimeZoneLabel(last)}` : "-";
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
  $("#queuedCount").textContent = String(data.summary?.queued ?? 0);
  $("#completeCount").textContent = String(data.summary?.complete ?? 0);
  $("#activePercent").textContent = formatPercent(data.summary?.active_percent ?? active?.percent);
  $("#activeEta").textContent = active ? formatStageEta(active, latestActive.eta_seconds_from_rate) : formatEta(data.summary?.active_eta_at, data.summary?.active_eta);
  $("#speedStat").textContent = defined(active?.wall_speed_ns_per_day) ? formatRate(active.wall_speed_ns_per_day) : defined(latestActive.wall_speed_ns_per_day) ? formatRate(latestActive.wall_speed_ns_per_day) : defined(active?.performance_ns_per_day) ? Number(active.performance_ns_per_day).toFixed(2) : "-";
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
  $("#clockState").textContent = `${formatClock(new Date().toISOString())} ${viewerTimeZoneLabel(new Date())}`;
  $("#generatedAt").textContent = `${formatClock(data.generated_at)} ${viewerTimeZoneLabel(data.generated_at)}`;
  $("#commitState").textContent = isStaticHost() ? "status.json + history.json" : "live /api/status";
  $("#lastRefresh").textContent = `refreshed ${formatClock(data.generated_at)} ${viewerTimeZoneLabel(data.generated_at)} :: browser ${formatClock(new Date().toISOString())} ${viewerTimeZoneLabel(new Date())}`;
  $("#nsStat").textContent = simulation && active ? `${simulation.name} :: ${formatNs(active.current_ns)} / ${formatNs(active.total_ns)}` : "no active run";
  $("#terminalLines").textContent = terminalLog(data, history);
  $("#statsTable").innerHTML = renderStats(data, history);
  $("#observablesTable").innerHTML = renderObservables(data);
  $("#runtimeTable").innerHTML = renderRuntime(data);
  $("#mdpTable").innerHTML = renderMdp(data);
  $("#queuedJobs").innerHTML = renderQueuedJobs(data);
  $("#completeJobs").innerHTML = renderCompleteJobs(data);
  $("#phaseRibbon").innerHTML = renderPhaseRibbon(data);
  $("#stageMatrix").innerHTML = renderStageMatrix(data);
  renderViz();
  scheduleRenderPlots(history);

  const simulations = (data.simulations || []).filter(simulationMatches);
  $("#simulationList").innerHTML = simulations.map(simulationCard).join("");
  $("#emptyState").hidden = simulations.length !== 0;
}

async function loadHistory(force = false) {
  const endpoint = historyEndpoint();
  if (!endpoint || !shouldLoadHistory(force)) return false;
  state.historyLoading = true;
  state.historyFetchedAt = Date.now();
  try {
    const response = await fetch(cacheBust(endpoint), { cache: "no-store" });
    if (!response.ok) return false;
    const payload = await response.json();
    state.history = normalizeHistory(payload);
    state.historyLoaded = true;
    return true;
  } catch (error) {
    console.debug("history unavailable", error);
    return false;
  } finally {
    state.historyLoading = false;
  }
}

async function loadVizMetadata(force = false) {
  if (!shouldLoadVizMetadata(force)) return false;
  state.vizLoading = true;
  state.vizFetchedAt = Date.now();
  try {
    const response = await fetch(cacheBust(vizMetadataEndpoint()), { cache: "no-store" });
    if (!response.ok) {
      state.viz = null;
      return false;
    }
    state.viz = await response.json();
    return true;
  } catch (error) {
    state.viz = null;
    console.debug("viz preview unavailable", error);
    return false;
  } finally {
    state.vizLoading = false;
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
      state.clientHistory = state.clientHistory.slice(-2160);
    }
    setHealth(endpoint === "status.json" ? "snapshot" : "live", true);
    render();
    const deferred = [];
    if (shouldLoadHistory()) deferred.push(loadHistory());
    if (shouldLoadVizMetadata()) deferred.push(loadVizMetadata());
    if (deferred.length) {
      Promise.allSettled(deferred).then((results) => {
        if (results.some((result) => result.status === "fulfilled" && result.value)) {
          render();
        }
      });
    }
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
state.timer = setInterval(refresh, state.refreshMs);
