// ============================================================
// Gestione Benzina — PWA Vanilla JS
// ============================================================

const STORAGE_KEY = 'gestione-benzina-v1';

// --- Persone di default (dal foglio) ---
const PERSONE_DEFAULT = ["Alessia Mongiardo", "Alessio Paparella", "Alice Tonoli", "Andres Lo Monaco", "Daniel De Leo", "David Karpik", "Dennis Molinari", "Edoardo Ballarini", "Emanuele Meloni", "Emanuele Radice", "Federico Vessio", "Filippo Sciarpa", "Giorgia Bennici", "Giulia Pierin", "Ilenia Boccagno", "Ionuts Purniki", "Kerlins Hernandez", "Leonardo Scimone", "Luca", "Manuel Di Lanna", "Marco", "Marzio Foti", "Matteo Sangalli", "Noemi Pianta", "Rebecca Fato", "Riccardo Carissimi", "Romina Zeza", "Simone Lenoci", "Sofia Vessio", "Sonia Bertani", "Tommaso Signori", "Yuri Comelli", "amoremiodellamiavitalucedeimieiocchimadredeimieifiglimogliebellissimissima"];

let state = loadState();

function defaultState() {
  return {
    persone: [...PERSONE_DEFAULT],
    tragitti: [],
    benzina: [],
    restituzioni: [],
    spese: []
  };
}

const API = '/api/data';

async function apiGet() {
  try {
    const r = await fetch(API);
    if (r.ok) return await r.json();
  } catch(e) {}
  return null;
}

async function apiSave() {
  try {
    await fetch(API, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(state)
    });
  } catch(e) { updateStatus('Errore salvataggio!'); }
}

async function seedFromAPI() {
  const data = await apiGet();
  if (data && (data.tragitti?.length > 0 || data.benzina?.length > 0)) {
    state = data;
    return true;
  }
  return false;
}

function loadState() {
  // Sync load — will be replaced by async init()
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (!s.persone || s.persone.length === 0) s.persone = [...PERSONE_DEFAULT];
      return s;
    }
  } catch(e) {}
  return defaultState();
}

async function saveState() {
  await apiSave();
  // Also keep localStorage as cache
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateStatus('Dati salvati');
}

// --- Utility ---
function formatEuro(n) {
  return '€ ' + (n || 0).toFixed(2).replace('.', ',');
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

function parseDate(str) {
  // accetta dd/mm/yyyy o yyyy-mm-dd
  if (!str) return '';
  if (str.includes('/')) {
    const [d, m, y] = str.split('/');
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return str;
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function updateStatus(msg) {
  const el = document.getElementById('status-bar');
  if (el) {
    el.textContent = msg;
    setTimeout(() => { el.textContent = `${state.tragitti.length} tragitti · ${state.benzina.length} rifornimenti · ${state.persone.length} persone`; }, 2000);
  }
}

// --- Tabs ---
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'info') renderInfo();
    if (btn.dataset.tab === 'restituzioni' || btn.dataset.tab === 'spese') renderPersonInputs();
  });
});

// ============================================================
// TRAGITTI
// ============================================================
document.getElementById('form-tragitto').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const data = f.data.value;
  const km = parseFloat(f.km.value);
  const consumo = parseFloat(f.consumo.value);
  const costoCarburante = parseFloat(f.costoCarburante.value);
  const costiAgg = parseFloat(f.costiAgg.value) || 0;

  // Count selected people (always includes Luca + checked others)
  const checked = f.querySelectorAll('.tragitto-person-check:checked');
  const personeNames = [];
  checked.forEach(cb => personeNames.push(cb.value));
  const personeCount = personeNames.length;

  const totale = (km / 100) * consumo * costoCarburante + costiAgg;
  const totaleTesta = personeCount > 0 ? totale / personeCount : totale;
  const coeffKm = totale / km;

  state.tragitti.push({
    id: Date.now(),
    data, km, consumo, costoCarburante, persone: personeCount, costiAgg,
    totale, totaleTesta, coeffKm, personeNomi: personeNames
  });

  saveState();
  renderTragitti();
  f.reset();
  f.data.value = todayISO();
  renderTragittoPersone();
  updateStatus('Tragitto aggiunto (' + personeCount + ' persone)';
});

function renderTragitti() {
  const tbody = document.querySelector('#tabella-tragitti tbody');
  const sorted = [...state.tragitti].sort((a, b) => b.data.localeCompare(a.data));
  tbody.innerHTML = sorted.map(t => `
    <tr>
      <td>${formatDate(t.data)}</td>
      <td>${t.km.toFixed(1)}</td>
      <td>${t.consumo.toFixed(1)}</td>
      <td>${t.costoCarburante.toFixed(3)}</td>
      <td>${t.personeNomi ? t.personeNomi.join(', ') : t.persone}</td>
      <td>${formatEuro(t.totale)}</td>
      <td>${formatEuro(t.totaleTesta)}</td>
      <td>${(t.coeffKm * 100).toFixed(1)}%</td>
      <td>${t.incongruenza || ''}</td>
      <td><button class="btn-delete" onclick="deleteTragitto(${t.id})">✕</button></td>
    </tr>
  `).join('');
}

function renderTragittoPersone() {
  const el = document.getElementById('tragitto-persone');
  if (!el) return;
  el.innerHTML = state.persone.map(p => `
    <label class="person-checkbox">
      <input type="checkbox" class="tragitto-person-check" value="${p.replace(/"/g, '&quot;')}" ${p === 'Luca' ? 'checked' : ''}>
      ${p}
    </label>
  `).join('');
}

function deleteTragitto(id) {
  state.tragitti = state.tragitti.filter(t => t.id !== id);
  saveState();
  renderTragitti();
  updateStatus('Tragitto eliminato');
}

// ============================================================
// BENZINA
// ============================================================
document.getElementById('form-benzina').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  state.benzina.push({
    id: Date.now(),
    data: f.data.value,
    spesa: parseFloat(f.spesa.value),
    costoCarburante: parseFloat(f.costoCarburante.value),
    litri: parseFloat(f.litri.value),
    mese: f.mese.value
  });
  saveState();
  renderBenzina();
  f.reset();
  f.data.value = todayISO();
  updateStatus('Rifornimento aggiunto');
});

function renderBenzina() {
  const tbody = document.querySelector('#tabella-benzina tbody');
  const sorted = [...state.benzina].sort((a, b) => b.data.localeCompare(a.data));
  tbody.innerHTML = sorted.map(b => `
    <tr>
      <td>${formatDate(b.data)}</td>
      <td>${formatEuro(b.spesa)}</td>
      <td>${b.costoCarburante.toFixed(3)}</td>
      <td>${b.litri.toFixed(2)}</td>
      <td>${b.mese}</td>
      <td><button class="btn-delete" onclick="deleteBenzina(${b.id})">✕</button></td>
    </tr>
  `).join('');
}

function deleteBenzina(id) {
  state.benzina = state.benzina.filter(b => b.id !== id);
  saveState();
  renderBenzina();
  updateStatus('Rifornimento eliminato');
}

// ============================================================
// RESTITUZIONI
// ============================================================
document.getElementById('form-persona').addEventListener('submit', e => {
  e.preventDefault();
  const nome = e.target.nome.value.trim();
  if (nome && !state.persone.includes(nome)) {
    state.persone.push(nome);
    saveState();
    renderPersonTags();
    renderPersonInputs();
    e.target.reset();
    updateStatus(`Persona "${nome}" aggiunta`);
  }
});

function renderPersonTags() {
  const el = document.getElementById('lista-persone');
  el.innerHTML = state.persone.map(p => `
    <span class="person-tag">
      ${p}
      <button class="remove-person" onclick="removePersona('${p.replace(/'/g, "\\'")}')">×</button>
    </span>
  `).join('');
}

function removePersona(nome) {
  state.persone = state.persone.filter(p => p !== nome);
  saveState();
  renderPersonTags();
  renderPersonInputs();
  updateStatus(`Persona "${nome}" rimossa`);
}

function renderPersonInputs() {
  // Restituzioni
  const resEl = document.getElementById('restituzione-persone');
  if (resEl) {
    resEl.innerHTML = state.persone.map(p => `
      <div class="person-split-row">
        <span class="person-name">${p}</span>
        <input type="number" step="0.01" placeholder="0,00" data-persona="${p.replace(/"/g, '&quot;')}" class="split-input-res">
      </div>
    `).join('');
  }

  // Spese
  const speEl = document.getElementById('spese-persone');
  if (speEl) {
    speEl.innerHTML = state.persone.map(p => `
      <div class="person-split-row">
        <span class="person-name">${p}</span>
        <input type="number" step="0.01" placeholder="0,00" data-persona="${p.replace(/"/g, '&quot;')}" class="split-input-spe">
      </div>
    `).join('');
  }
}

document.getElementById('form-restituzione').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const data = f.data.value;
  const dividiTutti = f.dividiTutti.checked;
  const inputs = f.querySelectorAll('.split-input-res');

  const dettaglio = {};
  let somma = 0;

  if (dividiTutti) {
    const totale = parseFloat(f.totale.value) || 0;
    const perPersona = totale / state.persone.length;
    state.persone.forEach(p => { dettaglio[p] = perPersona; });
    somma = totale;
  } else {
    inputs.forEach(inp => {
      const val = parseFloat(inp.value) || 0;
      dettaglio[inp.dataset.persona] = val;
      somma += val;
    });
  }

  state.restituzioni.push({ id: Date.now(), data, totale: somma, dettaglio });
  saveState();
  renderRestituzioni();
  f.reset();
  f.data.value = todayISO();
  updateStatus('Restituzione aggiunta');
});

function renderRestituzioni() {
  const tbody = document.querySelector('#tabella-restituzioni tbody');
  const sorted = [...state.restituzioni].sort((a, b) => b.data.localeCompare(a.data));
  tbody.innerHTML = sorted.map(r => {
    const dettaglioStr = Object.entries(r.dettaglio)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}: ${formatEuro(v)}`)
      .join(', ');
    return `
      <tr>
        <td>${formatDate(r.data)}</td>
        <td>${formatEuro(r.totale)}</td>
        <td class="dettaglio-cell" title="${dettaglioStr}">${dettaglioStr || '—'}</td>
        <td><button class="btn-delete" onclick="deleteRestituzione(${r.id})">✕</button></td>
      </tr>
    `;
  }).join('');
}

function deleteRestituzione(id) {
  state.restituzioni = state.restituzioni.filter(r => r.id !== id);
  saveState();
  renderRestituzioni();
  updateStatus('Restituzione eliminata');
}

// ============================================================
// SPESE
// ============================================================
document.getElementById('form-spesa').addEventListener('submit', e => {
  e.preventDefault();
  const f = e.target;
  const data = f.data.value;
  const inputs = f.querySelectorAll('.split-input-spe');

  const dettaglio = {};
  let somma = 0;

  inputs.forEach(inp => {
    const val = parseFloat(inp.value) || 0;
    dettaglio[inp.dataset.persona] = val;
    somma += val;
  });

  state.spese.push({ id: Date.now(), data, totale: somma, dettaglio });
  saveState();
  renderSpese();
  f.reset();
  f.data.value = todayISO();
  updateStatus('Spesa aggiunta');
});

function renderSpese() {
  const tbody = document.querySelector('#tabella-spese tbody');
  const sorted = [...state.spese].sort((a, b) => b.data.localeCompare(a.data));
  tbody.innerHTML = sorted.map(s => {
    const dettaglioStr = Object.entries(s.dettaglio)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k}: ${formatEuro(v)}`)
      .join(', ');
    return `
      <tr>
        <td>${formatDate(s.data)}</td>
        <td>${formatEuro(s.totale)}</td>
        <td class="dettaglio-cell" title="${dettaglioStr}">${dettaglioStr || '—'}</td>
        <td><button class="btn-delete" onclick="deleteSpesa(${s.id})">✕</button></td>
      </tr>
    `;
  }).join('');
}

function deleteSpesa(id) {
  state.spese = state.spese.filter(s => s.id !== id);
  saveState();
  renderSpese();
  updateStatus('Spesa eliminata');
}

// ============================================================
// INFO / RIEPILOGO
// ============================================================
function renderInfo() {
  const el = document.getElementById('info-riepilogo');

  const totKm = state.tragitti.reduce((s, t) => s + t.km, 0);
  const totSpesaTragitti = state.tragitti.reduce((s, t) => s + t.totale, 0);
  const totCostiAgg = state.tragitti.reduce((s, t) => s + t.costiAgg, 0);
  const mediaConsumo = state.tragitti.length > 0
    ? state.tragitti.reduce((s, t) => s + t.consumo, 0) / state.tragitti.length
    : 0;

  const totBenzina = state.benzina.reduce((s, b) => s + b.spesa, 0);
  const totLitri = state.benzina.reduce((s, b) => s + b.litri, 0);
  const mediaPrezzoBenzina = state.benzina.length > 0
    ? state.benzina.reduce((s, b) => s + b.costoCarburante, 0) / state.benzina.length
    : 0;

  const totRestituzioni = state.restituzioni.reduce((s, r) => s + r.totale, 0);
  const totSpese = state.spese.reduce((s, sp) => s + sp.totale, 0);

  // Calcola saldo per persona
  const saldi = {};
  state.persone.forEach(p => saldi[p] = 0);

  // Restituzioni: somma entrate
  state.restituzioni.forEach(r => {
    Object.entries(r.dettaglio).forEach(([p, v]) => {
      if (saldi[p] !== undefined) saldi[p] += v;
    });
  });

  // Spese: sottrae quota
  state.spese.forEach(sp => {
    Object.entries(sp.dettaglio).forEach(([p, v]) => {
      if (saldi[p] !== undefined) saldi[p] -= v;
    });
  });

  // Tragitti: sottrae quota per testa
  state.tragitti.forEach(t => {
    const perTesta = t.totaleTesta;
    // Distribuisce in base a chi partecipava — semplificazione: divide tra tutti
    // (il foglio originale ha logica più complessa, qui semplifichiamo)
  });

  const saldoNetto = totRestituzioni - totSpese;

  el.innerHTML = `
    <div class="info-card">
      <div class="label">KM Totali</div>
      <div class="value">${totKm.toFixed(1)}</div>
    </div>
    <div class="info-card">
      <div class="label">Spesa Tragitti</div>
      <div class="value">${formatEuro(totSpesaTragitti)}</div>
      <div class="sub">Costi aggiuntivi: ${formatEuro(totCostiAgg)}</div>
    </div>
    <div class="info-card">
      <div class="label">Totale Benzina</div>
      <div class="value">${formatEuro(totBenzina)}</div>
      <div class="sub">${totLitri.toFixed(1)} litri · media ${mediaPrezzoBenzina.toFixed(3)} €/l</div>
    </div>
    <div class="info-card">
      <div class="label">Media Consumo</div>
      <div class="value">${mediaConsumo.toFixed(1)} l/100km</div>
    </div>
    <div class="info-card">
      <div class="label">Totale Restituzioni</div>
      <div class="value" style="color:var(--success)">${formatEuro(totRestituzioni)}</div>
    </div>
    <div class="info-card">
      <div class="label">Totale Spese</div>
      <div class="value" style="color:var(--danger)">${formatEuro(totSpese)}</div>
    </div>
    <div class="info-card" style="grid-column:1/-1">
      <div class="label">Saldo Netto (Restituzioni - Spese)</div>
      <div class="value" style="color:${saldoNetto >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatEuro(saldoNetto)}</div>
    </div>
  `;

  // Render saldi per persona
  let saldiHtml = '<h3>Saldi per persona</h3><div class="info-grid">';
  Object.entries(saldi)
    .sort(([, a], [, b]) => b - a)
    .forEach(([p, s]) => {
      saldiHtml += `
        <div class="info-card">
          <div class="label">${p}</div>
          <div class="value" style="color:${s >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatEuro(s)}</div>
        </div>
      `;
    });
  saldiHtml += '</div>';
  el.insertAdjacentHTML('beforeend', saldiHtml);
}

// ============================================================
// IMPORT / EXPORT
// ============================================================

// Import CSV
document.getElementById('form-import').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const foglio = f.foglio.value;
  const csv = f.csvData.value.trim();
  if (!csv) return;

  const lines = csv.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) { updateStatus('Dati insufficienti'); return; }

  // Parse CSV gestendo virgolette
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result.map(s => s.replace(/^["']|["']$/g, '').trim());
  };

  const headers = parseCSVLine(lines[0]);
  let imported = 0;

  if (foglio === 'tragitti') {
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      if (vals.length < 5) continue;
      const t = {
        id: Date.now() + i,
        data: parseDate(vals[0]),
        km: parseFloat(vals[1]?.replace(',', '.')) || 0,
        consumo: parseFloat(vals[2]?.replace(',', '.')) || 0,
        costoCarburante: parseFloat(vals[3]?.replace(',', '.')) || 0,
        persone: parseFloat(vals[4]?.replace(',', '.')) || 1,
        costiAgg: parseFloat(vals[6]?.replace(',', '.')) || 0
      };
      t.totale = (t.km / 100) * t.consumo * t.costoCarburante + t.costiAgg;
      t.totaleTesta = t.totale / t.persone;
      t.coeffKm = t.km > 0 ? t.totale / t.km : 0;
      state.tragitti.push(t);
      imported++;
    }
  } else if (foglio === 'benzina') {
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      if (vals.length < 4) continue;
      state.benzina.push({
        id: Date.now() + i,
        data: parseDate(vals[0]),
        spesa: parseFloat(vals[1]?.replace(',', '.')) || 0,
        costoCarburante: parseFloat(vals[2]?.replace(',', '.')) || 0,
        litri: parseFloat(vals[3]?.replace(',', '.')) || 0,
        mese: vals[4] || ''
      });
      imported++;
    }
  } else if (foglio === 'restituzioni') {
    // Colonna 0 = Data, 1 = Totale, poi una colonna per persona
    const personaCols = headers.slice(2).filter(h => h && h !== '');
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      if (!vals[0]) continue;
      const dettaglio = {};
      let somma = 0;
      personaCols.forEach((nome, idx) => {
        const v = parseFloat((vals[idx + 2] || '').replace(',', '.')) || 0;
        dettaglio[nome] = v;
        somma += v;
      });
      state.restituzioni.push({
        id: Date.now() + i,
        data: parseDate(vals[0]),
        totale: somma,
        dettaglio
      });
      imported++;
    }
  } else if (foglio === 'spese') {
    const personaCols = headers.slice(2).filter(h => h && h !== '');
    for (let i = 1; i < lines.length; i++) {
      const vals = parseCSVLine(lines[i]);
      if (!vals[0]) continue;
      const dettaglio = {};
      let somma = 0;
      personaCols.forEach((nome, idx) => {
        const v = parseFloat((vals[idx + 2] || '').replace(',', '.')) || 0;
        dettaglio[nome] = v;
        somma += v;
      });
      state.spese.push({
        id: Date.now() + i,
        data: parseDate(vals[0]),
        totale: somma,
        dettaglio
      });
      imported++;
    }
  }

  await saveState();
  renderAll();
  f.reset();
  updateStatus(`Importati ${imported} record dal foglio ${foglio}`);
});

// Export CSV
document.getElementById('btn-export-csv').addEventListener('click', () => {
  let csv = '';

  // Tragitti
  csv += '=== TRAGITTI ===\n';
  csv += 'Data,KM,Consumo (l/100km),Costo carburante (€/l),Persone,Totale,Totale a testa,Coeff/km,Costi aggiuntivi\n';
  state.tragitti.forEach(t => {
    csv += `${t.data},${t.km},${t.consumo},${t.costoCarburante},${t.persone},${t.totale.toFixed(2)},${t.totaleTesta.toFixed(2)},${(t.coeffKm * 100).toFixed(1)},${t.costiAgg}\n`;
  });

  csv += '\n=== BENZINA ===\n';
  csv += 'Data,Spesa (€),Costo carburante (€/l),Litri,Mese\n';
  state.benzina.forEach(b => {
    csv += `${b.data},${b.spesa.toFixed(2)},${b.costoCarburante},${b.litri.toFixed(2)},${b.mese}\n`;
  });

  csv += '\n=== RESTITUZIONI ===\n';
  csv += 'Data,Totale,' + state.persone.join(',') + '\n';
  state.restituzioni.forEach(r => {
    const vals = state.persone.map(p => (r.dettaglio[p] || 0).toFixed(2));
    csv += `${r.data},${r.totale.toFixed(2)},${vals.join(',')}\n`;
  });

  csv += '\n=== SPESE ===\n';
  csv += 'Data,Totale,' + state.persone.join(',') + '\n';
  state.spese.forEach(s => {
    const vals = state.persone.map(p => (s.dettaglio[p] || 0).toFixed(2));
    csv += `${s.data},${s.totale.toFixed(2)},${vals.join(',')}\n`;
  });

  downloadFile(csv, 'gestione-benzina.csv', 'text/csv');
  updateStatus('CSV esportato');
});

// Export JSON
document.getElementById('btn-export-json').addEventListener('click', () => {
  const data = JSON.stringify(state, null, 2);
  downloadFile(data, 'gestione-benzina.json', 'application/json');
  updateStatus('JSON esportato');
});

// Export XLSX (spreadsheet) — generiamo un file .xlsx usando un semplice approccio XML
document.getElementById('btn-export-xlsx')?.remove(); // rimuovi se esiste
// Aggiungiamo il pulsante XLSX dinamicamente
const exportDiv = document.querySelector('#info .form-actions');
if (exportDiv && !document.getElementById('btn-export-xlsx')) {
  const btn = document.createElement('button');
  btn.id = 'btn-export-xlsx';
  btn.type = 'button';
  btn.textContent = 'Esporta spreadsheet (XLSX)';
  btn.addEventListener('click', exportXLSX);
  exportDiv.appendChild(btn);
}

function exportXLSX() {
  // Generiamo un file XLSX reale usando la libreria SheetJS (caricata da CDN)
  // Se già caricata, usiamo quella
  if (typeof XLSX !== 'undefined') {
    generateXLSX();
  } else {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    script.onload = generateXLSX;
    script.onerror = () => {
      // Fallback: genera un file .xml compatibile con Excel
      exportXMLSpreadsheet();
    };
    document.head.appendChild(script);
  }
}

function generateXLSX() {
  const wb = XLSX.utils.book_new();

  // Foglio Tragitti
  const trData = [['Data', 'KM', 'Consumo (l/100km)', 'Costo carburante (€/l)', 'Persone', 'Totale', 'Totale a testa', 'Coeff/km (%)', 'Costi aggiuntivi']];
  state.tragitti.forEach(t => {
    trData.push([t.data, t.km, t.consumo, t.costoCarburante, t.persone, +t.totale.toFixed(2), +t.totaleTesta.toFixed(2), +(t.coeffKm * 100).toFixed(1), t.costiAgg]);
  });
  const wsTr = XLSX.utils.aoa_to_sheet(trData);
  XLSX.utils.book_append_sheet(wb, wsTr, 'Tragitti');

  // Foglio Benzina
  const bzData = [['Data', 'Spesa (€)', 'Costo carburante (€/l)', 'Litri', 'Mese']];
  state.benzina.forEach(b => {
    bzData.push([b.data, +b.spesa.toFixed(2), b.costoCarburante, +b.litri.toFixed(2), b.mese]);
  });
  const wsBz = XLSX.utils.aoa_to_sheet(bzData);
  XLSX.utils.book_append_sheet(wb, wsBz, 'Benzina');

  // Foglio Restituzioni
  const resData = [['Data', 'Totale', ...state.persone]];
  state.restituzioni.forEach(r => {
    const row = [r.data, +r.totale.toFixed(2), ...state.persone.map(p => +(r.dettaglio[p] || 0).toFixed(2))];
    resData.push(row);
  });
  const wsRes = XLSX.utils.aoa_to_sheet(resData);
  XLSX.utils.book_append_sheet(wb, wsRes, 'Restituzioni');

  // Foglio Spese
  const speData = [['Data', 'Totale', ...state.persone]];
  state.spese.forEach(s => {
    const row = [s.data, +s.totale.toFixed(2), ...state.persone.map(p => +(s.dettaglio[p] || 0).toFixed(2))];
    speData.push(row);
  });
  const wsSpe = XLSX.utils.aoa_to_sheet(speData);
  XLSX.utils.book_append_sheet(wb, wsSpe, 'Spese');

  // Foglio Info
  const totKm = state.tragitti.reduce((s, t) => s + t.km, 0);
  const totSpesaTragitti = state.tragitti.reduce((s, t) => s + t.totale, 0);
  const totBenzina = state.benzina.reduce((s, b) => s + b.spesa, 0);
  const totLitri = state.benzina.reduce((s, b) => s + b.litri, 0);
  const mediaConsumo = state.tragitti.length > 0 ? state.tragitti.reduce((s, t) => s + t.consumo, 0) / state.tragitti.length : 0;
  const mediaPrezzoBenzina = state.benzina.length > 0 ? state.benzina.reduce((s, b) => s + b.costoCarburante, 0) / state.benzina.length : 0;
  const totRestituzioni = state.restituzioni.reduce((s, r) => s + r.totale, 0);
  const totSpese = state.spese.reduce((s, sp) => s + sp.totale, 0);

  const infoData = [
    ['GESTIONE BENZINA - RIEPILOGO', ''],
    ['', ''],
    ['Totale KM', totKm.toFixed(1)],
    ['Totale Spesa Tragitti', totSpesaTragitti.toFixed(2)],
    ['Totale Benzina', totBenzina.toFixed(2)],
    ['Totale Litri', totLitri.toFixed(2)],
    ['Media Consumo (l/100km)', mediaConsumo.toFixed(1)],
    ['Media Prezzo Carburante (€/l)', mediaPrezzoBenzina.toFixed(3)],
    ['Totale Restituzioni', totRestituzioni.toFixed(2)],
    ['Totale Spese', totSpese.toFixed(2)],
    ['Saldo Netto', (totRestituzioni - totSpese).toFixed(2)],
    ['', ''],
    ['SALDI PER PERSONA', ''],
    ['Persona', 'Saldo']
  ];

  // Calcola saldi
  const saldi = {};
  state.persone.forEach(p => saldi[p] = 0);
  state.restituzioni.forEach(r => {
    Object.entries(r.dettaglio).forEach(([p, v]) => { if (saldi[p] !== undefined) saldi[p] += v; });
  });
  state.spese.forEach(sp => {
    Object.entries(sp.dettaglio).forEach(([p, v]) => { if (saldi[p] !== undefined) saldi[p] -= v; });
  });
  Object.entries(saldi).sort(([, a], [, b]) => b - a).forEach(([p, s]) => {
    infoData.push([p, +s.toFixed(2)]);
  });

  const wsInfo = XLSX.utils.aoa_to_sheet(infoData);
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Info');

  XLSX.writeFile(wb, 'Gestione-Benzina.xlsx');
  updateStatus('XLSX esportato');
}

function exportXMLSpreadsheet() {
  // Fallback: genera un file XML compatibile con Excel 2003
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<?mso-application progid="Excel.Sheet"?>\n';
  xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"\n';
  xml += ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';

  // Stile
  xml += '<Styles><Style ss:ID="header"><Font ss:Bold="1"/></Style></Styles>\n';

  // Foglio Tragitti
  xml += '<Worksheet ss:Name="Tragitti"><Table>\n';
  xml += '<Row><Cell><Data ss:Type="String">Data</Data></Cell><Cell><Data ss:Type="String">KM</Data></Cell><Cell><Data ss:Type="String">Consumo</Data></Cell><Cell><Data ss:Type="String">CostoCarb</Data></Cell><Cell><Data ss:Type="String">Persone</Data></Cell><Cell><Data ss:Type="String">Totale</Data></Cell><Cell><Data ss:Type="String">TotTesta</Data></Cell></Row>\n';
  state.tragitti.forEach(t => {
    xml += `<Row><Cell><Data ss:Type="String">${t.data}</Data></Cell><Cell><Data ss:Type="Number">${t.km}</Data></Cell><Cell><Data ss:Type="Number">${t.consumo}</Data></Cell><Cell><Data ss:Type="Number">${t.costoCarburante}</Data></Cell><Cell><Data ss:Type="Number">${t.persone}</Data></Cell><Cell><Data ss:Type="Number">${t.totale.toFixed(2)}</Data></Cell><Cell><Data ss:Type="Number">${t.totaleTesta.toFixed(2)}</Data></Cell></Row>\n`;
  });
  xml += '</Table></Worksheet>\n';

  // Foglio Benzina
  xml += '<Worksheet ss:Name="Benzina"><Table>\n';
  xml += '<Row><Cell><Data ss:Type="String">Data</Data></Cell><Cell><Data ss:Type="String">Spesa</Data></Cell><Cell><Data ss:Type="String">CostoCarb</Data></Cell><Cell><Data ss:Type="String">Litri</Data></Cell><Cell><Data ss:Type="String">Mese</Data></Cell></Row>\n';
  state.benzina.forEach(b => {
    xml += `<Row><Cell><Data ss:Type="String">${b.data}</Data></Cell><Cell><Data ss:Type="Number">${b.spesa.toFixed(2)}</Data></Cell><Cell><Data ss:Type="Number">${b.costoCarburante}</Data></Cell><Cell><Data ss:Type="Number">${b.litri.toFixed(2)}</Data></Cell><Cell><Data ss:Type="String">${b.mese}</Data></Cell></Row>\n`;
  });
  xml += '</Table></Worksheet>\n';

  xml += '</Workbook>';
  downloadFile(xml, 'Gestione-Benzina.xls', 'application/vnd.ms-excel');
  updateStatus('XLS esportato (formato legacy)');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Reset
document.getElementById('btn-reset').addEventListener('click', async () => {
  if (confirm('Eliminare TUTTI i dati? Questa azione è irreversibile.')) {
    state = defaultState();
    await saveState();
    renderAll();
    updateStatus('Dati resettati');
  }
});

// ============================================================
// INIT
// ============================================================
function renderAll() {
  renderTragitti();
  renderBenzina();
  renderRestituzioni();
  renderSpese();
  renderPersonTags();
  renderPersonInputs();
  renderTragittoPersone();
}

async function init() {
  const seeded = await seedFromAPI();
  if (!seeded) {
    // No server data yet — use localStorage cache or defaults
    state = loadState();
  }
  renderAll();
  document.querySelector('#form-tragitto input[name="data"]').value = todayISO();
  document.querySelector('#form-benzina input[name="data"]').value = todayISO();
  document.querySelector('#form-restituzione input[name="data"]').value = todayISO();
  document.querySelector('#form-spesa input[name="data"]').value = todayISO();
  updateStatus(`${state.tragitti.length} tragitti · ${state.benzina.length} rifornimenti · ${state.persone.length} persone`);
}

init();

// ============================================================
// SERVICE WORKER (PWA)
// ============================================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
