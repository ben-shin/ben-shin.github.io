const $ = (id) => document.getElementById(id);

const controls = {
  conc: $('conc'),
  fapA: $('fapA'),
  fapE: $('fapE'),
  seed: $('seed'),
  fragmentation: $('fragmentation'),
  offpathway: $('offpathway'),
  showAll: $('showAll'),
  criticMode: $('criticMode')
};

const readouts = {
  concValue: $('concValue'), fapAValue: $('fapAValue'), fapEValue: $('fapEValue'), seedValue: $('seedValue'), fragValue: $('fragValue'), offValue: $('offValue'),
  lagStat: $('lagStat'), halfStat: $('halfStat'), endpointStat: $('endpointStat'), burdenStat: $('burdenStat'), riskStat: $('riskStat'), dominantStat: $('dominantStat'),
  statusBadge: $('statusBadge'), scenarioText: $('scenarioText'), timePill: $('timePill'),
  mFinal: $('mFinal'), oFinal: $('oFinal'), fFinal: $('fFinal'), xFinal: $('xFinal'), barM: $('barM'), barO: $('barO'), barF: $('barF'), barX: $('barX'),
  thtTitle: $('thtTitle'), thtText: $('thtText'), fcsTitle: $('fcsTitle'), fcsText: $('fcsText'), nmrTitle: $('nmrTitle'), nmrText: $('nmrText'), emTitle: $('emTitle'), emText: $('emText'),
  equationText: $('equationText'), mechanismText: $('mechanismText'), criticText: $('criticText'), experimentText: $('experimentText'), copyStatus: $('copyStatus')
};

const particleCanvas = $('particleCanvas');
const curveCanvas = $('curveCanvas');
const pctx = particleCanvas.getContext('2d');
const cctx = curveCanvas.getContext('2d');

let particles = [];
let cachedSimulation = null;
let animationFrame = null;
let animationStart = null;
let paused = false;
let progress = 0;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function fitCanvas(canvas, ctx) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return rect;
}

function getSettings() {
  return {
    conc: Number(controls.conc.value),
    fapA: Number(controls.fapA.value),
    fapE: Number(controls.fapE.value),
    seed: Number(controls.seed.value),
    frag: Number(controls.fragmentation.value),
    off: Number(controls.offpathway.value),
    showAll: controls.showAll.checked,
    critic: controls.criticMode.checked
  };
}

function getRates(s) {
  const c = s.conc / 50;
  const inhibitor = s.fapA;
  const nucleator = s.fapE;
  const seed = s.seed / 100;
  const frag = s.frag / 100;
  const off = s.off / 100;

  const primary = 0.010 * Math.pow(c, 2.15) * (1 + 1.9 * nucleator) / (1 + 1.6 * inhibitor);
  const reversible = 0.028 * (1 + 0.55 * inhibitor);
  const mature = 0.030 * (1 + 1.45 * nucleator + 0.9 * seed) / (1 + 2.4 * inhibitor + 1.15 * off);
  const elongate = 0.020 * c * (1 + 2.2 * seed + 0.85 * nucleator) / (1 + 0.85 * inhibitor);
  const fragment = 0.018 * frag * (1 + 0.75 * c) / (1 + 0.35 * inhibitor);
  const trap = 0.006 + 0.035 * off * (1 + 0.55 * inhibitor);
  const rescue = 0.004 / (1 + 0.9 * off + 0.45 * inhibitor);

  return { primary, reversible, mature, elongate, fragment, trap, rescue };
}

function simulate(s) {
  const rates = getRates(s);
  const dt = 0.03;
  const maxT = 12;
  const steps = Math.round(maxT / dt);
  const seedFraction = s.seed / 100;

  let M = clamp(1 - seedFraction, 0.01, 1);
  let O = 0;
  let F = clamp(seedFraction, 0, 0.38);
  let X = 0;

  const data = [];
  let oligomerArea = 0;
  let maxO = 0;

  for (let i = 0; i <= steps; i++) {
    const t = i * dt;
    const tht = clamp((F / 0.9) * 100, 0, 100);
    const fcs = clamp((0.2 * M + 0.95 * O + 1.1 * F + 0.65 * X) * 100, 0, 100);
    const nmr = clamp(M * 100, 0, 100);
    const em = F > 0.12 ? clamp(((F - 0.12) / 0.72) * 100, 0, 100) : 0;
    data.push({ t, M, O, F, X, tht, fcs, nmr, em });

    oligomerArea += O * dt;
    maxO = Math.max(maxO, O);

    const nucleation = rates.primary * Math.pow(Math.max(M, 0), 2.05);
    const dissociation = rates.reversible * O;
    const maturation = rates.mature * O * (0.35 + M);
    const elongation = rates.elongate * M * F * (1 + F * 0.8);
    const fragmentationAmplification = rates.fragment * F * (0.25 + F) * M;
    const trap = rates.trap * O;
    const rescue = rates.rescue * X;

    let dM = -nucleation + dissociation - elongation - fragmentationAmplification + rescue * 0.45;
    let dO = nucleation - dissociation - maturation - trap + fragmentationAmplification * 0.12 + rescue * 0.15;
    let dF = maturation + elongation + fragmentationAmplification;
    let dX = trap - rescue * 0.6;

    M = clamp(M + dM * dt, 0, 1.3);
    O = clamp(O + dO * dt, 0, 1.3);
    F = clamp(F + dF * dt, 0, 1.3);
    X = clamp(X + dX * dt, 0, 1.3);

    const total = M + O + F + X;
    if (total > 1.0001) {
      M /= total;
      O /= total;
      F /= total;
      X /= total;
    }
  }

  const final = data[data.length - 1];
  const halfTarget = Math.max(12, final.tht * 0.5);
  const halfPoint = data.find(d => d.tht >= halfTarget);
  const lagPoint = data.find(d => d.tht >= 8);
  const emPoint = data.find(d => d.em >= 10);

  const lag = lagPoint ? lagPoint.t : 12;
  const half = halfPoint ? halfPoint.t : 12;
  const emTime = emPoint ? emPoint.t : null;
  const endpoint = final.tht;
  const oligomerBurden = oligomerArea / maxT;

  return { data, rates, final, lag, half, emTime, endpoint, oligomerBurden, maxO };
}

function currentSimulation() {
  const s = getSettings();
  cachedSimulation = simulate(s);
  return { s, sim: cachedSimulation };
}

function burdenLabel(b) {
  if (b < 0.018) return 'Low';
  if (b < 0.055) return 'Medium';
  if (b < 0.105) return 'High';
  return 'Very high';
}

function riskLabel(s, sim) {
  const highFcsLowThT = sim.data.some(d => d.t > 2 && d.fcs > 35 && d.tht < 12);
  const invisibleNmr = sim.data.some(d => d.nmr < 65 && d.tht < 15);
  const lateEm = sim.emTime === null && sim.endpoint > 25;
  const score = Number(highFcsLowThT) + Number(invisibleNmr) + Number(lateEm) + (s.off > 45 ? 1 : 0) + (s.fapA > 1 && sim.endpoint < 30 ? 1 : 0);
  if (score <= 1) return 'Low';
  if (score <= 3) return 'Moderate';
  return 'High';
}

function dominantBottleneck(s, sim) {
  if (s.seed > 10) return 'Elongation';
  if (s.fapA > 1.1 && sim.endpoint < 35) return 'Maturation';
  if (s.off > 45) return 'Partitioning';
  if (s.fapE > 1.1 && s.frag > 60) return 'Depletion';
  if (sim.lag > 7.5) return 'Nucleation';
  return 'Nucleation';
}

function scenarioText(s, sim) {
  if (s.fapA > 0.7 && s.fapE > 0.7) {
    return {
      status: 'Competing controls',
      scenario: 'Nucleator-like activity pulls the system toward assembly, while FapA-like inhibition suppresses productive maturation.'
    };
  }
  if (s.seed > 8) return { status: 'Seeded growth', scenario: 'Pre-formed seed bypasses much of the lag phase, making elongation the dominant behavior.' };
  if (s.fapA > 1.0) return { status: 'Suppressed maturation', scenario: 'FapA-like inhibition delays visible fibril formation and increases the chance of hidden soluble or stalled intermediates.' };
  if (s.fapE > 1.0) return { status: 'Nucleated growth', scenario: 'FapE-like nucleation lowers the barrier and pulls the curve left.' };
  if (s.off > 50) return { status: 'Off-pathway trap', scenario: 'A large fraction of material is being diverted into nonproductive assemblies rather than ordered fibrils.' };
  if (s.conc > 105 && s.frag > 60) return { status: 'Aggressive growth', scenario: 'High concentration and agitation produce a fast, amplified aggregation condition.' };
  if (s.conc < 25) return { status: 'Mostly soluble', scenario: 'Low concentration keeps productive encounters rare over this time window.' };
  return { status: 'Lag phase', scenario: 'A balanced condition with a visible lag phase.' };
}

function updateLabels(s) {
  readouts.concValue.textContent = s.conc.toFixed(0);
  readouts.fapAValue.textContent = s.fapA.toFixed(1);
  readouts.fapEValue.textContent = s.fapE.toFixed(1);
  readouts.seedValue.textContent = s.seed.toFixed(0);
  readouts.fragValue.textContent = s.frag.toFixed(0);
  readouts.offValue.textContent = s.off.toFixed(0);
}

function updateDashboard() {
  const { s, sim } = currentSimulation();
  updateLabels(s);

  const scene = scenarioText(s, sim);
  readouts.statusBadge.textContent = scene.status;
  readouts.scenarioText.textContent = scene.scenario;

  readouts.lagStat.textContent = sim.lag >= 11.95 ? '>12 h' : `${sim.lag.toFixed(1)} h`;
  readouts.halfStat.textContent = sim.half >= 11.95 ? '>12 h' : `${sim.half.toFixed(1)} h`;
  readouts.endpointStat.textContent = `${Math.round(sim.endpoint)}%`;
  readouts.burdenStat.textContent = burdenLabel(sim.oligomerBurden);
  readouts.riskStat.textContent = riskLabel(s, sim);
  readouts.dominantStat.textContent = dominantBottleneck(s, sim);

  const final = sim.final;
  const mp = Math.round(final.M * 100);
  const op = Math.round(final.O * 100);
  const fp = Math.round(final.F * 100);
  const xp = Math.round(final.X * 100);
  readouts.mFinal.textContent = `${mp}%`; readouts.oFinal.textContent = `${op}%`; readouts.fFinal.textContent = `${fp}%`; readouts.xFinal.textContent = `${xp}%`;
  readouts.barM.style.width = `${mp}%`; readouts.barO.style.width = `${op}%`; readouts.barF.style.width = `${fp}%`; readouts.barX.style.width = `${xp}%`;

  updateReadoutCards(s, sim);
  updateMechanism(s, sim);
}

function updateReadoutCards(s, sim) {
  const endpoint = sim.endpoint;
  const hiddenOligomers = sim.data.some(d => d.O > 0.06 && d.tht < 15);
  const earlyFcs = sim.data.find(d => d.fcs > 32);
  const nmrDrop = sim.data.find(d => d.nmr < 70);

  if (endpoint < 12) {
    readouts.thtTitle.textContent = 'Mostly flat signal';
    readouts.thtText.textContent = 'ThT-like signal would suggest weak fibril formation inside the 12 hour window, but that does not rule out soluble assemblies.';
  } else if (sim.lag < 1.5) {
    readouts.thtTitle.textContent = 'Lag nearly collapses';
    readouts.thtText.textContent = 'The fibril-associated signal rises early, consistent with seeding or strong nucleator-like behavior.';
  } else {
    readouts.thtTitle.textContent = 'Sigmoidal aggregation';
    readouts.thtText.textContent = 'The curve shows a lag phase followed by accelerated growth and an endpoint plateau.';
  }

  if (hiddenOligomers) {
    readouts.fcsTitle.textContent = 'Slow species before ThT';
    readouts.fcsText.textContent = 'A diffusion shift appears before strong fibril signal, pointing to early oligomers or larger soluble particles.';
  } else if (earlyFcs && earlyFcs.t < 2) {
    readouts.fcsTitle.textContent = 'Rapid size increase';
    readouts.fcsText.textContent = 'FCS-like signal shifts early, matching a seeded or strongly nucleated condition.';
  } else {
    readouts.fcsTitle.textContent = 'Slow species track growth';
    readouts.fcsText.textContent = 'Diffusion changes mostly follow the main aggregation phase rather than preceding it.';
  }

  if (nmrDrop && endpoint < 20) {
    readouts.nmrTitle.textContent = 'Invisible material without ThT';
    readouts.nmrText.textContent = 'Soluble signal loss with weak ThT would be a warning sign for large non-fibrillar or off-pathway states.';
  } else if (nmrDrop) {
    readouts.nmrTitle.textContent = 'Soluble pool depletes';
    readouts.nmrText.textContent = `NMR-visible monomer begins to disappear around ${nmrDrop.t.toFixed(1)} h in this condition.`;
  } else {
    readouts.nmrTitle.textContent = 'Most monomer remains visible';
    readouts.nmrText.textContent = 'NMR would mainly see soluble material over the displayed time window.';
  }

  if (sim.emTime === null) {
    readouts.emTitle.textContent = 'Few obvious fibrils';
    readouts.emText.textContent = 'EM-like visibility remains low. This could mean little ordered fibril mass or structures below the practical detection threshold.';
  } else if (sim.emTime > 7) {
    readouts.emTitle.textContent = 'Fibrils appear late';
    readouts.emText.textContent = `EM-visible structures become likely around ${sim.emTime.toFixed(1)} h, after earlier soluble changes.`;
  } else {
    readouts.emTitle.textContent = 'Fibrils visible early';
    readouts.emText.textContent = `Ordered structures become visible around ${sim.emTime.toFixed(1)} h, consistent with strong seeding or nucleation.`;
  }
}

function updateMechanism(s, sim) {
  const seedLine = s.seed > 0 ? 'Seed + M → F' : 'rare nucleus forms from M';
  const fragLine = s.frag > 50 ? 'F → more fibril ends' : 'F elongates without strong fragmentation';
  const offLine = s.off > 30 ? 'O → X competes with O → F' : 'limited off-pathway loss';
  const inhibitorLine = s.fapA > 0.3 ? 'FapA-like activity suppresses O → F' : 'weak inhibition';
  const nucleatorLine = s.fapE > 0.3 ? 'FapE-like activity boosts M → O' : 'spontaneous primary nucleation dominates';

  readouts.equationText.textContent = `M ⇌ O → F\n${seedLine}\n${nucleatorLine}\n${inhibitorLine}\n${offLine}\n${fragLine}`;

  if (s.seed > 8) {
    readouts.mechanismText.textContent = 'This is mostly an elongation experiment. Because seed is already present, lag time is less diagnostic of primary nucleation.';
    readouts.experimentText.textContent = 'Vary seed concentration at fixed monomer concentration to separate elongation capacity from de novo nucleation.';
  } else if (s.fapA > 0.8 && s.fapE > 0.8) {
    readouts.mechanismText.textContent = 'This condition tests competition: nucleator-like activity makes productive nuclei easier, while inhibitor-like activity blocks or delays maturation.';
    readouts.experimentText.textContent = 'Run a matrix of FapA:FapE ratios and compare early FCS/NMR changes against final ThT endpoint.';
  } else if (s.off > 45) {
    readouts.mechanismText.textContent = 'The main story is partitioning. Material can leave the soluble pool without becoming strongly ThT-positive fibril mass.';
    readouts.experimentText.textContent = 'Combine NMR intensity loss, FCS diffusion shifts, and EM at matched timepoints to catch non-fibrillar material.';
  } else if (s.fapA > 0.8) {
    readouts.mechanismText.textContent = 'FapA-like activity raises the barrier between transient assemblies and ordered fibrils. The most important species may sit before the ThT rise.';
    readouts.experimentText.textContent = 'Sample the lag phase densely with FCS and NMR rather than only measuring the final ThT endpoint.';
  } else if (s.fapE > 0.8) {
    readouts.mechanismText.textContent = 'FapE-like activity lowers the cost of productive nucleation, shifting the system toward earlier growth.';
    readouts.experimentText.textContent = 'Measure whether the concentration dependence of lag time weakens when FapE-like nucleation is present.';
  } else {
    readouts.mechanismText.textContent = 'Primary nucleation creates a transient oligomer pool. Some oligomers mature into fibrils, and fibrils then elongate by recruiting soluble material.';
    readouts.experimentText.textContent = 'Run a concentration series and compare ThT timing against FCS/NMR evidence for early soluble assemblies.';
  }

  if (s.critic) {
    readouts.criticText.textContent = 'Reviewer 2 would ask whether the same traces could be explained by sample loss, dye artefacts, conformational changes without aggregation, or off-pathway particles that never become fibrils.';
  } else if (sim.endpoint < 12 && sim.oligomerBurden > 0.035) {
    readouts.criticText.textContent = 'A flat ThT curve is not enough to claim inhibition. You need to show where the protein went and whether it remains soluble, oligomeric, or trapped.';
  } else if (s.seed > 8) {
    readouts.criticText.textContent = 'With seeds present, lag time no longer cleanly reports primary nucleation. Do not overinterpret it as de novo aggregation propensity.';
  } else {
    readouts.criticText.textContent = 'Does the curve actually require this pathway, or could another mechanism generate a similar macroscopic shape?';
  }
}

function getAtProgress(sim) {
  const t = progress * 12;
  let best = sim.data[0];
  for (const d of sim.data) {
    if (Math.abs(d.t - t) < Math.abs(best.t - t)) best = d;
  }
  return best;
}

function initParticles() {
  const rect = fitCanvas(particleCanvas, pctx);
  const s = getSettings();
  const count = Math.round(34 + s.conc * 0.42);
  particles = Array.from({ length: count }, (_, i) => ({
    x: Math.random() * rect.width,
    y: Math.random() * rect.height,
    vx: (Math.random() - 0.5) * (0.32 + s.frag / 85),
    vy: (Math.random() - 0.5) * (0.32 + s.frag / 85),
    r: Math.random() * 2.1 + 3.1,
    phase: Math.random() * Math.PI * 2,
    seed: i
  }));
}

function drawParticles(timestamp = 0) {
  const { s, sim } = currentSimulation();
  const now = getAtProgress(sim);
  const rect = fitCanvas(particleCanvas, pctx);
  const w = rect.width;
  const h = rect.height;
  const t = timestamp / 1000;
  pctx.clearRect(0, 0, w, h);

  pctx.fillStyle = 'rgba(244,239,231,0.045)';
  for (let i = 0; i < 28; i++) {
    pctx.beginPath();
    pctx.arc((i * 101 + t * 9) % w, (i * 47 + Math.sin(t + i) * 10) % h, 1.4, 0, Math.PI * 2);
    pctx.fill();
  }

  const centerX = w * 0.54;
  const centerY = h * 0.53;
  const fCount = Math.floor(particles.length * clamp(now.F, 0, 0.92));
  const oCount = Math.floor(particles.length * clamp(now.O * 1.25, 0, 0.55));
  const xCount = Math.floor(particles.length * clamp(now.X, 0, 0.45));

  particles.forEach((p, i) => {
    let x = p.x;
    let y = p.y;
    let color = '#76c7c0';
    let radius = p.r;
    let alpha = 0.95;

    if (i < fCount) {
      const lineIndex = i % 42;
      const strand = Math.floor(i / 42) % 6;
      x = centerX - 205 + lineIndex * 10 + Math.sin(lineIndex * 0.45 + t * 2.5) * 1.5;
      y = centerY - 32 + strand * 12 + Math.sin(lineIndex * 0.7 + t * 3) * 1.5;
      color = '#d7b56d';
      radius = 4.3;
    } else if (i < fCount + oCount) {
      const j = i - fCount;
      const angle = (j / Math.max(1, oCount)) * Math.PI * 2 + t * 0.35;
      const clusterR = 16 + (j % 10) * 2.8;
      x = centerX + Math.cos(angle) * clusterR;
      y = centerY + Math.sin(angle) * clusterR;
      color = '#e98c77';
      radius = 5.2;
    } else if (i < fCount + oCount + xCount) {
      const j = i - fCount - oCount;
      x = w * 0.22 + Math.cos(j * 1.7 + t * 0.22) * (26 + (j % 8) * 2);
      y = h * 0.70 + Math.sin(j * 1.4 + t * 0.28) * (24 + (j % 7) * 2);
      color = '#c89cff';
      radius = 4.8;
      alpha = 0.75;
    } else {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      x = p.x + Math.sin(t + p.phase) * 1.3;
      y = p.y + Math.cos(t * 0.8 + p.phase) * 1.3;
    }

    pctx.globalAlpha = alpha;
    pctx.fillStyle = color;
    pctx.shadowColor = color;
    pctx.shadowBlur = 12;
    pctx.beginPath();
    pctx.arc(x, y, radius, 0, Math.PI * 2);
    pctx.fill();
    pctx.shadowBlur = 0;
    pctx.globalAlpha = 1;
  });

  if (s.fapA > 0) {
    pctx.strokeStyle = `rgba(165,214,143,${clamp(0.18 + s.fapA * 0.18, 0.2, 0.62)})`;
    pctx.lineWidth = 2;
    const loops = Math.round(4 + s.fapA * 5);
    for (let i = 0; i < loops; i++) {
      const x = (i * 91 + t * 16) % w;
      const y = 42 + ((i * 53) % Math.max(50, h - 84));
      pctx.beginPath();
      pctx.arc(x, y, 12 + Math.sin(t + i) * 2, 0, Math.PI * 2);
      pctx.stroke();
    }
  }

  if (s.fapE > 0 || s.seed > 0) {
    pctx.fillStyle = s.seed > 0 ? 'rgba(143,167,255,0.88)' : 'rgba(215,181,109,0.88)';
    pctx.beginPath();
    roundRect(pctx, centerX - 42, centerY - 12, 84, 24, 12);
    pctx.fill();
  }
}

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function drawTrace(ctx, data, key, color, w, h, pad, scaleMode = 'normal') {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = pad + (d.t / 12) * (w - pad * 1.45);
    let value = d[key];
    if (scaleMode === 'fraction') value *= 100;
    const y = (h - pad) - clamp(value, 0, 100) / 100 * (h - pad * 1.55);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

function drawCurve() {
  const { s, sim } = currentSimulation();
  const rect = fitCanvas(curveCanvas, cctx);
  const w = rect.width;
  const h = rect.height;
  const pad = 46;
  cctx.clearRect(0, 0, w, h);

  cctx.strokeStyle = 'rgba(255,255,255,0.12)';
  cctx.lineWidth = 1;
  cctx.beginPath();
  cctx.moveTo(pad, 24);
  cctx.lineTo(pad, h - pad);
  cctx.lineTo(w - 24, h - pad);
  cctx.stroke();

  for (let i = 0; i <= 4; i++) {
    const y = 24 + i * ((h - pad - 24) / 4);
    cctx.strokeStyle = 'rgba(255,255,255,0.055)';
    cctx.beginPath();
    cctx.moveTo(pad, y);
    cctx.lineTo(w - 24, y);
    cctx.stroke();
  }

  cctx.fillStyle = 'rgba(244,239,231,0.72)';
  cctx.font = '12px system-ui, sans-serif';
  cctx.fillText('signal / population', 12, 18);
  cctx.fillText('0 h', pad - 6, h - 16);
  cctx.fillText('12 h', w - 66, h - 16);

  if (s.showAll) {
    drawTrace(cctx, sim.data, 'tht', '#d7b56d', w, h, pad);
    drawTrace(cctx, sim.data, 'fcs', '#e98c77', w, h, pad);
    drawTrace(cctx, sim.data, 'nmr', '#76c7c0', w, h, pad);
    drawTrace(cctx, sim.data, 'em', '#8fa7ff', w, h, pad);
  } else {
    drawTrace(cctx, sim.data, 'tht', '#d7b56d', w, h, pad);
    drawTrace(cctx, sim.data, 'O', '#e98c77', w, h, pad, 'fraction');
    drawTrace(cctx, sim.data, 'M', '#76c7c0', w, h, pad, 'fraction');
    drawTrace(cctx, sim.data, 'F', '#8fa7ff', w, h, pad, 'fraction');
  }

  const d = getAtProgress(sim);
  const x = pad + (d.t / 12) * (w - pad * 1.45);
  const y = (h - pad) - clamp(d.tht, 0, 100) / 100 * (h - pad * 1.55);
  cctx.fillStyle = '#f4efe7';
  cctx.strokeStyle = 'rgba(0,0,0,0.35)';
  cctx.lineWidth = 2;
  cctx.beginPath();
  cctx.arc(x, y, 6, 0, Math.PI * 2);
  cctx.fill();
  cctx.stroke();

  if (sim.lag < 12) {
    const lagX = pad + (sim.lag / 12) * (w - pad * 1.45);
    cctx.strokeStyle = 'rgba(118,199,192,0.65)';
    cctx.setLineDash([5, 5]);
    cctx.beginPath();
    cctx.moveTo(lagX, 24);
    cctx.lineTo(lagX, h - pad);
    cctx.stroke();
    cctx.setLineDash([]);
    cctx.fillStyle = 'rgba(118,199,192,0.95)';
    cctx.fillText('lag', lagX + 6, 40);
  }

  readouts.timePill.textContent = `${d.t.toFixed(1)} h`;
}

function redraw() {
  updateDashboard();
  drawParticles(0);
  drawCurve();
}

function animate(ts) {
  if (!animationStart) animationStart = ts - progress * 9000;
  if (!paused) progress = clamp((ts - animationStart) / 9000, 0, 1);
  drawParticles(ts);
  drawCurve();
  if (progress < 1 && !paused) {
    animationFrame = requestAnimationFrame(animate);
  }
}

function runAnimation() {
  cancelAnimationFrame(animationFrame);
  paused = false;
  progress = 0;
  animationStart = null;
  initParticles();
  updateDashboard();
  animationFrame = requestAnimationFrame(animate);
  $('pauseBtn').textContent = 'Pause';
}

function pauseToggle() {
  if (paused) {
    paused = false;
    animationStart = null;
    animationFrame = requestAnimationFrame(animate);
    $('pauseBtn').textContent = 'Pause';
  } else {
    paused = true;
    cancelAnimationFrame(animationFrame);
    $('pauseBtn').textContent = 'Resume';
  }
}

function reset() {
  cancelAnimationFrame(animationFrame);
  controls.conc.value = 50;
  controls.fapA.value = 0;
  controls.fapE.value = 0;
  controls.seed.value = 0;
  controls.fragmentation.value = 35;
  controls.offpathway.value = 15;
  controls.showAll.checked = true;
  controls.criticMode.checked = false;
  paused = false;
  progress = 0;
  animationStart = null;
  $('pauseBtn').textContent = 'Pause';
  initParticles();
  redraw();
}

function applyPreset(name) {
  const presets = {
    fapc: { conc: 50, fapA: 0, fapE: 0, seed: 0, frag: 35, off: 15 },
    fapa: { conc: 50, fapA: 1.1, fapE: 0, seed: 0, frag: 35, off: 25 },
    fape: { conc: 50, fapA: 0, fapE: 1.2, seed: 0, frag: 35, off: 10 },
    all: { conc: 50, fapA: 1.0, fapE: 1.0, seed: 0, frag: 35, off: 20 },
    seeded: { conc: 50, fapA: 0, fapE: 0, seed: 15, frag: 55, off: 10 }
  };
  const p = presets[name];
  if (!p) return;
  controls.conc.value = p.conc;
  controls.fapA.value = p.fapA;
  controls.fapE.value = p.fapE;
  controls.seed.value = p.seed;
  controls.fragmentation.value = p.frag;
  controls.offpathway.value = p.off;
  progress = 0;
  initParticles();
  redraw();
}

function randomize() {
  controls.conc.value = Math.round((15 + Math.random() * 125) / 5) * 5;
  controls.fapA.value = (Math.round(Math.random() * 16) / 10).toFixed(1);
  controls.fapE.value = (Math.round(Math.random() * 16) / 10).toFixed(1);
  controls.seed.value = Math.round(Math.random() * 24);
  controls.fragmentation.value = Math.round((10 + Math.random() * 85) / 5) * 5;
  controls.offpathway.value = Math.round((Math.random() * 70) / 5) * 5;
  progress = 0;
  initParticles();
  redraw();
}

function conditionSummary() {
  const { s, sim } = currentSimulation();
  return {
    title: 'Amyloid Playground condition',
    controls: {
      amyloidProtein_uM: s.conc,
      fapA_like_inhibitor_ratio: s.fapA,
      fapE_like_nucleator_ratio: s.fapE,
      preformed_seed_percent: s.seed,
      agitation_fragmentation_percent: s.frag,
      off_pathway_trapping_percent: s.off
    },
    conceptual_outputs: {
      lag_time_h: sim.lag >= 11.95 ? '>12' : Number(sim.lag.toFixed(2)),
      half_time_h: sim.half >= 11.95 ? '>12' : Number(sim.half.toFixed(2)),
      fibril_endpoint_percent: Math.round(sim.endpoint),
      oligomer_burden: burdenLabel(sim.oligomerBurden),
      misread_risk: riskLabel(s, sim),
      bottleneck: dominantBottleneck(s, sim)
    },
    caveat: 'Conceptual teaching model only. Not a fitted kinetic model.'
  };
}

async function copySummary() {
  const summary = conditionSummary();
  const text = `Amyloid Playground condition\n` +
    `FapC-like protein: ${summary.controls.amyloidProtein_uM} µM\n` +
    `FapA-like inhibitor: ${summary.controls.fapA_like_inhibitor_ratio}x\n` +
    `FapE-like nucleator: ${summary.controls.fapE_like_nucleator_ratio}x\n` +
    `Seed: ${summary.controls.preformed_seed_percent}%\n` +
    `Agitation/fragmentation: ${summary.controls.agitation_fragmentation_percent}%\n` +
    `Off-pathway trapping: ${summary.controls.off_pathway_trapping_percent}%\n` +
    `Lag: ${summary.conceptual_outputs.lag_time_h} h; half-time: ${summary.conceptual_outputs.half_time_h} h; endpoint: ${summary.conceptual_outputs.fibril_endpoint_percent}%\n` +
    `Oligomer burden: ${summary.conceptual_outputs.oligomer_burden}; misread risk: ${summary.conceptual_outputs.misread_risk}; bottleneck: ${summary.conceptual_outputs.bottleneck}`;
  try {
    await navigator.clipboard.writeText(text);
    readouts.copyStatus.textContent = 'Copied summary.';
  } catch (e) {
    readouts.copyStatus.textContent = 'Copy failed. Select the page text manually.';
  }
  setTimeout(() => { readouts.copyStatus.textContent = ''; }, 2500);
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(conditionSummary(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'amyloid-playground-condition.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

Object.values(controls).forEach(el => {
  el.addEventListener('input', () => {
    progress = Math.min(progress, 0.2);
    initParticles();
    redraw();
  });
  el.addEventListener('change', () => {
    progress = Math.min(progress, 0.2);
    initParticles();
    redraw();
  });
});

document.querySelectorAll('[data-preset]').forEach(btn => {
  btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
});

$('runBtn').addEventListener('click', runAnimation);
$('pauseBtn').addEventListener('click', pauseToggle);
$('resetBtn').addEventListener('click', reset);
$('copyBtn').addEventListener('click', copySummary);
$('downloadJsonBtn').addEventListener('click', downloadJson);
$('randomizeBtn').addEventListener('click', randomize);

window.addEventListener('resize', () => {
  initParticles();
  redraw();
});

initParticles();
redraw();
