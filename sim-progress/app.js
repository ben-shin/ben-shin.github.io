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

const STAGES = ["em", "nvt", "npt", "md_relax", "relax", "md", "metad"];
const ETA_SOURCE_TIME_ZONE = "Europe/London";
const LEGACY_TIMESTAMP_TIME_ZONE = "Europe/London";
const STATIC_HISTORY_REFRESH_MS = 5 * 60 * 1000;
const LIVE_HISTORY_REFRESH_MS = 30 * 1000;
const VIZ_METADATA_REFRESH_MS = 60 * 1000;
const GITHUB_PAGES_RAW_BASE = "https://raw.githubusercontent.com/ben-shin/ben-shin.github.io/main/sim-progress";
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

function formatEstimatedFinish(finishAt, seconds) {
  const duration = formatDuration(seconds);
  const finish = finishAt ? `${formatDateTime(finishAt)} ${viewerTimeZoneLabel(finishAt)}` : null;
  if (duration !== "-" && finish) return `${duration} -> ${finish}`;
  if (duration !== "-") return duration;
  return finish || "-";
}

function formatStageEta(stage, fallbackSeconds = null) {
  if (!stage) return "-";
  if (stage.status === "complete") return "complete";
  if (stage.status === "paused") return `paused @ ${formatPercent(stage.percent)}`;
  if (stage.status === "stale") return `stale @ ${formatPercent(stage.percent)}`;
  if (stage.status === "failed") return "failed";
  if (stage.status === "queued") return formatEstimatedFinish(stage.estimated_finish_at, stage.estimated_duration_seconds) || "queued";
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
    paused: "paused",
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

function usesRawSnapshots() {
  return window.location.hostname === "ben-shin.github.io";
}

function rawSnapshotUrl(path) {
  return `${GITHUB_PAGES_RAW_BASE}/${path}`;
}

function statusEndpoint() {
  if (window.location.protocol === "file:") return "../out/status.json";
  if (usesRawSnapshots()) return rawSnapshotUrl("status.json");
  return isStaticHost() ? "status.json" : "/api/status";
}

function historyEndpoint() {
  if (window.location.protocol === "file:") return "../out/history.json";
  if (usesRawSnapshots()) return rawSnapshotUrl("history.json");
  return isStaticHost() ? "history.json" : "/api/history";
}

function vizMetadataEndpoint() {
  return usesRawSnapshots() ? rawSnapshotUrl("viz/md_preview.json") : "viz/md_preview.json";
}

function vizAssetUrl(path) {
  return usesRawSnapshots() ? rawSnapshotUrl(path) : path;
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
  if (state.filter === "attention") return ["failed", "paused", "stale"].includes(simulation.status);
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
      rg_nm: active.rg_nm ?? null,
      rg_time_ns: active.rg_time_ns ?? null,
      rg_samples: active.rg_samples ?? null,
      rg_histogram: active.rg_histogram || null,
      rg_stats: active.rg_stats || null,
      rg_updated_at: active.rg_updated_at || null,
      rg_source: active.rg_source || null,
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
    lines.push(`eta rate=${defined(data.summary.estimated_rate_ns_per_day) ? `${formatRate(data.summary.estimated_rate_ns_per_day)} ns/day` : "-"} source="${data.summary.estimated_rate_source || "-"}" queue="${formatEstimatedFinish(data.summary.queue_eta_at, data.summary.queue_eta_seconds)}" total="${formatEstimatedFinish(data.summary.total_eta_at, data.summary.total_eta_seconds)}"`);
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

function makeHistogramChart(histogram, { label = "population", suffix = "", decimals = 2 } = {}) {
  const bins = Array.isArray(histogram?.bins) ? histogram.bins.map(Number) : [];
  const counts = Array.isArray(histogram?.counts) ? histogram.counts.map(Number) : [];
  const rows = bins.map((bin, index) => ({ bin, count: counts[index] || 0 })).filter((row) => Number.isFinite(row.bin));
  const maxCount = Math.max(0, ...rows.map((row) => row.count));
  if (!rows.length || maxCount <= 0) {
    return `<div class="empty-plot">No Rg population data yet.<br>Waiting for the next gmx gyrate sample.</div>`;
  }

  const width = 720;
  const height = 230;
  const margin = { top: 16, right: 18, bottom: 34, left: 44 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;
  const minX = Math.min(...rows.map((row) => row.bin));
  const maxX = Math.max(...rows.map((row) => row.bin));
  const barGap = 2;
  const barW = Math.max(1, innerW / rows.length - barGap);
  const x = (index) => margin.left + index * (innerW / rows.length) + barGap / 2;
  const y = (count) => margin.top + (1 - count / maxCount) * innerH;
  const bars = rows.map((row, index) => {
    const yy = y(row.count);
    const h = height - margin.bottom - yy;
    return `<rect class="hist-bar" x="${x(index).toFixed(2)}" y="${yy.toFixed(2)}" width="${barW.toFixed(2)}" height="${h.toFixed(2)}"><title>${row.bin.toFixed(decimals)}${suffix}: ${row.count}</title></rect>`;
  }).join("");
  const yTicks = [0, 0.5, 1].map((fraction) => Math.round(maxCount * fraction));
  const grid = yTicks.map((value) => {
    const yy = y(value);
    return `<line class="grid-line" x1="${margin.left}" y1="${yy.toFixed(1)}" x2="${width - margin.right}" y2="${yy.toFixed(1)}"></line><text class="tick-label" x="8" y="${(yy + 3).toFixed(1)}">${value}</text>`;
  }).join("");
  const xLabels = [
    { value: minX, anchor: "start", x: margin.left },
    { value: (minX + maxX) / 2, anchor: "middle", x: margin.left + innerW / 2 },
    { value: maxX, anchor: "end", x: width - margin.right },
  ].map((tick) => `<text class="tick-label" x="${tick.x.toFixed(1)}" y="${height - 9}" text-anchor="${tick.anchor}">${tick.value.toFixed(decimals)}${suffix}</text>`).join("");
  const samples = histogram.samples ?? counts.reduce((sum, value) => sum + value, 0);

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">
      ${grid}
      <line class="axis" x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}"></line>
      <line class="axis" x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}"></line>
      ${xLabels}
      ${bars}
    </svg>
    <div class="legend"><span>${label}: ${samples} frames</span></div>
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
  const eta = formatEstimatedFinish(simulation.estimated_finish_at || active.estimated_finish_at, simulation.estimated_duration_seconds ?? active.estimated_duration_seconds);

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
            <div class="detail"><span class="detail-label">eta</span><strong>${eta !== "-" ? eta : formatStageEta(active)}</strong></div>
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
    const eta = formatEstimatedFinish(simulation.estimated_finish_at || active.estimated_finish_at, simulation.estimated_duration_seconds ?? active.estimated_duration_seconds);
    const start = formatEstimatedFinish(simulation.estimated_start_at || active.estimated_start_at, null);
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
        <code>${ns} :: ${speed} :: eta=${eta} :: start=${start}</code>
        <code>files=${formatBytes(files)} :: age=${formatAge(simulation.age_seconds)} :: ${simulation.estimated_eta_source || active.estimated_eta_source || "observed"}</code>
        <code>${stageStatusSummary(simulation)}</code>
      </div>
    `;
  }).join("");
}

function renderQueuedJobs(data) {
  const queued = (data?.simulations || []).filter((simulation) => simulation.status === "queued");
  return renderJobLedger(queued, "No queued jobs detected from stage input/log scan.");
}

function renderRunEtaSummary(data) {
  const summary = data?.summary || {};
  const rows = [
    ["rate basis", defined(summary.estimated_rate_ns_per_day) ? `${formatRate(summary.estimated_rate_ns_per_day)} ns/day (${summary.estimated_rate_source || "estimated"})` : "-"],
    ["active + queued", formatEstimatedFinish(summary.total_eta_at, summary.total_eta_seconds)],
    ["queued complete", formatEstimatedFinish(summary.queue_eta_at, summary.queue_eta_seconds)],
    ["queued work", formatDuration(summary.queue_work_seconds)],
    ["estimated runs", summary.estimated_runs_count ?? "-"],
  ];
  const queued = (data?.simulations || []).filter((simulation) => simulation.status === "queued");
  queued.forEach((simulation) => {
    const detail = [
      `start ${formatEstimatedFinish(simulation.estimated_start_at, null)}`,
      `duration ${formatDuration(simulation.estimated_duration_seconds)}`,
      `finish ${formatEstimatedFinish(simulation.estimated_finish_at, null)}`,
      simulation.estimated_eta_source || "estimate",
    ].join(" :: ");
    rows.push([simulation.name, detail]);
  });
  return renderKeyValueRows(rows);
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
    ["queue eta", formatEstimatedFinish(data.summary?.queue_eta_at, data.summary?.queue_eta_seconds)],
    ["entire run eta", formatEstimatedFinish(data.summary?.total_eta_at, data.summary?.total_eta_seconds)],
    ["eta rate", defined(data.summary?.estimated_rate_ns_per_day) ? `${formatRate(data.summary.estimated_rate_ns_per_day)} ns/day (${data.summary.estimated_rate_source || "estimated"})` : "-"],
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
    ["Rg", defined(active?.rg_nm) ? `${Number(active.rg_nm).toFixed(3)} nm` : "-"],
    ["Rg frames", defined(active?.rg_samples) ? formatNumber(active.rg_samples) : "-"],
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
    video.poster = cacheBust(vizAssetUrl("viz/md_preview.png"));
    video.src = cacheBust(vizAssetUrl("viz/md_preview.mp4"));
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
  $("#plotRg").innerHTML = makeLineChart({
    samples: activeSamples,
    series: [
      { label: "Rg", value: (sample) => sample.active?.rg_nm },
      { label: "mean", value: (sample) => sample.active?.rg_stats?.mean_nm },
    ],
    suffix: "",
    decimals: 3,
  });
  const latestRg = [...activeSamples].reverse().find((sample) => sample.active?.rg_histogram)?.active;
  $("#plotRgHistogram").innerHTML = makeHistogramChart(latestRg?.rg_histogram, { label: "Rg", suffix: " nm", decimals: 3 });
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
  $("#queueEta").textContent = formatDuration(data.summary?.queue_eta_seconds);
  $("#totalEta").textContent = formatDuration(data.summary?.total_eta_seconds);
  $("#speedStat").textContent = defined(active?.wall_speed_ns_per_day) ? formatRate(active.wall_speed_ns_per_day) : defined(latestActive.wall_speed_ns_per_day) ? formatRate(latestActive.wall_speed_ns_per_day) : defined(active?.performance_ns_per_day) ? Number(active.performance_ns_per_day).toFixed(2) : "-";
  $("#tempStat").textContent = defined(active?.temperature_k) ? `${Number(active.temperature_k).toFixed(1)} K` : "-";
  $("#pressureStat").textContent = defined(active?.pressure_bar) ? `${Number(active.pressure_bar).toFixed(1)} bar` : "-";
  $("#rgStat").textContent = defined(active?.rg_nm) ? `${Number(active.rg_nm).toFixed(3)} nm` : "-";
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
  $("#commitState").textContent = usesRawSnapshots() ? "raw snapshots" : (isStaticHost() ? "status.json + history.json" : "live /api/status");
  $("#lastRefresh").textContent = `refreshed ${formatClock(data.generated_at)} ${viewerTimeZoneLabel(data.generated_at)} :: browser ${formatClock(new Date().toISOString())} ${viewerTimeZoneLabel(new Date())}`;
  $("#nsStat").textContent = simulation && active ? `${simulation.name} :: ${formatNs(active.current_ns)} / ${formatNs(active.total_ns)}` : "no active run";
  $("#terminalLines").textContent = terminalLog(data, history);
  $("#statsTable").innerHTML = renderStats(data, history);
  $("#observablesTable").innerHTML = renderObservables(data);
  $("#runtimeTable").innerHTML = renderRuntime(data);
  $("#mdpTable").innerHTML = renderMdp(data);
  $("#runEtaSummary").innerHTML = renderRunEtaSummary(data);
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

(() => {
  const terminalOutput = document.querySelector("#eggTerminalOutput");
  const terminalForm = document.querySelector("#eggTerminalForm");
  const terminalInput = document.querySelector("#eggTerminalInput");
  const fapcCompanion = document.querySelector("#fapcCompanion");
  const fapcMascot = document.querySelector("#fapcMascot");
  const fapcMood = document.querySelector("#fapcMood");
  const fapcNote = document.querySelector("#fapcNote");
  const fapcBubble = document.querySelector("#fapcBubble");
  const vizDownload = document.querySelector("#vizDownload");
  const title = document.querySelector("h1");

  if (!terminalOutput || !terminalForm || !terminalInput) return;

  const randomItem = (items) => items[Math.floor(Math.random() * items.length)];
  const dashboard = () => (typeof state !== "undefined" ? state : null);
  const dashboardData = () => dashboard()?.data || null;
  const activeSimulation = () => (dashboardData()?.simulations || [])[0] || null;
  const activeStage = () => activeSimulation()?.active_stage || null;
  const localHour = () => new Date().getHours();
  const lines = [];
  const history = [];
  let historyIndex = 0;
  let fapcClicks = 0;
  let fapcCooldownUntil = 0;
  let titleClicks = 0;
  let attentionClicks = 0;
  let etaClicks = 0;
  let rKeyTime = 0;
  const konami = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let konamiIndex = 0;

  const fapcResponses = [
    "You poke FapC. FapC refuses to aggregate on command.",
    "You offer FapC a chaperone. FapC becomes emotionally unavailable.",
    "You ask FapC for publication-quality behavior. FapC laughs in conformational heterogeneity.",
    "You ask FapC what it wants. FapC says: \"more replicates.\"",
    "You whisper \"major revision.\" FapC immediately forms off-pathway species.",
    "You add salt. FapC says this changes everything and nothing.",
    "You ask if it has converged. FapC avoids eye contact.",
  ];

  const reviewerComments = [
    "\"The simulations are promising, but the authors should validate every frame experimentally.\"",
    "\"The authors claim convergence, but I personally remain unconverged.\"",
    "\"Could the authors repeat this at pH 5, 6, 7, 8, and in the presence of emotional stress?\"",
    "\"The manuscript would benefit from a clearer explanation of why I am wrong.\"",
    "\"The data are interesting but do not exclude the possibility that the protein simply has bad vibes.\"",
    "\"The authors should compare against AlphaFold, wet lab data, cryo-EM, SAXS, NMR, astrology, and common sense.\"",
    "\"Minor point: please rewrite the paper.\"",
    "\"I could not reproduce the trajectory from the screenshot provided.\"",
    "\"The authors should include a movie, a control movie, and a movie explaining the first movie.\"",
    "\"The result is convincing, but I would like it to be convincing in a different way.\"",
  ];

  const denialMessages = [
    "ACCESS DENIED\n\nReason: insufficient banter entropy.\nHint: this code was probably said in a pub.",
    "ACCESS DENIED\n\nYour credentials have been forwarded to Reviewer 2.",
    "ACCESS DENIED\n\nThis incident will be included in the supplementary information.",
    "ACCESS DENIED\n\nIncorrect code.\nPlease repeat with three independent biological replicates.",
  ];

  // These passcodes are public joke easter eggs, not security.
  const friendCodes = {
    seb: {
      code: "1111",
      response: "ACCESS GRANTED\n\nWelcome Seb\n\nDon't break your arm again, praying you heal fast\nxox",
    },
    group: {
      code: "8008",
      response: "GROUP MODE UNLOCKED\n\nCurrent lab party status:\nscience: pending\npints: probable\nNature progress: disputed\nemotional convergence: not achieved\n\nShared secret:\nYou have unlocked the forbidden trajectory:\nBen checking the same simulation 47 times in one evening.",
    },
  };

  function safeFormatDuration(seconds) {
    return typeof formatDuration === "function" ? formatDuration(seconds) : "-";
  }

  function appendLine(text, className = "") {
    lines.push({ text, className });
    while (lines.length > 20) lines.shift();
    terminalOutput.innerHTML = lines
      .map((line) => {
        const div = document.createElement("div");
        div.className = `egg-terminal-line ${line.className}`.trim();
        div.textContent = line.text;
        return div.outerHTML;
      })
      .join("");
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  function toast(message, timeout = 5200) {
    const old = document.querySelector(".egg-toast");
    if (old) old.remove();
    const node = document.createElement("div");
    node.className = "egg-toast";
    node.textContent = message;
    document.body.appendChild(node);
    window.setTimeout(() => node.remove(), timeout);
  }

  function closeModal() {
    document.querySelectorAll(".egg-modal-backdrop").forEach((node) => node.remove());
  }

  function openModal(titleText, bodyText, extraContent = null) {
    closeModal();
    const backdrop = document.createElement("div");
    backdrop.className = "egg-modal-backdrop";
    backdrop.innerHTML = `
      <div class="egg-modal" role="dialog" aria-modal="true" aria-label="${titleText}">
        <header>
          <h2></h2>
          <button class="egg-modal-close" type="button" aria-label="Close">x</button>
        </header>
        <div class="egg-modal-body"><pre></pre></div>
      </div>
    `;
    backdrop.querySelector("h2").textContent = titleText;
    backdrop.querySelector("pre").textContent = bodyText;
    if (extraContent) backdrop.querySelector(".egg-modal-body").appendChild(extraContent);
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeModal();
    });
    backdrop.querySelector(".egg-modal-close").addEventListener("click", closeModal);
    document.body.appendChild(backdrop);
    const firstInput = backdrop.querySelector("input, button");
    if (firstInput) firstInput.focus();
  }

  function reviewerCount() {
    try {
      return Number(localStorage.getItem("reviewer2-count") || "0");
    } catch {
      return 0;
    }
  }

  function setReviewerCount(value) {
    try {
      localStorage.setItem("reviewer2-count", String(value));
    } catch {
      /* localStorage can fail in private modes. */
    }
  }

  function triggerReviewer2() {
    const count = reviewerCount() + 1;
    setReviewerCount(count);
    const achievement = count === 3 ? "\n\nAchievement unlocked:\n\"Major revision enjoyer\"" : "";
    openModal(
      "REVIEWER 2 DETECTED",
      "WARNING: REVIEWER 2 DETECTED\n\nSeverity: major revision\nThreat level: \"interesting, however...\"\nSuggested response: add 400 ns, three controls, and a schematic.\n\nReviewer 2 diagnostic report:\n\nNovelty concern: elevated\nNeed for controls: infinite\nSuggested extra experiments: unreasonable\nTone: polite but devastating\nDecision: major revision\n\nReviewer comment:\n" + randomItem(reviewerComments) + achievement,
    );
    appendLine("Reviewer 2 diagnostic alert opened.", "system");
  }

  function openAccessModal() {
    const form = document.createElement("form");
    form.className = "egg-access-form";
    form.innerHTML = `
      <label>name:<input name="name" autocomplete="off" inputmode="text"></label>
      <label>code:<input name="code" autocomplete="off" inputmode="numeric" maxlength="4"></label>
      <button type="submit">request access</button>
      <div class="egg-access-result" aria-live="polite"></div>
    `;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const name = String(formData.get("name") || "").trim().toLowerCase();
      const code = String(formData.get("code") || "").trim();
      const exact = friendCodes[name];
      const codeOwner = Object.entries(friendCodes).find(([, entry]) => entry.code === code);
      let result = randomItem(denialMessages);
      if (exact?.code === code) {
        result = exact.response;
      } else if (codeOwner) {
        result = "PASSCODE RECOGNIZED\nNAME SUSPICIOUS\n\nYou know too much.";
      }
      form.querySelector(".egg-access-result").textContent = result;
      appendLine(result.split("\n")[0], "system");
    });
    openModal("RESTRICTED LAB ACCESS", "authorized personnel only", form);
  }

  function statusResponse() {
    const data = dashboardData();
    const summary = data?.summary || {};
    const sim = activeSimulation();
    const active = activeStage();
    if (!data) {
      return "status: dashboard online\ntelemetry: watching\nconfidence: conditional";
    }
    return [
      "status: dashboard online",
      `running=${summary.running ?? 0} queued=${summary.queued ?? 0} attention=${summary.attention ?? 0} done=${summary.complete ?? 0}`,
      `active=${sim?.name || "-"} stage=${active?.stage || "-"}`,
      `confidence=${summary.running ? "caffeinated" : "conditional"}`,
    ].join("\n");
  }

  function commandResponse(rawCommand) {
    const command = rawCommand.trim().replace(/\s+/g, " ").toLowerCase();
    const hour = localHour();
    if (command === "help") {
      return "Available commands:\nstatus      show simulation status\ncoffee      estimate required caffeine\npanic       emergency simulation response menu\nfapc        inspect protein mood\n\nNote: Do NOT reveal all commands in help. Keep some secret.";
    }
    if (command === "status") return statusResponse();
    if (command === "fapc") {
      return randomItem([
        "FapC status report:\n  solubility: negotiable\n  aggregation tendency: emotionally significant\n  current social structure: oligomer-curious\n  confidence: 73%",
        "FapC appears to be behaving.\nThis is suspicious and should be repeated in triplicate.",
        "FapC status:\nsoluble but plotting something",
        "FapC status:\naggregation delayed due to conformational admin",
      ]);
    }
    if (command === "coffee") {
      if (hour >= 0 && hour < 5) {
        return "Caffeine recommendation: no.\nSleep recommendation: yes.\nProbability Ben ignores this: 94%.";
      }
      return randomItem([
        "Estimated caffeine required to finish this trajectory:\n4.2 coffees\n1 irresponsible late-night espresso\n0.6 \"I'll just check one more thing\" incidents",
        "Coffee units remaining:\nsupervisor-meeting-safe: 4\nemotionally honest: 7",
        "Current caffeine model:\nlinear fit failed\nexponential dependence suspected",
      ]);
    }
    if (command === "panic") {
      return "Emergency simulation response menu:\n\n[1] Stare at the log file\n[2] Restart mdrun and call it troubleshooting\n[3] Blame the barostat\n[4] Say \"probably just equilibration\"\n[5] Email supervisor with selective optimism\n\nRecommended action: [3]";
    }
    if (command === "baseball") {
      return "Pitching report:\nFastball command: comes and goes\nCurveball: respectable\nSlider: either disgusting or a war crime\nCurrent mound visit: \"Just throw strikes, Ben\"";
    }
    if (command === "reviewer2") {
      triggerReviewer2();
      return "Reviewer 2 protocol armed.";
    }
    if (command === "reviewer1") {
      return "Reviewer 1:\n\"Nice work. I have only minor comments.\"\n\nSystem note:\nReviewer 1 has been ignored by the editorial balance algorithm.";
    }
    if (command === "editor") {
      return "Editor:\n\"While the reviewers are generally positive, we invite a substantially revised manuscript.\"\n\nTranslation:\nReviewer 2 has won.";
    }
    if (command === "respond reviewer2") {
      return randomItem([
        "We thank the reviewer for this insightful comment.\n\nInternal translation:\nI hate that this is a good point.",
        "We have now clarified this in the revised manuscript.\n\nInternal translation:\nWe added one sentence and prayed.",
        "This is an excellent suggestion.\n\nInternal translation:\nI cannot believe we have to do this.",
      ]);
    }
    if (command === "sudo make simulation faster") return "Permission denied.\nOnly the GPU may decide.";
    if (command === "sudo rm -rf reviewer2") return "Nice try.\nReviewer 2 has already downloaded the supplementary data.";
    if (command === "godmode") {
      return "GOD MODE ENABLED\n\nAll simulations complete.\nAll papers accepted.\nAll reviewers reasonable.\nAll plots publication-ready.\n\nReality restored in 3...\n2...\n1...\n\nGOD MODE DISABLED";
    }
    if (command === "access") {
      openAccessModal();
      return "Opening restricted lab access...";
    }
    if (command === "fortune") {
      return randomItem([
        "The barostat knows what you did.",
        "A stable trajectory is just instability with confidence intervals.",
        "Your protein is not aggregating, it is networking.",
        "No LINCS warnings. Suspicious.",
        "The GPU dreams of solvent.",
        "Convergence is a social construct, but please still check it.",
        "The real equilibration was the pub trip we took along the way.",
      ]);
    }
    if (command.includes("quantum")) {
      return "Command not found.\nEstimated availability: 2047, pending funding.";
    }
    return randomItem([
      "Command not found. Try blaming the barostat.",
      "Command not found. Did you mean: fix_my_life?",
      "Unknown command. Reviewer 2 has requested clarification.",
      "Command failed successfully.",
      "This command requires three biological replicates.",
      "Ambiguous command. Please define \"done\".",
    ]);
  }

  function handleCommand(rawCommand) {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;
    history.push(trimmed);
    historyIndex = history.length;
    appendLine(`ben@md-progress:~$ ${trimmed}`, "command");
    appendLine(commandResponse(trimmed));
  }

  function updateFapC() {
    const data = dashboardData();
    const sim = activeSimulation();
    const active = activeStage();
    const summary = data?.summary || {};
    let mood = "FapC mood: soluble but suspicious";
    let mascot = ".-.\n(o o)\n |=|";
    let note = "telemetry-derived vibes pending";
    if (!active) mood = "FapC mood: idle and suspicious";
    if (active?.stage === "em") mood = "FapC mood: removing bad contacts";
    if (active?.stage === "nvt") mood = "FapC mood: thermally negotiating";
    if (active?.stage === "npt") mood = "FapC mood: barostat anxiety";
    if (["md", "md_relax"].includes(active?.stage)) mood = "FapC mood: soluble but plotting something";
    if (sim?.status === "complete") mood = "FapC mood: trajectory veteran";
    if (["failed", "paused", "stale"].includes(sim?.status) || Number(summary.attention || 0) > 0) {
      mood = "FapC mood: ensemble identity crisis";
      mascot = "(ಠ_ಠ)";
    }
    if (defined(active?.temperature_k) && Math.abs(Number(active.temperature_k) - 310) < 2) {
      mood = "FapC mood: thermally cozy";
    }
    if (defined(active?.pressure_bar) && Math.abs(Number(active.pressure_bar) - 1) > 5) {
      mood = "FapC mood: barostat anxiety";
      mascot = "(ಠ_ಠ)";
    }
    if (defined(sim?.age_seconds) && Number(sim.age_seconds) > 1800) {
      mood = "FapC mood: abandoned in phase space";
      mascot = "(-_-) zzz";
    }
    if (localHour() >= 0 && localHour() < 5) {
      mood = "FapC mood: GPU night shift";
      mascot = "(-_-) zzz";
    }
    if (active?.stage === "md" && Number(active?.percent || 0) > 80) mascot = "βββββββββ";
    if (active?.stage === "md_relax") mascot = "(o-o)(o-o)";
    note = active ? `${sim?.name || "simulation"} :: ${active.stage || "-"} :: ${formatPercent(active.percent)}` : "no active simulation";
    if (fapcMascot) fapcMascot.textContent = mascot;
    if (fapcMood) fapcMood.textContent = mood;
    if (fapcNote) fapcNote.textContent = note;
    const stateLabel = document.querySelector("#fapcState");
    if (stateLabel) stateLabel.textContent = active?.stage || "idle";
  }

  function showFapCBubble(text) {
    if (!fapcBubble) return;
    fapcBubble.textContent = text;
    fapcBubble.hidden = false;
    window.clearTimeout(showFapCBubble.timer);
    showFapCBubble.timer = window.setTimeout(() => {
      fapcBubble.hidden = true;
    }, 5200);
  }

  terminalForm.addEventListener("submit", (event) => {
    event.preventDefault();
    handleCommand(terminalInput.value);
    terminalInput.value = "";
  });

  terminalInput.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      terminalInput.value = history[historyIndex] || "";
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      terminalInput.value = history[historyIndex] || "";
    }
  });

  if (fapcCompanion) {
    fapcCompanion.addEventListener("click", () => {
      fapcClicks += 1;
      const now = Date.now();
      if (fapcClicks >= 25) {
        toast("Achievement unlocked: unethical amount of poking.");
      }
      if (fapcClicks >= 10 && now < fapcCooldownUntil) {
        showFapCBubble("FapC is overstimulated.\nPlease wait 30 seconds before further perturbation.");
        return;
      }
      if (fapcClicks === 10) {
        fapcCooldownUntil = now + 30000;
        showFapCBubble("FapC is overstimulated.\nPlease wait 30 seconds before further perturbation.");
        return;
      }
      const response = randomItem(fapcResponses);
      showFapCBubble(response);
      appendLine(response, "system");
    });
    fapcCompanion.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        fapcCompanion.click();
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
    if (event.key.toLowerCase() === "r") rKeyTime = Date.now();
    if (event.key === "2" && Date.now() - rKeyTime < 2000) triggerReviewer2();
    const expected = konami[konamiIndex];
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === expected) {
      konamiIndex += 1;
      if (konamiIndex === konami.length) {
        konamiIndex = 0;
        appendLine("CHEAT CODE ACCEPTED\nmdrun used Rare Candy.\nTrajectory gained +10 confidence.", "system");
        toast("CHEAT CODE ACCEPTED\nmdrun used Rare Candy.\nTrajectory gained +10 confidence.");
      }
    } else {
      konamiIndex = key === konami[0] ? 1 : 0;
    }
  });

  document.addEventListener("click", (event) => {
    const target = event.target;
    const attentionTarget = target.closest?.(".status.failed, .status.stale, .status.paused, .simulation.failed, .simulation.stale, .simulation.paused, #healthDot.bad");
    if (attentionTarget) {
      attentionClicks += 1;
      if (attentionClicks >= 5) {
        attentionClicks = 0;
        triggerReviewer2();
      }
    }
    const etaTarget = target.closest?.("#activeEta, #queueEta, #totalEta, .metric");
    if (etaTarget && /eta/i.test(etaTarget.textContent || "")) {
      etaClicks += 1;
      if (etaClicks >= 5) {
        etaClicks = 0;
        toast("Equivalent: 5.8 coffees, 1.2 regrettable late nights, 0.4 thesis chapters avoided");
      }
    }
  });

  if (title) {
    title.addEventListener("click", () => {
      titleClicks += 1;
      if (titleClicks >= 7) {
        titleClicks = 0;
        openAccessModal();
      }
    });
  }

  function addNightShiftLine() {
    if (localHour() < 0 || localHour() >= 5 || document.querySelector(".night-shift-line")) return;
    const footer = document.querySelector("footer");
    if (!footer) return;
    const line = document.createElement("span");
    line.className = "night-shift-line";
    line.textContent = "night_shift=true advice=\"go to sleep, the GPU can suffer alone\"";
    footer.appendChild(line);
  }

  function updateVizDownload() {
    if (!vizDownload) return;
    const generated = dashboard()?.viz?.generated_at || dashboardData()?.generated_at || Date.now();
    vizDownload.href = cacheBust(vizAssetUrl("viz/md_preview.mp4"));
  }

  window.setInterval(updateFapC, 5000);
  window.setInterval(updateVizDownload, 60000);
  updateFapC();
  updateVizDownload();
  addNightShiftLine();

  if (Math.random() < 0.01 && fapcCompanion) {
    showFapCBubble("FapC has escaped the simulation box.");
    fapcCompanion.classList.add("fapc-escape");
    window.setTimeout(() => fapcCompanion.classList.remove("fapc-escape"), 4200);
  }

  appendLine("lab_shell online. Type help.", "system");
})();
