// v2: House-style loop. Outside view first (what a human sees) -> scan layers -> talk to the fellow (time stops)
// -> prepare the treatments he suggests -> physically deliver them (drag + hold / shock / cut / compress) -> the body reacts.
import { SITES, MODES as SCAN_MODES, MODE_SITES, layer, route } from './anatomy.js';
import { drawPatient, hologram, guessEffects, MOUTH } from './patient.js';
import { partAt, applyChanges, inferChanges } from './mods.js';
import { ICONS, ACTIONS, guessKind, safeSvg } from './tools.js';
import { Body } from './sim.js';
import FALLBACK from './cases.json';

const API = import.meta.env.VITE_API || 'http://localhost:8010';
const FELLOW = { name: 'Dr. Foreman', full: 'Dr. Foreman', role: 'Neurologist · on the pager' };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const post = (path, data) => fetch(API + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json());
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const START_MIN = 16 * 60 + 30, ONSET_AFTER = 8, EASY = true;
const MODES = [{ id: 'outside', label: 'OUTSIDE (EYES)', color: '#e6eef5' }, ...SCAN_MODES];
MODE_SITES.outside = Object.keys(SITES);

// ---------------- state ----------------
let C = null;
const body = new Body();
let mode = 'outside', bot = { site: 'heart', x: SITES.heart.x, y: SITES.heart.y }, path = null, testing = null;
let findings = [], evidence = [], log = [], visuals = [], treatHistory = [], tray = [], action = null;
let mods = [];
let chat = [], chatOpen = false, chatBusy = false, busy = false, sharedUpTo = 0;
let t = 0, started = false, over = false, onset = false, lastSay = -99, idleTimer = 0, flags = {}, paged = false;
let visPromise = null;
const paused = () => chatOpen || busy;

// ---------------- voice ----------------
const synth = window.speechSynthesis; let voice = null;
const pickVoice = () => { const vs = synth?.getVoices() || []; voice = vs.find(v => /en-GB/i.test(v.lang) && /male|george|ryan|daniel/i.test(v.name)) || vs.find(v => /en-GB/i.test(v.lang)) || vs[0]; };
if (synth) { pickVoice(); synth.onvoiceschanged = pickVoice; }
function speak(text) { if (!synth) return; synth.cancel(); const u = new SpeechSynthesisUtterance(text); if (voice) u.voice = voice; u.rate = 1.07; u.pitch = 0.85; synth.speak(u); }
function say(text, force = false) {               // the pager line under the patient
  if (!force && t - lastSay < 5) return;
  lastSay = t; $('att-text').textContent = '"' + text + '"';
  if (force || !synth?.speaking) speak(text);
}

const clock = () => { const m = START_MIN + Math.floor(t); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const record = (kind, text) => log.push({ t: clock(), kind, text });
const vitalsNow = () => ({ hr: Math.round(body.v.hr), bp: `${Math.round(body.v.sys)}/${Math.round(body.v.dia)}`, spo2: Math.round(body.v.spo2), temp: +body.v.temp.toFixed(1), rr: Math.round(body.v.rr) });

// ---------------- case + visuals pipeline ----------------
async function loadCase() {
  try {
    const j = await post('/case', {});
    if (j.ok && j.case) { $('case-status').textContent = `Case ready (written by Claude${j.cached ? ', from the case pool' : ''}).`; return j.case; }
  } catch { /* offline */ }
  $('case-status').textContent = 'Backend offline: built-in case, offline fellow.';
  return FALLBACK[Math.floor(Math.random() * FALLBACK.length)];
}

// Claude maps each symptom to what an onlooker SEES; offline we use keywords. Either way our renderer draws it.
async function effectsFor(symptoms) {
  try {
    const j = await post('/visualize', { symptoms });
    if (j.ok) return symptoms.map((s, i) => (j.items.find(it => it.index === i)?.effects || guessEffects(s.text, s.site)));
  } catch { /* offline */ }
  return symptoms.map(s => guessEffects(s.text, s.site));
}
function addVisuals(sym, effects) {
  for (const e of effects) if (SITES[e.site]) visuals.push({ ...e, symSite: SITES[sym.site] ? sym.site : e.site });
}
function activeEffects() {
  const out = [];
  for (const v of visuals) {
    const p = body.problems.get(v.symSite);
    if (p && p.severity > 0.03) out.push({ ...v, k: Math.min(1, 0.3 + p.severity * 1.3) });
  }
  return out;
}

// ---------------- rendering ----------------
function renderModes() {
  $('modes').innerHTML = MODES.map((m, i) => {
    const n = evidence.filter(e => e.system === m.id && !e.normal).length;
    return `<button data-mode="${m.id}" class="${m.id === mode ? 'active' : ''}" style="${m.id === mode ? `border-color:${m.color}` : ''}">
      <span class="dot" style="background:${m.color}"></span><span>${m.label}<small>[${i + 1}] ${n ? n + ' abnormal' : m.id === 'outside' ? 'look at the patient' : 'scan'}</small></span></button>`;
  }).join('');
  document.querySelectorAll('#modes button').forEach(b => b.onclick = () => setMode(b.dataset.mode));
}

function setMode(m) {
  mode = m; const md = MODES.find(x => x.id === m);
  $('scan-title').innerHTML = `<span style="color:${md.color}">${m === 'outside' ? 'BEDSIDE · WHAT YOU SEE' : md.label + ' SCAN'}</span>`;
  $('scan-hint').textContent = m === 'outside' ? 'Click a body part to examine it · drag prepared treatments onto the patient' : 'Click a site: the nanobot travels there and runs the test';
  $('body').style.setProperty('--tint', m === 'outside' ? '#1d2a3a' : md.color + '30');
  lastSig = ''; drawStatic(); renderModes();
}

let lastSig = '';
function drawStatic() {
  const md = MODES.find(x => x.id === mode);
  if (mode === 'outside') {
    $('body').innerHTML = `<g id="pt"></g><g id="dyn"></g><g id="act"></g>`;
    drawPatientNow(true);
  } else {
    $('body').innerHTML = `${hologram()}<g id="lay">${layer(mode)}</g>
      <image href="/art/body_${mode}.png" x="0" y="0" width="600" height="880" preserveAspectRatio="xMidYMid meet"
        onload="document.getElementById('holo').style.display='none';document.getElementById('lay').style.display='none'" onerror="this.remove()"/>
      <g id="dyn"></g>
      <rect class="scanline" x="0" y="0" width="600" height="6" fill="${md.color}" opacity=".8"/>
      <circle id="bot-glow" r="20" fill="#5adcff" opacity=".35"/><circle id="bot" r="9" fill="#5adcff" stroke="#fff" stroke-width="2"/>
      <image id="bot-art" href="/art/nanobot.png" width="44" height="44" onload="document.getElementById('bot').style.display='none'" onerror="this.remove()"/>
      <g id="act"></g>`;
  }
  drawDynamic();
}

function drawPatientNow(force) {
  if (mode !== 'outside' || !$('pt')) return;
  const fx = onset ? activeEffects() : [];
  const sig = fx.map(e => e.type + e.site + e.side + Math.round(e.k * 10)).join('|') + (body.v.rr > 24 ? 'F' : 'S') + mods.map(x => x.change + x.part + (Date.now() - x.t < 25000)).join(',');
  if (!force && sig === lastSig) return;
  lastSig = sig;
  $('pt').innerHTML = drawPatient(fx, { breathFast: body.v.rr > 24 ? 1 : 0, mods });
}

function drawDynamic() {
  const md = MODES.find(x => x.id === mode), inMode = MODE_SITES[mode];
  let h = '';
  if (mode !== 'outside') for (const [id, s] of Object.entries(SITES)) {
    const p = body.problems.get(id), bright = inMode.includes(id);
    const tested = evidence.some(e => e.site === id && e.system === mode);
    const clueHere = EASY && onset && findings.some(f => f.site === id && f.system === mode) && !tested;
    if (clueHere) h += `<text x="${s.x - 6}" y="${s.y + 5}" style="font:bold 15px Consolas;fill:#ffd24a;paint-order:stroke;stroke:#000;stroke-width:3px">?</text>`;
    if (p && p.severity > 0.02 && onset) h += `<circle class="glow" cx="${s.x}" cy="${s.y}" r="${16 + 30 * p.severity}" fill="#ff3030" opacity=".6"/>`;
    h += `<g class="site" data-site="${id}"><circle cx="${s.x}" cy="${s.y}" r="18" fill="transparent"/>
      <circle class="ring" cx="${s.x}" cy="${s.y}" r="${bright ? 11 : 7}" stroke="${tested ? '#5ae68c' : bright ? md.color : '#506070'}"/>
      ${bright || p ? `<text x="${s.x + 15}" y="${s.y - 10}">${SITES[id].label}</text>` : ''}</g>`;
  } else if (!action) for (const [id, s] of Object.entries(SITES)) {
    const seen = evidence.some(e => e.site === id && e.system === 'outside');
    h += `<g class="site exam" data-site="${id}"><circle cx="${s.x}" cy="${s.y}" r="22" fill="transparent"/>
      <circle class="ring" cx="${s.x}" cy="${s.y}" r="5" stroke="${seen ? '#5ae68c' : '#ffffff55'}"/></g>`;
  }
  if (testing) h += `<circle cx="${SITES[testing.site].x}" cy="${SITES[testing.site].y}" r="${10 + (testing.p * 40) % 40}" fill="none" stroke="#5adcff" stroke-width="3" opacity="${1 - (testing.p * 40 % 40) / 40}"/>
      <text x="${SITES[testing.site].x - 40}" y="${SITES[testing.site].y + 34}" style="font:13px Consolas;fill:#5adcff">SCANNING…</text>`;
  if ($('dyn')) $('dyn').innerHTML = h;
  document.querySelectorAll('#dyn .site').forEach(g => g.onclick = () => mode === 'outside' ? examine(g.dataset.site) : goTest(g.dataset.site));
  drawAction();
}

function renderDay() {
  const items = (C.day_events || []).map(e => ({ ...e }));
  if (onset) items.push({ time: C._onsetClock, text: 'COLLAPSED: ' + C.initial_symptoms.map(s => s.text).join(', '), bad: true });
  $('chart-bg').textContent = C.patient.background;
  $('day').innerHTML = items.map(e => `<li class="${e.bad ? 'bad' : ''}">${esc(e.time)} &nbsp;${esc(e.text)}</li>`).join('');
}

function renderEvidence() {
  $('evidence').innerHTML = evidence.length ? evidence.map((e, i) => `<li class="${e.key ? 'key' : e.normal ? 'normal' : ''}" data-i="${i}" title="click: tell ${FELLOW.name}">
      ${esc(SITES[e.site].label)} · ${e.system === 'outside' ? 'seen' : esc(e.system)}: ${esc(e.result)} <span class="tell">＋</span></li>`).join('')
    : '<li class="dim">Examine the patient and run scans. Click any line to tell the fellow.</li>';
  document.querySelectorAll('#evidence li[data-i]').forEach(li => li.onclick = () => { const e = evidence[+li.dataset.i]; openChat(evLine(e)); });
  renderModes();
}
const evLine = (e) => `${SITES[e.site].label} (${e.system === 'outside' ? 'on exam' : e.system + ' scan'}): ${e.result}`;

function renderLog() {
  $('cascade').innerHTML = treatHistory.length ? treatHistory.map(h => `<div class="o-${h.outcome}"><b>${esc(h.name)}</b> → <span class="oc">${h.outcome.replace('_', ' ').toUpperCase()}</span><br><span class="dim">${esc(h.narration)}</span></div>`).join('')
    : '<span class="dim">Nothing given yet.</span>';
}

const VITALS = [
  ['HR', 'bpm', v => v.hr > 130 ? 'bad' : v.hr > 105 ? 'warn' : '', v => Math.round(v.hr)],
  ['BP', '', v => v.sys < 85 ? 'bad' : v.sys < 100 || v.sys > 160 ? 'warn' : '', v => `${Math.round(v.sys)}/${Math.round(v.dia)}`],
  ['SpO₂', '%', v => v.spo2 < 88 ? 'bad' : v.spo2 < 94 ? 'warn' : '', v => Math.round(v.spo2)],
  ['TEMP', '°C', v => v.temp > 39 ? 'bad' : v.temp > 37.8 ? 'warn' : '', v => v.temp.toFixed(1)],
  ['RR', '/min', v => v.rr > 26 ? 'bad' : v.rr > 20 ? 'warn' : '', v => Math.round(v.rr)],
];
function renderVitals() {
  const v = body.v;
  $('vitals').innerHTML = VITALS.map(([k, u, cls, val]) => `<div class="vital ${cls(v)}"><small>${k}</small><span>${val(v)}</span> <em>${u}</em></div>`).join('');
  const st = body.status(); $('vit-status').textContent = st; $('vit-status').className = st;
}

const ecg = $('ecg').getContext('2d'); let ecgX = 0, beatPhase = 0, lastY = 40, vfPhase = 0;
function drawEcg(dt) {
  if (paused()) return;
  beatPhase += dt * (body.v.hr / 60);
  for (let i = 0; i < 3; i++) {
    ecgX = (ecgX + 1) % 440; const ph = beatPhase % 1; let y = 40;
    if (ph > 0.30 && ph < 0.34) y = 34; else if (ph > 0.36 && ph < 0.39) y = 66; else if (ph > 0.39 && ph < 0.43) y = 8; else if (ph > 0.43 && ph < 0.47) y = 50;
    else if (ph > 0.62 && ph < 0.72) y = 40 - 7 * Math.sin((ph - 0.62) / 0.1 * Math.PI);
    if (body.arrest) { vfPhase += 0.35 + Math.random() * 0.2; y = 40 + Math.sin(vfPhase) * (14 + Math.random() * 10); }
    ecg.fillStyle = '#06100a'; ecg.fillRect(ecgX, 0, 12, 80);
    ecg.strokeStyle = body.status() === 'CRITICAL' ? '#ff4646' : '#5ae68c'; ecg.lineWidth = 2;
    ecg.beginPath(); ecg.moveTo(ecgX - 1, lastY); ecg.lineTo(ecgX, y); ecg.stroke(); lastY = y;
  }
}

// ---------------- examining + scanning ----------------
function examine(site) {
  if (!started || over || action || paused()) return;
  idleTimer = 0;
  if (evidence.some(e => e.site === site && e.system === 'outside')) { say('You already looked there.'); return; }
  const p = body.problems.get(site);
  const seen = onset ? activeEffects().filter(e => e.site === site || e.symSite === site) : [];
  let result;
  if (p && onset && p.texts.length) result = p.texts.join('; ');
  else if (seen.length) result = [...new Set(seen.map(e => e.type.replace('_', ' ')))].join(', ');
  else result = 'nothing abnormal on the outside';
  const e = { site, system: 'outside', result, normal: !(p && onset && p.texts.length) && !seen.length };
  evidence.push(e); renderEvidence(); record('exam', `Examined ${SITES[site].label}: ${result}`);
}

function goTest(site) {
  if (!started || over || testing || action || paused()) return;
  idleTimer = 0;
  if (site === bot.site) { testing = { site, p: 0, mode }; return; }
  path = { pts: route(bot.site, site).slice(1), target: site };
}

function finishTest() {
  const { site, mode: m } = testing; testing = null;
  if (evidence.some(e => e.site === site && e.system === m)) return;
  const f = findings.find(x => x.site === site && x.system === m), p = body.problems.get(site);
  let e;
  if (f) e = { site, system: m, result: f.result, key: f.key };
  else if (p && onset) e = { site, system: m, result: `${p.texts[0] || 'abnormal'} (non-specific on this scan)` };
  else e = { site, system: m, result: 'normal', normal: true };
  evidence.push(e); renderEvidence();
  record('test', `${m} scan of ${SITES[site].label}: ${e.result}`);
  if (e.key) say(pick([`That's worth paging ${FELLOW.name} about.`, 'Now that is interesting.']));
}

// ---------------- the fellow (chat). Time stops while it is open ----------------
function openChat(prefill) {
  if (!started || over) return;
  chatOpen = true; paged = true; idleTimer = 0;
  document.body.classList.add('chat-open');
  if (!chat.length) chat.push({ role: 'fellow', text: `${FELLOW.name}. I can't see the patient, you can. What are we looking at? Symptoms, vitals, anything off on your scans.` });
  if (prefill) $('chat-in').value = ($('chat-in').value ? $('chat-in').value + '\n' : '') + prefill;
  renderChat(); setTimeout(() => $('chat-in').focus(), 50);
}
function closeChat() { chatOpen = false; document.body.classList.remove('chat-open'); $('chat-in').blur(); }

function renderChat() {
  $('chat-log').innerHTML = chat.map((m, mi) => {
    if (m.role === 'lead') return `<div class="msg lead">${esc(m.text)}</div>`;
    const r = m.reply;
    let h = `<div class="msg fellow"><b>${FELLOW.name}</b><div>${esc(r ? r.say : m.text)}</div>`;
    if (r?.differential?.length) h += `<div class="ddx"><div class="cap">DIFFERENTIAL</div>${r.differential.map(d => `<div class="dd"><span class="lk ${d.likelihood}">${d.likelihood}</span><b>${esc(d.condition)}</b><small>${esc(d.reasoning)}</small></div>`).join('')}</div>`;
    if (r?.suggest_scan) h += `<div class="sugg">🔎 Next test: ${esc(r.suggest_scan)}</div>`;
    if (r?.treatments?.length) h += `<div class="cap">TREATMENT OPTIONS</div>` + r.treatments.map((tr, ti) => {
      const inTray = tray.some(x => x.tr.name === tr.name);
      return `<div class="tx"><div class="ic">${ICONS[tr.kind] || ICONS.injection}</div><div class="body"><b>${esc(tr.name)}</b> <small class="dim">${esc(tr.detail)}</small>
        <small>for: ${esc(tr.treats)}</small><small class="risk">risk: ${esc(tr.risk)}</small></div>
        <button class="prep" data-m="${mi}" data-t="${ti}" ${inTray ? 'disabled' : ''}>${inTray ? 'IN HAND ✓' : 'PREPARE'}</button></div>`;
    }).join('');
    return h + '</div>';
  }).join('') + (chatBusy ? `<div class="msg fellow typing"><b>${FELLOW.name}</b><div>thinking<span class="dots">...</span></div></div>` : '');
  document.querySelectorAll('#chat-log .prep').forEach(b => b.onclick = () => prepare(chat[+b.dataset.m].reply.treatments[+b.dataset.t]));
  $('chat-log').scrollTop = 1e9;
  const unshared = evidence.slice(sharedUpTo);
  $('paste-notes').textContent = unshared.length ? `📋 Paste my ${unshared.length} new note${unshared.length > 1 ? 's' : ''}` : '📋 No new notes';
  $('paste-notes').disabled = !unshared.length;
}

async function sendChat() {
  const text = $('chat-in').value.trim();
  if (!text || chatBusy) return;
  $('chat-in').value = ''; chat.push({ role: 'lead', text }); chatBusy = true; renderChat();
  record('chat', `To ${FELLOW.name}: ${text}`);
  let reply = null;
  try {
    const j = await post('/chat', {
      history: chat.map(m => ({ role: m.role, text: m.reply ? m.reply.say + ` [my differential: ${m.reply.differential.map(d => d.condition).join(', ')}; offered: ${m.reply.treatments.map(x => x.name).join(', ')}]` : m.text })),
      patient: { name: C.patient.name, age: C.patient.age }, clock: clock(), vitals: vitalsNow(),
      treatments: treatHistory.map(h => ({ name: h.name, result: h.outcome, what_happened: h.narration })),
      body_changes: mods.map(x => `${x.change} ${x.part.replace('_', ' ')}`),
    });
    if (j.ok) reply = j.reply;
  } catch { /* offline */ }
  if (!reply) reply = offlineFellow();
  const want = text.match(/\b(?:i(?:'?m| am)? (?:want to|wanna|will|'ll|gonna|going to)|let me|give (?:him|her|them|the patient)?)\s+(?:give\s+)?(?:him |her |them )?(.{3,60}?)(?:[.!?\n]|$)/i);
  if (want && !reply.treatments.some(x => want[1].toLowerCase().includes(x.name.toLowerCase().split(' ')[0]))) {
    const n = want[1].replace(/^(a|an|some|the)\s+/i, '').trim();
    reply.treatments.push({ name: n.charAt(0).toUpperCase() + n.slice(1), detail: 'your call, against advice', kind: guessKind(n), target_site: 'heart', treats: 'lead\'s own decision', risk: 'nobody suggested this' });
  }
  chatBusy = false; chat.push({ role: 'fellow', reply }); renderChat();
  speak(reply.say);
  for (const tr of reply.treatments) fetchArt(tr);          // start drawing the items before you even click PREPARE
}

function offline(why, waking = false) {
  const b = document.createElement('div'); b.id = 'offline-banner';
  const fix = API.includes('localhost') ? ' Run: cd backend && python -m uvicorn main:app --port 8010, then reload.' : ' Try reloading in a minute.';
  b.textContent = waking ? `⏳ ${why}…` : `⚠ OFFLINE: ${why}. The fellow, outcomes and art are canned.${fix}`;
  document.body.appendChild(b);
}
function offlineFellow() {
  return { say: `⚠ OFFLINE MODE: the Claude backend (port 8010) is not running, so these are the case's 4 canned options. Start the backend for the real fellow.`, differential: [], suggest_scan: '',
    treatments: C.treatments.map(x => ({ name: x.name, detail: '', kind: guessKind(x.name), target_site: C.root_site, treats: '?', risk: 'unknown' })) };
}

// ---------------- items: prepare, art, drag, deliver ----------------
const artCache = new Map();
function fetchArt(tr) {
  const key = tr.kind + '|' + tr.name;
  if (!artCache.has(key)) artCache.set(key, post('/art', { name: tr.name, kind: tr.kind }).then(j => (j.ok ? safeSvg(j.svg) : null)).catch(() => null));
  return artCache.get(key);
}
function prepare(tr) {
  if (tray.some(x => x.tr.name === tr.name)) return;
  const item = { id: Math.random().toString(36).slice(2), tr: { ...tr, kind: ACTIONS[tr.kind] ? tr.kind : guessKind(tr.name) }, svg: null };
  tray.push(item); renderTray(); renderChat();
  record('prep', `Prepared ${tr.name}`);
  fetchArt(item.tr).then(svg => { if (svg) { item.svg = svg; renderTray(); } });
}
function renderTray() {
  $('tray').innerHTML = tray.length ? tray.map(it => `<div class="item" data-id="${it.id}" title="drag onto the patient">
      <div class="ic">${it.svg || ICONS[it.tr.kind]}</div><div><b>${esc(it.tr.name)}</b><small>${esc(ACTIONS[it.tr.kind].hint || 'drag onto the patient')}${it.svg ? '' : ' · drawing…'}</small></div>
      <span class="x" data-x="${it.id}">✕</span></div>`).join('')
    : `<span class="dim">Your hands are empty. Page ${FELLOW.name} [TAB] to get treatment options, then PREPARE them.</span>`;
  document.querySelectorAll('#tray .item').forEach(el => el.onpointerdown = (ev) => { if (ev.target.dataset.x) return; startDrag(tray.find(x => x.id === el.dataset.id), ev); });
  document.querySelectorAll('#tray .x').forEach(x => x.onclick = () => { tray = tray.filter(i => i.id !== x.dataset.x); renderTray(); });
}

let drag = null;
function startDrag(item, ev) {
  if (!item || over || paused() || action) return;
  ev.preventDefault();
  if (mode !== 'outside') setMode('outside');
  const g = document.createElement('div'); g.className = 'ghost'; g.innerHTML = item.svg || ICONS[item.tr.kind];
  document.body.appendChild(g); drag = { item, g }; moveGhost(ev);
}
function moveGhost(ev) { if (drag) { drag.g.style.left = ev.clientX - 40 + 'px'; drag.g.style.top = ev.clientY - 40 + 'px'; } }
function svgPoint(ev) {
  const svg = $('body'), pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}
window.addEventListener('pointermove', (ev) => {
  moveGhost(ev);
  if (action?.cfg.cut && action.cutting) {
    const p = svgPoint(ev);
    if (Math.abs(p.y - action.y) < 28 && p.x > action.x - 50 && p.x < action.x + 50) { action.cut += Math.abs(p.x - action.lastX); if (action.cut >= action.cfg.cut) { complete(); return; } }
    action.lastX = p.x;
  }
});
window.addEventListener('pointerup', (ev) => {
  if (drag) {
    const { item, g } = drag; g.remove(); drag = null;
    const r = $('body').getBoundingClientRect();
    if (ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom) return;
    const p = svgPoint(ev);
    let site = 'heart', best = 1e9;
    for (const [id, s] of Object.entries(SITES)) { const d = Math.hypot(s.x - p.x, s.y - p.y); if (d < best) { best = d; site = id; } }
    const onMouth = Math.hypot(p.x - MOUTH.x, p.y - MOUTH.y) < 40;
    const part = onMouth ? 'face' : partAt(p.x, p.y);
    action = { item, x: p.x, y: p.y, site, part, where: (onMouth ? 'mouth/face' : SITES[site].label) + ` (${part.replace('_', ' ')})`, cfg: ACTIONS[item.tr.kind], p: 0, holding: false, clicks: 0, cut: 0, charged: false };
    drawDynamic(); return;
  }
  if (action) {
    if (action.cfg.release && action.charged) { shockFx(); complete(); return; }
    action.holding = false; action.cutting = false;
  }
});
$('body').addEventListener('pointerdown', (ev) => {
  if (!action || paused()) return;
  ev.preventDefault();
  if (action.cfg.clicks) { action.clicks++; $('body').classList.remove('compress'); void $('body').getBoundingClientRect(); $('body').classList.add('compress'); if (action.clicks >= action.cfg.clicks) complete(); else drawAction(); return; }
  if (action.cfg.cut) { action.cutting = true; action.lastX = svgPoint(ev).x; return; }
  action.holding = true;
});
function shockFx() { const f = $('flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); $('body').classList.add('jolt'); setTimeout(() => $('body').classList.remove('jolt'), 600); }

function drawAction() {
  if (!$('act')) return;
  if (!action) { $('act').innerHTML = ''; return; }
  const a = action, art = a.item.svg || ICONS[a.item.tr.kind];
  const prog = a.cfg.clicks ? a.clicks / a.cfg.clicks : a.cfg.cut ? a.cut / a.cfg.cut : a.p;
  const label = a.cfg.release && a.charged ? 'CHARGED! RELEASE TO SHOCK' : a.cfg.verb;
  const R = 46, circ = 2 * Math.PI * R;
  $('act').innerHTML = `
    ${a.cfg.cut ? `<line x1="${a.x - 45}" y1="${a.y}" x2="${a.x + 45}" y2="${a.y}" stroke="#fff" stroke-width="2.5" stroke-dasharray="6 5"/>
      <line x1="${a.x - 45}" y1="${a.y}" x2="${a.x - 45 + 90 * Math.min(1, prog)}" y2="${a.y}" stroke="#c0101a" stroke-width="4"/>` : ''}
    <circle cx="${a.x}" cy="${a.y}" r="${R}" fill="#00000066" stroke="#ffffff33" stroke-width="6"/>
    <circle cx="${a.x}" cy="${a.y}" r="${R}" fill="none" stroke="${a.charged ? '#ff4a3c' : '#5adcff'}" stroke-width="6" stroke-dasharray="${circ * Math.min(1, prog)} ${circ}" transform="rotate(-90 ${a.x} ${a.y})"/>
    <svg x="${a.x - 34}" y="${a.y - 34}" width="68" height="68" viewBox="0 0 120 120">${art.replace(/^<svg[^>]*>|<\/svg>$/g, '')}</svg>
    <text x="${a.x}" y="${a.y + R + 22}" text-anchor="middle" class="act-label">${esc(label)}${a.cfg.clicks ? ` (${a.clicks}/${a.cfg.clicks})` : ''}</text>
    <text x="${a.x}" y="${a.y + R + 40}" text-anchor="middle" class="act-sub">${esc(a.item.tr.name)} → ${esc(a.where)} · Esc to cancel</text>`;
}

function complete() {
  const a = action; if (!a) return; action = null; drawDynamic();
  tray = tray.filter(i => i !== a.item); renderTray(); renderChat();
  administer(a.item.tr, a.where, a.part);
}

async function administer(tr, where, part = 'chest') {
  busy = true; document.body.classList.add('busy');
  say(`${tr.name} is in. Watching…`, true);
  record('treat', `Gave ${tr.name} (${tr.detail || tr.kind}) at ${where}`);
  const symptoms = [...body.problems].map(([s, p]) => ({ site: s, severity: +p.severity.toFixed(2), texts: p.texts }));
  let res = null;
  try {
    const j = await post('/treat', { case: C, symptoms, vitals: vitalsNow(), history: treatHistory, body_changes_so_far: mods.map(x => `${x.change} ${x.part}`),
      treatment: { name: tr.name, detail: tr.detail, kind: tr.kind, intended_site: tr.target_site, applied_to: where, meant_for: tr.treats } });
    if (j.ok) res = j.result;
  } catch { /* offline */ }
  if (!res) res = offlineOutcome(tr);
  // apply the outcome to OUR simulation
  const wasArrest = body.arrest;
  if (res.outcome === 'lethal') { body.arrest = true; body.stabilising = false; body.add('heart', 'Cardiac arrest', 1, false); visuals.push({ type: 'unconscious', site: 'brain', side: 'none', symSite: 'heart' }, { type: 'cyanosis', site: 'lungs', side: 'none', symSite: 'heart' }); }
  if (wasArrest && (res.outcome === 'improving' || res.outcome === 'cured')) { body.arrest = false; body.critTime = 0; body.heal('heart', 0.3); }
  if (res.outcome === 'cured' && !body.arrest) body.stabilising = true;
  for (const s of res.resolve_sites || []) body.heal(s, res.outcome === 'improving' ? 0.45 : res.outcome === 'cured' ? 0.3 : 0.8);
  const k = res.outcome === 'much_worse' ? 0.7 : 0.5;
  for (const s of res.new_symptoms || []) {
    if (!SITES[s.site]) continue;
    body.add(s.site, s.text, Math.max(0.15, (s.severity || 0.5) * k));
    addVisuals(s, s.effects?.length ? s.effects : guessEffects(s.text, s.site));
  }
  // physical changes: code decides what the act itself does (an amputation always shows), Claude adds consequences
  const mine = inferChanges(tr, part);
  const extra = (res.body_changes || []).filter(c => !(c.change === 'amputate' && mine.some(x => x.change === 'amputate')));
  applyChanges(mods, [...mine, ...extra]);
  findings.push(...(res.new_findings || []).filter(f => SITES[f.site]));
  treatHistory.push({ name: tr.name, outcome: res.outcome, narration: res.narration, physiology: res.physiology });
  record(/worse|lethal/.test(res.outcome) ? 'cascade' : 'result', `${tr.name}: ${res.outcome.toUpperCase()}. ${res.narration} (${res.physiology})`);
  renderLog(); lastSig = ''; drawDynamic();
  showOutcome(tr, res);
  busy = false; document.body.classList.remove('busy');
}

function offlineOutcome(tr) {
  const m = C.treatments.find(x => x.name.toLowerCase() === tr.name.toLowerCase());
  if (m?.correct) return { outcome: 'cured', narration: 'Colour returns, the monitor settles.', physiology: m.why, resolve_sites: [], new_symptoms: [], new_findings: [], body_changes: [] };
  if (m) return { outcome: 'worse', narration: 'The monitor alarms. Something new is going wrong.', physiology: m.why, resolve_sites: [], new_symptoms: m.if_wrong_cascade.map(e => ({ ...e, effects: [] })), new_findings: [], body_changes: [] };
  return { outcome: 'no_change', narration: 'Nothing happens.', physiology: 'Offline: no simulation for this treatment.', resolve_sites: [], new_symptoms: [], new_findings: [], body_changes: [] };
}

function showOutcome(tr, res) {
  const el = $('outcome'), good = res.outcome === 'cured' || res.outcome === 'improving', bad = /worse|lethal/.test(res.outcome);
  el.className = 'show ' + (good ? 'good' : bad ? 'bad' : 'meh');
  el.innerHTML = `<div class="big">${res.outcome.replace('_', ' ').toUpperCase()}</div><div>${esc(res.narration)}</div><small>${esc(res.physiology)}</small>
    ${res.new_symptoms?.length ? `<div class="new">NEW: ${res.new_symptoms.map(s => esc(s.text)).join(' · ')}</div>` : ''}`;
  setTimeout(() => el.className = '', 7000);
  if (res.outcome === 'lethal') say(`${C.patient.name} is in arrest! You have about thirty seconds. Shock or compress, NOW.`, true);
  else say(bad ? `${res.narration} Page me. Now.` : res.narration, true);
}

// ---------------- the end: incident post-mortem ----------------
function end(won) {
  if (over) return; over = true; closeChat();
  record(won ? 'win' : 'lose', won ? 'Patient stable. Incident resolved.' : 'Patient coded. Incident closed: fatal.');
  say(won ? `Stable. I'd have got there faster, but fine.` : `Time of death, ${clock()}. Let's find out what we missed.`, true);
  const keyTotal = findings.filter(f => f.key).length, keyFound = evidence.filter(e => e.key).length;
  setTimeout(() => {
    $('overlay').innerHTML = `<div class="card pm">
      <h1>${won ? 'RESOLVED' : 'FATAL'}: INCIDENT POST-MORTEM</h1>
      <p class="tag">${esc(C.patient.name)}, ${C.patient.age} · ${esc(C.patient.background)}</p>
      <p><b>Root cause:</b> ${esc(C.root_cause)}</p><p>${esc(C.post_mortem)}</p>
      <p><b>Time to ${won ? 'resolution' : 'death'}:</b> ${Math.round(t)} min · <b>Exams + scans:</b> ${evidence.length} · <b>Key clues:</b> ${keyFound}/${keyTotal} · <b>Treatments:</b> ${treatHistory.length} (${treatHistory.filter(h => /worse|lethal/.test(h.outcome)).length} made it worse)</p>
      <h3>Incident timeline</h3>
      <div class="tl">${log.map(l => `<div><span class="t">${l.t}</span> ${l.kind === 'cascade' ? '<b style="color:#ff6b6b">CASCADE</b> ' : l.kind === 'treat' ? '<b style="color:#ffb43c">TREAT</b> ' : l.kind === 'chat' ? '<b style="color:#5adcff">PAGE</b> ' : ''}${esc(l.text)}</div>`).join('')}</div>
      <button onclick="location.reload()">NEXT PATIENT</button></div>`;
    $('overlay').classList.add('show');
  }, 2200);
}

// ---------------- live loop ----------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (started && !over && !paused()) {
    t += dt; idleTimer += dt;
    if (!onset && t > ONSET_AFTER) startOnset();
    if (body.tick(dt)) end(false);
    if (body.stabilising && body.problems.size === 0) end(true);
    const v = body.v, react = (k, cond, line) => { if (cond && !flags[k]) { flags[k] = true; say(line, true); } if (!cond) flags[k] = false; };
    if (onset && !body.stabilising) {
      react('spo2', v.spo2 < 90, `Sats ${Math.round(v.spo2)}. They're running out of oxygen.`);
      react('hr', v.hr > 130, `Heart rate ${Math.round(v.hr)} and climbing.`);
      react('bp', v.sys < 90, `Pressure ${Math.round(v.sys)} over ${Math.round(v.dia)}. They're crashing.`);
      react('temp', v.temp > 38.8, `Temp ${v.temp.toFixed(1)}. Something's cooking in there.`);
      if (idleTimer > 30) { idleTimer = 0; say(paged ? pick(['Got anything new for me?', 'Scan something. Then tell me about it.', `Read the chart. What did ${C.patient.name} do today?`]) : `Are you going to page me or just watch? Press TAB.`); }
    }
    if (path) {
      const p = path.pts[0], dx = p.x - bot.x, dy = p.y - bot.y, d = Math.hypot(dx, dy), step = 320 * dt;
      if (d <= step) { bot.x = p.x; bot.y = p.y; path.pts.shift(); if (!path.pts.length) { bot.site = path.target; path = null; testing = { site: bot.site, p: 0, mode }; } }
      else { bot.x += dx / d * step; bot.y += dy / d * step; }
    }
    if (testing) { testing.p += dt; if (testing.p > 1.3) finishTest(); }
    if (action?.holding && action.cfg.hold) {
      action.p = Math.min(1, action.p + dt / action.cfg.hold);
      if (action.p >= 1) { if (action.cfg.release) action.charged = true; else complete(); }
    }
  }
  if (C) {
    $('patient-line').textContent = `PATIENT: ${C.patient.name.toUpperCase()}, ${C.patient.age} · CLOCK ${clock()}${paused() ? ' ⏸' : ''} · ${body.status()}`;
    const b = $('bot'), g = $('bot-glow');
    if (b) { b.setAttribute('cx', bot.x); b.setAttribute('cy', bot.y); g.setAttribute('cx', bot.x); g.setAttribute('cy', bot.y); }
    const ba = $('bot-art'); if (ba) { ba.setAttribute('x', bot.x - 22); ba.setAttribute('y', bot.y - 22); }
    drawEcg(dt);
  }
  requestAnimationFrame(frame);
}

async function startOnset() {
  onset = true; C._onsetClock = clock();
  for (const s of C.initial_symptoms) if (SITES[s.site]) body.add(s.site, s.text, s.severity * 0.35, s.site === C.root_site);
  if (!body.problems.has(C.root_site)) body.add(C.root_site, '', 0.25, true);
  const fx = await visPromise;
  C.initial_symptoms.forEach((s, i) => addVisuals(s, fx[i] || []));
  lastSig = '';
  $('sev').textContent = 'SEV-1 · DIAGNOSIS UNKNOWN'; $('sev').classList.add('on');
  say(`${C.patient.name} just went down. You're lead. Look at them, then page me with what you see. TAB.`, true);
  record('onset', C.initial_symptoms.map(s => s.text).join('; '));
  renderDay(); $('body').classList.add('jolt'); setTimeout(() => $('body').classList.remove('jolt'), 600);
}

setInterval(() => { if (C) { drawDynamic(); drawPatientNow(); renderVitals(); } }, 150);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') { e.preventDefault(); chatOpen ? closeChat() : openChat(); return; }
  if (chatOpen) { if (e.key === 'Escape') closeChat(); return; }
  if (e.key === 'Escape' && action) { action = null; drawDynamic(); return; }
  const n = +e.key; if (n >= 1 && n <= MODES.length) setMode(MODES[n - 1].id);
});

// ---------------- boot ----------------
(async () => {
  $('fellow-name').textContent = FELLOW.full; $('fellow-role').textContent = FELLOW.role; $('page-btn').textContent = `PAGE ${FELLOW.name.toUpperCase()} [TAB]`;
  $('page-btn').onclick = () => openChat();
  const own = () => { const n = $('own-in').value.trim(); if (!n) return; $('own-in').value = '';
    prepare({ name: n, detail: 'your call', kind: $('own-kind').value === 'auto' ? guessKind(n) : $('own-kind').value, target_site: 'heart', treats: 'lead\'s own decision', risk: 'unknown: nobody suggested this' }); };
  $('own-btn').onclick = own; $('own-in').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') own(); });
  $('chat-close').onclick = closeChat; $('chat-send').onclick = sendChat;
  $('chat-in').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
  $('paste-notes').onclick = () => { const lines = evidence.slice(sharedUpTo).map(evLine); sharedUpTo = evidence.length; $('chat-in').value += (($('chat-in').value ? '\n' : '') + lines.join('\n')); renderChat(); $('chat-in').focus(); };
  C = await loadCase();
  // make offline mode impossible to miss: without the backend the fellow is canned
  // free hosting sleeps when idle: keep knocking for ~90 s before declaring offline
  (async () => {
    for (let i = 0; i < 18; i++) {
      try { const h = await fetch(API + '/health').then(r => r.json()); $('offline-banner')?.remove(); if (!h.key_set) offline('backend has no API key'); return; }
      catch { if (i === 0) offline('waking the server up (free hosting sleeps), give it up to a minute', true); await new Promise(r => setTimeout(r, 5000)); }
    }
    $('offline-banner')?.remove(); offline(API.includes('localhost') ? 'backend on :8010 not running' : 'the game server is not answering');
  })();
  findings = [...C.findings];
  visPromise = effectsFor(C.initial_symptoms);     // the visual pipeline runs while you read the intro
  setMode('outside'); renderDay(); renderVitals(); renderEvidence(); renderTray(); renderLog();
  $('cold').innerHTML = `<b>${esc(C.patient.name)}, ${C.patient.age}.</b> ${esc(C.patient.background)}`;
  $('start').disabled = false;
  $('start').onclick = () => { $('overlay').classList.remove('show'); started = true; say(`${C.patient.name}, ${C.patient.age}. Seemed fine this morning. Keep an eye on them.`, true); };
  if (location.hash === '#demo') { $('start').onclick(); t = ONSET_AFTER + 0.1; }
  if (location.hash === '#demochat') { $('start').onclick(); t = ONSET_AFTER + 0.1; setTimeout(() => { openChat('Vomiting, headache, rash on arm, HR 72'); sendChat(); }, 300); }   // screenshot/debug: skip the intro
  requestAnimationFrame(frame);
})();
