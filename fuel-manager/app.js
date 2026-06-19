// ============================================================
// Serbatoio — Gestione Benzina (vanilla JS)
// Input minimale, costi 100% derivati da un serbatoio FIFO.
// ============================================================

const STORAGE_KEY = 'serbatoio-v2';
const API = '/api/data';
const DRIVER = 'Luca';
const CONSUMO_DEFAULT = 6.7;

// ---------- State ----------
function emptyState() {
  return { persone: [DRIVER], tragitti: [], rifornimenti: [], restituzioni: [] };
}

function normalize(s) {
  s = s || {};
  const out = {
    persone: Array.isArray(s.persone) ? s.persone.slice() : [DRIVER],
    tragitti: Array.isArray(s.tragitti) ? s.tragitti : [],
    rifornimenti: Array.isArray(s.rifornimenti) ? s.rifornimenti : [],
    restituzioni: Array.isArray(s.restituzioni) ? s.restituzioni : [],
  };
  // migrazione dal vecchio schema "benzina"
  if (!s.rifornimenti && Array.isArray(s.benzina)) {
    out.rifornimenti = s.benzina.map((b, i) => ({
      id: b.id || i + 1, data: b.data,
      importo: b.spesa, costo: b.costoCarburante,
    }));
  }
  // tragitti: garantisci campi base
  out.tragitti = out.tragitti.map((t, i) => ({
    id: t.id || i + 1,
    data: t.data,
    km: +t.km || 0,
    consumo: +t.consumo || 0,
    partecipanti: Array.isArray(t.partecipanti) && t.partecipanti.length
      ? t.partecipanti
      : (Array.isArray(t.personeNomi) ? t.personeNomi : [DRIVER]),
    costiAgg: +t.costiAgg || 0,
  }));
  if (!out.persone.includes(DRIVER)) out.persone.unshift(DRIVER);
  return out;
}

let state = normalize(loadLocal());

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return emptyState();
}

async function apiGet() {
  try { const r = await fetch(API); if (r.ok) return await r.json(); } catch (e) {}
  return null;
}

async function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  try {
    await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
  } catch (e) { toast('Salvato solo in locale'); }
}

// ============================================================
// MOTORE FIFO  —  cuore dei calcoli
// ============================================================
// Ogni rifornimento immette litri nel serbatoio a un prezzo.
// Ogni tragitto consuma litri = km/100 * consumo, prelevati FIFO
// (prima il carburante più vecchio). Se il serbatoio è vuoto i
// litri restano "in prestito" e vengono prezzati al rifornimento
// successivo (backorder). Il costo di ogni tragitto emerge da qui.
function compute() {
  const trips = state.tragitti.map(t => ({
    ...t,
    litri: (t.km / 100) * t.consumo,
    fuelCost: 0,
    coperto: 0,        // litri già prezzati
  }));
  const refuels = state.rifornimenti.map(r => ({
    ...r,
    litri: r.costo > 0 ? r.importo / r.costo : 0,
  }));

  const events = [];
  refuels.forEach(r => events.push({ d: r.data || '', k: 0, o: r }));
  trips.forEach(t => events.push({ d: t.data || '', k: 1, o: t }));
  // ordine cronologico; a parità di data il rifornimento precede il tragitto
  events.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : a.k - b.k));

  const lots = [];     // { litri, prezzo }  carburante disponibile
  const borrow = [];   // { trip, litri }    litri in prestito da prezzare

  for (const ev of events) {
    if (ev.k === 0) {
      let litri = ev.o.litri, prezzo = ev.o.costo;
      // ripaga prima i prestiti più vecchi
      while (litri > 1e-9 && borrow.length) {
        const b = borrow[0];
        const take = Math.min(litri, b.litri);
        b.trip.fuelCost += take * prezzo;
        b.trip.coperto += take;
        b.litri -= take; litri -= take;
        if (b.litri <= 1e-9) borrow.shift();
      }
      if (litri > 1e-9) lots.push({ litri, prezzo });
    } else {
      const t = ev.o;
      let need = t.litri;
      while (need > 1e-9 && lots.length) {
        const lot = lots[0];
        const take = Math.min(need, lot.litri);
        t.fuelCost += take * lot.prezzo;
        t.coperto += take;
        lot.litri -= take; need -= take;
        if (lot.litri <= 1e-9) lots.shift();
      }
      if (need > 1e-9) borrow.push({ trip: t, litri: need });
    }
  }

  // finalizza i totali di ogni tragitto + quota di ogni partecipante
  // (split equo, oppure pesato se il tragitto ha `pesi`)
  trips.forEach(t => {
    t.scoperto = Math.max(0, t.litri - t.coperto);
    t.inPrestito = t.scoperto > 1e-6;
    t.totale = t.fuelCost + t.costiAgg;
    const n = t.partecipanti.length || 1;
    t.totaleTesta = t.totale / n;
    t.coeffKm = t.km > 0 ? t.totale / t.km : 0;
    t.quote = {};
    if (t.pesi) {
      const sum = Object.values(t.pesi).reduce((s, w) => s + w, 0) || 1;
      t.partecipanti.forEach(p => { t.quote[p] = t.totale * (t.pesi[p] || 0) / sum; });
    } else {
      t.partecipanti.forEach(p => { t.quote[p] = t.totale / n; });
    }
  });

  // stato serbatoio
  const tankAvail = lots.reduce((s, l) => s + l.litri, 0);
  const tankAvailValue = lots.reduce((s, l) => s + l.litri * l.prezzo, 0);
  const tankOwed = borrow.reduce((s, b) => s + b.litri, 0);

  // totali / medie pesate (come nel foglio Excel)
  const totKm = trips.reduce((s, t) => s + t.km, 0);
  const litriCons = trips.reduce((s, t) => s + t.litri, 0);
  const spesaBenzina = refuels.reduce((s, r) => s + r.importo, 0);
  const litriBuy = refuels.reduce((s, r) => s + r.litri, 0);
  const consumoPesato = totKm > 0
    ? trips.reduce((s, t) => s + t.consumo * t.km, 0) / totKm : 0;
  const prezzoPesato = spesaBenzina > 0
    ? refuels.reduce((s, r) => s + r.costo * r.importo, 0) / spesaBenzina : 0;
  const costoCarburanteTot = trips.reduce((s, t) => s + t.fuelCost, 0);
  const costoPerKm = totKm > 0
    ? trips.reduce((s, t) => s + t.totale, 0) / totKm : 0;

  // saldi + storico per persona (quote tragitti − restituzioni)
  const saldi = {};
  const detail = {};
  state.persone.forEach(p => { saldi[p] = 0; detail[p] = { addebito: 0, restituito: 0, km: 0, tragitti: [], restituzioni: [] }; });
  const ensure = p => { if (!(p in saldi)) { saldi[p] = 0; detail[p] = { addebito: 0, restituito: 0, km: 0, tragitti: [], restituzioni: [] }; } };
  trips.forEach(t => {
    t.partecipanti.forEach(p => {
      ensure(p);
      const q = t.quote[p] || 0;
      saldi[p] += q;
      detail[p].addebito += q;
      detail[p].km += t.km;
      detail[p].tragitti.push({ data: t.data, km: t.km, quota: q, inPrestito: t.inPrestito, pax: t.partecipanti.length });
    });
  });
  state.restituzioni.forEach(q => {
    Object.entries(q.dettaglio || {}).forEach(([p, v]) => {
      ensure(p);
      saldi[p] -= v;
      detail[p].restituito += v;
      detail[p].restituzioni.push({ data: q.data, importo: v });
    });
  });

  return {
    trips, refuels,
    tank: { avail: tankAvail, availValue: tankAvailValue, owed: tankOwed, net: tankAvail - tankOwed },
    totals: { totKm, litriCons, spesaBenzina, litriBuy, consumoPesato, prezzoPesato, costoCarburanteTot, costoPerKm },
    saldi, detail,
  };
}

// prezzo FIFO corrente stimato (per anteprima nuovi tragitti)
function prezzoCorrente(d) {
  const t = state.tragitti.reduce((s, x) => s + (x.km / 100) * x.consumo, 0);
  const r = [...state.rifornimenti]
    .filter(x => x.costo > 0)
    .sort((a, b) => (a.data < b.data ? -1 : 1));
  if (!r.length) return 0;
  return r[r.length - 1].costo; // ultimo prezzo noto: stima ragionevole
}

// ---------- Format ----------
const euro = n => '€ ' + (Math.round((n || 0) * 100) / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num = (n, d = 1) => (n || 0).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d });
const lit = n => num(n, 1) + ' l';
function fmtDate(d) {
  if (!d) return '';
  const [y, m, g] = d.split('-');
  return `${g}/${m}/${y.slice(2)}`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastT;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), 2200);
}

// ============================================================
// RENDER
// ============================================================
function renderDashboard(c) {
  const tank = c.tank;
  const head = document.getElementById('tank-headline');
  const head2 = document.getElementById('tank-headline-2');
  const sub = document.getElementById('tank-sub');
  if (tank.owed > 0.05) {
    head.innerHTML = `<span class="neg">${num(tank.owed, 1)}</span> <small>l in prestito</small>`;
    head2.innerHTML = `<span class="neg">${euro(tank.owed * prezzoCorrente())}</span> <small>da pagare</small>`;
    sub.textContent = 'Carburante guidato e non ancora coperto da un rifornimento. Verrà prezzato al prossimo pieno.';
  } else if (tank.avail > 0.05) {
    head.innerHTML = `<span class="pos">${num(tank.avail, 1)}</span> <small>l disponibili</small>`;
    head2.innerHTML = `<span class="pos">${euro(tank.availValue)}</span> <small>valore residuo</small>`;
    sub.textContent = 'Carburante pagato non ancora consumato.';
  } else {
    head.innerHTML = `<span>0,0</span> <small>l</small>`;
    head2.innerHTML = '';
    sub.textContent = 'Serbatoio in pari: tutto il carburante comprato è stato consumato.';
  }

  // controvalore: disponibile vs in prestito (stimato al prezzo corrente)
  const prezzoStima = prezzoCorrente();
  const owedValue = tank.owed * prezzoStima;
  const netValue = tank.availValue - owedValue;
  const tankStats = [
    { l: 'Disponibile', v: euro(tank.availValue), cls: 'pos' },
    { l: 'In prestito', v: tank.owed > 0.05 ? euro(owedValue) : euro(0), cls: tank.owed > 0.05 ? 'neg' : '' },
    { l: 'Controvalore netto', v: euro(netValue), cls: netValue < 0 ? 'neg' : 'pos' },
  ];
  document.getElementById('tank-stats').innerHTML = tankStats.map((s, i) => `
    <div class="tank-stat" style="--i:${i}">
      <span class="tank-stat-label">${s.l}</span>
      <span class="tank-stat-value ${s.cls}">${s.v}</span>
    </div>`).join('');

  const T = c.totals;
  const lastRefuel = [...c.refuels].sort((a, b) => (a.data < b.data ? 1 : -1))[0];
  const lastTrip = [...c.trips].sort((a, b) => (a.data < b.data ? 1 : -1))[0];
  const partecipantiUnici = new Set(c.trips.flatMap(t => t.partecipanti));
  const avgKmTragitto = c.trips.length ? T.totKm / c.trips.length : 0;
  const giorniDaUltimo = lastRefuel ? Math.round((new Date(todayISO()) - new Date(lastRefuel.data)) / 86400000) : null;

  const metrics = [
    { l: 'Km totali', v: num(T.totKm, 0), u: 'km' },
    { l: 'Speso in benzina', v: euro(T.spesaBenzina), u: '' },
    { l: 'Consumo medio', v: num(T.consumoPesato, 1), u: 'l/100km' },
    { l: 'Prezzo medio', v: num(T.prezzoPesato, 3), u: '€/l' },
    { l: 'Costo per km', v: euro(T.costoPerKm), u: '/km' },
    { l: 'Tragitti', v: num(c.trips.length, 0), u: '' },
    { l: 'Km medi a tragitto', v: num(avgKmTragitto, 0), u: 'km' },
    { l: 'Persone coinvolte', v: num(partecipantiUnici.size, 0), u: '' },
    { l: 'Ultimo pieno', v: lastRefuel ? num(lastRefuel.costo, 3) : '—', u: lastRefuel ? '€/l' : '' },
    { l: 'Giorni dall\'ultimo pieno', v: giorniDaUltimo === null ? '—' : num(giorniDaUltimo, 0), u: giorniDaUltimo === null ? '' : 'gg' },
  ];
  document.getElementById('dash-metrics').innerHTML = metrics.map((m, i) => `
    <div class="metric" style="--i:${i}">
      <span class="metric-label">${m.l}</span>
      <span class="metric-value">${m.v}${m.u ? `<span class="metric-unit">${m.u}</span>` : ''}</span>
    </div>`).join('');

  // chi ti deve (saldo positivo), escluso il guidatore
  const debs = Object.entries(c.saldi)
    .filter(([p, v]) => p !== DRIVER && v > 0.01)
    .sort((a, b) => b[1] - a[1]);
  const totOwed = debs.reduce((s, [, v]) => s + v, 0);
  document.getElementById('owed-total').textContent = euro(totOwed);
  renderLedger(document.getElementById('dash-saldi'), debs.slice(0, 6), totOwed);

  renderTrend(c);
  renderRecent(lastTrip, lastRefuel);
}

// andamento mensile: spesa totale (tragitti) per mese, ultimi 6 mesi con dati
function renderTrend(c) {
  const byMonth = {};
  c.trips.forEach(t => {
    if (!t.data) return;
    const m = t.data.slice(0, 7); // YYYY-MM
    byMonth[m] = (byMonth[m] || 0) + t.totale;
  });
  const months = Object.keys(byMonth).sort().slice(-6);
  const el = document.getElementById('dash-trend');
  const totalEl = document.getElementById('trend-total');
  if (!months.length) {
    el.innerHTML = `<p class="empty">Nessun dato ancora per un andamento mensile.</p>`;
    totalEl.textContent = '—';
    return;
  }
  const totMonths = months.reduce((s, m) => s + byMonth[m], 0);
  totalEl.textContent = euro(totMonths);
  const top = Math.max(...months.map(m => byMonth[m]), 1);
  el.innerHTML = months.map((m, i) => {
    const [y, mo] = m.split('-');
    const label = new Date(+y, +mo - 1, 1).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' });
    return `
    <div class="trend-row" style="--i:${i}">
      <span class="trend-label">${label}</span>
      <span class="trend-bar"><span style="width:${Math.max(4, (byMonth[m] / top) * 100)}%"></span></span>
      <span class="trend-amt">${euro(byMonth[m])}</span>
    </div>`;
  }).join('');
}

// ultimo tragitto / ultimo rifornimento, affiancati
function renderRecent(lastTrip, lastRefuel) {
  const el = document.getElementById('dash-recent');
  const cards = [];
  cards.push(lastTrip ? `
    <div class="recent-card">
      <span class="recent-label">Ultimo tragitto</span>
      <span class="recent-date">${fmtDate(lastTrip.data)}</span>
      <span class="recent-info">${num(lastTrip.km, 0)} km · ${lastTrip.partecipanti.length} in auto</span>
      <span class="recent-amt">${euro(lastTrip.totale)}</span>
    </div>` : `<div class="recent-card"><span class="recent-label">Ultimo tragitto</span><p class="empty sm">Nessuno.</p></div>`);
  cards.push(lastRefuel ? `
    <div class="recent-card">
      <span class="recent-label">Ultimo rifornimento</span>
      <span class="recent-date">${fmtDate(lastRefuel.data)}</span>
      <span class="recent-info">${num(lastRefuel.costo, 3)} €/l</span>
      <span class="recent-amt">${euro(lastRefuel.importo)}</span>
    </div>` : `<div class="recent-card"><span class="recent-label">Ultimo rifornimento</span><p class="empty sm">Nessuno.</p></div>`);
  el.innerHTML = cards.join('');
}

function renderLedger(el, rows, max) {
  if (!rows.length) {
    el.innerHTML = `<p class="empty">Nessuno ti deve niente. Tutto saldato.</p>`;
    return;
  }
  const top = max || rows[0][1] || 1;
  el.innerHTML = rows.map(([p, v], i) => `
    <div class="ledger-row" style="--i:${i}">
      <span class="ledger-name">${esc(p)}</span>
      <span class="ledger-bar"><span style="width:${Math.max(4, (v / top) * 100)}%"></span></span>
      <span class="ledger-amt">${euro(v)}</span>
    </div>`).join('');
}

function renderTragitti(c) {
  const el = document.getElementById('lista-tragitti');
  const rows = [...c.trips].sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 60);
  if (!rows.length) {
    el.innerHTML = `<p class="empty">Nessun tragitto. Aggiungine uno qui sopra.</p>`;
    return;
  }
  el.innerHTML = rows.map((t, i) => `
    <article class="feed-card" style="--i:${Math.min(i, 12)}">
      <div class="feed-main">
        <div class="feed-top">
          <span class="feed-date">${fmtDate(t.data)}</span>
          ${t.inPrestito ? `<span class="badge badge-warn">in prestito</span>` : ''}
          ${t.daRivedere ? `<span class="badge badge-review">da rivedere</span>` : ''}
        </div>
        <div class="feed-meta">${num(t.km, 0)} km · ${num(t.consumo, 1)} l/100 · ${t.partecipanti.length} in auto</div>
        <div class="feed-people">${t.partecipanti.map(p => esc(p)).join(' · ')}</div>
      </div>
      <div class="feed-side">
        <span class="feed-amt">${euro(t.totale)}</span>
        <span class="feed-sub">${euro(t.totaleTesta)}/testa</span>
        <button class="del" data-del-tragitto="${t.id}" aria-label="Elimina">&times;</button>
      </div>
    </article>`).join('');
}

function renderRifornimenti(c) {
  const el = document.getElementById('lista-rifornimenti');
  const rows = [...c.refuels].sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 60);
  if (!rows.length) {
    el.innerHTML = `<p class="empty">Nessun rifornimento ancora.</p>`;
    return;
  }
  el.innerHTML = rows.map((r, i) => `
    <article class="feed-card" style="--i:${Math.min(i, 12)}">
      <div class="feed-main">
        <span class="feed-date">${fmtDate(r.data)}</span>
        <div class="feed-meta">${num(r.costo, 3)} €/l</div>
      </div>
      <div class="feed-side">
        <span class="feed-amt">${euro(r.importo)}</span>
        <span class="feed-sub">${lit(r.litri)}</span>
        <button class="del" data-del-rifornimento="${r.id}" aria-label="Elimina">&times;</button>
      </div>
    </article>`).join('');
}

function renderPersone(c) {
  // saldi completi, schede espandibili con storico
  const all = Object.entries(c.saldi)
    .filter(([p]) => p !== DRIVER)
    .sort((a, b) => b[1] - a[1]);
  const el = document.getElementById('lista-saldi');
  if (!all.length) {
    el.innerHTML = `<p class="empty">Aggiungi tragitti con passeggeri per vedere i saldi.</p>`;
  } else {
    const top = Math.max(...all.map(([, v]) => Math.abs(v)), 1);
    el.innerHTML = all.map(([p, v], i) => {
      const d = c.detail[p] || { addebito: 0, restituito: 0, km: 0, tragitti: [], restituzioni: [] };
      const negc = v < -0.01 ? 'neg' : '';
      const trips = [...d.tragitti].sort((a, b) => (a.data < b.data ? 1 : -1));
      const rests = [...d.restituzioni].sort((a, b) => (a.data < b.data ? 1 : -1));
      const quotaMedia = d.tragitti.length ? d.addebito / d.tragitti.length : 0;
      const meta = [
        ['Addebitato', euro(d.addebito)],
        ['Restituito', euro(d.restituito)],
        ['Tragitti', num(d.tragitti.length, 0)],
        ['Km con te', num(d.km, 0)],
        ['Quota media', euro(quotaMedia)],
        ['Restituzioni', num(d.restituzioni.length, 0)],
      ];
      return `
      <details class="person" style="--i:${Math.min(i, 12)}">
        <summary>
          <span class="ledger-name">${esc(p)}</span>
          <span class="ledger-bar"><span class="${negc ? 'b-neg' : ''}" style="width:${Math.max(4, (Math.abs(v) / top) * 100)}%"></span></span>
          <span class="ledger-amt ${negc}">${euro(v)}</span>
          <svg class="chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>
        </summary>
        <div class="person-body">
          <div class="meta-grid">
            ${meta.map(([l, val]) => `<div class="meta"><span>${l}</span><strong>${val}</strong></div>`).join('')}
          </div>
          <div class="history">
            <h4>Tragitti <span>${trips.length}</span></h4>
            ${trips.length ? `<div class="hist-list">${trips.slice(0, 40).map(t => `
              <div class="hist-row">
                <span class="hist-date">${fmtDate(t.data)}</span>
                <span class="hist-info">${num(t.km, 0)} km · ${t.pax} in auto${t.inPrestito ? ' · <em>in prestito</em>' : ''}</span>
                <span class="hist-amt">${euro(t.quota)}</span>
              </div>`).join('')}${trips.length > 40 ? `<div class="hist-more">+ altri ${trips.length - 40}</div>` : ''}</div>` : `<p class="empty sm">Nessun tragitto.</p>`}
          </div>
          <div class="history">
            <h4>Restituzioni <span>${rests.length}</span></h4>
            ${rests.length ? `<div class="hist-list">${rests.map(r => `
              <div class="hist-row">
                <span class="hist-date">${fmtDate(r.data)}</span>
                <span class="hist-info">rientro</span>
                <span class="hist-amt pos">${euro(r.importo)}</span>
              </div>`).join('')}</div>` : `<p class="empty sm">Nessuna restituzione.</p>`}
          </div>
        </div>
      </details>`;
    }).join('');
  }

  // select restituzione (rispetta l'ordine scelto)
  const sel = document.getElementById('q-persona');
  const cur = sel.value;
  sel.innerHTML = state.persone.filter(p => p !== DRIVER)
    .map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  if (cur) sel.value = cur;

  // gestione persone con riordino
  const others = state.persone.filter(p => p !== DRIVER);
  document.getElementById('lista-persone').innerHTML = `
    <span class="tag tag-driver">${esc(DRIVER)}</span>
    ${others.map((p, i) => `
      <span class="tag">
        <button class="ord" data-move-up="${esc(p)}" ${i === 0 ? 'disabled' : ''} aria-label="Su">↑</button>
        <button class="ord" data-move-down="${esc(p)}" ${i === others.length - 1 ? 'disabled' : ''} aria-label="Giù">↓</button>
        ${esc(p)}
        <button data-del-persona="${esc(p)}" aria-label="Rimuovi">&times;</button>
      </span>`).join('')}`;
}

function orderedPersone() {
  // Luca sempre primo, poi l'ordine scelto dall'utente
  return [DRIVER, ...state.persone.filter(p => p !== DRIVER)];
}

function renderChips() {
  document.getElementById('t-persone').innerHTML = orderedPersone().map(p => `
    <label class="chip">
      <input type="checkbox" value="${esc(p)}" ${p === DRIVER ? 'checked' : ''}>
      <span>${esc(p)}</span>
    </label>`).join('');
}

function renderAll() {
  const c = compute();
  renderDashboard(c);
  renderTragitti(c);
  renderRifornimenti(c);
  renderPersone(c);
  renderGrafici(c);
}

// ============================================================
// GRAFICI — motore SVG leggero, interattivo, senza dipendenze
// ============================================================
let lastCompute = null;

function filterByPeriod(items, periodDays, dateOf) {
  if (periodDays === 'all') return items;
  const cutoff = new Date(todayISO());
  cutoff.setDate(cutoff.getDate() - +periodDays);
  return items.filter(x => {
    const d = dateOf(x);
    return d && new Date(d) >= cutoff;
  });
}

function buildDataset(c, metric, period) {
  if (metric === 'prezzo') {
    const rows = filterByPeriod([...c.refuels].filter(r => r.data), period, r => r.data)
      .sort((a, b) => (a.data < b.data ? -1 : 1));
    return {
      title: 'Prezzo carburante', unit: '€/l', currency: false,
      labels: rows.map(r => fmtDate(r.data)), values: rows.map(r => r.costo),
      defaultType: 'line', allowTrend: true,
      summary: rows.length ? `media ${num(rows.reduce((s, r) => s + r.costo, 0) / rows.length, 3)} €/l` : '—',
    };
  }
  if (metric === 'mensile') {
    const rows = filterByPeriod([...c.trips].filter(t => t.data), period, t => t.data);
    const byMonth = {};
    rows.forEach(t => { const m = t.data.slice(0, 7); byMonth[m] = (byMonth[m] || 0) + t.totale; });
    const months = Object.keys(byMonth).sort();
    const labels = months.map(m => { const [y, mo] = m.split('-'); return new Date(+y, +mo - 1, 1).toLocaleDateString('it-IT', { month: 'short', year: '2-digit' }); });
    const values = months.map(m => byMonth[m]);
    return {
      title: 'Spesa mensile', unit: '€', currency: true,
      labels, values, defaultType: 'line', allowTrend: true,
      summary: values.length ? `totale ${euro(values.reduce((s, v) => s + v, 0))}` : '—',
    };
  }
  if (metric === 'cumulativa') {
    const rows = filterByPeriod([...c.refuels].filter(r => r.data), period, r => r.data)
      .sort((a, b) => (a.data < b.data ? -1 : 1));
    let run = 0;
    const values = rows.map(r => (run += r.importo));
    return {
      title: 'Spesa cumulativa', unit: '€', currency: true,
      labels: rows.map(r => fmtDate(r.data)), values, defaultType: 'area', allowTrend: false,
      summary: values.length ? `totale ${euro(values[values.length - 1])}` : '—',
    };
  }
  if (metric === 'rifornimenti') {
    const rows = filterByPeriod([...c.refuels].filter(r => r.data), period, r => r.data)
      .sort((a, b) => (a.data < b.data ? -1 : 1));
    return {
      title: 'Spesa per rifornimento', unit: '€', currency: true,
      labels: rows.map(r => fmtDate(r.data)), values: rows.map(r => r.importo),
      defaultType: 'bar', allowTrend: false,
      summary: rows.length ? `${rows.length} rifornimenti` : '—',
    };
  }
  // consumo
  const rows = filterByPeriod([...c.trips].filter(t => t.data), period, t => t.data)
    .sort((a, b) => (a.data < b.data ? -1 : 1));
  return {
    title: 'Consumo per tragitto', unit: 'l/100km', currency: false,
    labels: rows.map(t => fmtDate(t.data)), values: rows.map(t => t.consumo),
    defaultType: 'bar', allowTrend: true,
    summary: rows.length ? `media ${num(rows.reduce((s, t) => s + t.consumo, 0) / rows.length, 1)} l/100km` : '—',
  };
}

function movingAverage(values, window = 3) {
  return values.map((_, i) => {
    const lo = Math.max(0, i - window + 1);
    const slice = values.slice(lo, i + 1);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

const G = { W: 600, H: 280, pad: 14 };

function chartCoords(values) {
  const n = values.length;
  const max = Math.max(...values, 0) * 1.15 || 1;
  const usableH = G.H - G.pad * 2;
  const x = i => n <= 1 ? G.W / 2 : G.pad + (i / (n - 1)) * (G.W - G.pad * 2);
  const y = v => G.H - G.pad - (v / max) * usableH;
  return { x, y, max };
}

function svgEl(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
}

function renderChartSVG(ds, type, showTrend) {
  const svg = document.getElementById('g-svg');
  svg.innerHTML = '';
  const { labels, values } = ds;
  if (!values.length) {
    document.getElementById('g-axis-x').innerHTML = '';
    document.getElementById('g-tooltip').hidden = true;
    return;
  }
  const { x, y } = chartCoords(values);

  // griglia orizzontale leggera
  for (let g = 0; g <= 3; g++) {
    const gy = G.pad + (g / 3) * (G.H - G.pad * 2);
    svg.appendChild(svgEl('line', { x1: G.pad, x2: G.W - G.pad, y1: gy, y2: gy, class: 'chart-grid' }));
  }

  if (type === 'bar') {
    const n = values.length;
    const slot = (G.W - G.pad * 2) / n;
    const bw = Math.max(2, slot * 0.6);
    values.forEach((v, i) => {
      const bx = x(i) - bw / 2;
      const by = y(v);
      svg.appendChild(svgEl('rect', {
        x: bx, y: by, width: bw, height: (G.H - G.pad) - by,
        class: 'chart-bar', 'data-i': i,
      }));
    });
  } else {
    const pathD = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
    if (type === 'area') {
      const areaD = `${pathD} L ${x(values.length - 1)} ${G.H - G.pad} L ${x(0)} ${G.H - G.pad} Z`;
      svg.appendChild(svgEl('path', { d: areaD, class: 'chart-area' }));
    }
    svg.appendChild(svgEl('path', { d: pathD, class: 'chart-line', fill: 'none' }));
    values.forEach((v, i) => {
      svg.appendChild(svgEl('circle', { cx: x(i), cy: y(v), r: 3.2, class: 'chart-dot', 'data-i': i }));
    });
    if (showTrend && ds.allowTrend && values.length > 2) {
      const trend = movingAverage(values, Math.min(3, values.length));
      const trendD = trend.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');
      svg.appendChild(svgEl('path', { d: trendD, class: 'chart-trend', fill: 'none' }));
    }
  }

  // asse X: prime/ultima/medie etichette per non sovraffollare
  const axisEl = document.getElementById('g-axis-x');
  const maxLabels = 6;
  const step = Math.max(1, Math.ceil(labels.length / maxLabels));
  axisEl.innerHTML = labels.map((l, i) => (i % step === 0 || i === labels.length - 1) ? `<span style="left:${(x(i) / G.W) * 100}%">${l}</span>` : '').join('');

  // tooltip interattivo
  const tooltip = document.getElementById('g-tooltip');
  const { x: xf } = chartCoords(values);
  svg.onmousemove = svg.ontouchmove = e => {
    const rect = svg.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const relX = ((clientX - rect.left) / rect.width) * G.W;
    let nearest = 0, best = Infinity;
    values.forEach((_, i) => { const d = Math.abs(xf(i) - relX); if (d < best) { best = d; nearest = i; } });
    const val = ds.currency ? euro(values[nearest]) : `${num(values[nearest], ds.unit === 'l/100km' ? 1 : 3)} ${ds.unit}`;
    tooltip.hidden = false;
    tooltip.style.left = `${(xf(nearest) / G.W) * 100}%`;
    tooltip.innerHTML = `<strong>${val}</strong><span>${labels[nearest] || ''}</span>`;
  };
  svg.onmouseleave = () => { tooltip.hidden = true; };
}

function renderGrafici(c) {
  lastCompute = c;
  const metric = document.getElementById('g-metric').value;
  const period = document.getElementById('g-period').value;
  const ds = buildDataset(c, metric, period);
  const typeSel = document.getElementById('g-type');
  if (typeSel.dataset.metric !== metric) {
    typeSel.value = ds.defaultType;
    typeSel.dataset.metric = metric;
  }
  const trendChk = document.getElementById('g-trend');
  trendChk.disabled = !ds.allowTrend;
  document.getElementById('g-title').textContent = ds.title;
  document.getElementById('g-summary').textContent = ds.summary;
  if (!ds.values.length) {
    document.getElementById('g-svg').innerHTML = '';
    document.getElementById('g-axis-x').innerHTML = '';
    document.getElementById('g-tooltip').hidden = true;
    return;
  }
  renderChartSVG(ds, typeSel.value, trendChk.checked && ds.allowTrend);
}

['g-metric', 'g-period', 'g-type', 'g-trend'].forEach(id =>
  document.getElementById(id).addEventListener('change', () => { if (lastCompute) renderGrafici(lastCompute); }));

// ============================================================
// FORMS
// ============================================================
document.getElementById('form-tragitto').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const partecipanti = [...f.querySelectorAll('#t-persone input:checked')].map(i => i.value);
  if (!partecipanti.length) { toast('Seleziona almeno una persona'); return; }
  state.tragitti.push({
    id: Date.now(),
    data: f.data.value,
    km: parseFloat(f.km.value) || 0,
    consumo: parseFloat(f.consumo.value) || 0,
    partecipanti,
    costiAgg: parseFloat(f.costiAgg.value) || 0,
  });
  await save();
  renderAll();
  f.reset();
  f.data.value = todayISO();
  f.consumo.value = lastConsumo();
  renderChips();
  updatePreviewT();
  toast('Tragitto aggiunto');
});

document.getElementById('form-rifornimento').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  state.rifornimenti.push({
    id: Date.now(),
    data: f.data.value,
    importo: parseFloat(f.importo.value) || 0,
    costo: parseFloat(f.costo.value) || 0,
  });
  await save();
  renderAll();
  f.reset();
  f.data.value = todayISO();
  updatePreviewR();
  toast('Rifornimento aggiunto');
});

document.getElementById('form-restituzione').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const p = f.persona.value;
  const v = parseFloat(f.importo.value) || 0;
  if (!p || v <= 0) return;
  state.restituzioni.push({ id: Date.now(), data: f.data.value, dettaglio: { [p]: v } });
  await save();
  renderAll();
  f.importo.value = '';
  toast(`Restituzione di ${p} registrata`);
});

document.getElementById('form-persona').addEventListener('submit', async e => {
  e.preventDefault();
  const nome = e.target.nome.value.trim();
  if (nome && !state.persone.includes(nome)) {
    state.persone.push(nome);
    await save();
    renderAll();
    renderChips();
    e.target.reset();
    toast(`"${nome}" aggiunta`);
  }
});

// ---------- Delete + riordino (delegation) ----------
function movePersona(nome, dir) {
  const i = state.persone.indexOf(nome);
  if (i < 0) return;
  const j = i + dir;
  if (j < 0 || j >= state.persone.length || state.persone[j] === DRIVER) return;
  [state.persone[i], state.persone[j]] = [state.persone[j], state.persone[i]];
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-del-tragitto],[data-del-rifornimento],[data-del-persona],[data-move-up],[data-move-down]');
  if (!b) return;
  if (b.dataset.delTragitto) {
    state.tragitti = state.tragitti.filter(t => String(t.id) !== b.dataset.delTragitto);
  } else if (b.dataset.delRifornimento) {
    state.rifornimenti = state.rifornimenti.filter(r => String(r.id) !== b.dataset.delRifornimento);
  } else if (b.dataset.delPersona) {
    state.persone = state.persone.filter(p => p !== b.dataset.delPersona);
  } else if (b.dataset.moveUp) {
    movePersona(b.dataset.moveUp, -1);
  } else if (b.dataset.moveDown) {
    movePersona(b.dataset.moveDown, 1);
  }
  await save();
  renderAll();
  renderChips();
});

document.getElementById('btn-export-json').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'serbatoio.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

document.getElementById('btn-reset').addEventListener('click', async () => {
  if (confirm('Eliminare TUTTI i dati? Irreversibile.')) {
    state = emptyState();
    await save();
    renderAll();
    renderChips();
    toast('Dati azzerati');
  }
});

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    window.scrollTo(0, 0);
  });
});

// ---------- Live preview ----------
function lastConsumo() {
  const t = state.tragitti[state.tragitti.length - 1];
  return t ? t.consumo : CONSUMO_DEFAULT;
}
function updatePreviewT() {
  const f = document.getElementById('form-tragitto');
  const km = parseFloat(f.km.value) || 0;
  const cons = parseFloat(f.consumo.value) || 0;
  const n = f.querySelectorAll('#t-persone input:checked').length || 1;
  const el = document.getElementById('t-preview');
  if (km <= 0 || cons <= 0) { el.textContent = ''; return; }
  const litri = (km / 100) * cons;
  const costo = litri * prezzoCorrente();
  const agg = parseFloat(f.costiAgg.value) || 0;
  const tot = costo + agg;
  el.innerHTML = `≈ ${lit(litri)} · ${euro(tot)} · <strong>${euro(tot / n)}</strong>/testa`;
}
function updatePreviewR() {
  const f = document.getElementById('form-rifornimento');
  const imp = parseFloat(f.importo.value) || 0;
  const costo = parseFloat(f.costo.value) || 0;
  const el = document.getElementById('r-preview');
  el.textContent = (imp > 0 && costo > 0) ? `= ${lit(imp / costo)}` : '';
}
['form-tragitto'].forEach(id => document.getElementById(id).addEventListener('input', updatePreviewT));
document.getElementById('t-persone').addEventListener('change', updatePreviewT);
document.getElementById('form-rifornimento').addEventListener('input', updatePreviewR);

// ============================================================
// INIT
// ============================================================
async function init() {
  const remote = await apiGet();
  if (remote && (remote.tragitti?.length || remote.rifornimenti?.length || remote.benzina?.length)) {
    state = normalize(remote);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  ['t-data', 'r-data', 'q-data'].forEach(id => { const el = document.getElementById(id); if (el) el.value = todayISO(); });
  document.getElementById('t-consumo').value = lastConsumo();
  renderChips();
  renderAll();
  updatePreviewT();
}
init();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
