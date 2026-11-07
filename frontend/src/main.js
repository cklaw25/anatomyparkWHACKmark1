import { SITES, MODES, MODE_SITES, silhouette, layer, route } from './anatomy.js';
import { Body } from './sim.js';
import FALLBACK from './cases.json';

const API = import.meta.env.VITE_API || 'http://localhost:8010';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const LETTERS = 'ABCD';
const START_MIN = 16 * 60 + 30, ONSET_AFTER = 12; // game clock starts 16:30, symptoms start ~12 s later

// ---------------- state ----------------
let C = null;                         // the hidden case (from Claude)
const body = new Body();
let mode = 'circulatory', bot = { site: 'heart', x: SITES.heart.x, y: SITES.heart.y }, path = null, testing = null;
let findings = [], treatments = [], given = [], evidence = [], cascades = [], log = [];
let t = 0, started = false, over = false, onset = false, stagePending = false;
let lastSay = -99, idleTimer = 0, flags = {};

// ---------------- voice + the Attending (live personality) ----------------
const synth = window.speechSynthesis; let voice = null;
const pickVoice = () => { const vs = synth?.getVoices() || []; voice = vs.find(v => /en-GB/i.test(v.lang) && /male|george|ryan|daniel/i.test(v.name)) || vs.find(v => /en-GB/i.test(v.lang)) || vs[0]; };
if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
function say(text, force = false) {
  if (!force && t - lastSay < 4) return;
  lastSay = t;
  $('att-text').textContent = '"' + text + '"';
  if (!synth) return;
  if (force) synth.cancel(); else if (synth.speaking) return;
  const u = new SpeechSynthesisUtterance(text); if (voice) u.voice = voice; u.rate = 1.05; u.pitch = 0.8; synth.speak(u);
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// ---------------- helpers ----------------
const clock = () => { const m = START_MIN + Math.floor(t); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const record = (kind, text) => log.push({ t: clock(), kind, text });

// ---------------- loading the case ----------------
async function loadCase() {
  try {
    const r = await fetch(API + '/case', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const j = await r.json();
    if (j.ok && j.case) { $('case-status').textContent = `Case ready (Claude ${j.case._source || ''}${j.cached ? ', from the case pool' : ''}).`; return j.case; }
  } catch { /* offline */ }
  $('case-status').textContent = 'Backend offline: using a built-in case.';
  return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
}

// ---------------- rendering ----------------
function renderModes() {
  $('modes').innerHTML = MODES.map((m, i) => {
    const n = findings.filter(f => f.system === m.id && evidence.some(e => e.site === f.site && e.system === f.system)).length;
    return `<button data-mode="${m.id}" class="${m.id === mode ? 'active' : ''}" style="${m.id === mode ? `border-color:${m.color}` : ''}">
      <span class="dot" style="background:${m.color}"></span><span>${m.label}<small>[${i + 1}] clues found: ${n}</small></span></button>`;
  }).join('');
  document.querySelectorAll('#modes button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
}

function setMode(m) {
  mode = m; const md = MODES.find(x => x.id === m);
  $('scan-title').innerHTML = `<span style="color:${md.color}">${md.label} SCAN</span>`;
  $('body').style.setProperty('--tint', md.color + '30');
  drawStatic(); renderModes();
}

function drawStatic() {
  const md = MODES.find(x => x.id === mode);
  $('body').innerHTML = `${silhouette()}<g id="lay">${layer(mode)}</g><g id="dyn"></g>
    <rect class="scanline" x="0" y="0" width="600" height="6" fill="${md.color}" opacity=".8"/>
    <circle id="bot-glow" r="20" fill="#5adcff" opacity=".35"/><circle id="bot" r="9" fill="#5adcff" stroke="#fff" stroke-width="2"/>`;
  drawDynamic();
}

function drawDynamic() {
  const md = MODES.find(x => x.id === mode), inMode = MODE_SITES[mode];
  let h = '';
  for (const [id, s] of Object.entries(SITES)) {
    const p = body.problems.get(id), bright = inMode.includes(id);
    const tested = evidence.some(e => e.site === id && e.system === mode);
    if (p && p.severity > 0.02 && onset) h += `<circle class="glow" cx="${s.x}" cy="${s.y}" r="${16 + 30 * p.severity}" fill="#ff3030" opacity=".6"/>`;
    h += `<g class="site" data-site="${id}"><circle cx="${s.x}" cy="${s.y}" r="18" fill="transparent"/>
      <circle class="ring" cx="${s.x}" cy="${s.y}" r="${bright ? 11 : 7}" stroke="${tested ? '#5ae68c' : bright ? md.color : '#506070'}"/>
      ${bright || p ? `<text x="${s.x + 15}" y="${s.y - 10}">${SITES[id].label}${p && onset ? ' ⚠' : ''}</text>` : ''}</g>`;
  }
  if (testing) h += `<circle cx="${SITES[testing.site].x}" cy="${SITES[testing.site].y}" r="${10 + (testing.p * 40) % 40}" fill="none" stroke="#5adcff" stroke-width="3" opacity="${1 - (testing.p * 40 % 40) / 40}"/>
      <text x="${SITES[testing.site].x - 40}" y="${SITES[testing.site].y + 34}" style="font:13px Consolas;fill:#5adcff">SCANNING…</text>`;
  $('dyn').innerHTML = h;
  document.querySelectorAll('#dyn .site').forEach(g => g.onclick = () => goTest(g.dataset.site));
}

function renderDay() {
  const items = (C.day_events || []).map(e => ({ ...e }));
  if (onset) for (const s of C.initial_symptoms) items.push({ time: C._onsetClock, text: s.text, bad: true });
  $('day').innerHTML = items.map(e => `<li class="${e.bad ? 'bad' : ''}">${esc(e.time)} &nbsp;${esc(e.text)}</li>`).join('');
}

function renderEvidence() {
  $('evidence').innerHTML = evidence.length ? evidence.map(e => `<li class="${e.key ? 'key' : e.normal ? 'normal' : ''}">${esc(SITES[e.site].label)} · ${esc(e.system)}: ${esc(e.result)}</li>`).join('')
    : '<li class="dim">Run tests to collect evidence.</li>';
  renderModes();
}

function renderTreatments() {
  if (stagePending) { $('treatments').innerHTML = '<div class="dim" style="grid-column:1/3">Administering… the body is reacting (Claude is simulating the cascade)…</div>'; return; }
  $('treatments').innerHTML = treatments.map((tr, i) => `<button data-i="${i}" ${(!onset || over) ? 'disabled' : ''}><b>${LETTERS[i]}</b>${esc(tr.name)}</button>`).join('');
  document.querySelectorAll('#treatments button').forEach(b => b.onclick = () => treat(+b.dataset.i));
}

function renderCascades() {
  $('cascade').innerHTML = cascades.length ? cascades.map(c => `<div><b style="color:#ff6b6b">${esc(c.treatment)}</b>: ${esc(c.why)}<br><span class="new">→ NEW: ${c.effects.map(e => esc(SITES[e.site].label) + ' (' + esc(e.text) + ')').join(', ')}</span></div>`).join('')
    : '<span class="dim">No cascades yet.</span>';
}

const VITALS = [
  ['hr', 'HR', 'bpm', v => v.hr > 130 ? 'bad' : v.hr > 105 ? 'warn' : '', v => Math.round(v.hr)],
  ['bp', 'BP', '', v => v.sys < 85 ? 'bad' : v.sys < 100 || v.sys > 160 ? 'warn' : '', v => `${Math.round(v.sys)}/${Math.round(v.dia)}`],
  ['spo2', 'SpO₂', '%', v => v.spo2 < 88 ? 'bad' : v.spo2 < 94 ? 'warn' : '', v => Math.round(v.spo2)],
  ['temp', 'TEMP', '°C', v => v.temp > 39 ? 'bad' : v.temp > 37.8 ? 'warn' : '', v => v.temp.toFixed(1)],
  ['rr', 'RR', '/min', v => v.rr > 26 ? 'bad' : v.rr > 20 ? 'warn' : '', v => Math.round(v.rr)],
];
function renderVitals() {
  const v = body.v;
  $('vitals').innerHTML = VITALS.map(([, k, u, cls, val]) => `<div class="vital ${cls(v)}"><small>${k}</small><span>${val(v)}</span> <em>${u}</em></div>`).join('');
  const st = body.status(); $('vit-status').textContent = st; $('vit-status').className = st;
}

// scrolling ECG driven by the simulated heart rate
const ecg = $('ecg').getContext('2d'); let ecgX = 0, beatPhase = 0, lastY = 40;
function drawEcg(dt) {
  const w = 440, h = 80;
  beatPhase += dt * (body.v.hr / 60);
  for (let i = 0; i < 3; i++) {
    ecgX = (ecgX + 1) % w;
    const ph = beatPhase % 1; let y = 40;
    if (ph > 0.30 && ph < 0.34) y = 34; else if (ph > 0.36 && ph < 0.39) y = 66; else if (ph > 0.39 && ph < 0.43) y = 8; else if (ph > 0.43 && ph < 0.47) y = 50;
    else if (ph > 0.62 && ph < 0.72) y = 40 - 7 * Math.sin((ph - 0.62) / 0.1 * Math.PI);
    ecg.fillStyle = '#06100a'; ecg.fillRect(ecgX, 0, 12, h);
    ecg.strokeStyle = body.status() === 'CRITICAL' ? '#ff4646' : '#5ae68c'; ecg.lineWidth = 2;
    ecg.beginPath(); ecg.moveTo(ecgX - 1, lastY); ecg.lineTo(ecgX, y); ecg.stroke(); lastY = y;
  }
}

// ---------------- player actions ----------------
function goTest(site) {
  if (!started || over || testing) return;
  idleTimer = 0;
  if (site === bot.site) { startTest(site); return; }
  path = { pts: route(bot.site, site).slice(1), target: site };
}

function startTest(site) { testing = { site, p: 0, mode }; }

function finishTest() {
  const { site, mode: m } = testing; testing = null;
  if (evidence.some(e => e.site === site && e.system === m)) { say(pick(['You already ran that test.', 'Same test, same answer. Fascinating.'])); return; }
  const f = findings.find(x => x.site === site && x.system === m);
  const p = body.problems.get(site);
  let e;
  if (f) e = { site, system: m, result: f.result, key: f.key };
  else if (p && onset) e = { site, system: m, result: `${p.texts[0] || 'abnormal'} (non-specific on this scan)` };
  else e = { site, system: m, result: 'normal', normal: true };
  evidence.push(e); renderEvidence();
  record('test', `${m} scan of ${SITES[site].label}: ${e.result}`);
  if (e.key) say(pick(['Finally. A useful test.', 'Now we are getting somewhere.', 'That one matters. Write it down.']));
  else if (e.normal) say(pick([`Normal. You spent ten minutes confirming the ${SITES[site].label.toLowerCase()} exists.`, 'Normal. The patient thanks you for the sightseeing.', 'Nothing. Try thinking before scanning.']));
}

async function treat(i) {
  if (over || stagePending || !onset) return;
  const tr = treatments[i]; given.push(tr.name); idleTimer = 0;
  record('treat', `${tr.name}${tr.correct ? ' (correct)' : ' (WRONG)'}`);
  say(tr.attending_line || (tr.correct ? 'Good.' : 'Bold choice.'), true);
  if (tr.correct) {
    body.stabilising = true; treatments = []; renderTreatments();
    record('resolve', 'Patient stabilising');
    return;
  }
  const effects = (tr.if_wrong_cascade || []).filter(e => SITES[e.site]);
  effects.forEach(e => body.add(e.site, e.text, Math.max(0.25, e.severity * 0.8)));
  cascades.push({ treatment: tr.name, why: tr.why, effects }); renderCascades();
  record('cascade', `${tr.why} → ${effects.map(e => SITES[e.site].label + ': ' + e.text).join('; ')}`);
  stagePending = true; renderTreatments();
  const remaining = treatments.filter((_, k) => k !== i);
  try {
    const j = await (prefetched.get(tr.name) || fetchStage(tr.name));   // usually already computed in the background
    if (!j || !j.ok) throw new Error(j && j.error);
    findings.push(...j.stage.new_findings.filter(f => SITES[f.site]));
    treatments = shuffle(j.stage.treatments.slice(0, 4));
    setTimeout(() => say(j.stage.attending_line, true), 2500);
  } catch {
    treatments = remaining; // offline: just remove the wrong option
  }
  stagePending = false; renderTreatments(); renderModes();
  prefetchStages();
}

// cold path planning ahead: compute the cascade for every wrong option before the player clicks it
const prefetched = new Map();
function fetchStage(name) {
  const symptoms = [...body.problems].map(([s, p]) => ({ site: s, severity: +p.severity.toFixed(2), texts: p.texts }));
  return fetch(API + '/stage', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ case: C, given: [...given, name], symptoms, vitals: body.v }) }).then(r => r.json()).catch(() => null);
}
function prefetchStages() {
  prefetched.clear();
  for (const tr of treatments) if (!tr.correct) prefetched.set(tr.name, fetchStage(tr.name));
}

// ---------------- the end: an incident post-mortem ----------------
function end(won) {
  if (over) return; over = true;
  record(won ? 'win' : 'lose', won ? 'Patient stable. Incident resolved.' : 'Patient coded. Incident closed: fatal.');
  say(won ? pick(['He lives. Do not let it go to your head.', 'Stable. Even a broken clock is right twice a day.']) : 'Time of death, ' + clock() + '. Let us do the post-mortem.', true);
  const keyTotal = findings.filter(f => f.key).length, keyFound = evidence.filter(e => e.key).length;
  setTimeout(() => {
    $('overlay').innerHTML = `<div class="card pm">
      <h1>${won ? 'RESOLVED' : 'FATAL'}: INCIDENT POST-MORTEM</h1>
      <p class="tag">${esc(C.patient.name)}, ${C.patient.age} · ${esc(C.patient.background)}</p>
      <p><b>Root cause:</b> ${esc(C.root_cause)}</p>
      <p>${esc(C.post_mortem)}</p>
      <p><b>Time to ${won ? 'resolution' : 'death'}:</b> ${Math.round(t)} min · <b>Tests run:</b> ${evidence.length} · <b>Key clues found:</b> ${keyFound}/${keyTotal} · <b>Wrong treatments (cascades):</b> ${cascades.length}</p>
      <h3>Incident timeline</h3>
      <div class="tl">${log.map(l => `<div><span class="t">${l.t}</span> ${l.kind === 'cascade' ? '<b style="color:#ff6b6b">CASCADE</b> ' : l.kind === 'treat' ? '<b style="color:#ffb43c">TREAT</b> ' : ''}${esc(l.text)}</div>`).join('')}</div>
      <button onclick="location.reload()">NEXT PATIENT</button></div>`;
    $('overlay').classList.add('show');
  }, 2200);
}

// ---------------- live loop ----------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (started && !over) {
    t += dt; idleTimer += dt;
    if (!onset && t > ONSET_AFTER) {
      onset = true; C._onsetClock = clock();
      for (const s of C.initial_symptoms) if (SITES[s.site]) body.add(s.site, s.text, s.severity * 0.6, s.site === C.root_site);
      if (!body.problems.has(C.root_site)) body.add(C.root_site, '', 0.25, true);
      $('sev').textContent = 'SEV-1 INCIDENT · ROOT CAUSE: UNKNOWN'; $('sev').classList.add('on');
      say(`Here we go. ${C.patient.name} just reported: ${C.initial_symptoms[0].text.toLowerCase()}. You're on call.`, true);
      record('onset', C.initial_symptoms.map(s => s.text).join('; '));
      renderDay(); renderTreatments();
    }
    if (body.tick(dt)) end(false);
    if (body.stabilising && body.problems.size === 0) end(true);
    // live reactions to the vitals feed (fast path, no AI call)
    const v = body.v;
    const react = (k, cond, line) => { if (cond && !flags[k]) { flags[k] = true; say(line, true); } if (!cond) flags[k] = false; };
    if (onset && !body.stabilising) {
      react('spo2', v.spo2 < 90, `Sats ${Math.round(v.spo2)} percent. He is running out of oxygen while you window shop.`);
      react('hr', v.hr > 130, `Heart rate ${Math.round(v.hr)}. That is not excitement.`);
      react('bp', v.sys < 90, `Pressure ${Math.round(v.sys)} over ${Math.round(v.dia)}. He is crashing.`);
      react('temp', v.temp > 38.8, `Temperature ${v.temp.toFixed(1)}. Something is burning in there.`);
      if (idleTimer > 18) { idleTimer = 0; say(pick(['Are you waiting for him to get better on his own?', 'Tick tock. Bodies do not pause.', `Look at the day log. What did ${C.patient.name} do today?`])); }
    }
    // movement through the bloodstream
    if (path) {
      const p = path.pts[0], dx = p.x - bot.x, dy = p.y - bot.y, d = Math.hypot(dx, dy), step = 320 * dt;
      if (d <= step) { bot.x = p.x; bot.y = p.y; path.pts.shift(); if (!path.pts.length) { bot.site = path.target; path = null; startTest(bot.site); } }
      else { bot.x += dx / d * step; bot.y += dy / d * step; }
    }
    if (testing) { testing.p += dt; if (testing.p > 1.3) finishTest(); }
  }
  if (C) {
    $('patient-line').textContent = `PATIENT: ${C.patient.name.toUpperCase()}, ${C.patient.age} · CLOCK ${clock()} · ${body.status()}`;
    const b = $('bot'), g = $('bot-glow');
    if (b) { b.setAttribute('cx', bot.x); b.setAttribute('cy', bot.y); g.setAttribute('cx', bot.x); g.setAttribute('cy', bot.y); }
    drawEcg(dt);
  }
  requestAnimationFrame(frame);
}
setInterval(() => { if (C) { drawDynamic(); renderVitals(); } }, 120);
window.addEventListener('keydown', (e) => { const n = +e.key; if (n >= 1 && n <= 6) setMode(MODES[n - 1].id); });

// ---------------- boot ----------------
(async () => {
  C = await loadCase();
  findings = [...C.findings]; treatments = shuffle(C.treatments.slice(0, 4));
  setMode('circulatory'); renderDay(); renderTreatments(); renderVitals(); renderEvidence();
  prefetchStages();
  $('start').disabled = false;
  $('start').onclick = () => {
    $('overlay').classList.remove('show'); started = true;
    say(`${C.patient.name}, ${C.patient.age}. ${C.patient.background} Normal day so far. Stay close.`, true);
  };
  requestAnimationFrame(frame);
})();
