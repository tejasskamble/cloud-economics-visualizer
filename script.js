'use strict';
/* ==========================================================================
   Cloud Economics Visualizer — script.js
   Sections: 1 Util · 2 Glossary · 3 Cost model · 4 Charts · 5 Controls ·
             6 Lesson modules · 7 Views · 8 App
   NOTE: every price here is an ILLUSTRATIVE ESTIMATE, not live AWS pricing.
   ========================================================================== */

/* ============================== 1. UTIL ================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = n => (n < 0 ? '-' : '') + '$' + Math.round(Math.abs(n)).toLocaleString('en-US');
const fmt = n => {
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return s + '$' + (a / 1e3).toFixed(a >= 1e4 ? 0 : 1) + 'K';
  return s + '$' + Math.round(a);
};
const pct = (a, b) => (b ? (100 * a) / b : 0);
let _uid = 0;
const uid = p => (p || 'u') + (++_uid);
const store = {
  get(k, d) { try { const v = localStorage.getItem('cev_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('cev_' + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
};
const isTech = () => document.body.dataset.mode === 'technical';

/* ============================= 2. GLOSSARY =============================== */
// s = short label, t = full term, d = plain-language definition, x = technical detail
const GLOSSARY = {
  tco: { s: 'TCO', t: 'Total Cost of Ownership', d: 'Everything it costs to own and run something over its whole life: purchase price plus power, cooling, staff, repairs, software and more.', x: 'TCO = acquisition + operations + support/staffing + refresh + risk − residual value over a fixed horizon, optionally discounted to net present value (NPV).' },
  capex: { s: 'CapEx', t: 'Capital Expenditure', d: 'Money spent up front on long-lasting assets such as servers, network gear or buildings.', x: 'Capitalised on the balance sheet and expensed over time via depreciation; cash outflow is front-loaded.' },
  opex: { s: 'OpEx', t: 'Operational Expenditure', d: 'Ongoing, day-to-day costs of running the business, like electricity, subscriptions and wages.', x: 'Expensed in the period incurred and fully visible on the P&L; cloud consumption billing is typically OpEx.' },
  depreciation: { s: 'depreciation', t: 'Depreciation', d: 'Spreading the cost of an asset over the years you use it, instead of counting it all on day one.', x: 'Straight-line: (cost − salvage value) ÷ useful life. Other methods include declining balance.' },
  elasticity: { s: 'elasticity', t: 'Elasticity', d: 'The ability to automatically add or remove computing power as demand rises and falls.', x: 'Achieved with auto scaling groups, serverless functions and managed services; billing follows the scaled capacity.' },
  scalability: { s: 'scalability', t: 'Scalability', d: 'How easily a system can grow to handle more work.', x: 'Vertical (bigger machine) or horizontal (more machines); cloud makes horizontal scaling fast and cheap to start.' },
  payg: { s: 'pay-as-you-go', t: 'Pay-as-you-go', d: 'You are billed only for what you actually use, like a taxi meter or an electricity bill.', x: 'Metered billing per second/hour, per GB-month, per request or per GB transferred.' },
  savings: { s: 'Savings Plans', t: 'Savings Plans / Reserved capacity', d: 'A discount you earn by promising to use a certain amount of cloud for 1–3 years.', x: 'Commitment-based pricing (e.g. AWS Savings Plans, Reserved Instances). Trades flexibility for lower unit prices; all-upfront options behave like prepaid CapEx.' },
  pue: { s: 'PUE', t: 'Power Usage Effectiveness', d: 'How much extra power a data center uses for cooling and overhead. 1.0 would be perfect; 1.6 means 60% extra.', x: 'PUE = total facility energy ÷ IT equipment energy. Cooling cost here ≈ IT power × (PUE − 1).' },
  egress: { s: 'data transfer out', t: 'Data transfer out (egress)', d: 'Data that leaves the cloud to the internet. Moving data in is usually free; moving it out is billed per GB.', x: 'Often a surprise line item; reduce with CDNs, caching, compression and keeping traffic within a Region.' },
  rightsizing: { s: 'rightsizing', t: 'Rightsizing', d: 'Choosing server sizes that match what you really need, not bigger.', x: 'Use utilisation metrics (CPU, memory, network) to downsize or change instance families.' },
  utilization: { s: 'utilization', t: 'Utilization', d: 'How much of the capacity you pay for is actually used.', x: 'Used ÷ provisioned. Owned hardware costs the same at 10% or 90% use; metered cloud costs track use.' },
  breakeven: { s: 'break-even', t: 'Break-even point', d: 'The moment when the total cost of two options becomes equal — after it, the other option is cheaper.', x: 'Solved where cumulative cost curves intersect: upfront ÷ (monthly difference).' },
  fte: { s: 'FTE', t: 'Full-Time Equivalent', d: 'One full-time employee. 0.5 FTE is half a person\u2019s working time.', x: 'Used to model staffing cost: FTE × loaded salary (salary + benefits + overhead).' },
  refresh: { s: 'hardware refresh', t: 'Hardware refresh cycle', d: 'Replacing old servers with new ones every few years.', x: 'Typically 3–5 years; creates recurring CapEx waves that on-premises models must include.' },
  overprov: { s: 'over-provisioning', t: 'Over-provisioning', d: 'Buying more capacity than you usually need, just to be safe for busy times.', x: 'Leads to idle, stranded capacity and low utilisation on owned infrastructure.' },
  ec2: { s: 'EC2', t: 'Amazon EC2', d: 'Virtual servers you rent by the hour or second.', x: 'Elastic Compute Cloud: On-Demand, Savings Plans, Reserved and Spot pricing across instance families.' },
  s3: { s: 'S3', t: 'Amazon S3', d: 'Online storage for files and backups, billed per GB stored per month.', x: 'Object storage with storage classes (Standard, Intelligent-Tiering, Glacier) and lifecycle rules; requests and egress billed separately.' },
  rds: { s: 'RDS', t: 'Amazon RDS', d: 'A managed database — AWS handles patching and backups for you.', x: 'Relational Database Service: billed per instance-hour plus storage, I/O and backups; Multi-AZ doubles instance cost for availability.' },
  lambda: { s: 'Lambda', t: 'AWS Lambda', d: 'Run code without managing servers; you pay only when your code runs.', x: 'Billed per request and per GB-second of execution; no charge when idle.' },
  cloudwatch: { s: 'CloudWatch', t: 'Amazon CloudWatch', d: 'Monitoring and alarms for your cloud resources and logs.', x: 'Charges for custom metrics, log ingestion/storage, dashboards and alarms.' },
  finops: { s: 'FinOps', t: 'FinOps', d: 'A practice where finance, engineering and business teams work together to manage cloud spending.', x: 'Cloud financial management: tagging, showback/chargeback, budgets, forecasting and continuous optimisation.' }
};
const termify = h => String(h).replace(/\{\{(\w+)(?:\|([^}]+))?\}\}/g, (m, k, label) =>
  GLOSSARY[k] ? `<span class="term" tabindex="0" data-term="${k}">${esc(label || GLOSSARY[k].s)}</span>` : (label || k));

const Tip = {
  el: null,
  init() {
    this.el = $('#tooltip');
    const find = t => (t && t.closest ? t.closest('[data-term],[data-tip]') : null);
    document.addEventListener('mouseover', e => { const t = find(e.target); t ? this.show(t) : this.hide(); });
    document.addEventListener('focusin', e => { const t = find(e.target); t ? this.show(t) : this.hide(); });
    document.addEventListener('focusout', () => this.hide());
    document.addEventListener('click', e => { const t = find(e.target); t ? this.show(t) : this.hide(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.hide(); });
    window.addEventListener('scroll', () => this.hide(), { passive: true });
  },
  show(t) {
    let html = '';
    if (t.dataset.term && GLOSSARY[t.dataset.term]) {
      const g = GLOSSARY[t.dataset.term];
      html = `<b>${esc(g.t)}</b><br>${esc(g.d)}` + (isTech() ? `<em>${esc(g.x)}</em>` : '');
    } else if (t.dataset.tip) html = esc(t.dataset.tip);
    if (!html) return this.hide();
    const el = this.el; el.innerHTML = html; el.hidden = false;
    const r = t.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
    let x = clamp(r.left + r.width / 2 - w / 2, 8, window.innerWidth - w - 8);
    let y = r.top - h - 10; if (y < 8) y = r.bottom + 10;
    el.style.left = x + 'px'; el.style.top = y + 'px';
  },
  hide() { if (this.el) this.el.hidden = true; }
};

/* ============================ 3. COST MODEL ============================== */
// Per-category metadata: colour, label, side (on-prem / cloud) and accounting type.
const CATS = {
  hardware: { l: 'Hardware', c: '#4f8cff', side: 'on', type: 'CapEx' },
  software: { l: 'Software licences', c: '#8b5cf6', side: 'on', type: 'OpEx' },
  networking: { l: 'Networking', c: '#06b6d4', side: 'on', type: 'Mixed' },
  electricity: { l: 'Electricity', c: '#f59e0b', side: 'on', type: 'OpEx' },
  cooling: { l: 'Cooling', c: '#38bdf8', side: 'on', type: 'OpEx' },
  maintenance: { l: 'Maintenance', c: '#ef4444', side: 'on', type: 'OpEx' },
  staffing: { l: 'IT staffing', c: '#ec4899', side: 'on', type: 'OpEx' },
  compute: { l: 'Cloud compute', c: '#22c55e', side: 'cl', type: 'OpEx' },
  storage: { l: 'Cloud storage', c: '#14b8a6', side: 'cl', type: 'OpEx' },
  transfer: { l: 'Data transfer', c: '#a3e635', side: 'cl', type: 'OpEx' },
  cloudStaff: { l: 'Cloud ops staffing', c: '#f472b6', side: 'cl', type: 'OpEx' }
};
const ON_KEYS = ['hardware', 'software', 'networking', 'electricity', 'cooling', 'maintenance', 'staffing'];
const CL_KEYS = ['compute', 'storage', 'transfer', 'cloudStaff'];

const BASE = {
  servers: 20, years: 3, hwCost: 6000, hwLife: 5, swLic: 400, netCost: 500, circuit: 300,
  kw: 0.4, kwhPrice: 0.12, pue: 1.6, maintPct: 10, perAdmin: 40, salary: 80000,
  cloudRate: 1, cloudUse: 60, discount: 0, storageGB: 5000, storagePrice: 0.023, growth: 20,
  transferGB: 2000, transferPrice: 0.09, cloudStaffPct: 40
};
const SCENARIOS = {
  startup: {
    name: 'Startup', icon: '🚀',
    who: 'A 6-person SaaS startup launching its first product.',
    story: 'Cash is tight, traffic is unpredictable and there is no dedicated IT team. Every dollar of runway matters.',
    lesson: 'Cloud wins big: no upfront spend, tiny team overhead, and you can scale the day you go viral.',
    p: { ...BASE, servers: 4, years: 3, hwCost: 5000, swLic: 200, netCost: 400, circuit: 150, kw: 0.35, pue: 1.8, perAdmin: 10, salary: 70000, cloudUse: 35, storageGB: 2000, growth: 60, transferGB: 500, cloudStaffPct: 30 }
  },
  college: {
    name: 'College', icon: '🎓',
    who: 'A mid-sized college running student portals, LMS and research labs.',
    story: 'Usage swings with the academic calendar — exam weeks are busy, summers are quiet. A small IT department already exists.',
    lesson: 'It is close: cloud savings depend on how well you switch things off. Idle summers favour cloud, steady labs favour owned servers.',
    p: { ...BASE, servers: 40, years: 5, hwCost: 5500, swLic: 150, netCost: 600, circuit: 800, kwhPrice: 0.10, pue: 1.7, perAdmin: 20, salary: 60000, cloudUse: 45, discount: 15, storageGB: 50000, growth: 15, transferGB: 8000 }
  },
  small: {
    name: 'Small Business', icon: '🏪',
    who: 'A 120-person company running ERP, email, file sharing and a customer website.',
    story: 'Moderate workloads, a part-time admin and growing storage needs. They hate surprise bills.',
    lesson: 'Cloud usually wins on TCO because staffing, cooling and maintenance dominate a small server room.',
    p: { ...BASE, servers: 12, years: 3, swLic: 450, circuit: 250, perAdmin: 15, salary: 75000, storageGB: 8000, transferGB: 1500 }
  },
  enterprise: {
    name: 'Enterprise', icon: '🏢',
    who: 'A large retailer with 24/7 core systems and heavy, steady workloads.',
    story: 'Very high, predictable utilisation, big in-house teams and purchasing power on hardware.',
    lesson: 'On-premises can win for steady, high-utilisation workloads at scale — which is why many enterprises go hybrid.',
    p: { ...BASE, servers: 500, years: 5, hwCost: 7000, swLic: 600, netCost: 800, circuit: 5000, kw: 0.45, kwhPrice: 0.10, pue: 1.4, perAdmin: 40, salary: 100000, cloudUse: 90, discount: 30, storageGB: 500000, growth: 25, transferGB: 100000 }
  }
};

/* Month-by-month TCO model. Returns category totals, cumulative curves and break-even. */
function calc(p) {
  const N = Math.max(1, Math.round(p.years * 12));
  const cat = {}; Object.keys(CATS).forEach(k => { cat[k] = 0; });
  let capexOn = 0, on = 0, cl = 0;
  const cumOn = [0], cumCl = [0];
  const lifeM = Math.max(12, Math.round(p.hwLife * 12));
  const fte = Math.max(0.2, p.servers / Math.max(1, p.perAdmin));
  const power = p.servers * p.kw * 730 * p.kwhPrice;
  const mg = Math.pow(1 + p.growth / 100, 1 / 12);
  for (let m = 0; m < N; m++) {
    let o = 0;
    if (m % lifeM === 0) { // purchase + refresh waves (CapEx)
      const h = p.servers * p.hwCost, n = p.servers * p.netCost;
      cat.hardware += h; cat.networking += n; capexOn += h + n; o += h + n;
    }
    const sw = p.servers * p.swLic / 12, ci = p.circuit, co = power * Math.max(0, p.pue - 1);
    const mt = p.servers * p.hwCost * p.maintPct / 100 / 12, st = fte * p.salary / 12;
    cat.software += sw; cat.networking += ci; cat.electricity += power; cat.cooling += co; cat.maintenance += mt; cat.staffing += st;
    o += sw + ci + power + co + mt + st;
    const cc = p.servers * p.cloudRate * 730 * (p.cloudUse / 100) * (1 - p.discount / 100);
    const cs = p.storageGB * Math.pow(mg, m) * p.storagePrice;
    const ct = p.transferGB * p.transferPrice;
    const cst = st * p.cloudStaffPct / 100;
    cat.compute += cc; cat.storage += cs; cat.transfer += ct; cat.cloudStaff += cst;
    on += o; cl += cc + cs + ct + cst;
    cumOn.push(on); cumCl.push(cl);
  }
  const onTotal = ON_KEYS.reduce((a, k) => a + cat[k], 0);
  const clTotal = CL_KEYS.reduce((a, k) => a + cat[k], 0);
  let cross = null; const s0 = Math.sign(cumOn[1] - cumCl[1]);
  for (let i = 2; i <= N; i++) { if (Math.sign(cumOn[i] - cumCl[i]) !== s0 && s0 !== 0) { cross = i; break; } }
  return { cat, onTotal, clTotal, capexOn, opexOn: onTotal - capexOn, cumOn, cumCl, N, cross, fte,
    diff: onTotal - clTotal, cloudCheaper: clTotal < onTotal };
}
// Utilisation at which cloud and on-prem total cost are equal (binary search).
function breakEvenUse(p) {
  const hi = calc({ ...p, cloudUse: 100 });
  if (hi.clTotal <= hi.onTotal) return { always: true };
  const lo = calc({ ...p, cloudUse: 0 });
  if (lo.clTotal >= lo.onTotal) return { never: true };
  let a = 0, b = 100;
  for (let i = 0; i < 24; i++) { const mid = (a + b) / 2, r = calc({ ...p, cloudUse: mid }); if (r.clTotal < r.onTotal) a = mid; else b = mid; }
  return { use: (a + b) / 2 };
}

/* =============================== 4. CHARTS =============================== */
const Charts = {
  niceMax(v) {
    if (v <= 0) return 1;
    const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
  },
  legend(items) { return `<div class="legend">${items.map(i => `<span><i style="background:${i.c}"></i>${esc(i.l)}</span>`).join('')}</div>`; },
  line(o) {
    const w = 640, h = o.h || 290, m = { l: 64, r: 18, t: 22, b: 44 }, iw = w - m.l - m.r, ih = h - m.t - m.b;
    const n = Math.max(1, Math.max(...o.series.map(s => s.data.length)) - 1);
    const ymax = this.niceMax(Math.max(1, ...o.series.flatMap(s => s.data)));
    const X = i => m.l + (i / n) * iw, Y = v => m.t + ih - (v / ymax) * ih, yf = o.yFmt || fmt;
    let s = `<svg class="chart${o.animate ? ' anim' : ''}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.label || 'Line chart')}">`;
    for (let i = 0; i <= 4; i++) { const v = ymax * i / 4, y = Y(v); s += `<line class="grid" x1="${m.l}" x2="${w - m.r}" y1="${y}" y2="${y}"/><text class="axis" x="${m.l - 8}" y="${y + 4}" text-anchor="end">${yf(v)}</text>`; }
    (o.xTicks || []).forEach(t => { s += `<line class="tick" x1="${X(t.i)}" x2="${X(t.i)}" y1="${m.t + ih}" y2="${m.t + ih + 5}"/><text class="axis" x="${X(t.i)}" y="${h - m.b + 20}" text-anchor="middle">${esc(t.l)}</text>`; });
    if (o.xLabel) s += `<text class="axis lab" x="${m.l + iw / 2}" y="${h - 4}" text-anchor="middle">${esc(o.xLabel)}</text>`;
    o.series.forEach(se => {
      const d = se.data.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
      s += `<path class="line" d="${d}" stroke="${se.c}" fill="none"${se.dash ? ` stroke-dasharray="${se.dash}"` : ' pathLength="1"'}/>`;
    });
    (o.marks || []).forEach(mk => {
      const x = X(mk.i);
      s += `<line class="mark" x1="${x}" x2="${x}" y1="${m.t}" y2="${m.t + ih}"/><text class="mark-t" x="${clamp(x, m.l + 50, w - m.r - 50)}" y="${m.t - 6}" text-anchor="middle">${esc(mk.l)}</text>`;
    });
    return s + '</svg>';
  },
  stack(o) {
    const w = 640, lw = 104, rh = 44, gap = 20, h = o.rows.length * (rh + gap) + 6;
    const tot = r => r.parts.reduce((a, p) => a + p.v, 0);
    const max = Math.max(1, ...o.rows.map(tot)), iw = w - lw - 74;
    let s = `<svg class="chart${o.animate ? ' anim' : ''}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.label || 'Stacked cost bars')}">`;
    o.rows.forEach((r, ri) => {
      const y = 4 + ri * (rh + gap), t = tot(r); let x = lw;
      s += `<text class="rowl" x="0" y="${y + rh / 2 + 5}">${esc(r.label)}</text>`;
      r.parts.forEach(p => {
        const bw = (p.v / max) * iw; if (bw <= 0) return;
        s += `<rect class="seg" x="${x.toFixed(1)}" y="${y}" width="${bw.toFixed(1)}" height="${rh}" fill="${p.c}" data-tip="${esc(p.l + ': ' + money(p.v) + ' (' + pct(p.v, t).toFixed(0) + '%)')}"/>`;
        x += bw;
      });
      s += `<text class="tot" x="${(x + 8).toFixed(1)}" y="${y + rh / 2 + 5}">${fmt(t)}</text>`;
    });
    return s + '</svg>';
  },
  donut(o) {
    const R = 64, C = 2 * Math.PI * R, tot = o.parts.reduce((a, p) => a + p.v, 0) || 1; let acc = 0;
    let s = `<svg class="chart" viewBox="0 0 180 180" role="img" aria-label="${esc(o.label || 'Donut chart')}"><circle cx="90" cy="90" r="${R}" fill="none" class="donut-bg" stroke-width="26"/>`;
    o.parts.forEach(p => {
      const len = (p.v / tot) * C; if (len <= 0) return;
      s += `<circle cx="90" cy="90" r="${R}" fill="none" stroke="${p.c}" stroke-width="26" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 90 90)" data-tip="${esc(p.l + ': ' + money(p.v) + ' (' + (p.v / tot * 100).toFixed(0) + '%)')}"/>`;
      acc += len;
    });
    return s + `<text class="d-top" x="90" y="85" text-anchor="middle">${esc(o.top || '')}</text><text class="d-val" x="90" y="107" text-anchor="middle">${esc(o.center || '')}</text></svg>`;
  },
  vbars(o) {
    const w = o.w || 640, h = o.h || 240, m = { l: 62, r: 12, t: 18, b: 40 }, iw = w - m.l - m.r, ih = h - m.t - m.b;
    const ymax = o.ymax || this.niceMax(Math.max(1, ...o.items.map(i => i.v)));
    const bw = iw / o.items.length, yf = o.yFmt || fmt, Y = v => m.t + ih - (v / ymax) * ih;
    let s = `<svg class="chart${o.animate ? ' anim' : ''}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(o.label || 'Bar chart')}">`;
    for (let i = 0; i <= 4; i++) { const v = ymax * i / 4, y = Y(v); s += `<line class="grid" x1="${m.l}" x2="${w - m.r}" y1="${y}" y2="${y}"/><text class="axis" x="${m.l - 8}" y="${y + 4}" text-anchor="end">${yf(v)}</text>`; }
    o.items.forEach((it, i) => {
      const x = m.l + i * bw + bw * 0.15, bh = (it.v / ymax) * ih;
      s += `<rect class="bar" x="${x.toFixed(1)}" y="${(m.t + ih - bh).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${Math.max(0, bh).toFixed(1)}" rx="4" fill="${it.c}" data-tip="${esc(it.l + ': ' + money(it.v))}"/>`;
      s += `<text class="axis" x="${(x + bw * 0.35).toFixed(1)}" y="${h - m.b + 18}" text-anchor="middle">${esc(it.l)}</text>`;
      if (it.v > 0 && bw > 34) s += `<text class="val" x="${(x + bw * 0.35).toFixed(1)}" y="${(m.t + ih - bh - 5).toFixed(1)}" text-anchor="middle">${yf(it.v)}</text>`;
    });
    return s + '</svg>';
  }
};

/* ============================== 5. CONTROLS ============================== */
function ctl(d) {
  const id = uid('c');
  return `<div class="ctl"><div class="ctl-h"><label for="${id}">${d.l}</label>${d.tip ? `<span class="tipi" tabindex="0" data-tip="${esc(d.tip)}">?</span>` : ''}</div>
  <div class="ctl-b"><input id="${id}" type="range" data-k="${d.k}" min="${d.min}" max="${d.max}" step="${d.step}" value="${d.v}">
  <div class="num">${d.pre ? `<i>${d.pre}</i>` : ''}<input type="number" data-k="${d.k}" min="${d.min}" step="${d.step}" value="${d.v}" aria-label="${esc(d.l)} value">${d.suf ? `<i>${d.suf}</i>` : ''}</div></div></div>`;
}
function bindCtl(root, obj, onChange) {
  root.addEventListener('input', e => {
    const t = e.target, k = t.dataset && t.dataset.k;
    if (!k || !(k in obj)) return;
    const val = parseFloat(t.value); if (isNaN(val)) return;
    obj[k] = val;
    $$(`[data-k="${k}"]`, root).forEach(o => { if (o !== t) o.value = val; });
    onChange(k);
  });
}
function syncCtl(root, obj) { $$('[data-k]', root).forEach(o => { if (o.dataset.k in obj) o.value = obj[o.dataset.k]; }); }
// Controls on the left, live-rendered output on the right (only output is re-rendered, so focus is kept).
function live(el, defs, state, render, cls) {
  el.innerHTML = `<div class="split ${cls || ''}"><div class="panel ctls">${defs.map(d => ctl({ ...d, v: state[d.k] })).join('')}</div><div class="panel out"></div></div>`;
  const out = $('.out', el);
  const run = first => { out.innerHTML = termify(render(state, first) || ''); };
  bindCtl(el, state, () => run(false));
  run(true);
  return { out, run };
}
function scnPills(active) {
  return `<div class="pills" role="group" aria-label="Scenario">${Object.keys(SCENARIOS).map(k => `<button class="pill${k === active ? ' on' : ''}" data-scn="${k}">${SCENARIOS[k].icon} ${SCENARIOS[k].name}</button>`).join('')}</div>`;
}

const CTRL = [
  { g: 'Infrastructure size & duration', items: [
    { k: 'servers', l: 'Infrastructure size (server-equivalents)', min: 1, max: 600, step: 1, tip: 'How many physical servers you would need to own — or the same capacity rented in the cloud.' },
    { k: 'years', l: 'Usage duration (years)', min: 1, max: 10, step: 1, suf: 'yrs', tip: 'How long you will run this infrastructure. Longer periods show refresh cycles and long-term effects.' }] },
  { g: 'On-premises assumptions', items: [
    { k: 'hwCost', l: 'Hardware cost per server', min: 500, max: 20000, step: 100, pre: '$', tip: 'CapEx: paid up front for each server (and again at each refresh).' },
    { k: 'hwLife', l: 'Hardware refresh cycle', min: 3, max: 7, step: 1, suf: 'yrs', tip: 'Servers are replaced after this many years.' },
    { k: 'swLic', l: 'Software licences / server / year', min: 0, max: 3000, step: 50, pre: '$', tip: 'OS, virtualisation, database and backup licences.' },
    { k: 'netCost', l: 'Networking gear per server', min: 0, max: 3000, step: 50, pre: '$', tip: 'One-time cost of switches, cabling and firewalls, per server.' },
    { k: 'circuit', l: 'Internet circuit / month', min: 0, max: 20000, step: 50, pre: '$', tip: 'Monthly fee for business internet bandwidth.' },
    { k: 'kw', l: 'Power draw per server', min: 0.1, max: 1, step: 0.05, suf: 'kW', tip: 'Average electrical load per server.' },
    { k: 'kwhPrice', l: 'Electricity price', min: 0.04, max: 0.4, step: 0.01, pre: '$', suf: '/kWh', tip: 'Price per kilowatt-hour in your area.' },
    { k: 'pue', l: 'Power Usage Effectiveness (PUE)', min: 1.1, max: 2.5, step: 0.05, tip: 'Overhead for cooling and power delivery. 1.6 means 60% extra power for cooling.' },
    { k: 'maintPct', l: 'Maintenance (% of hardware / yr)', min: 0, max: 25, step: 1, suf: '%', tip: 'Support contracts, spare parts and repairs.' },
    { k: 'perAdmin', l: 'Servers managed per admin', min: 2, max: 100, step: 1, tip: 'More automation lets one admin manage more servers.' },
    { k: 'salary', l: 'Loaded admin salary / year', min: 20000, max: 200000, step: 1000, pre: '$', tip: 'Salary plus benefits and overhead.' }] },
  { g: 'Cloud assumptions (illustrative)', items: [
    { k: 'cloudRate', l: 'Cloud price per server-equivalent / hour', min: 0.1, max: 5, step: 0.05, pre: '$', tip: 'Illustrative on-demand price for cloud capacity matching one physical server. Not live AWS pricing.' },
    { k: 'cloudUse', l: 'Time cloud servers are running', min: 5, max: 100, step: 1, suf: '%', tip: 'Cloud bills only for running hours. Switching things off at night/weekends lowers this.' },
    { k: 'discount', l: 'Commitment discount (Savings Plan)', min: 0, max: 60, step: 1, suf: '%', tip: 'Discount for committing to 1–3 years of usage.' },
    { k: 'storageGB', l: 'Cloud storage', min: 0, max: 500000, step: 500, suf: 'GB', tip: 'Data stored (S3-style object storage).' },
    { k: 'storagePrice', l: 'Storage price / GB-month', min: 0.005, max: 0.1, step: 0.001, pre: '$', tip: 'Illustrative price per GB per month.' },
    { k: 'growth', l: 'Storage growth per year', min: 0, max: 100, step: 1, suf: '%', tip: 'Data usually grows year over year.' },
    { k: 'transferGB', l: 'Data transfer out / month', min: 0, max: 200000, step: 100, suf: 'GB', tip: 'Data leaving the cloud to the internet (egress).' },
    { k: 'transferPrice', l: 'Transfer price / GB', min: 0.01, max: 0.2, step: 0.005, pre: '$', tip: 'Illustrative egress price per GB.' },
    { k: 'cloudStaffPct', l: 'Cloud ops staffing (% of on-prem staff)', min: 10, max: 100, step: 5, suf: '%', tip: 'Cloud still needs people (architecture, security, cost management), but usually fewer than racking servers.' }] }
];

/* ========================== 6. LESSON MODULES ============================ */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MINI = {
  upfront: '<svg class="mini" viewBox="0 0 120 60" aria-hidden="true"><path d="M4 54 H30 V8 H34 V54 H116" stroke="#4f8cff"/></svg>',
  recurring: '<svg class="mini" viewBox="0 0 120 60" aria-hidden="true"><path d="M4 50 H24 V42 H44 V34 H64 V26 H84 V18 H104 V10 H116" stroke="#f59e0b"/></svg>',
  usage: '<svg class="mini" viewBox="0 0 120 60" aria-hidden="true"><path d="M4 40 L16 28 L28 46 L40 18 L52 36 L64 50 L76 14 L88 32 L100 22 L116 44" stroke="#22c55e"/></svg>'
};

const HOT = {
  hardware: { icon: '<rect class="ic" x="46" y="10" width="48" height="58" rx="4"/><path class="ic" d="M52 24h36M52 40h36M52 56h36"/><circle class="icf" cx="58" cy="18" r="2"/><circle class="icf" cx="58" cy="34" r="2"/><circle class="icf" cx="58" cy="50" r="2"/>', what: 'Servers, storage arrays and racks. The biggest upfront purchase — and you buy it again at every refresh cycle (every 3–5 years).', ex: 'e.g. 20 servers × $6,000 = $120,000 on day one.' },
  software: { icon: '<rect class="ic" x="36" y="12" width="68" height="52" rx="6"/><path class="ic" d="M36 26h68"/><text x="70" y="55" style="font-size:20px">{ }</text>', what: 'Operating systems, virtualisation, databases, backup and security software. Often charged per server or per CPU every year.', ex: 'e.g. $400 per server per year in licences.' },
  networking: { icon: '<circle class="ic" cx="70" cy="18" r="8"/><circle class="ic" cx="40" cy="56" r="8"/><circle class="ic" cx="100" cy="56" r="8"/><path class="ic" d="M66 25L44 49M74 25L96 49M48 56h44"/>', what: 'Switches, routers, firewalls and cabling (one-time), plus the monthly internet circuit.', ex: 'e.g. $500 gear per server + $300/month internet.' },
  electricity: { icon: '<polygon class="icf" points="78,6 50,42 67,42 60,70 92,30 75,30" style="--c:#f59e0b"/>', what: 'Servers draw power 24/7 whether they are busy or idle. This line grows with every machine you own.', ex: 'e.g. 0.4 kW × 8,760 h × $0.12 ≈ $420 per server per year.' },
  cooling: { icon: '<g class="spin"><g transform="translate(70 38)"><path class="ic" d="M-26 0H26M-13 -22.5L13 22.5M-13 22.5L13 -22.5"/></g></g>', what: 'Computers turn electricity into heat. Air conditioning and airflow add extra power on top of what the servers use (see PUE).', ex: 'e.g. PUE 1.6 → 60% extra power for cooling.' },
  maintenance: { icon: '<g class="spin"><circle class="ic" cx="70" cy="38" r="22" stroke-dasharray="8 6" stroke-width="8"/></g><circle class="ic" cx="70" cy="38" r="13"/><circle class="icf" cx="70" cy="38" r="4" style="--c:#ef4444"/>', what: 'Support contracts, spare parts, repairs and replacing failed drives. Typically 8–15% of the hardware price each year.', ex: 'e.g. 10% × $120,000 = $12,000 per year.' },
  staffing: { icon: '<circle class="ic" cx="70" cy="22" r="12"/><path class="ic" d="M46 68q0-26 24-26t24 26z"/>', what: 'People to rack, patch, monitor, back up and secure everything — often the largest on-premises cost.', ex: 'e.g. 0.5 of an admin at $80,000 = $40,000 per year.' }
};

const MODULES = [
  /* ------------------------------ 1 ------------------------------ */
  { title: 'Introduction to Cloud Economics', obj: 'See why how you pay for IT matters as much as what you pay.',
    beginner: ['Imagine you need to get to work every day. You could <b>buy a car</b> — one big payment now, plus fuel and repairs later. Or you could <b>take taxis</b> — no big payment, you simply pay each time you ride.',
      'IT works the same way. A company can buy its own servers and look after them (the traditional way), or rent computing power from a cloud provider such as AWS and pay for what it uses. <b>Cloud economics</b> is about working out which choice makes financial sense — and when.'],
    technical: ['Cloud economics analyses the financial model of IT delivery: converting fixed, front-loaded {{capex}} for owned infrastructure into variable, consumption-based {{opex}}, and evaluating both through {{tco}} over a defined horizon.',
      'Key variables are {{utilization}}, workload variability, asset lifetime, staffing overhead and commitment discounts ({{savings}}). Cloud typically wins on {{elasticity}} and time-to-market; owned hardware can win for steady, highly utilised workloads at scale.'],
    points: ['Buying = big upfront payment (CapEx).', 'Renting = pay as you go (OpEx).', 'Neither is always cheaper — your usage pattern decides.', 'TCO is the fair way to compare them.'],
    tryIt: 'Drag the slider to find the month where buying becomes cheaper than renting.',
    mount(el) {
      const coins = (x, y, cls, r, n, d) => Array.from({ length: n }, (_, i) => `<circle class="coin ${cls}" cx="${x + i * 18}" cy="${y}" r="${r}" style="animation-delay:${(i * d).toFixed(1)}s"/>`).join('');
      el.innerHTML = `<svg class="scene" viewBox="0 0 640 250" role="img" aria-label="Left: buying a data center means one large upfront payment. Right: renting cloud means small payments that follow your usage.">
        <line class="divider" x1="320" y1="14" x2="320" y2="236"/>
        <text class="scene-t" x="160" y="26" text-anchor="middle">BUY it yourself → CapEx</text>
        <text class="scene-t" x="480" y="26" text-anchor="middle">RENT from the cloud → OpEx</text>
        <g class="bld"><rect x="70" y="100" width="180" height="110" rx="6"/><rect class="win" x="90" y="118" width="26" height="20"/><rect class="win" x="130" y="118" width="26" height="20"/><rect class="win" x="170" y="118" width="26" height="20"/><rect class="win" x="210" y="118" width="26" height="20"/><rect x="146" y="160" width="28" height="50"/></g>
        ${coins(112, 44, 'big', 11, 4, 0.5)}
        <text class="scene-s" x="160" y="238" text-anchor="middle">One big payment up front</text>
        <g class="meter"><rect x="440" y="44" width="80" height="26" rx="6"/><text x="480" y="62" text-anchor="middle" style="font-size:12px;font-weight:700">⏱ METER</text></g>
        ${coins(462, 76, 'sm', 5, 3, 0.7)}
        <g><circle class="cloud-shape" cx="445" cy="165" r="30"/><circle class="cloud-shape" cx="485" cy="148" r="38"/><circle class="cloud-shape" cx="525" cy="168" r="30"/><rect x="445" y="160" width="80" height="35" fill="var(--card2)"/><text x="485" y="172" text-anchor="middle" style="font-size:20px">☁</text><text x="485" y="190" text-anchor="middle" style="font-size:11px;font-weight:700">pay per use</text></g>
        <text class="scene-s" x="480" y="238" text-anchor="middle">Small payments that follow usage</text></svg>
        <div class="split" style="margin-top:14px"><div class="panel">${ctl({ k: 'months', l: 'How many months will you need it?', min: 1, max: 60, step: 1, v: 12, suf: 'mo', tip: 'Example: buy for $12,000 once, or rent for $400 per month.' })}<p class="sub">Example: buy for <b>$12,000</b> once · rent for <b>$400/month</b>.</p></div><div class="panel" id="m1out"></div></div>`;
      const out = $('#m1out', el), slider = $('input[type=range]', el);
      const upd = m => {
        const rent = 400 * m, buy = 12000, win = rent < buy ? 'Renting' : rent > buy ? 'Buying' : 'Both';
        out.innerHTML = `<div class="grid2"><div><div class="sub">Buying (CapEx)</div><div class="big" style="color:var(--pri)">${money(buy)}</div></div><div><div class="sub">Renting (OpEx)</div><div class="big" style="color:var(--good)">${money(rent)}</div></div></div>
        <div class="verdict ${rent < buy ? 'good' : 'warn'}">${win === 'Both' ? 'Exactly equal at 30 months!' : win + ' is cheaper after ' + m + ' month' + (m > 1 ? 's' : '') + '.'}</div>
        <p class="sub">The break-even is month 30 ($12,000 ÷ $400). Use it for less than 30 months and renting wins; longer and buying wins — <i>if</i> you ignore power, staff and repairs. Adding those is what <b>TCO</b> is for.</p>`;
      };
      slider.addEventListener('input', () => upd(parseFloat(slider.value)));
      $('input[type=number]', el).addEventListener('input', e => upd(parseFloat(e.target.value) || 1));
      upd(12);
    } },

  /* ------------------------------ 2 ------------------------------ */
  { title: 'Traditional IT Infrastructure Costs', obj: 'Discover the seven cost buckets of running your own data center.',
    beginner: ['Running your own servers costs far more than the price on the hardware box. You also need software licences, network equipment, electricity, cooling so nothing overheats, repairs and spare parts — and people to look after it all.',
      'Click each tile below to see what it covers and what share of the bill it takes for a typical small business.'],
    technical: ['On-premises TCO combines acquisition costs (servers, storage, switches, licences) with recurring operating costs: power (kWh × price), cooling overhead expressed through {{pue}}, vendor maintenance contracts (commonly 8–15% of hardware price per year), facilities and {{fte}} staffing.',
      'Hardware is replaced every 3–5 years ({{refresh}}), so the "one-off" purchase actually recurs. Capacity is sized for peak demand ({{overprov}}), which depresses average {{utilization}}.'],
    points: ['Hardware is only one of seven cost buckets.', 'Power and cooling run 24/7, busy or idle.', 'People are often the biggest hidden cost.', 'Hardware must be re-bought every 3–5 years.'],
    tryIt: 'Click every tile and note which one is the biggest. Is it the one you expected?',
    mount(el) {
      const r = calc(SCENARIOS.small.p), pos = { hardware: [20, 12], software: [170, 12], networking: [320, 12], electricity: [470, 12], cooling: [95, 140], maintenance: [245, 140], staffing: [395, 140] };
      let g = '';
      ON_KEYS.forEach(k => {
        const [x, y] = pos[k], c = CATS[k].c;
        g += `<g class="hot" tabindex="0" role="button" aria-label="${CATS[k].l}" data-c="${k}" transform="translate(${x} ${y})" style="--c:${c}"><rect class="hbg" width="140" height="116" rx="14"/><rect class="pulse" width="140" height="116" rx="14"/><g>${HOT[k].icon}</g><text x="70" y="92">${CATS[k].l}</text><text class="pc" x="70" y="108">${pct(r.cat[k], r.onTotal).toFixed(0)}% of total</text></g>`;
      });
      el.innerHTML = `<svg class="scene" viewBox="0 0 640 270" role="group" aria-label="Seven clickable on-premises cost categories">${g}</svg><div class="panel" id="m2d" style="margin-top:12px"></div>`;
      const show = k => {
        $$('.hot', el).forEach(h => h.classList.toggle('on', h.dataset.c === k));
        const sh = pct(r.cat[k], r.onTotal);
        $('#m2d', el).innerHTML = `<h4 style="color:${CATS[k].c}">${CATS[k].l} <span class="tag ${CATS[k].type === 'CapEx' ? 'cap' : 'op'}">${CATS[k].type === 'Mixed' ? 'CapEx + OpEx' : CATS[k].type}</span></h4><p>${termify(HOT[k].what)}</p>
        <div class="detail"><span class="sub">Example</span><span>${HOT[k].ex}</span><span class="sub">3-yr cost (sample)</span><b>${money(r.cat[k])}</b><span class="sub">Share of on-prem TCO</span><span><div class="bar-track"><i style="width:${sh}%;background:${CATS[k].c}"></i></div><span class="sub">${sh.toFixed(1)}%</span></span></div>
        <p class="sub" style="margin-top:10px">Sample: ${SCENARIOS.small.name} scenario, ${r.N / 12} years, ${SCENARIOS.small.p.servers} servers — illustrative numbers.</p>`;
      };
      el.addEventListener('click', e => { const h = e.target.closest('.hot'); if (h) show(h.dataset.c); });
      el.addEventListener('keydown', e => { const h = e.target.closest('.hot'); if (h && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); show(h.dataset.c); } });
      show('hardware');
    } },

  /* ------------------------------ 3 ------------------------------ */
  { title: 'Understanding CapEx', obj: 'Learn how big upfront purchases work — and how accountants spread them out.',
    beginner: ['{{capex}} (capital expenditure) is money spent to buy things that last for years — servers, network gear, even a building. You pay a big amount <b>up front</b>, and the item keeps helping your business for a long time.',
      'Accountants spread that cost over the item\u2019s useful life — called {{depreciation}}. A $60,000 server purchase used for 5 years is treated as $12,000 per year on paper, even though all the cash left on day one.'],
    technical: ['CapEx is capitalised as a fixed asset and expensed gradually through straight-line {{depreciation}}: (cost − salvage) ÷ useful life. Cash leaves in one block, but the P&L impact is spread across the asset\u2019s life.',
      'Risks: {{overprov}} (buying for peak), stranded capacity, technology obsolescence and capital lock-up. Note that some cloud commitments (all-upfront Reserved Instances / {{savings}}) behave like prepaid CapEx.'],
    points: ['Large cash payment on day one.', 'Cost is spread on paper via depreciation.', 'You carry the risk of guessing capacity wrong.', 'Needs budget approval and lead time (weeks to months).'],
    tryIt: 'Change the number of servers and the lifespan. Notice how the cash chart is one tall bar while depreciation is a gentle staircase.',
    mount(el) {
      const st = { n: 10, c: 6000, life: 5 };
      live(el, [
        { k: 'n', l: 'Number of servers', min: 1, max: 100, step: 1, tip: 'How many servers you buy.' },
        { k: 'c', l: 'Cost per server', min: 1000, max: 20000, step: 500, pre: '$' },
        { k: 'life', l: 'Useful life', min: 3, max: 7, step: 1, suf: 'yrs', tip: 'Years before it is replaced.' }], st, (s, first) => {
        const total = s.n * s.c, dep = total / s.life, yrs = Array.from({ length: s.life + 1 }, (_, i) => i);
        return `<div class="grid2"><div><div class="sub">Cash paid on day 1</div><div class="big" style="color:var(--pri)">${money(total)}</div></div><div><div class="sub">Depreciation per year</div><div class="big">${money(dep)}</div></div></div>
        <h4 style="margin-top:12px">Cash leaving your bank, by year</h4>${Charts.vbars({ items: yrs.map(i => ({ l: 'Y' + i, v: i === 0 ? total : 0, c: '#4f8cff' })), ymax: Charts.niceMax(total), h: 190, animate: first, label: 'Cash paid per year' })}
        <h4>Accounting expense (depreciation), by year</h4>${Charts.vbars({ items: yrs.map(i => ({ l: 'Y' + i, v: i === 0 ? 0 : dep, c: '#8b5cf6' })), ymax: Charts.niceMax(total), h: 190, animate: first, label: 'Depreciation per year' })}
        <p class="sub tech-only">Straight-line, zero salvage: book value after year k = ${money(total)} − k × ${money(dep)}. After ${s.life} years the book value is $0 but the hardware must be replaced.</p>`;
      });
    } },

  /* ------------------------------ 4 ------------------------------ */
  { title: 'Understanding OpEx', obj: 'See how pay-as-you-go billing follows your usage up and down.',
    beginner: ['{{opex}} (operational expenditure) is the ongoing cost of running a business — electricity, subscriptions, wages. You pay as you go and the cost shows up in the same period you use it.',
      'Cloud is mostly OpEx: you are billed for the hours of computing, the gigabytes stored and the data moved. Turn something off and the bill for it stops — like switching off a light.'],
    technical: ['OpEx is expensed in the period incurred. Cloud billing is metered: per-second/hour compute, per GB-month storage, per request, per GB {{egress}}. That gives {{elasticity}}, but also variable bills that need governance (budgets, tags, anomaly alerts — see {{finops}}).',
      'Pricing options include On-Demand, {{savings}} (1–3 year commitments for lower rates) and Spot (spare capacity at deep discounts with interruption risk).'],
    points: ['No big upfront payment.', 'Bill rises and falls with usage.', 'Turning resources off stops the charge.', 'Variable bills need monitoring and budgets.'],
    tryIt: 'Reduce "hours per day" to 10 — what happens to the yearly bill? Then check how a busy season changes the monthly bars.',
    mount(el) {
      const st = { inst: 8, hrs: 24, price: 0.1 }, f = [1, 1, 1, 1.1, 1, 1, 1.2, 1.3, 1, 1.6, 2, 1.4];
      live(el, [
        { k: 'inst', l: 'Servers running (average)', min: 1, max: 60, step: 1 },
        { k: 'hrs', l: 'Hours per day they run', min: 1, max: 24, step: 1, suf: 'h', tip: 'Switching dev/test servers off at night reduces this.' },
        { k: 'price', l: 'Price per server-hour (illustrative)', min: 0.02, max: 1, step: 0.01, pre: '$', tip: 'Sample price — not live AWS pricing.' }], st, (s, first) => {
        const base = s.inst * s.hrs * 30 * s.price, items = f.map((x, i) => ({ l: MONTHS[i], v: base * x, c: x > 1.3 ? '#f59e0b' : '#22c55e' })), yr = items.reduce((a, b) => a + b.v, 0);
        return `<div class="grid2"><div><div class="sub">Typical month</div><div class="big" style="color:var(--good)">${money(base)}</div></div><div><div class="sub">Year total (with seasonal peaks)</div><div class="big">${money(yr)}</div></div></div>
        <h4 style="margin-top:12px">Monthly bill — it follows demand</h4>${Charts.vbars({ items, animate: first, label: 'Monthly cloud bill' })}
        <p class="sub">Orange months have extra demand (festive season, campaigns). You pay more only when you use more — no hardware sits idle the rest of the year.</p>
        <p class="sub">Formula: servers × hours/day × 30 days × price/hour × seasonal factor. See the <b>AWS Lab</b> tab for EC2, S3, RDS, Lambda and CloudWatch examples.</p>`;
      });
    } },

  /* ------------------------------ 5 ------------------------------ */
  { title: 'CapEx vs OpEx Comparison', obj: 'Compare three payment patterns side by side and find the crossover point.',
    beginner: ['Think of three ways to pay: <b>one big payment</b> (buying), <b>a fixed monthly payment</b> (a subscription or lease), and <b>pay for what you use</b> (a taxi meter). Cloud mixes the last two.',
      'Below, drag the sliders to see when the total money spent on each option crosses over.'],
    technical: ['CapEx: high initial outlay, low marginal cost, fixed capacity, depreciation tax shield (jurisdiction-dependent). OpEx: low entry cost, higher marginal unit cost, elastic capacity, immediately deductible.',
      'The {{breakeven}} month is m* = Upfront ÷ (cloud monthly − on-prem monthly). Past m*, the owned asset is cheaper <i>if</i> {{utilization}} stays high and the hardware does not need replacing.'],
    points: ['CapEx = high entry cost, low running cost.', 'OpEx = low entry cost, flexible running cost.', 'Break-even depends on how long and how heavily you use it.', 'Cash-flow and risk differ even when totals are similar.'],
    tryIt: 'Lower the cloud monthly bill to $2,000 — does the crossover disappear?',
    mount(el) {
      el.innerHTML = `<div class="grid3" style="margin-bottom:14px"><div class="pat"><h5 style="color:var(--pri)">Upfront investment</h5>${MINI.upfront}<p>One big payment, then little. <b>CapEx</b> (buying servers).</p></div><div class="pat"><h5 style="color:var(--warn)">Recurring expenses</h5>${MINI.recurring}<p>Fixed amount every month. Power, support contracts, subscriptions, salaries.</p></div><div class="pat"><h5 style="color:var(--good)">Usage-based billing</h5>${MINI.usage}<p>Bill follows what you use. <b>Cloud</b> (EC2 hours, S3 GB, Lambda requests).</p></div></div><div id="m5l"></div>
      <div class="table-wrap panel" style="margin-top:14px"><table><thead><tr><th>Aspect</th><th>CapEx (buy)</th><th>OpEx (cloud)</th></tr></thead><tbody>
      <tr><td>When you pay</td><td>Upfront, in one block</td><td>Monthly / hourly as consumed</td></tr>
      <tr><td>Capacity</td><td>Fixed — sized for peak</td><td>Elastic — grows and shrinks</td></tr>
      <tr><td>Cost predictability</td><td>High after purchase</td><td>Variable; needs budgets &amp; alerts</td></tr>
      <tr><td>Risk of wrong guess</td><td>You own idle or missing capacity</td><td>You pay for what you use</td></tr>
      <tr><td>Time to start</td><td>Weeks–months (order, ship, install)</td><td>Minutes</td></tr>
      <tr class="tech-only"><td>Accounting</td><td>Balance sheet asset; depreciated</td><td>Expensed on P&amp;L as incurred</td></tr>
      <tr><td>Example</td><td>20 servers in a server room</td><td>EC2, S3, RDS, Lambda bills</td></tr></tbody></table></div>`;
      const st = { up: 60000, onM: 1500, clM: 3500 };
      live($('#m5l', el), [
        { k: 'up', l: 'On-prem upfront (CapEx)', min: 5000, max: 300000, step: 1000, pre: '$' },
        { k: 'onM', l: 'On-prem monthly running cost', min: 0, max: 10000, step: 100, pre: '$', tip: 'Power, cooling, support, staff share.' },
        { k: 'clM', l: 'Cloud monthly bill', min: 500, max: 15000, step: 100, pre: '$' }], st, (s, first) => {
        const N = 60, a = [], b = []; for (let m = 0; m <= N; m++) { a.push(s.up + s.onM * m); b.push(s.clM * m); }
        const d = s.clM - s.onM, cross = d > 0 ? s.up / d : null, ok = cross !== null && cross <= N;
        return `<div class="verdict ${ok ? 'info' : 'good'}">${ok ? 'Break-even at month ' + Math.ceil(cross) + ' — after that, owning is cheaper (if usage stays high).' : (d > 0 ? 'No crossover within 5 years — cloud stays cheaper.' : 'Cloud is never more expensive than owning in this setup.')}</div>
        ${Charts.line({ series: [{ data: a, c: '#4f8cff' }, { data: b, c: '#22c55e' }], xTicks: [0, 1, 2, 3, 4, 5].map(y => ({ i: y * 12, l: 'Y' + y })), xLabel: 'Time (cumulative spend)', marks: ok ? [{ i: Math.ceil(cross), l: 'Break-even' }] : [], animate: first, label: 'Cumulative cost, buy vs cloud' })}
        ${Charts.legend([{ c: '#4f8cff', l: 'Buy (CapEx + running)' }, { c: '#22c55e', l: 'Cloud (OpEx)' }])}`;
      }, 'even');
    } },

  /* ------------------------------ 6 ------------------------------ */
  { title: 'Understanding TCO', obj: 'Look beneath the price tag at the full cost of owning something.',
    beginner: ['The sticker price is only the tip of the iceberg. {{tco}} (Total Cost of Ownership) adds up <b>everything</b> it costs to own and run something for its whole life: buying it, powering it, cooling it, fixing it, licensing software and paying people to manage it.',
      'Comparing TCO instead of price tags stops you picking an option that looks cheap today but is expensive over the years.'],
    technical: ['TCO = Acquisition + Operations + Support/Staffing + Refresh + Risk/Downtime − Residual value, over a fixed horizon (3–5 years typical). Mature models discount future cash flows (NPV) and include migration, training and exit costs.',
      'Fair comparisons are like-for-like: same availability, security, performance and capacity. Include indirect costs such as opportunity cost of slow provisioning.'],
    points: ['Price tag ≠ total cost.', 'Hidden costs often exceed the purchase price.', 'Compare over the same time period.', 'Include people, power and replacement.'],
    tryIt: 'Untick the hidden costs one by one and watch the "multiple of sticker price" fall.',
    mount(el) {
      const inc = {}; ON_KEYS.forEach(k => { inc[k] = true; });
      const r0 = calc(App.params);
      el.innerHTML = `<div class="split even"><div class="panel"><h4>Tick the costs to include (your calculator inputs)</h4>${ON_KEYS.map(k => `<label class="chk"><input type="checkbox" data-c="${k}" checked><i style="background:${CATS[k].c}"></i><span>${CATS[k].l}</span><b>${money(r0.cat[k])}</b></label>`).join('')}<p class="sub">Uses the numbers from the <b>TCO Calculator</b> (${SCENARIOS[App.scn].name} scenario).</p></div><div class="panel" id="berg"></div></div>`;
      const draw = () => {
        const r = calc(App.params), sticker = r.cat.hardware, total = ON_KEYS.reduce((a, k) => a + (inc[k] ? r.cat[k] : 0), 0);
        const visible = inc.hardware ? sticker : 0, hidden = total - visible, mult = sticker ? total / sticker : 0;
        $('#berg', el).innerHTML = `<svg class="scene" viewBox="0 0 320 300" role="img" aria-label="Iceberg: the hardware price is the visible tip, other costs are hidden below water">
          <rect x="0" y="110" width="320" height="190" fill="#06b6d4" opacity=".14"/><line x1="0" y1="110" x2="320" y2="110" stroke="var(--acc)" stroke-width="2" stroke-dasharray="6 5"/>
          <polygon points="130,110 160,48 192,110" fill="#e8f1ff" stroke="#9db8e8" stroke-width="2"/>
          <polygon points="90,110 230,110 262,168 214,262 124,270 62,184" fill="${hidden > 0 ? '#9db8e8' : '#c7d6f0'}" opacity=".85" stroke="#6d8fd0" stroke-width="2"/>
          <text x="160" y="26" text-anchor="middle" style="font-size:13px;font-weight:700">Sticker price (hardware)</text><text x="160" y="42" text-anchor="middle" style="font-size:14px;font-weight:800;fill:var(--pri)">${money(visible)}</text>
          <text x="160" y="176" text-anchor="middle" style="font-size:13px;font-weight:800;fill:#0f1b33">Hidden costs</text><text x="160" y="196" text-anchor="middle" style="font-size:16px;font-weight:800;fill:#b91c1c">${money(hidden)}</text>
          <text x="160" y="218" text-anchor="middle" style="font-size:11px;fill:#0f1b33">power · cooling · staff</text><text x="160" y="233" text-anchor="middle" style="font-size:11px;fill:#0f1b33">software · maintenance</text></svg>
          <div class="grid2"><div><div class="sub">TCO included (${App.params.years} yrs)</div><div class="big">${money(total)}</div></div><div><div class="sub">× sticker price</div><div class="big" style="color:var(--warn)">${sticker ? mult.toFixed(1) + '×' : '–'}</div></div></div>
          <p class="sub">Cloud TCO for the same period and capacity: <b>${money(r.clTotal)}</b> (${r.cloudCheaper ? 'cheaper' : 'more expensive'} than the full on-prem TCO of ${money(r.onTotal)}).</p>
          <p class="sub tech-only">TCO = Σ categories over ${r.N} months. Average annual on-prem TCO: ${money(total / App.params.years)}.</p>`;
      };
      el.addEventListener('change', e => { const c = e.target.dataset && e.target.dataset.c; if (c) { inc[c] = e.target.checked; draw(); } });
      draw();
    } },

  /* ------------------------------ 7 ------------------------------ */
  { title: 'Traditional Data Center vs Cloud Cost Model', obj: 'Watch fixed capacity and elastic capacity respond to a traffic spike.',
    beginner: ['A traditional data center has a <b>fixed number of servers</b>. You pay for all of them all the time — even when nobody is using them. And if a rush of visitors arrives, extra requests simply fail.',
      'Cloud adds servers automatically when traffic rises and removes them when it falls. You pay only for the ones running. Drag the traffic slider or press the spike button.'],
    technical: ['The owned model has a fixed cost function C = N × c_server regardless of load, with a hard capacity ceiling. Cloud cost approximates C(t) = n(t) × rate, where n(t) tracks demand through auto scaling ({{elasticity}}).',
      'Over-provisioning wastes money; under-provisioning loses revenue. Elasticity converts the capacity-planning problem into a monitoring and budgeting problem.'],
    points: ['Owned: pay for peak capacity all the time.', 'Cloud: capacity follows demand.', 'Fixed capacity can drop requests at spikes.', 'Idle capacity is pure waste.'],
    tryIt: 'Press "Simulate traffic spike" and watch the red alert on the left while the right side simply scales.',
    mount(el, ctx) {
      const SLOTS = 12, OWN = 8, DC = 0.9, CL = 1.0;
      let slots = '';
      [0, 1].forEach(side => {
        for (let i = 0; i < SLOTS; i++) slots += `<rect class="slot off" data-s="${side}-${i}" x="${(side ? 358 : 28) + (i % 4) * 68}" y="${104 + Math.floor(i / 4) * 50}" width="58" height="40" rx="6"/>`;
      });
      el.innerHTML = `<svg class="scene" viewBox="0 0 640 300" role="img" aria-label="Left: fixed eight-server data center that overloads. Right: cloud that adds servers as traffic grows.">
        <circle cx="320" cy="20" r="12" fill="var(--acc)"/><text x="320" y="25" text-anchor="middle" style="font-size:13px;fill:#04222b!important;font-weight:800">U</text>
        <line class="flow" x1="312" y1="30" x2="160" y2="76"/><line class="flow" x1="328" y1="30" x2="480" y2="76"/>
        <rect class="panel-bg" x="10" y="76" width="300" height="194" rx="12"/><rect class="panel-bg" x="340" y="76" width="290" height="194" rx="12"/>
        <text class="ptitle" x="26" y="97">🏢 Traditional data center (8 servers owned)</text><text class="ptitle" x="356" y="97">☁ Cloud (auto-scaling)</text>
        ${slots}
        <g class="alert-g" id="m7alert" style="display:none"><rect x="60" y="251" width="200" height="22" rx="6"/><text x="160" y="266" text-anchor="middle" class="m7al">OVERLOADED</text></g>
        <text class="pstatus" x="26" y="287" id="m7s0"></text><text class="pstatus" x="356" y="287" id="m7s1"></text></svg>
        <div class="split" style="margin-top:12px"><div class="panel">${ctl({ k: 'load', l: 'Website traffic', min: 0, max: 100, step: 1, v: 40, suf: '%', tip: '100% = 12 servers worth of demand.' })}
        <button class="btn" id="m7spike">⚡ Simulate traffic spike</button> <button class="btn ghost" id="m7reset">Reset</button></div><div class="panel" id="m7out"></div></div>`;
      const rng = $('input[type=range]', el), num = $('input[type=number]', el);
      const set = (side, i, c) => { const n = $(`[data-s="${side}-${i}"]`, el); if (n) n.setAttribute('class', 'slot ' + c); };
      const upd = load => {
        load = clamp(load, 0, 100);
        const d = Math.round(load / 100 * SLOTS), busy = Math.min(d, OWN), drop = Math.max(0, d - OWN);
        for (let i = 0; i < SLOTS; i++) { set(0, i, i < OWN ? (i < busy ? 'busy' : 'idle') : 'off'); set(1, i, i < d ? 'busy' : 'off'); }
        $('#m7alert', el).style.display = drop ? '' : 'none';
        $('.m7al', el).textContent = `OVERLOADED — ${drop} of ${d} requests dropped`;
        $('#m7s0', el).textContent = `${busy} busy · ${OWN - busy} idle but still paid`;
        $('#m7s1', el).textContent = `${d} running · ${SLOTS - d} not billed`;
        const dcCost = OWN * DC, clCost = d * CL;
        $('#m7out', el).innerHTML = `<div class="grid2"><div><div class="sub">Data center cost / hour</div><div class="big" style="color:var(--pri)">$${dcCost.toFixed(2)}</div><div class="sub">Idle waste: $${((OWN - busy) * DC).toFixed(2)}${drop ? ' · lost customers: ' + drop : ''}</div></div>
        <div><div class="sub">Cloud cost / hour</div><div class="big" style="color:var(--good)">$${clCost.toFixed(2)}</div><div class="sub">Idle waste: $0.00 · lost customers: 0</div></div></div>
        <p class="sub">Illustrative: owned server ≈ $${DC.toFixed(2)}/h all-in, cloud ≈ $${CL.toFixed(2)}/h per running server. At steady, full load the owned server is cheaper per hour; at low or spiky load cloud wins.</p>`;
      };
      let timer = null;
      const stop = () => { if (timer) { clearInterval(timer); timer = null; $('#m7spike', el).disabled = false; } };
      ctx.cleanup(stop);
      const setLoad = v => { rng.value = v; num.value = v; upd(v); };
      rng.addEventListener('input', () => { stop(); upd(parseFloat(rng.value)); num.value = rng.value; });
      num.addEventListener('input', () => { stop(); rng.value = num.value; upd(parseFloat(num.value) || 0); });
      $('#m7reset', el).addEventListener('click', () => { stop(); setLoad(40); });
      $('#m7spike', el).addEventListener('click', e => {
        e.target.disabled = true; const seq = [20, 40, 60, 80, 95, 100, 100, 80, 60, 40, 20]; let i = 0;
        timer = setInterval(() => { setLoad(seq[i++]); if (i >= seq.length) stop(); }, 550);
      });
      upd(40);
    } },

  /* ------------------------------ 8 ------------------------------ */
  { title: 'Real-World Business Scenarios', obj: 'Apply everything to four very different organisations.',
    beginner: ['The "right" answer depends on who you are. A startup with no money and unpredictable traffic is very different from a big retailer with steady, heavy workloads.',
      'Pick a scenario to see its story, assumptions and the full 3–5 year cost comparison.'],
    technical: ['Scenario sensitivity is driven by (1) utilisation and variability, (2) staffing leverage (servers per admin), (3) scale-driven hardware pricing, (4) commitment discounts and (5) growth uncertainty. Use the calculator to run a sensitivity analysis on each.',
      'Many enterprises adopt hybrid: owned or colocated hardware for steady baseload, cloud for bursts, DR and new projects.'],
    points: ['Startups: cloud — no capital, instant scale.', 'Colleges: depends on idle time and calendar.', 'Small business: cloud usually wins on staffing.', 'Enterprises: steady load can favour owning or hybrid.'],
    tryIt: 'Switch scenarios, then press "Open in calculator" and change one assumption to see what flips the winner.',
    mount(el) {
      el.innerHTML = `<div id="m8p"></div>`;
      const draw = () => {
        const k = App.scn, S = SCENARIOS[k], r = calc(S.p), save = Math.abs(r.diff);
        $('#m8p', el).innerHTML = scnPills(k) + `<div class="cols"><div class="panel"><h4>${S.icon} ${S.name}</h4><p><b>${S.who}</b></p><p>${S.story}</p>
        <table><tbody><tr><td>Infrastructure</td><td class="r">${S.p.servers} servers</td></tr><tr><td>Time horizon</td><td class="r">${S.p.years} years</td></tr><tr><td>Cloud runs</td><td class="r">${S.p.cloudUse}% of the time</td></tr><tr><td>Servers per admin</td><td class="r">${S.p.perAdmin}</td></tr><tr><td>Commitment discount</td><td class="r">${S.p.discount}%</td></tr></tbody></table></div>
        <div class="panel"><h4>${S.p.years}-year cost comparison</h4>${Charts.stack({ rows: [{ label: 'On-premises', parts: ON_KEYS.map(c => ({ k: c, v: r.cat[c], c: CATS[c].c, l: CATS[c].l })) }, { label: 'Cloud', parts: CL_KEYS.map(c => ({ k: c, v: r.cat[c], c: CATS[c].c, l: CATS[c].l })) }], label: S.name + ' cost comparison' })}
        <div class="verdict ${r.cloudCheaper ? 'good' : 'warn'}">${r.cloudCheaper ? '☁ Cloud is cheaper by ' + money(save) + ' (' + (100 * save / r.onTotal).toFixed(0) + '%)' : '🏢 On-premises is cheaper by ' + money(save) + ' (' + (100 * save / r.clTotal).toFixed(0) + '%)'}</div>
        <p><b>Lesson:</b> ${S.lesson}</p><button class="btn sm" id="m8open">Open in calculator →</button></div></div>`;
      };
      el.addEventListener('click', e => { if (e.target.id === 'm8open') App.go('calculator'); });
      App.onScenario.push(() => { if (document.body.contains(el)) draw(); });
      draw();
    } },

  /* ------------------------------ 9 ------------------------------ */
  { title: 'Cost Optimization and Key Takeaways', obj: 'Turn on real-world savings levers and watch the bill shrink.',
    beginner: ['Moving to the cloud does not automatically make things cheap — you have to <b>manage</b> it. Small habits, like switching off unused servers and moving old files to cheaper storage, can cut a bill dramatically.',
      'Toggle the savings actions below and see the effect on a sample monthly bill.'],
    technical: ['Optimisation levers: {{rightsizing}}, scheduling non-production, {{savings}} for steady baseload, storage tiering and lifecycle policies, CDN caching to cut {{egress}}, log retention in {{cloudwatch}}, and serverless ({{lambda}}) for spiky workloads. Run these as an ongoing {{finops}} practice with tagging, budgets and anomaly alerts.',
      'Savings figures here are illustrative; actual results depend on workload and provider pricing.'],
    points: ['Rightsize and switch off idle resources.', 'Commit only for steady baseload.', 'Tier or expire old data.', 'Budgets + alerts + tags = no surprises.'],
    tryIt: 'Click "Apply all" — which single action saves the most dollars?',
    mount(el) {
      const share = { compute: .5, database: .2, storage: .12, transfer: .1, monitoring: .08 };
      const lab = { compute: 'Compute (EC2)', database: 'Database (RDS)', storage: 'Storage (S3)', transfer: 'Data transfer', monitoring: 'Monitoring' };
      const col = { compute: '#22c55e', database: '#4f8cff', storage: '#14b8a6', transfer: '#a3e635', monitoring: '#f59e0b' };
      const OPT = [
        { id: 'rs', l: 'Rightsize over-sized instances', cat: 'compute', cut: .2 }, { id: 'sc', l: 'Stop dev/test servers nights & weekends', cat: 'compute', cut: .15 },
        { id: 'sp', l: 'Savings Plans for steady baseload', cat: 'compute', cut: .3 }, { id: 'lm', l: 'Move spiky jobs to Lambda', cat: 'compute', cut: .1 },
        { id: 'db', l: 'Rightsize & schedule databases', cat: 'database', cut: .2 }, { id: 's3', l: 'S3 lifecycle rules / Intelligent-Tiering', cat: 'storage', cut: .4 },
        { id: 'ebs', l: 'Delete unattached volumes & old snapshots', cat: 'storage', cut: .15 }, { id: 'cdn', l: 'CDN caching to reduce data transfer', cat: 'transfer', cut: .35 },
        { id: 'cw', l: 'Set log retention & filter noisy logs', cat: 'monitoring', cut: .4 }, { id: 'bud', l: 'Budgets, tags & anomaly alerts', cat: 'all', cut: .05 }];
      const on = {}; OPT.forEach(o => { on[o.id] = false; });
      const st = { bill: 20000 };
      el.innerHTML = `<div class="split"><div class="panel"><div id="m9c"></div><h4>Savings actions</h4>${OPT.map(o => `<label class="chk"><input type="checkbox" data-o="${o.id}"><span>${o.l}</span><b>−${Math.round(o.cut * 100)}%</b></label>`).join('')}<div style="display:flex;gap:8px;margin-top:8px"><button class="btn sm" id="m9all">Apply all</button><button class="btn ghost sm" id="m9none">Clear</button></div></div><div class="panel" id="m9o"></div></div>`;
      $('#m9c', el).innerHTML = ctl({ k: 'bill', l: 'Monthly cloud bill before optimisation', min: 1000, max: 100000, step: 500, pre: '$' });
      const draw = first => {
        const after = {}, before = {}; let tot = 0;
        Object.keys(share).forEach(c => {
          before[c] = st.bill * share[c]; let v = before[c];
          OPT.forEach(o => { if (on[o.id] && (o.cat === c || o.cat === 'all')) v *= (1 - o.cut); });
          after[c] = v; tot += v;
        });
        const saved = st.bill - tot;
        $('#m9o', el).innerHTML = `<div class="grid2"><div><div class="sub">Saved per month</div><div class="big" style="color:var(--good)">${money(saved)}</div></div><div><div class="sub">Saved per year</div><div class="big">${money(saved * 12)}</div></div></div>
        ${Charts.stack({ rows: [{ label: 'Before', parts: Object.keys(share).map(c => ({ v: before[c], c: col[c], l: lab[c] })) }, { label: 'After', parts: Object.keys(share).map(c => ({ v: after[c], c: col[c], l: lab[c] })) }], label: 'Monthly bill before and after optimisation' })}
        ${Charts.legend(Object.keys(share).map(c => ({ c: col[c], l: lab[c] })))}
        <div class="verdict ${saved > 0 ? 'good' : 'info'}">${saved > 0 ? (100 * saved / st.bill).toFixed(0) + '% lower bill — same workload.' : 'Tick actions to see savings.'}</div>
        <h4>Key takeaways</h4><ul class="insights"><li><b>CapEx</b> = pay upfront for assets; <b>OpEx</b> = pay as you go.</li><li><b>TCO</b> includes power, cooling, people and refresh — not just the price tag.</li><li>Cloud shines for variable, uncertain or fast-growing demand; owning can win at steady, high utilisation.</li><li>Cloud needs active cost management (FinOps) to stay cheap.</li><li>Always compare options with a like-for-like TCO model — then take the quiz!</li></ul>`;
      };
      bindCtl(el, st, () => draw(false));
      el.addEventListener('change', e => { const o = e.target.dataset && e.target.dataset.o; if (o) { on[o] = e.target.checked; draw(false); } });
      const setAll = v => { OPT.forEach(o => { on[o.id] = v; }); $$('[data-o]', el).forEach(c => { c.checked = v; }); draw(false); };
      $('#m9all', el).addEventListener('click', () => setAll(true)); $('#m9none', el).addEventListener('click', () => setAll(false));
      draw(true);
    } }
];

/* ============================== 7. VIEWS ================================= */

/* ---- Interactive TCO calculator ---- */
function calcView(el) {
  el.innerHTML = `<div class="view-h"><h2>Interactive TCO Calculator</h2><p>Compare owning a data center (CapEx-heavy) with using cloud services (OpEx). Change any assumption — every chart updates instantly. <b>All prices are illustrative estimates, not live AWS pricing.</b></p></div>
  <div class="calc"><aside class="panel ctls"><h4>Scenario preset</h4>${scnPills(App.scn)}<div id="cGroups">${CTRL.map(g => `<details class="grp" open><summary>${g.g}</summary>${g.items.map(i => ctl({ ...i, v: App.params[i.k] })).join('')}</details>`).join('')}</div><button class="btn ghost" id="cReset">↺ Reset to scenario</button></aside><section id="cOut"></section></div>`;
  let first = true;
  const out = $('#cOut', el);
  const render = () => {
    const p = App.params, r = calc(p), be = breakEvenUse(p), Y = p.years;
    const costPer = x => x / Math.max(1, p.servers * r.N);
    const ins = [];
    const big = ON_KEYS.reduce((a, k) => (r.cat[k] > r.cat[a] ? k : a), 'hardware');
    ins.push(`Biggest on-prem cost: <b>${CATS[big].l}</b> (${pct(r.cat[big], r.onTotal).toFixed(0)}% of on-prem TCO). Hardware alone is only ${pct(r.cat.hardware, r.onTotal).toFixed(0)}%.`);
    ins.push(`On-prem CapEx (hardware + network gear) is <b>${fmt(r.capexOn)}</b> paid in waves; cloud has <b>$0 upfront</b>.`);
    if (be.always) ins.push('Even running 100% of the time, cloud stays cheaper with these assumptions.');
    else if (be.never) ins.push('On-premises is cheaper even if cloud servers ran almost never — check your assumptions.');
    else ins.push(`Cloud stays cheaper while your servers run less than about <b>${be.use.toFixed(0)}%</b> of the time (currently ${p.cloudUse}%). Above that, owning wins.`);
    ins.push(`Average cost per server-equivalent per month: on-prem <b>${money(costPer(r.onTotal))}</b> vs cloud <b>${money(costPer(r.clTotal))}</b>.`);
    if (Y < p.hwLife) ins.push(`You model ${Y} year${Y > 1 ? 's' : ''} but hardware lasts ${p.hwLife}. This model charges the full purchase and ignores resale value, so on-prem looks pricier than it really is.`);
    const rows = Object.keys(CATS).map(k => ({ k, v: r.cat[k], side: CATS[k].side })).filter(x => x.v > 0).map(x => {
      const tot = x.side === 'on' ? r.onTotal : r.clTotal, ty = CATS[x.k].type;
      return `<tr><td><span class="dot" style="background:${CATS[x.k].c}"></span>${CATS[x.k].l}</td><td>${x.side === 'on' ? 'On-prem' : 'Cloud'}</td><td><span class="tag ${ty === 'CapEx' ? 'cap' : 'op'}">${ty === 'Mixed' ? 'CapEx+OpEx' : ty}</span></td><td class="r">${money(x.v)}</td><td class="r">${pct(x.v, tot).toFixed(1)}%</td></tr>`;
    }).join('');
    const ticks = []; const stepY = Y > 6 ? 2 : 1; for (let y = 0; y <= Y; y += stepY) ticks.push({ i: y * 12, l: 'Y' + y });
    const sv = Math.abs(r.diff);
    out.innerHTML = `<div class="cards4">
      <div class="stat" style="--c:var(--pri)"><div class="l">On-premises TCO</div><div class="v">${fmt(r.onTotal)}</div><div class="s">CapEx ${fmt(r.capexOn)} · OpEx ${fmt(r.opexOn)}</div></div>
      <div class="stat" style="--c:var(--good)"><div class="l">Cloud TCO</div><div class="v">${fmt(r.clTotal)}</div><div class="s">100% OpEx · usage-based</div></div>
      <div class="stat" style="--c:${r.cloudCheaper ? 'var(--good)' : 'var(--warn)'}"><div class="l">${r.cloudCheaper ? 'Cloud saves' : 'On-prem saves'}</div><div class="v">${fmt(sv)}</div><div class="s">${(100 * sv / (r.cloudCheaper ? r.onTotal : r.clTotal)).toFixed(0)}% over ${Y} year${Y > 1 ? 's' : ''}</div></div>
      <div class="stat" style="--c:var(--warn)"><div class="l">Cost crossover</div><div class="v">${r.cross ? 'Month ' + r.cross : 'None'}</div><div class="s">${r.cross ? 'cheaper option flips' : 'same option wins throughout'}</div></div></div>
    <div class="panel out-block"><h4>Total-cost comparison by category</h4>${Charts.stack({ rows: [{ label: 'On-premises', parts: ON_KEYS.map(k => ({ v: r.cat[k], c: CATS[k].c, l: CATS[k].l })) }, { label: 'Cloud', parts: CL_KEYS.map(k => ({ v: r.cat[k], c: CATS[k].c, l: CATS[k].l })) }], animate: first, label: 'Stacked total cost comparison' })}
      ${Charts.legend(Object.keys(CATS).filter(k => r.cat[k] > 0).map(k => ({ c: CATS[k].c, l: CATS[k].l })))}</div>
    <div class="cols out-block"><div class="panel"><h4>Cumulative spend over time</h4>${Charts.line({ series: [{ data: r.cumOn, c: '#4f8cff' }, { data: r.cumCl, c: '#22c55e' }], xTicks: ticks, xLabel: 'Years', marks: r.cross ? [{ i: r.cross, l: 'Crossover m' + r.cross }] : [], animate: first, label: 'Cumulative cost over time' })}${Charts.legend([{ c: '#4f8cff', l: 'On-premises (CapEx steps at refresh)' }, { c: '#22c55e', l: 'Cloud (OpEx)' }])}</div>
      <div class="panel"><h4>Where the money goes</h4><div class="grid2"><div class="donut-wrap">${Charts.donut({ parts: ON_KEYS.map(k => ({ v: r.cat[k], c: CATS[k].c, l: CATS[k].l })), top: 'On-prem', center: fmt(r.onTotal), label: 'On-premises breakdown' })}<span class="sub">On-premises</span></div><div class="donut-wrap">${Charts.donut({ parts: CL_KEYS.map(k => ({ v: r.cat[k], c: CATS[k].c, l: CATS[k].l })), top: 'Cloud', center: fmt(r.clTotal), label: 'Cloud breakdown' })}<span class="sub">Cloud</span></div></div>
      <p class="sub">Upfront vs recurring vs usage-based: on-prem <b>${(100 * r.capexOn / r.onTotal).toFixed(0)}%</b> upfront CapEx, <b>${(100 * r.opexOn / r.onTotal).toFixed(0)}%</b> recurring; cloud <b>100%</b> usage-based.</p></div></div>
    <div class="panel out-block"><h4>Insights</h4><ul class="insights">${ins.map(i => `<li>${i}</li>`).join('')}</ul>
      <div class="tech-only" style="margin-top:10px"><p class="sub">Technical detail: effective staffing = max(0.2, servers ÷ servers-per-admin) = <b>${r.fte.toFixed(2)} FTE</b>. Cooling = IT power × (PUE − 1). Cloud compute = servers × rate × 730 h × run% × (1 − discount). Storage grows ${p.growth}%/yr compounded monthly. No discounting (NPV), taxes or resale value.</p></div></div>
    <div class="panel out-block table-wrap"><h4>Cost breakdown</h4><table><thead><tr><th>Category</th><th>Model</th><th>Type</th><th class="r">${Y}-yr total</th><th class="r">Share of side</th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="sub">Simplified model with illustrative sample prices — not live AWS pricing and not financial advice.</p>`;
    first = false;
  };
  bindCtl(el, App.params, render);
  el.addEventListener('click', e => { if (e.target.id === 'cReset') { App.setScenario(App.scn); } });
  const sync = () => { $('.pills', el).outerHTML = scnPills(App.scn); syncCtl(el, App.params); first = true; render(); };
  App.onScenario.push(sync);
  render();
}

/* ---- Business decision simulator ---- */
const SIM = { months: 36, unitCapex: 1500, unitMonthly: 20, cloudUnit: 90, revenue: 200 };
const PATTERNS = {
  steady: { l: '🏦 Steady (payroll system)', f: m => 50 + [0, 2, -2, 1][m % 4], d: 'Demand is flat and predictable.' },
  growth: { l: '🌱 Fast growth (new app)', f: m => Math.round(20 + 100 * Math.pow(m / 35, 1.5)), d: 'Demand grows over three years — hard to forecast.' },
  seasonal: { l: '🛍 Seasonal (online store)', f: m => { const mm = m % 12; return mm === 10 ? 120 : mm === 11 ? 90 : mm === 9 ? 60 : 40; }, d: 'Big peaks every Oct–Dec, quiet the rest of the year.' },
  spiky: { l: '📣 Spiky (viral campaigns)', f: m => ({ 5: 100, 6: 80, 17: 110, 22: 90, 29: 120 }[m] || 30), d: 'Unpredictable bursts on a low baseline.' }
};
function simulate(pat, cap) {
  const d = Array.from({ length: SIM.months }, (_, m) => PATTERNS[pat].f(m)), S = SIM, sum = a => a.reduce((x, y) => x + y, 0);
  const served = sum(d.map(x => Math.min(x, cap))), lost = sum(d.map(x => Math.max(0, x - cap)));
  const buyCost = cap * S.unitCapex + cap * S.unitMonthly * S.months, cloudCost = sum(d) * S.cloudUnit;
  const buy = { cost: buyCost, rev: served * S.revenue, lost: lost * S.revenue }; buy.profit = buy.rev - buy.cost;
  const cloud = { cost: cloudCost, rev: sum(d) * S.revenue, lost: 0 }; cloud.profit = cloud.rev - cloud.cost;
  return { d, buy, cloud, util: pct(served, cap * S.months) };
}
function simView(el) {
  const st = { pat: 'seasonal', choice: 'buy', cap: 70 };
  const ADV = [
    { k: 'pred', l: 'How predictable is your demand?', o: [['Very predictable', -2], ['Somewhat', 0], ['Unpredictable / spiky', 2]] },
    { k: 'cash', l: 'Upfront cash available', o: [['Plenty', -1], ['Limited', 1], ['Very little', 2]] },
    { k: 'speed', l: 'How fast must you launch?', o: [['Months are fine', -1], ['A few weeks', 1], ['Days', 2]] },
    { k: 'team', l: 'In-house IT skills & staff', o: [['Strong data-center team', -1], ['Small team', 1], ['None', 2]] },
    { k: 'comp', l: 'Data control / compliance needs', o: [['Must stay on-premises', -2], ['Regulated, cloud-approved', 0], ['No special rules', 1]] }];
  const adv = {}; ADV.forEach(a => { adv[a.k] = 1; });
  el.innerHTML = `<div class="view-h"><h2>Business Decision Simulator</h2><p>You run a business for 36 months. Choose whether to <b>buy infrastructure</b> or <b>use cloud services</b>, then see profit, wasted capacity and lost sales. Illustrative economics: buying costs $1,500 + $20/month per capacity unit; cloud costs $90 per unit actually used; each served unit earns $200/month.</p></div>
  <div class="split"><div class="panel ctls"><h4>1 · Pick the workload</h4><select id="sPat" aria-label="Workload pattern">${Object.keys(PATTERNS).map(k => `<option value="${k}"${k === st.pat ? ' selected' : ''}>${PATTERNS[k].l}</option>`).join('')}</select><p class="sub" id="sPD" style="margin-top:6px"></p>
  <h4 style="margin-top:14px">2 · Make your decision</h4><div class="radios"><label><input type="radio" name="ch" value="buy" checked><span>🏢 Buy infrastructure</span></label><label><input type="radio" name="ch" value="cloud"><span>☁ Use cloud</span></label></div>
  <div id="capBox">${ctl({ k: 'cap', l: 'Capacity units to buy', min: 10, max: 200, step: 5, v: st.cap, tip: 'You must guess your capacity up front. Too low = lost sales. Too high = wasted money.' })}</div></div>
  <div class="panel" id="sOut"></div></div>
  <div class="panel" style="margin-top:16px"><h4>Decision advisor — which way does your situation lean?</h4><div class="grid3" id="advSel">${ADV.map(a => `<div><div class="sub" style="margin-bottom:4px">${a.l}</div><select data-a="${a.k}" aria-label="${esc(a.l)}">${a.o.map((o, i) => `<option value="${i}"${i === 1 ? ' selected' : ''}>${o[0]}</option>`).join('')}</select></div>`).join('')}</div><div id="advOut"></div></div>`;
  const out = $('#sOut', el), capBox = $('#capBox', el);
  const run = () => {
    $('#sPD', el).textContent = PATTERNS[st.pat].d;
    capBox.style.display = st.choice === 'buy' ? '' : 'none';
    const r = simulate(st.pat, st.cap), me = r[st.choice], other = r[st.choice === 'buy' ? 'cloud' : 'buy'];
    const best = (() => { let b = 10, bp = -1e12; for (let c = 10; c <= 200; c += 5) { const p = simulate(st.pat, c).buy.profit; if (p > bp) { bp = p; b = c; } } return { c: b, p: bp }; })();
    const diff = me.profit - other.profit, d = r.d, N = d.length, xt = [0, 12, 24, 35].map(i => ({ i, l: 'M' + (i + 1) }));
    const cap = st.choice === 'buy' ? d.map(() => st.cap) : d.slice();
    const card = (t, o, mine) => `<div class="stat" style="--c:${mine ? 'var(--acc)' : 'var(--line)'}"><div class="l">${t}${mine ? '<span class="badge-you">YOUR CHOICE</span>' : ''}</div><div class="v" style="color:${o.profit >= 0 ? 'var(--good)' : 'var(--bad)'}">${fmt(o.profit)}</div><div class="s">Profit · cost ${fmt(o.cost)} · revenue ${fmt(o.rev)}${o.lost ? ' · <span style="color:var(--bad)">lost sales ' + fmt(o.lost) + '</span>' : ''}</div></div>`;
    out.innerHTML = `<h4>3 · Results after 36 months</h4><div class="grid2">${card('Buy', r.buy, st.choice === 'buy')}${card('Cloud', r.cloud, st.choice === 'cloud')}</div>
    <div class="verdict ${diff >= 0 ? 'good' : 'warn'}">${diff >= 0 ? '✔ Good call! Your choice made ' + money(diff) + ' more profit.' : '✖ The other option would have earned ' + money(-diff) + ' more.'}</div>
    ${Charts.line({ series: [{ data: d, c: '#22c55e' }, { data: cap, c: '#4f8cff', dash: '6 4' }], xTicks: xt, xLabel: 'Month', yFmt: v => Math.round(v), label: 'Demand versus capacity' })}${Charts.legend([{ c: '#22c55e', l: 'Customer demand (units)' }, { c: '#4f8cff', l: st.choice === 'buy' ? 'Your owned capacity' : 'Cloud capacity (follows demand)' }])}
    <ul class="insights"><li>${st.choice === 'buy' ? 'Capacity utilisation: <b>' + r.util.toFixed(0) + '%</b> — you pay for all ' + st.cap + ' units whether used or not.' : 'You paid only for what was used: no idle capacity, no lost sales.'}</li>
    <li>Best capacity to <i>buy</i> for this workload was <b>${best.c} units</b> (profit ${fmt(best.p)}) — hard to know in advance!</li>
    <li>${st.pat === 'steady' ? 'Steady demand lets owned hardware run at high utilisation, so buying is competitive.' : 'Variable demand makes fixed capacity wasteful or insufficient — cloud elasticity pays off.'}</li></ul>`;
  };
  $('#sPat', el).addEventListener('change', e => { st.pat = e.target.value; run(); });
  $$('input[name=ch]', el).forEach(r => r.addEventListener('change', e => { st.choice = e.target.value; run(); }));
  bindCtl(capBox, st, run);
  const advRun = () => {
    const score = ADV.reduce((a, q) => a + q.o[adv[q.k]][1], 0), pos = clamp(50 + score * 6, 5, 95);
    const msg = score >= 3 ? ['info', '☁ Leans Cloud — flexibility, speed and low upfront cost fit your situation.'] : score <= -3 ? ['warn', '🏢 Leans On-premises — predictability and control matter most.'] : ['good', '⚖ Hybrid / mixed — steady baseload on owned hardware, bursts and new projects in the cloud.'];
    $('#advOut', el).innerHTML = `<div class="meter-bar"><i style="left:${pos}%"></i></div><div class="meter-l"><span>On-premises</span><span>Hybrid</span><span>Cloud</span></div><div class="verdict ${msg[0]}">${msg[1]}</div><p class="sub">A simple rule-of-thumb scorer for learning — real decisions need a full TCO and risk analysis.</p>`;
  };
  $('#advSel', el).addEventListener('change', e => { const k = e.target.dataset.a; if (k) { adv[k] = parseInt(e.target.value, 10); advRun(); } });
  run(); advRun();
}

/* ---- AWS Lab ---- */
const AWSP = { ec2: 0.096, s3: 0.023, rdsH: 0.17, rdsGB: 0.115, lamReq: 0.2, lamGBs: 0.0000166667, cwMetric: 0.3, cwLog: 0.5 };
function awsView(el) {
  const a = { ec2n: 4, ec2h: 400, s3: 2000, rdsh: 730, rdsgb: 200, lreq: 20, lms: 200, lmem: 0.5, cwm: 50, cwlog: 20 };
  const svc = [
    { id: 'ec2', n: 'Amazon EC2', t: 'Virtual servers', c: '#22c55e', model: 'Pay per hour/second the instance runs', onprem: 'A physical server you buy (CapEx)', key: 'ec2', ctl: [{ k: 'ec2n', l: 'Instances', min: 1, max: 100, step: 1 }, { k: 'ec2h', l: 'Hours per instance / month', min: 1, max: 730, step: 1, suf: 'h', tip: '730 hours ≈ always on for a month.' }] },
    { id: 's3', n: 'Amazon S3', t: 'Object storage', c: '#14b8a6', model: 'Pay per GB stored per month (+ requests, transfer)', onprem: 'A storage array or NAS (CapEx)', key: 's3', ctl: [{ k: 's3', l: 'Data stored', min: 0, max: 100000, step: 100, suf: 'GB' }] },
    { id: 'rds', n: 'Amazon RDS', t: 'Managed database', c: '#4f8cff', model: 'Pay per instance-hour + GB-month storage', onprem: 'DB server + licences + a DBA (CapEx + staff)', key: 'rds', ctl: [{ k: 'rdsh', l: 'Database hours / month', min: 1, max: 730, step: 1, suf: 'h' }, { k: 'rdsgb', l: 'Database storage', min: 10, max: 5000, step: 10, suf: 'GB' }] },
    { id: 'lambda', n: 'AWS Lambda', t: 'Serverless functions', c: '#f59e0b', model: 'Pay per request + GB-seconds while code runs', onprem: 'An always-on app server (CapEx + power)', key: 'lambda', ctl: [{ k: 'lreq', l: 'Requests / month', min: 0, max: 500, step: 1, suf: 'M' }, { k: 'lms', l: 'Avg duration', min: 10, max: 3000, step: 10, suf: 'ms' }, { k: 'lmem', l: 'Memory', min: 0.125, max: 4, step: 0.125, suf: 'GB' }] },
    { id: 'cw', n: 'Amazon CloudWatch', t: 'Monitoring & logs', c: '#ec4899', model: 'Pay per custom metric + GB of logs ingested', onprem: 'A monitoring server + software licence', key: 'cw', ctl: [{ k: 'cwm', l: 'Custom metrics', min: 0, max: 2000, step: 10 }, { k: 'cwlog', l: 'Logs ingested / month', min: 0, max: 2000, step: 5, suf: 'GB' }] }];
  const cost = () => ({
    ec2: a.ec2n * a.ec2h * AWSP.ec2, s3: a.s3 * AWSP.s3, rds: a.rdsh * AWSP.rdsH + a.rdsgb * AWSP.rdsGB,
    lambda: a.lreq * AWSP.lamReq + a.lreq * 1e6 * (a.lms / 1000) * a.lmem * AWSP.lamGBs, cw: a.cwm * AWSP.cwMetric + a.cwlog * AWSP.cwLog });
  const detail = { ec2: ['Rent a server by the hour; stop it and billing stops.', 'On-Demand per-second billing; Savings Plans/RIs up to large discounts for commitments; Spot for fault-tolerant work.'], s3: ['Store files and backups; pay for the GB you keep.', 'Storage classes + lifecycle rules reduce $/GB; requests and egress billed separately.'], rds: ['A database where AWS handles patching and backups.', 'Instance-hour + storage + I/O + backup; Multi-AZ roughly doubles instance cost for availability.'], lambda: ['Run code only when needed — nothing to pay when idle.', 'Cost = requests × price + (duration × memory) GB-seconds × price.'], cw: ['Dashboards, alarms and logs so you can see what is happening.', 'Costs scale with metrics, log ingestion/retention and alarms — a classic "surprise" bill line.'] };
  el.innerHTML = `<div class="view-h"><h2>AWS Lab — Practical OpEx Examples</h2><p>Five core AWS services and how each is billed. Adjust usage and watch the monthly bill respond. <b>Sample prices are illustrative estimates, not live AWS pricing</b> (and ignore free tiers) — use the official AWS Pricing Calculator for real quotes.</p></div>
  <div class="aws-grid">${svc.map(s => `<div class="svc" style="--c:${s.c}"><header><div><h4>${termify('{{' + (s.id === 'cw' ? 'cloudwatch' : s.id) + '|' + s.n + '}}')}</h4><span class="sub">${s.t}</span></div><span class="badge">usage-based</span></header>
  <div class="cost" data-cost="${s.key}">$0</div><p class="meta"><b>Billed:</b> ${s.model}<br><b>On-prem equivalent:</b> ${s.onprem}</p><p class="meta beginner-only">${detail[s.id][0]}</p><p class="meta tech-only">${detail[s.id][1]}</p>
  ${s.ctl.map(c => ctl({ ...c, v: a[c.k] })).join('')}</div>`).join('')}</div>
  <div class="panel"><h4>Estimated monthly AWS bill (illustrative)</h4><div class="grid2"><div><div class="sub">Per month</div><div class="big" id="awsM">$0</div></div><div><div class="sub">Per year</div><div class="big" id="awsY" style="color:var(--good)">$0</div></div></div><div id="awsChart"></div><p class="sub">Notice: no upfront purchase — every dollar is OpEx and rises or falls with usage. Set EC2 hours to 0 and the EC2 line disappears.</p></div>`;
  const upd = () => {
    const c = cost(), tot = Object.values(c).reduce((x, y) => x + y, 0);
    $$('[data-cost]', el).forEach(n => { n.textContent = '$' + c[n.dataset.cost].toFixed(2); });
    $('#awsM', el).textContent = money(tot); $('#awsY', el).textContent = money(tot * 12);
    $('#awsChart', el).innerHTML = Charts.stack({ rows: [{ label: 'Monthly', parts: svc.map(s => ({ v: c[s.key], c: s.c, l: s.n })) }], label: 'AWS bill by service' }) + Charts.legend(svc.map(s => ({ c: s.c, l: s.n })));
  };
  bindCtl(el, a, upd); upd();
}

/* ---- Glossary ---- */
function glossaryView(el) {
  el.innerHTML = `<div class="view-h"><h2>Glossary</h2><p>Key terms in plain language. In Technical mode each entry also shows the detailed definition.</p></div><input type="search" id="glQ" placeholder="Search terms…" aria-label="Search glossary"><div class="gl-grid" id="glList"></div>`;
  const keys = Object.keys(GLOSSARY).sort((x, y) => GLOSSARY[x].t.localeCompare(GLOSSARY[y].t));
  const draw = q => {
    q = (q || '').toLowerCase().trim();
    const list = keys.filter(k => !q || (GLOSSARY[k].t + ' ' + GLOSSARY[k].s + ' ' + GLOSSARY[k].d).toLowerCase().includes(q));
    $('#glList', el).innerHTML = list.length ? list.map(k => `<div class="gl"><h4>${esc(GLOSSARY[k].t)}</h4><p>${esc(GLOSSARY[k].d)}</p><p class="sub tech-only">${esc(GLOSSARY[k].x)}</p></div>`).join('') : '<p class="sub">No matching terms.</p>';
  };
  $('#glQ', el).addEventListener('input', e => draw(e.target.value)); draw('');
}

/* ---- Quiz ---- */
const QUIZ = [
  { q: 'Which statement best describes CapEx?', o: ['A monthly subscription that follows usage', 'Large upfront spending on long-lasting assets such as servers', 'Daily electricity and wages', 'A discount for committing to cloud usage'], a: 1, why: 'CapEx is money spent up front on assets that last for years (servers, network gear), then depreciated over their life.' },
  { q: 'Pay-as-you-go cloud billing is mostly treated as…', o: ['CapEx', 'Depreciation', 'OpEx', 'Residual value'], a: 2, why: 'Metered cloud usage is an operating expense: you pay as you consume and the cost lands in the period used.' },
  { q: 'Which is part of Total Cost of Ownership (TCO) for an on-premises server room?', o: ['Only the purchase price of the servers', 'Hardware, software, power, cooling, maintenance and staff', 'Only electricity', 'Only the cloud provider\u2019s bill'], a: 1, why: 'TCO counts every cost over the asset\u2019s life, not just the price tag — people, power and cooling are often large.' },
  { q: 'Which workload benefits MOST from cloud elasticity?', o: ['A perfectly flat, always-on workload at 95% utilisation', 'An online store with huge, unpredictable traffic peaks', 'A server that is switched off permanently', 'A workload that never changes size'], a: 1, why: 'Spiky demand makes owned hardware either idle (wasted money) or overloaded (lost sales); elastic capacity follows the peaks.' },
  { q: 'Which AWS service charges per request and execution time, with no cost while idle?', o: ['Amazon EC2 On-Demand', 'Amazon RDS Multi-AZ', 'AWS Lambda', 'A purchased physical server'], a: 2, why: 'Lambda bills for requests and GB-seconds of execution only — nothing when your code is not running.' }
];
function quizView(el) {
  let i = 0, score = 0, done = false;
  const best = () => store.get('best', 0);
  const render = () => {
    if (i >= QUIZ.length) {
      if (score > best()) store.set('best', score);
      const msg = score === 5 ? '🏆 Perfect — you\u2019re a cloud economist!' : score >= 3 ? '👍 Nice work — review the modules you missed.' : '📚 Keep going — revisit the Learn section and try again.';
      el.innerHTML = `<div class="quiz panel"><div class="score-ring">${score} / ${QUIZ.length}</div><p style="text-align:center;font-size:1.1rem">${msg}</p><p class="sub" style="text-align:center">Best score: ${best()} / ${QUIZ.length}</p><div style="display:flex;gap:10px;justify-content:center"><button class="btn" id="qRe">Try again</button><button class="btn ghost" id="qLearn">Back to lessons</button></div></div>`;
      $('#qRe', el).onclick = () => { i = 0; score = 0; render(); }; $('#qLearn', el).onclick = () => App.go('learn', 0); return;
    }
    done = false; const q = QUIZ[i];
    el.innerHTML = `<div class="view-h"><h2>Knowledge Quiz</h2></div><div class="quiz panel"><div class="q-meta"><span>Question ${i + 1} of ${QUIZ.length}</span><span>Score: ${score}</span></div><div class="progress"><i style="width:${(i / QUIZ.length) * 100}%"></i></div><div class="q-text">${esc(q.q)}</div>
    ${q.o.map((o, n) => `<button class="opt" data-n="${n}">${String.fromCharCode(65 + n)}. ${esc(o)}</button>`).join('')}<div id="qFb"></div></div>`;
    $$('.opt', el).forEach(b => b.addEventListener('click', () => {
      if (done) return; done = true; const n = parseInt(b.dataset.n, 10), ok = n === q.a; if (ok) score++;
      $$('.opt', el).forEach(x => { x.disabled = true; const m = parseInt(x.dataset.n, 10); if (m === q.a) x.classList.add('right'); else if (m === n) x.classList.add('wrong'); });
      $('#qFb', el).innerHTML = `<div class="feedback ${ok ? 'ok' : 'no'}"><b>${ok ? '✔ Correct!' : '✖ Not quite.'}</b> ${esc(q.why)}</div><button class="btn" id="qNext">${i === QUIZ.length - 1 ? 'See results' : 'Next question →'}</button>`;
      $('#qNext', el).onclick = () => { i++; render(); };
    }));
  };
  render();
}

/* ---- Learn view (sidebar + step content) ---- */
const Learn = {
  visited: store.get('visited', []),
  init() {
    this.list = $('#stepList'); this.content = $('#stepContent'); this.cleanups = [];
    this.list.addEventListener('click', e => { const b = e.target.closest('.step-btn'); if (b) App.go('learn', parseInt(b.dataset.i, 10)); });
  },
  drawList() {
    const n = MODULES.length, doneN = this.visited.length;
    this.list.innerHTML = `<h3>Learning path</h3><div class="progress" aria-label="Progress"><i style="width:${(doneN / n) * 100}%"></i></div><div class="sub" style="margin:-4px 0 8px">${doneN} of ${n} steps visited</div><div class="list">${MODULES.map((m, i) =>
      `<button class="step-btn${i === App.step ? ' on' : ''}${this.visited.includes(i) ? ' done' : ''}" data-i="${i}" ${i === App.step ? 'aria-current="step"' : ''}><span class="n">${this.visited.includes(i) ? '✓' : i + 1}</span><span class="t">${esc(m.title)}</span></button>`).join('')}</div>`;
  },
  show(i) {
    this.cleanups.forEach(f => { try { f(); } catch (e) { /* ignore */ } }); this.cleanups = [];
    i = clamp(i, 0, MODULES.length - 1); App.step = i;
    if (!this.visited.includes(i)) { this.visited.push(i); store.set('visited', this.visited); }
    const M = MODULES[i], P = a => a.map(t => `<p>${termify(t)}</p>`).join('');
    this.content.innerHTML = `<header class="step-h"><span class="step-n">Step ${i + 1} of ${MODULES.length}</span><h2>${esc(M.title)}</h2><p class="obj">${esc(M.obj)}</p></header>
      <div class="explain"><div class="beginner-only">${P(M.beginner)}</div><div class="tech-only">${P(M.technical)}</div></div>
      <div class="card viz" id="viz"></div>
      <div class="points">${M.points.map(p => `<div class="point">${esc(p)}</div>`).join('')}</div>
      <div class="try">💡 <b>Try it:</b> ${esc(M.tryIt)}</div>
      <nav class="step-nav"><button class="btn ghost" id="prevB" ${i === 0 ? 'disabled' : ''}>← Previous</button>${i === MODULES.length - 1 ? '<button class="btn" id="quizB">Take the quiz →</button>' : '<button class="btn" id="nextB">Next →</button>'}</nav>`;
    const ctx = { cleanup: f => this.cleanups.push(f) };
    M.mount($('#viz', this.content), ctx);
    $('#prevB', this.content).onclick = () => App.go('learn', i - 1);
    const nx = $('#nextB', this.content); if (nx) nx.onclick = () => App.go('learn', i + 1);
    const qb = $('#quizB', this.content); if (qb) qb.onclick = () => App.go('quiz');
    this.drawList();
  }
};

/* ============================== 8. APP =================================== */
const App = {
  params: { ...SCENARIOS.small.p }, scn: 'small', view: 'learn', step: 0, mounted: {}, onScenario: [],
  setScenario(k) {
    if (!SCENARIOS[k]) return;
    this.scn = k;
    Object.keys(this.params).forEach(x => delete this.params[x]);
    Object.assign(this.params, SCENARIOS[k].p);
    this.onScenario.forEach(f => { try { f(); } catch (e) { /* ignore */ } });
  },
  go(view, step) {
    Tip.hide();
    this.view = view;
    $$('.view').forEach(v => { v.hidden = v.id !== 'view-' + view; });
    $$('#mainNav button').forEach(b => b.classList.toggle('on', b.dataset.view === view));
    const el = $('#view-' + view);
    if (view === 'learn') {
      Learn.show(step === undefined ? this.step : step);
      this.setHash('learn/' + (this.step + 1));
    } else {
      if (!this.mounted[view]) { ({ calculator: calcView, simulator: simView, aws: awsView, glossary: glossaryView, quiz: quizView })[view](el); this.mounted[view] = true; }
      this.setHash(view);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  },
  setHash(h) { this.ignoreHash = true; try { location.hash = h; } catch (e) { /* ignore */ } setTimeout(() => { this.ignoreHash = false; }, 0); },
  fromHash() {
    const h = (location.hash || '').replace('#', '').split('/');
    if (h[0] === 'learn') { const n = parseInt(h[1], 10); this.go('learn', isNaN(n) ? 0 : n - 1); }
    else if (['calculator', 'simulator', 'aws', 'glossary', 'quiz'].includes(h[0])) this.go(h[0]);
    else this.go('learn', 0);
  },
  init() {
    Tip.init(); Learn.init();
    const mode = store.get('mode', 'beginner'), theme = store.get('theme', 'dark');
    this.setMode(mode); document.documentElement.dataset.theme = theme;
    $('#mainNav').addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.go(b.dataset.view, b.dataset.view === 'learn' ? this.step : undefined); });
    $('#modeToggle').addEventListener('click', e => { const b = e.target.closest('button'); if (b) this.setMode(b.dataset.mode); });
    $('#themeBtn').addEventListener('click', () => {
      const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = t; store.set('theme', t);
    });
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-scn]'); if (b) this.setScenario(b.dataset.scn);
    });
    window.addEventListener('hashchange', () => { if (!this.ignoreHash) this.fromHash(); });
    this.fromHash();
  },
  setMode(m) {
    document.body.dataset.mode = m; store.set('mode', m);
    $$('#modeToggle button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  }
};

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => App.init());
  else App.init();
}
if (typeof module !== 'undefined' && module.exports) module.exports = { calc, breakEvenUse, simulate, SCENARIOS, BASE, MODULES };
