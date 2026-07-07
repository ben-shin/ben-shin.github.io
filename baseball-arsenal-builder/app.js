const STORAGE_KEY = 'pitchLab.v1';
const root = document.documentElement;

const defaultPitches = [
  {
    id: cryptoRandomId(), name: 'Four-seam', type: 'Fastball', velocity: 76, confidence: 7, command: 6,
    whiff: 5, ground: 4, horizontal: -4, vertical: 14, bestTarget: 'up-away', color: '#64d8ff',
    notes: 'Primary strike pitch. Plays best above the belt or away when ahead.'
  },
  {
    id: cryptoRandomId(), name: 'Slider', type: 'Breaking', velocity: 68, confidence: 6, command: 5,
    whiff: 8, ground: 5, horizontal: 9, vertical: -2, bestTarget: 'down-away', color: '#ff8a5b',
    notes: 'Put-away option. Watch for the backup miss over the heart.'
  },
  {
    id: cryptoRandomId(), name: 'Curveball', type: 'Breaking', velocity: 61, confidence: 7, command: 6,
    whiff: 6, ground: 6, horizontal: 3, vertical: -12, bestTarget: 'below-zone', color: '#b892ff',
    notes: 'Can steal strikes early or finish below the zone.'
  },
  {
    id: cryptoRandomId(), name: 'Changeup', type: 'Offspeed', velocity: 64, confidence: 3, command: 3,
    whiff: 5, ground: 7, horizontal: -7, vertical: -5, bestTarget: 'down-away', color: '#63e6be',
    notes: 'Development pitch. Use sparingly until command improves.'
  }
];

let state = loadState();
let lastRecommendation = null;
const canvases = {};

function cryptoRandomId() {
  if (window.crypto && crypto.getRandomValues) {
    return 'p_' + Array.from(crypto.getRandomValues(new Uint8Array(6))).map(x => x.toString(16).padStart(2, '0')).join('');
  }
  return 'p_' + Math.random().toString(36).slice(2, 10);
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.pitches) && Array.isArray(parsed.logs)) {
        return { ...initialState(), ...parsed };
      }
    } catch (_) {}
  }
  return initialState();
}

function initialState() {
  return {
    theme: 'dark',
    pitches: structuredClone(defaultPitches),
    logs: [],
    context: {
      pitcherHand: 'RHP', batterHand: 'RHB', count: '0-0', intent: 'getAhead', hitterTendency: 'balanced', riskMode: 'balanced'
    }
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function $(id) { return document.getElementById(id); }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function pct(n, d) { return d ? `${Math.round((n / d) * 100)}%` : '—'; }
function mean(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0; }
function formatNumber(n, digits = 0) { return Number.isFinite(n) ? n.toFixed(digits) : '—'; }

function init() {
  canvases.zone = $('zoneCanvas');
  canvases.mix = $('mixCanvas');
  canvases.location = $('locationCanvas');
  canvases.count = $('countCanvas');
  canvases.outcome = $('outcomeCanvas');

  applyTheme();
  bindEvents();
  syncContextInputs();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);

function bindEvents() {
  ['pitcherHand', 'batterHand', 'countSelect', 'intentSelect', 'hitterTendency', 'riskMode'].forEach(id => {
    $(id).addEventListener('change', () => {
      state.context = {
        pitcherHand: $('pitcherHand').value,
        batterHand: $('batterHand').value,
        count: $('countSelect').value,
        intent: $('intentSelect').value,
        hitterTendency: $('hitterTendency').value,
        riskMode: $('riskMode').value
      };
      saveState();
      renderRecommendation();
    });
  });

  $('pitchSelect').addEventListener('change', renderRecommendation);
  $('targetSelect').addEventListener('change', renderRecommendation);
  $('resultSelect').addEventListener('change', handleResultContactDefaults);
  $('themeToggle').addEventListener('click', () => { state.theme = state.theme === 'dark' ? 'light' : 'dark'; applyTheme(); saveState(); drawEverything(); });
  $('resetContext').addEventListener('click', () => { state.context = initialState().context; syncContextInputs(); renderRecommendation(); saveState(); });
  $('saveSnapshot').addEventListener('click', () => { saveState(); toast('Session saved in this browser.'); });
  $('exportCsv').addEventListener('click', exportCsv);
  $('copySummary').addEventListener('click', copyReport);
  $('importCsv').addEventListener('change', importCsv);
  $('clearLast').addEventListener('click', undoLast);
  $('clearSession').addEventListener('click', clearSession);
  $('manualBall').addEventListener('click', () => logPitch({xNorm: 0.94, yNorm: 0.52, source: 'manual'}));
  $('randomBullpen').addEventListener('click', simulateBullpen);
  $('refreshRec').addEventListener('click', renderRecommendation);
  $('addPitch').addEventListener('click', () => openPitchDialog(newPitchTemplate()));
  $('loadBenPreset').addEventListener('click', loadPreset);

  const stage = $('strikeStage');
  stage.addEventListener('pointerdown', e => {
    const rect = canvases.zone.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) logPitch({ xNorm: x, yNorm: y, source: 'tap' });
  });
  stage.addEventListener('keydown', e => {
    const moves = { ArrowUp:[0,-.03], ArrowDown:[0,.03], ArrowLeft:[-.03,0], ArrowRight:[.03,0] };
    if (!moves[e.key] && e.key !== 'Enter') return;
    e.preventDefault();
    const last = state.logs.at(-1);
    if (e.key === 'Enter') logPitch({ xNorm: .5, yNorm: .5, source: 'keyboard' });
    else if (last) {
      const [dx, dy] = moves[e.key];
      last.xNorm = clamp(last.xNorm + dx, 0, 1);
      last.yNorm = clamp(last.yNorm + dy, 0, 1);
      enrichLogLocation(last);
      saveState(); renderAll();
    }
  });

  $('pitchForm').addEventListener('submit', e => {
    e.preventDefault();
    savePitchFromDialog();
    $('pitchDialog').close();
  });
  $('deletePitch').addEventListener('click', deleteCurrentPitch);

  window.addEventListener('resize', debounce(drawEverything, 150));
}

function handleResultContactDefaults() {
  const result = $('resultSelect').value;
  if (['calledStrike','swingingStrike','ball','hbp'].includes(result)) $('contactSelect').value = 'none';
  if (['inPlayOut','single','double','triple','homeRun'].includes(result) && $('contactSelect').value === 'none') $('contactSelect').value = 'medium';
}

function syncContextInputs() {
  $('pitcherHand').value = state.context.pitcherHand;
  $('batterHand').value = state.context.batterHand;
  $('countSelect').value = state.context.count;
  $('intentSelect').value = state.context.intent;
  $('hitterTendency').value = state.context.hitterTendency;
  $('riskMode').value = state.context.riskMode;
}

function renderAll() {
  renderPitchSelect();
  renderArsenal();
  renderLegend();
  renderRecommendation();
  renderMetrics();
  renderTable();
  drawEverything();
}

function drawEverything() {
  drawZone();
  drawMixChart();
  drawLocationChart();
  drawCountChart();
  drawOutcomeChart();
}

function applyTheme() {
  root.classList.toggle('light', state.theme === 'light');
}

function renderPitchSelect() {
  const selected = $('pitchSelect').value;
  $('pitchSelect').innerHTML = state.pitches.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
  if (state.pitches.some(p => p.id === selected)) $('pitchSelect').value = selected;
}

function renderLegend() {
  $('pitchLegend').innerHTML = state.pitches.map(p => `
    <span class="legend-pill"><span class="legend-dot" style="background:${p.color}"></span>${escapeHtml(p.name)}</span>
  `).join('') + '<span class="legend-pill"><span class="legend-dot" style="background:#ffffff"></span>Target</span>';
}

function renderArsenal() {
  const grid = $('arsenalGrid');
  grid.innerHTML = state.pitches.map(p => `
    <article class="pitch-card">
      <div class="pitch-head">
        <div class="pitch-name"><span class="pitch-dot" style="background:${p.color}"></span>${escapeHtml(p.name)}</div>
        <button class="ghost-button" data-edit="${p.id}" type="button">Edit</button>
      </div>
      <div class="pitch-stats">
        <div class="stat-chip"><strong>${formatNumber(p.velocity, 1)}</strong>mph</div>
        <div class="stat-chip"><strong>${escapeHtml(p.bestTarget.replace('-', ' / '))}</strong>best target</div>
        <div class="stat-chip"><strong>${p.horizontal > 0 ? '+' : ''}${p.horizontal}</strong>horizontal</div>
        <div class="stat-chip"><strong>${p.vertical > 0 ? '+' : ''}${p.vertical}</strong>vertical</div>
      </div>
      <div class="skill-bars">
        ${skillBar('Command', p.command, p.color)}
        ${skillBar('Whiff', p.whiff, p.color)}
        ${skillBar('Ground', p.ground, p.color)}
        ${skillBar('Trust', p.confidence, p.color)}
      </div>
      <p class="muted">${escapeHtml(p.notes || 'No notes yet.')}</p>
      <div class="card-actions">
        <button class="secondary-button" data-use="${p.id}" type="button">Use next</button>
        <button class="ghost-button" data-filter="${p.id}" type="button">Highlight</button>
      </div>
    </article>
  `).join('');
  grid.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => openPitchDialog(state.pitches.find(p => p.id === btn.dataset.edit))));
  grid.querySelectorAll('[data-use]').forEach(btn => btn.addEventListener('click', () => { $('pitchSelect').value = btn.dataset.use; toast('Pitch selected for next log.'); renderRecommendation(); }));
  grid.querySelectorAll('[data-filter]').forEach(btn => { btn.addEventListener('click', () => { drawZone(btn.dataset.filter); toast('Zone view highlighted.'); }); });

  $('arsenalTags').innerHTML = buildArsenalTags().map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
}

function skillBar(label, value, color) {
  return `<div class="skill"><span>${label}</span><span class="skill-track"><span class="skill-fill" style="width:${value*10}%;color:${color}"></span></span><b>${value}</b></div>`;
}

function buildArsenalTags() {
  const tags = [];
  const avgVelo = mean(state.pitches.map(p => p.velocity));
  const bestWhiff = [...state.pitches].sort((a,b)=>b.whiff-a.whiff)[0];
  const bestCommand = [...state.pitches].sort((a,b)=>b.command-a.command)[0];
  const veloSpread = Math.max(...state.pitches.map(p=>p.velocity)) - Math.min(...state.pitches.map(p=>p.velocity));
  if (bestWhiff) tags.push(`Best whiff: ${bestWhiff.name}`);
  if (bestCommand) tags.push(`Best command: ${bestCommand.name}`);
  tags.push(`Avg velo: ${avgVelo.toFixed(1)} mph`);
  tags.push(`Velo spread: ${veloSpread.toFixed(1)} mph`);
  if (state.pitches.some(p => p.type === 'Offspeed')) tags.push('Has offspeed look');
  if (state.pitches.filter(p => p.type === 'Breaking').length >= 2) tags.push('Multiple breaking balls');
  return tags;
}

function newPitchTemplate() {
  return { id: cryptoRandomId(), name: 'New pitch', type: 'Fastball', velocity: 70, confidence: 5, command: 5, whiff: 5, ground: 5, horizontal: 0, vertical: 0, bestTarget: 'down-away', color: randomColor(), notes: '' };
}
function randomColor() {
  const colors = ['#64d8ff','#ff8a5b','#b892ff','#63e6be','#ffd166','#ff6c7a','#8dd7ff','#c3ff6b'];
  return colors[Math.floor(Math.random()*colors.length)];
}

function openPitchDialog(pitch) {
  $('dialogTitle').textContent = pitch.name;
  $('editPitchId').value = pitch.id;
  $('editPitchName').value = pitch.name;
  $('editPitchType').value = pitch.type;
  $('editVelocity').value = pitch.velocity;
  $('editConfidence').value = pitch.confidence;
  $('editCommand').value = pitch.command;
  $('editWhiff').value = pitch.whiff;
  $('editGround').value = pitch.ground;
  $('editHorizontal').value = pitch.horizontal;
  $('editVertical').value = pitch.vertical;
  $('editBestTarget').value = pitch.bestTarget;
  $('editColor').value = pitch.color;
  $('editPitchNotes').value = pitch.notes || '';
  $('deletePitch').style.visibility = state.pitches.some(p => p.id === pitch.id) ? 'visible' : 'hidden';
  $('pitchDialog').showModal();
}

function savePitchFromDialog() {
  const pitch = {
    id: $('editPitchId').value || cryptoRandomId(),
    name: $('editPitchName').value.trim() || 'Unnamed pitch',
    type: $('editPitchType').value,
    velocity: Number($('editVelocity').value),
    confidence: clamp(Number($('editConfidence').value), 1, 10),
    command: clamp(Number($('editCommand').value), 1, 10),
    whiff: clamp(Number($('editWhiff').value), 1, 10),
    ground: clamp(Number($('editGround').value), 1, 10),
    horizontal: Number($('editHorizontal').value),
    vertical: Number($('editVertical').value),
    bestTarget: $('editBestTarget').value,
    color: $('editColor').value,
    notes: $('editPitchNotes').value.trim()
  };
  const idx = state.pitches.findIndex(p => p.id === pitch.id);
  if (idx >= 0) state.pitches[idx] = pitch; else state.pitches.push(pitch);
  saveState(); renderAll(); toast('Pitch profile saved.');
}

function deleteCurrentPitch() {
  const id = $('editPitchId').value;
  if (state.pitches.length <= 1) return toast('Keep at least one pitch.');
  state.pitches = state.pitches.filter(p => p.id !== id);
  state.logs = state.logs.filter(l => l.pitchId !== id);
  $('pitchDialog').close(); saveState(); renderAll(); toast('Pitch deleted.');
}

function logPitch({xNorm, yNorm, source}) {
  const pitch = state.pitches.find(p => p.id === $('pitchSelect').value) || state.pitches[0];
  const recTarget = lastRecommendation?.primary?.target || pitch.bestTarget;
  const target = $('targetSelect').value === 'auto' ? recTarget : $('targetSelect').value;
  const log = {
    id: cryptoRandomId(),
    n: state.logs.length + 1,
    timestamp: new Date().toISOString(),
    pitchId: pitch.id,
    pitchName: pitch.name,
    pitchColor: pitch.color,
    pitcherHand: state.context.pitcherHand,
    batterHand: state.context.batterHand,
    count: state.context.count,
    intent: state.context.intent,
    target,
    result: $('resultSelect').value,
    contact: $('contactSelect').value,
    note: $('pitchNote').value.trim(),
    xNorm, yNorm, source
  };
  enrichLogLocation(log);
  state.logs.push(log);
  $('pitchNote').value = '';
  advanceCountFromResult(log.result);
  saveState();
  syncContextInputs();
  renderAll();
  toast(`${pitch.name} logged: ${log.zoneLabel}, ${humanResult(log.result)}.`);
}

function enrichLogLocation(log) {
  const cls = classifyLocation(log.xNorm, log.yNorm);
  Object.assign(log, cls);
  const targetPoint = targetToPoint(log.target, log.batterHand);
  log.missDistance = Math.sqrt((log.xNorm - targetPoint.x)**2 + (log.yNorm - targetPoint.y)**2);
  log.missLabel = missLabel(log.xNorm - targetPoint.x, log.yNorm - targetPoint.y);
}

function classifyLocation(x, y) {
  const strike = { left:.34, right:.66, top:.24, bottom:.76 };
  const shadow = { left:.26, right:.74, top:.16, bottom:.84 };
  const inZone = x >= strike.left && x <= strike.right && y >= strike.top && y <= strike.bottom;
  const inShadow = x >= shadow.left && x <= shadow.right && y >= shadow.top && y <= shadow.bottom;
  const heart = x >= .42 && x <= .58 && y >= .36 && y <= .64;
  let zoneType = 'Waste';
  if (heart) zoneType = 'Heart'; else if (inZone) zoneType = 'Strike'; else if (inShadow) zoneType = 'Shadow'; else if (y > .84 || x < .18 || x > .82 || y < .10) zoneType = 'Waste'; else zoneType = 'Chase';
  const vertical = y < .33 ? 'up' : y > .67 ? 'down' : 'middle';
  const horizontal = x < .38 ? 'arm side' : x > .62 ? 'glove side' : 'middle';
  return { inZone, zoneType, vertical, horizontal, zoneLabel: `${vertical} ${horizontal}` };
}

function missLabel(dx, dy) {
  const x = Math.abs(dx) < .045 ? '' : dx > 0 ? 'glove side' : 'arm side';
  const y = Math.abs(dy) < .045 ? '' : dy > 0 ? 'low' : 'high';
  return [y, x].filter(Boolean).join(' / ') || 'on target';
}

function targetToPoint(target, batterHand = 'RHB') {
  const map = {
    'up-in': [.38,.31], 'up-away': [.62,.31], 'middle-in': [.38,.50], 'middle-away': [.62,.50],
    'down-in': [.38,.69], 'down-away': [.62,.69], 'below-zone': [.50,.83], waste: [.82,.20]
  };
  const [x,y] = map[target] || [.5,.5];
  // Names are from catcher/pitcher view by default. Keep simple and consistent.
  return { x, y };
}

function advanceCountFromResult(result) {
  const [balls, strikes] = state.context.count.split('-').map(Number);
  let b = balls, s = strikes;
  if (['calledStrike','swingingStrike'].includes(result)) s = Math.min(2, s + 1);
  if (result === 'foul' && s < 2) s += 1;
  if (['ball','hbp'].includes(result)) b = Math.min(3, b + 1);
  if (['inPlayOut','single','double','triple','homeRun'].includes(result)) { b = 0; s = 0; }
  state.context.count = `${b}-${s}`;
}

function renderRecommendation() {
  const rec = getRecommendations();
  lastRecommendation = rec;
  if (!rec.primary) {
    $('recommendationCard').innerHTML = '<p>No pitches available.</p>';
    return;
  }
  $('recommendationCard').innerHTML = `
    <p class="eyebrow">Best call right now</p>
    <div class="rec-primary"><span style="color:${rec.primary.pitch.color}">●</span> ${escapeHtml(rec.primary.pitch.name)}</div>
    <p class="rec-meta"><strong>Target:</strong> ${escapeHtml(rec.primary.target.replace('-', ' / '))}<br>${escapeHtml(rec.primary.reason)}</p>
    <div class="rec-list">
      ${rec.options.map(o => `
        <div class="rec-option">
          <span style="color:${o.pitch.color}">●</span>
          <span><strong>${escapeHtml(o.pitch.name)}</strong><br><small class="muted">${escapeHtml(o.target.replace('-', ' / '))}</small></span>
          <span class="rec-score">${Math.round(o.score)}</span>
        </div>`).join('')}
    </div>
  `;
  $('criticText').textContent = rec.critic;
}

function getRecommendations() {
  const [balls, strikes] = state.context.count.split('-').map(Number);
  const leverage = strikes === 2 ? 'putAway' : balls >= 3 ? 'mustThrowStrike' : balls > strikes ? 'behind' : strikes > balls ? 'ahead' : 'neutral';
  const selectedId = $('pitchSelect')?.value;
  const options = state.pitches.map(p => {
    const stats = logsForPitch(p.id);
    const zonePct = stats.length ? stats.filter(l=>l.inZone).length / stats.length : p.command / 10;
    const strikePct = stats.length ? stats.filter(isStrikeResult).length / stats.length : (p.command + p.confidence) / 20;
    const badContact = stats.length ? stats.filter(l => ['hard','barrel'].includes(l.contact)).length / stats.length : Math.max(0, 0.45 - p.ground/30);

    let score = p.confidence * 7 + p.command * 5 + p.whiff * 3 + p.ground * 2;
    if (leverage === 'mustThrowStrike') score += p.command * 9 + strikePct * 25 - p.whiff;
    if (leverage === 'putAway') score += p.whiff * 10 + (state.context.hitterTendency === 'chases' ? 10 : 0);
    if (leverage === 'behind') score += p.command * 8 + p.confidence * 5;
    if (leverage === 'ahead') score += p.whiff * 5 + movementSeparationBonus(p);
    if (state.context.intent === 'weakContact') score += p.ground * 8;
    if (state.context.intent === 'doublePlay') score += p.ground * 10;
    if (state.context.intent === 'putAway') score += p.whiff * 8;
    if (state.context.riskMode === 'attack') score += zonePct * 20 + p.command * 3;
    if (state.context.riskMode === 'chase') score += p.whiff * 5 + movementSeparationBonus(p);
    if (state.context.riskMode === 'safe') score += strikePct * 25 + p.command * 5;
    if (state.context.hitterTendency === 'aggressive' && p.type !== 'Fastball') score += 8;
    if (state.context.hitterTendency === 'takes') score += p.command * 4;
    if (state.context.hitterTendency === 'pull') score += p.ground * 2 + Math.abs(p.horizontal);
    score -= badContact * 18;
    if (p.id === selectedId) score += 2;

    return { pitch: p, score, target: chooseTarget(p, leverage), reason: reasonFor(p, leverage, strikePct, badContact) };
  }).sort((a,b)=>b.score-a.score);

  const primary = options[0];
  const critic = buildCritic(options, leverage);
  return { primary, options: options.slice(0,3), leverage, critic };
}

function movementSeparationBonus(p) {
  const fb = state.pitches.find(x => x.type === 'Fastball') || state.pitches[0];
  const veloSep = Math.abs((fb?.velocity || p.velocity) - p.velocity);
  const moveSep = Math.hypot((fb?.horizontal || 0)-p.horizontal, (fb?.vertical || 0)-p.vertical);
  return Math.min(18, veloSep * 0.8 + moveSep * 0.35);
}

function chooseTarget(p, leverage) {
  if (leverage === 'mustThrowStrike') return p.bestTarget.includes('below') || p.bestTarget === 'waste' ? 'middle-away' : p.bestTarget;
  if (leverage === 'putAway' && p.whiff >= 7) return p.type === 'Fastball' ? 'up-away' : 'below-zone';
  if (state.context.intent === 'pitchAround') return 'waste';
  if (state.context.intent === 'weakContact' || state.context.intent === 'doublePlay') return p.type === 'Fastball' ? 'down-away' : 'below-zone';
  return p.bestTarget;
}

function reasonFor(p, leverage, strikePct, badContact) {
  const bits = [];
  if (leverage === 'mustThrowStrike') bits.push('three-ball count rewards command and strike rate');
  if (leverage === 'putAway') bits.push('two-strike count rewards whiff potential');
  if (p.command >= 7) bits.push('reliable strike option');
  if (p.whiff >= 7) bits.push('best chase/finish profile');
  if (p.ground >= 7) bits.push('useful weak-contact shape');
  if (strikePct < .45) bits.push('but your logged strike rate is low');
  if (badContact > .25) bits.push('watch hard-contact risk');
  return bits.join('; ') + '.';
}

function buildCritic(options, leverage) {
  const logs = state.logs;
  if (!logs.length) return 'Start by logging a bullpen. The app is currently leaning on your self-rated arsenal, not observed command.';
  const waste = logs.filter(l=>l.zoneType === 'Waste').length / logs.length;
  const heart = logs.filter(l=>l.zoneType === 'Heart').length / logs.length;
  const chase = logs.filter(l=>l.zoneType === 'Chase' || l.zoneType === 'Shadow').length / logs.length;
  if (waste > .28) return 'Your smartest critic would say you may be overestimating command. Too many misses are non-competitive waste pitches.';
  if (heart > .25) return 'Your smartest critic would say you are throwing strikes, but too many are hittable heart-zone mistakes.';
  if (leverage === 'putAway' && chase < .35) return 'With two strikes, you are not expanding enough. The miss pattern may be too plate-oriented.';
  const top = options[0];
  return `The current plan survives basic scrutiny: ${top.pitch.name} fits the count, but keep checking whether the actual miss stays away from the heart.`;
}

function logsForPitch(id) { return state.logs.filter(l => l.pitchId === id); }
function isStrikeResult(l) { return ['calledStrike','swingingStrike','foul','inPlayOut'].includes(l.result) || l.inZone; }

function renderMetrics() {
  const logs = state.logs;
  const n = logs.length;
  $('metricPitches').textContent = n;
  $('metricStrikePct').textContent = pct(logs.filter(isStrikeResult).length, n);
  $('metricZonePct').textContent = pct(logs.filter(l=>l.inZone).length, n);
  $('metricWastePct').textContent = pct(logs.filter(l=>l.zoneType === 'Waste').length, n);
  $('sessionStatus').textContent = n ? 'Live' : 'Ready';
  renderPitchMixBars();
  renderInsights();
}

function renderPitchMixBars() {
  const n = state.logs.length;
  const html = state.pitches.map(p => {
    const count = state.logs.filter(l=>l.pitchId===p.id).length;
    const width = n ? count / n * 100 : 0;
    return `<div class="mini-bar"><span>${escapeHtml(p.name)}</span><span class="mini-bar-track"><span class="mini-bar-fill" style="width:${width}%;background:${p.color}"></span></span><b>${count}</b></div>`;
  }).join('');
  $('pitchMixBars').innerHTML = html || '<span class="muted">No pitches.</span>';
}

function renderInsights() {
  const logs = state.logs;
  const n = logs.length;
  const bestStrike = state.pitches.map(p => {
    const lp = logsForPitch(p.id);
    return {p, v: lp.length ? lp.filter(isStrikeResult).length / lp.length : 0, n: lp.length};
  }).filter(x=>x.n).sort((a,b)=>b.v-a.v)[0];
  const worstMiss = logs.length ? mode(logs.map(l=>l.missLabel)) : '—';
  const heart = logs.filter(l=>l.zoneType==='Heart').length;
  const putAway = logs.filter(l=>l.count.endsWith('-2'));
  const putAwayWhiff = putAway.filter(l=>l.result === 'swingingStrike').length;

  const cards = [
    {k:'Best strike pitch', v: bestStrike ? `${bestStrike.p.name} · ${pct(bestStrike.v,1)}` : '—', p:'Pitch with the best observed strike/result profile.'},
    {k:'Common miss', v: worstMiss, p:'Bias of actual endpoint compared with intended target.'},
    {k:'Heart-zone mistakes', v: pct(heart, n), p:'Higher values mean more damage risk even if strike rate looks good.'},
    {k:'Two-strike whiff', v: putAway.length ? pct(putAwayWhiff, putAway.length) : '—', p:'How often two-strike pitches generated a swing and miss.'}
  ];
  $('insightGrid').innerHTML = cards.map(c => `<article class="insight"><span>${c.k}</span><strong>${escapeHtml(c.v)}</strong><p>${c.p}</p></article>`).join('');
}

function mode(arr) {
  if (!arr.length) return '—';
  const counts = new Map();
  arr.forEach(x => counts.set(x, (counts.get(x)||0)+1));
  return [...counts.entries()].sort((a,b)=>b[1]-a[1])[0][0];
}

function drawZone(highlightPitchId = null) {
  const canvas = canvases.zone;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = cssVar('--panel-strong');
  roundRect(ctx, 0, 0, w, h, 28); ctx.fill();

  const strike = {x:w*.34, y:h*.24, width:w*.32, height:h*.52};
  const shadow = {x:w*.26, y:h*.16, width:w*.48, height:h*.68};

  drawRect(ctx, shadow, 'rgba(255,255,255,0.055)', 'rgba(255,255,255,0.11)');
  drawRect(ctx, strike, 'rgba(102,227,180,0.055)', 'rgba(102,227,180,0.58)', 3);

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  for (let i=1;i<3;i++) {
    const x = strike.x + strike.width * i/3;
    ctx.beginPath(); ctx.moveTo(x, strike.y); ctx.lineTo(x, strike.y+strike.height); ctx.stroke();
    const y = strike.y + strike.height * i/3;
    ctx.beginPath(); ctx.moveTo(strike.x, y); ctx.lineTo(strike.x+strike.width, y); ctx.stroke();
  }

  // Plate
  ctx.beginPath();
  ctx.moveTo(w*.39,h*.88); ctx.lineTo(w*.61,h*.88); ctx.lineTo(w*.57,h*.94); ctx.lineTo(w*.50,h*.98); ctx.lineTo(w*.43,h*.94); ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.stroke();

  // Recommended target
  const target = lastRecommendation?.primary?.target || state.pitches[0]?.bestTarget || 'middle-away';
  const tp = targetToPoint(target, state.context.batterHand);
  drawTarget(ctx, tp.x*w, tp.y*h);

  const logs = highlightPitchId ? state.logs.filter(l=>l.pitchId === highlightPitchId) : state.logs;
  logs.forEach((l, i) => drawPitchMarker(ctx, l, w, h, i, highlightPitchId));
}

function drawRect(ctx, r, fill, stroke, lw=1) {
  ctx.fillStyle = fill; ctx.strokeStyle = stroke; ctx.lineWidth = lw;
  ctx.fillRect(r.x, r.y, r.width, r.height); ctx.strokeRect(r.x, r.y, r.width, r.height);
}

function drawTarget(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x,y,19,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x-28,y); ctx.lineTo(x+28,y); ctx.moveTo(x,y-28); ctx.lineTo(x,y+28); ctx.stroke();
  ctx.restore();
}

function drawPitchMarker(ctx, l, w, h, i, highlighted) {
  const x = l.xNorm*w, y = l.yNorm*h;
  const r = highlighted ? 8 : 6;
  ctx.save();
  ctx.globalAlpha = highlighted ? 1 : Math.max(.35, 1 - (state.logs.length - i) * .015);
  ctx.fillStyle = l.pitchColor || '#fff';
  ctx.strokeStyle = l.zoneType === 'Heart' ? '#ff4d5e' : 'rgba(255,255,255,0.78)';
  ctx.lineWidth = l.zoneType === 'Heart' ? 3 : 1.5;
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); ctx.stroke();
  if (i === state.logs.length - 1 || highlighted) {
    ctx.fillStyle = cssVar('--text');
    ctx.font = '700 12px system-ui';
    ctx.fillText(String(l.n || i+1), x + 10, y - 8);
  }
  ctx.restore();
}

function drawMixChart() {
  const ctx = canvases.mix.getContext('2d');
  const data = state.pitches.map(p => ({label:p.name, value:logsForPitch(p.id).length, color:p.color}));
  drawBarChart(ctx, canvases.mix, data, 'pitches');
}
function drawLocationChart() {
  const ctx = canvases.location.getContext('2d');
  const labels = ['Heart','Strike','Shadow','Chase','Waste'];
  const data = labels.map(label => ({label, value:state.logs.filter(l=>l.zoneType===label).length, color: zoneColor(label)}));
  drawBarChart(ctx, canvases.location, data, 'locations');
}
function drawCountChart() {
  const ctx = canvases.count.getContext('2d');
  const labels = ['0-0','Ahead','Even','Behind','2-strike','3-ball'];
  const data = labels.map(label => ({label, value:countBucketValue(label), color:'#7bb7ff'}));
  drawBarChart(ctx, canvases.count, data, 'pitches');
}
function drawOutcomeChart() {
  const ctx = canvases.outcome.getContext('2d');
  const labels = ['CS','SwStr','Foul','Ball','Out','Hit','Damage'];
  const data = labels.map(label => ({label, value:outcomeValue(label), color: outcomeColor(label)}));
  drawBarChart(ctx, canvases.outcome, data, 'results');
}

function drawBarChart(ctx, canvas, data, suffix) {
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0,0,w,h);
  ctx.fillStyle = 'rgba(255,255,255,0.025)'; roundRect(ctx,0,0,w,h,16); ctx.fill();
  const pad = 34;
  const max = Math.max(1, ...data.map(d=>d.value));
  const barW = (w - pad*2) / data.length * .62;
  data.forEach((d, i) => {
    const x = pad + (w - pad*2) * (i + .5) / data.length - barW/2;
    const bh = (h - pad*2 - 26) * d.value / max;
    const y = h - pad - bh - 20;
    ctx.fillStyle = d.color || cssVar('--accent');
    roundRect(ctx, x, y, barW, bh, 8); ctx.fill();
    ctx.fillStyle = cssVar('--text'); ctx.font = '800 13px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(String(d.value), x + barW/2, y - 6);
    ctx.fillStyle = cssVar('--muted'); ctx.font = '700 11px system-ui';
    wrapLabel(ctx, d.label, x + barW/2, h - pad + 2, Math.max(48, barW+30));
  });
  ctx.textAlign = 'left'; ctx.fillStyle = cssVar('--muted'); ctx.font = '700 11px system-ui';
  ctx.fillText(suffix, 12, 18);
}

function wrapLabel(ctx, label, x, y, maxWidth) {
  if (ctx.measureText(label).width <= maxWidth) return ctx.fillText(label, x, y);
  const shortened = label.length > 8 ? label.slice(0,7) + '…' : label;
  ctx.fillText(shortened, x, y);
}
function zoneColor(label) { return {Heart:'#ff6c7a', Strike:'#66e3b4', Shadow:'#ffd166', Chase:'#7bb7ff', Waste:'#95a3ac'}[label]; }
function outcomeColor(label) { return ['Hit','Damage'].includes(label) ? '#ff6c7a' : label === 'Ball' ? '#ffd166' : '#66e3b4'; }
function countBucketValue(label) {
  return state.logs.filter(l => {
    const [b,s] = l.count.split('-').map(Number);
    if (label === '0-0') return b===0 && s===0;
    if (label === 'Ahead') return s>b;
    if (label === 'Even') return s===b && !(b===0 && s===0);
    if (label === 'Behind') return b>s;
    if (label === '2-strike') return s===2;
    if (label === '3-ball') return b===3;
  }).length;
}
function outcomeValue(label) {
  const map = {
    CS: ['calledStrike'], SwStr:['swingingStrike'], Foul:['foul'], Ball:['ball','hbp'], Out:['inPlayOut'],
    Hit:['single','double','triple'], Damage:['homeRun']
  };
  return state.logs.filter(l => map[label].includes(l.result)).length;
}

function renderTable() {
  $('tableCount').textContent = `${state.logs.length} row${state.logs.length === 1 ? '' : 's'}`;
  $('pitchTable').innerHTML = state.logs.slice().reverse().map(l => `
    <tr>
      <td>${l.n}</td>
      <td><span style="color:${l.pitchColor}">●</span> ${escapeHtml(l.pitchName)}</td>
      <td>${l.count}</td>
      <td>${l.batterHand}</td>
      <td>${escapeHtml(l.target.replace('-', ' / '))}</td>
      <td><span class="location-chip">${escapeHtml(l.zoneLabel)}</span></td>
      <td>${l.zoneType}</td>
      <td>${humanResult(l.result)}</td>
      <td>${humanContact(l.contact)}</td>
      <td>${escapeHtml(l.missLabel)}</td>
      <td>${escapeHtml(l.note || '')}</td>
    </tr>
  `).join('');
  $('lastLocation').textContent = state.logs.length ? `Last: ${state.logs.at(-1).pitchName}, ${state.logs.at(-1).zoneLabel}, ${state.logs.at(-1).zoneType}` : 'No pitches logged yet.';
}

function humanResult(r) {
  const map = {calledStrike:'Called strike', swingingStrike:'Swinging strike', foul:'Foul', ball:'Ball', inPlayOut:'In play out', single:'Single', double:'Double', triple:'Triple', homeRun:'Home run', hbp:'HBP'};
  return map[r] || r;
}
function humanContact(c) { return {none:'None', weak:'Weak', medium:'Medium', hard:'Hard', barrel:'Barrel'}[c] || c; }

function undoLast() {
  if (!state.logs.length) return toast('Nothing to undo.');
  state.logs.pop();
  state.logs.forEach((l,i)=>l.n=i+1);
  saveState(); renderAll(); toast('Last pitch removed.');
}
function clearSession() {
  if (!state.logs.length) return toast('Session is already empty.');
  if (!confirm('Clear all logged pitches from this browser session?')) return;
  state.logs = [];
  saveState(); renderAll(); toast('Session cleared.');
}

function simulateBullpen() {
  const originalResult = $('resultSelect').value;
  const originalContact = $('contactSelect').value;
  for (let i=0; i<15; i++) {
    const rec = getRecommendations();
    const p = rec.options[Math.floor(Math.random() * Math.min(3, rec.options.length))]?.pitch || state.pitches[0];
    $('pitchSelect').value = p.id;
    const target = targetToPoint(chooseTarget(p, rec.leverage));
    const spread = .055 + (10 - p.command) * .012;
    const x = clamp(target.x + randomNormal() * spread, .03, .97);
    const y = clamp(target.y + randomNormal() * spread, .03, .97);
    const loc = classifyLocation(x,y);
    const result = loc.inZone ? weighted([['calledStrike',.38],['swingingStrike',.18 + p.whiff/60],['foul',.18],['inPlayOut',.18],['ball',.08]]) : weighted([['ball',.62],['swingingStrike',.14 + p.whiff/70],['foul',.10],['inPlayOut',.08],['calledStrike',.06]]);
    $('resultSelect').value = result;
    $('contactSelect').value = ['inPlayOut','single','double','triple','homeRun'].includes(result) ? weighted([['weak',p.ground/16],['medium',.45],['hard',.16],['barrel',.04]]) : 'none';
    logPitch({xNorm:x, yNorm:y, source:'sim'});
  }
  $('resultSelect').value = originalResult; $('contactSelect').value = originalContact;
  toast('Simulated 15-pitch bullpen.');
}
function randomNormal() { let u=0,v=0; while(u===0)u=Math.random(); while(v===0)v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
function weighted(items) { const total = items.reduce((a,b)=>a+b[1],0); let r = Math.random()*total; for (const [v,w] of items) { if ((r-=w)<=0) return v; } return items.at(-1)[0]; }

function loadPreset() {
  state.pitches = structuredClone(defaultPitches).map(p => ({...p, id: cryptoRandomId()}));
  saveState(); renderAll(); toast('RHP starter preset loaded.');
}

function exportCsv() {
  const header = ['n','timestamp','pitchName','pitcherHand','batterHand','count','intent','target','xNorm','yNorm','zoneType','zoneLabel','inZone','result','contact','missLabel','missDistance','note'];
  const rows = state.logs.map(l => header.map(h => csvEscape(l[h] ?? '')).join(','));
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `pitch-lab-session-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  toast('CSV exported.');
}
function csvEscape(v) { const s = String(v); return /[",\n]/.test(s) ? `"${s.replaceAll('"','""')}"` : s; }

function importCsv(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const lines = String(reader.result).split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return toast('CSV has no rows.');
    const header = parseCsvLine(lines[0]);
    const imported = lines.slice(1).map((line, idx) => {
      const values = parseCsvLine(line);
      const obj = Object.fromEntries(header.map((h,i)=>[h, values[i] ?? '']));
      const pitch = state.pitches.find(p=>p.name===obj.pitchName) || state.pitches[0];
      const log = {
        id: cryptoRandomId(), n: state.logs.length + idx + 1, timestamp: obj.timestamp || new Date().toISOString(),
        pitchId: pitch.id, pitchName: obj.pitchName || pitch.name, pitchColor: pitch.color,
        pitcherHand: obj.pitcherHand || state.context.pitcherHand, batterHand: obj.batterHand || state.context.batterHand,
        count: obj.count || '0-0', intent: obj.intent || 'getAhead', target: obj.target || pitch.bestTarget,
        result: obj.result || 'ball', contact: obj.contact || 'none', note: obj.note || '',
        xNorm: Number(obj.xNorm || .5), yNorm: Number(obj.yNorm || .5), source: 'import'
      };
      enrichLogLocation(log);
      return log;
    });
    state.logs.push(...imported);
    state.logs.forEach((l,i)=>l.n=i+1);
    saveState(); renderAll(); toast(`Imported ${imported.length} pitches.`);
  };
  reader.readAsText(file);
  event.target.value = '';
}
function parseCsvLine(line) {
  const out = []; let cur = ''; let quoted = false;
  for (let i=0;i<line.length;i++) {
    const ch = line[i];
    if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(cur); cur=''; }
    else cur += ch;
  }
  out.push(cur); return out;
}

async function copyReport() {
  const logs = state.logs;
  const report = [
    'Pitch Lab Session Report',
    `Pitches: ${logs.length}`,
    `Strike %: ${pct(logs.filter(isStrikeResult).length, logs.length)}`,
    `Zone %: ${pct(logs.filter(l=>l.inZone).length, logs.length)}`,
    `Waste %: ${pct(logs.filter(l=>l.zoneType==='Waste').length, logs.length)}`,
    `Common miss: ${logs.length ? mode(logs.map(l=>l.missLabel)) : '—'}`,
    '',
    'Pitch mix:',
    ...state.pitches.map(p => `- ${p.name}: ${logsForPitch(p.id).length}`)
  ].join('\n');
  try { await navigator.clipboard.writeText(report); toast('Report copied.'); }
  catch { toast('Copy failed. Export CSV instead.'); }
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function escapeHtml(s) { return String(s).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function debounce(fn, wait) { let t; return (...args) => { clearTimeout(t); t = setTimeout(()=>fn(...args), wait); }; }
function toast(msg) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(()=>el.classList.remove('show'), 2400); }
