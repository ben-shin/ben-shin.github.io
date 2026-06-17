const state = {
  filter: "all",
  data: null,
  timer: null,
};

const $ = (selector) => document.querySelector(selector);

function formatPercent(value) {
  if (value === null || value === undefined) return "-";
  if (value >= 99.95) return "100%";
  if (value < 1) return `${value.toFixed(2)}%`;
  return `${value.toFixed(1)}%`;
}

function formatNumber(value) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat().format(value);
}

function formatNs(value) {
  if (value === null || value === undefined) return "-";
  if (value >= 100) return `${value.toFixed(1)} ns`;
  if (value >= 1) return `${value.toFixed(2)} ns`;
  return `${(value * 1000).toFixed(0)} ps`;
}

function formatAge(seconds) {
  if (seconds === null || seconds === undefined) return "-";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function cleanEta(text) {
  if (!text) return "-";
  return text.replace(/\s+/g, " ").trim();
}

function statusLabel(status) {
  const labels = {
    running: "Running",
    complete: "Done",
    partial: "Partial",
    stale: "Stale",
    failed: "Failed",
    unknown: "Unknown",
  };
  return labels[status] || status;
}

function statusEndpoint() {
  const host = window.location.hostname;
  const staticHost = host.endsWith("github.io") || host === "localhost" && !window.location.port;
  return staticHost ? "status.json" : "/api/status";
}

function simulationMatches(simulation) {
  if (state.filter === "all") return true;
  if (state.filter === "attention") return ["failed", "stale"].includes(simulation.status);
  return simulation.status === state.filter;
}


function activeHero(data) {
  const simulation = data.simulations[0];
  if (!simulation || !simulation.active_stage) {
    return `
      <div class="hero-copy">
        <span class="eyebrow">Current run</span>
        <h2>No simulation logs found</h2>
      </div>
    `;
  }

  const active = simulation.active_stage;
  const percent = active.percent ?? 0;
  const speed = active.performance_ns_per_day
    ? `${active.performance_ns_per_day.toFixed(1)} ns/day`
    : "-";
  return `
    <div class="hero-copy">
      <span class="eyebrow">${statusLabel(simulation.status)}</span>
      <h2>${simulation.name}</h2>
      <p>${active.label || "Current stage"} - ${formatNs(active.current_ns)} of ${formatNs(active.total_ns)}</p>
    </div>
    <div class="hero-progress">
      <div class="hero-ring" style="--value: ${Math.max(0, Math.min(100, percent || 0))}">
        <span>${formatPercent(active.percent)}</span>
      </div>
      <div class="hero-stats">
        <div>
          <span>ETA</span>
          <strong>${cleanEta(active.eta_text)}</strong>
        </div>
        <div>
          <span>Speed</span>
          <strong>${speed}</strong>
        </div>
      </div>
    </div>
  `;
}

function stageCell(stageName, stage) {
  if (!stage) {
    return `
      <div class="stage unknown">
        <strong>${stageName.toUpperCase()}</strong>
        <span>-</span>
      </div>
    `;
  }
  return `
    <div class="stage ${stage.status}">
      <strong>${stage.label}</strong>
      <span>${formatPercent(stage.percent)}</span>
    </div>
  `;
}

function simulationCard(simulation) {
  const active = simulation.active_stage || {};
  const percent = active.percent ?? 0;
  const stageMap = Object.fromEntries(simulation.stages.map((stage) => [stage.stage, stage]));
  const currentNs = formatNs(active.current_ns);
  const totalNs = formatNs(active.total_ns);
  const performance = active.performance_ns_per_day
    ? `${active.performance_ns_per_day.toFixed(1)} ns/day`
    : "-";
  const temperature = active.temperature_k ? `${active.temperature_k.toFixed(1)} K` : "-";
  const pressure = active.pressure_bar ? `${active.pressure_bar.toFixed(1)} bar` : "-";
  const process = active.process_id
    ? `${active.process_id}${active.process_alive ? " live" : ""}`
    : "-";

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
          <div class="ring" style="--value: ${Math.max(0, Math.min(100, percent || 0))}">
            <span>${formatPercent(active.percent)}</span>
          </div>
          <div class="detail-grid">
            <div class="detail">
              <span class="detail-label">Stage</span>
              <strong>${active.label || "-"}</strong>
            </div>
            <div class="detail">
              <span class="detail-label">Time</span>
              <strong>${currentNs} / ${totalNs}</strong>
            </div>
            <div class="detail">
              <span class="detail-label">Step</span>
              <strong>${formatNumber(active.current_step)}</strong>
            </div>
            <div class="detail">
              <span class="detail-label">ETA</span>
              <strong>${cleanEta(active.eta_text)}</strong>
            </div>
            <div class="detail">
              <span class="detail-label">Speed</span>
              <strong>${performance}</strong>
            </div>
            <div class="detail">
              <span class="detail-label">Updated</span>
              <strong>${formatAge(simulation.age_seconds)}</strong>
            </div>
            <div class="detail">
              <span class="detail-label">Temp</span>
              <strong>${temperature}</strong>
            </div>
            <div class="detail">
              <span class="detail-label">Pressure</span>
              <strong>${pressure}</strong>
            </div>
            <div class="detail">
              <span class="detail-label">PID</span>
              <strong>${process}</strong>
            </div>
            <div class="detail">
              <span class="detail-label">Log</span>
              <strong>${active.log_path || "-"}</strong>
            </div>
          </div>
        </div>
      </div>
      <div class="stage-strip">
        ${["em", "nvt", "npt", "md"].map((name) => stageCell(name, stageMap[name])).join("")}
      </div>
    </article>
  `;
}

function render() {
  const data = state.data;
  if (!data) return;
  $("#sourceRoot").textContent = data.source_root;
  $("#activeHero").innerHTML = activeHero(data);
  $("#runningCount").textContent = String(data.summary.running);
  $("#activePercent").textContent = formatPercent(data.summary.active_percent);
  $("#activeEta").textContent = cleanEta(data.summary.active_eta);
  $("#lastRefresh").textContent = `Refreshed ${new Date(data.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;

  const simulations = data.simulations.filter(simulationMatches);
  $("#simulationList").innerHTML = simulations.map(simulationCard).join("");
  $("#emptyState").hidden = simulations.length !== 0;
}

async function refresh() {
  $("#healthState").textContent = "Updating";
  try {
    const endpoint = statusEndpoint();
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    $("#healthState").textContent = endpoint === "status.json" ? "Snapshot" : "Live";
    render();
  } catch (error) {
    $("#healthState").textContent = "Offline";
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
