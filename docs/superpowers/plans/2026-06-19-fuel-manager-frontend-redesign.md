# Fuel Manager Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the fuel-manager PWA frontend (index.html/style.css/manifest.json + new icons) into a warm, monochromatic editorial design with responsive nav (bottom bar on mobile, sidebar on desktop), CSS-only table→card collapse on mobile, a bento-style Info dashboard, and automatic dark mode — without touching `app.js` or `server.py`.

**Architecture:** Pure presentation-layer change. `index.html` gains inline SVG icons inside the existing 5 tab buttons (same `id`/`data-tab`/`name` attributes app.js relies on) and updated `<meta theme-color>`. `style.css` is restructured around a new set of CSS custom properties (light + `prefers-color-scheme: dark` variants), with new rules for nav positioning, table-to-card collapse via `nth-of-type` + `::before` content, and a bento grid for `.info-grid`. `manifest.json` gets updated theme/background colors. Two PWA icon PNGs are generated locally via a throwaway SVG rendered through headless Chromium (already installed) — they stay gitignored per existing repo convention, so the task is "generate them on disk", not "commit them".

**Tech Stack:** Vanilla HTML/CSS, no build step, no new dependencies. Icon generation uses the system Chromium (`/usr/bin/chromium --headless --screenshot`) — no Python imaging libraries available/needed.

---

## Task 1: Design tokens — palette, typography, base resets

**Files:**
- Modify: `fuel-manager/style.css:1-19` (the `:root` block and `*` reset)

- [ ] **Step 1: Replace the `:root` custom properties with the new warm/editorial palette and add a dark variant**

Replace lines 1–19 of `fuel-manager/style.css`:

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  --primary: #c2562f;
  --primary-dark: #a3431f;
  --danger: #a8412f;
  --success: #6b7a3f;
  --bg: #f7f3ee;
  --card: #fffdfb;
  --text: #241f1a;
  --text-secondary: #6b6259;
  --border: #e3dcd2;
  --radius: 6px;
  --shadow: none;
  --font-serif: ui-serif, Georgia, 'Times New Roman', serif;
}

@media (prefers-color-scheme: dark) {
  :root {
    --primary: #e07a4d;
    --primary-dark: #f0936a;
    --danger: #d97e6b;
    --success: #9caf6b;
    --bg: #1b1714;
    --card: #241f1a;
    --text: #f2ece4;
    --text-secondary: #b3a99d;
    --border: #3a322b;
  }
}
```

Note: `--shadow` is now `none` (was a `box-shadow` value) — this is intentional per the spec ("ombre minime o assenti, contrasto di superficie invece di shadow"). Every later step that used `box-shadow: var(--shadow)` will naturally become a no-op shadow but still needs a `border: 1px solid var(--border)` to keep surface separation — added explicitly where relevant in later tasks.

- [ ] **Step 2: Visually verify the page still loads with the new tokens (no CSS parse errors)**

Run:
```bash
cd /home/luca/pwa/fuel-manager && python3 -c "
import re
css = open('style.css').read()
assert css.count('{') == css.count('}'), 'unbalanced braces'
print('CSS braces balanced:', css.count('{'))
"
```
Expected: `CSS braces balanced: <some number>` with no assertion error.

- [ ] **Step 3: Commit**

```bash
cd /home/luca/pwa && git add fuel-manager/style.css && git commit -m "style(fuel-manager): nuova palette editoriale terracotta con dark mode automatico"
```

---

## Task 2: Header simplification + nav icons in HTML

**Files:**
- Modify: `fuel-manager/index.html:16-25` (header + nav markup)

- [ ] **Step 1: Replace the header block to add inline SVG icons per tab, keep all `id`/`data-tab`/`class` attributes app.js depends on**

Replace lines 16–25 of `fuel-manager/index.html`:

```html
  <header>
    <h1>⛽ Gestione Benzina</h1>
  </header>

  <nav id="tabs">
    <button class="tab active" data-tab="tragitti">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 13l2-7h10l2 7M5 13h14v6H5z"/><circle cx="8" cy="19" r="1.2"/><circle cx="16" cy="19" r="1.2"/></svg>
      <span>Tragitti</span>
    </button>
    <button class="tab" data-tab="benzina">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 21V8l4-4h2l4 4v2h2v7a2 2 0 01-2 2h-1"/><rect x="6" y="8" width="8" height="13"/><path d="M9 12h2"/></svg>
      <span>Benzina</span>
    </button>
    <button class="tab" data-tab="restituzioni">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 12a8 8 0 0114-5M20 12a8 8 0 01-14 5M4 7v4h4M20 17v-4h-4"/></svg>
      <span>Restituz.</span>
    </button>
    <button class="tab" data-tab="spese">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="6" width="18" height="13" rx="1.5"/><path d="M3 10h18M7 15h3"/></svg>
      <span>Spese</span>
    </button>
    <button class="tab" data-tab="info">
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M12 11v5"/></svg>
      <span>Info</span>
    </button>
  </nav>
```

This removes `<nav id="tabs">` from inside `<header>` (it's now a sibling element, needed for the fixed bottom-bar/sidebar positioning in Task 3) but keeps every `id`, `class="tab"`/`class="tab active"`, and `data-tab` value identical to before — `app.js:106-115`'s `document.querySelectorAll('.tab')` click handler needs zero changes.

- [ ] **Step 2: Verify app.js tab-switching still works against the new markup**

Run:
```bash
cd /home/luca/pwa/fuel-manager && grep -c 'data-tab=' index.html
```
Expected: `5`

Run:
```bash
cd /home/luca/pwa/fuel-manager && grep -oE 'data-tab="[a-z]+"' index.html | sort -u
```
Expected (must match the 5 `<section id="...">` ids already in the file):
```
data-tab="benzina"
data-tab="info"
data-tab="restituzioni"
data-tab="spese"
data-tab="tragitti"
```

- [ ] **Step 3: Commit**

```bash
cd /home/luca/pwa && git add fuel-manager/index.html && git commit -m "feat(fuel-manager): icone SVG inline nei tab, header semplificato"
```

---

## Task 3: Responsive navigation CSS (bottom bar mobile / sidebar desktop)

**Files:**
- Modify: `fuel-manager/style.css` (header, `#tabs`, `.tab`, `main`, footer rules — replace the existing header/tabs block, currently around lines 29–76 after Task 1's edits shift line numbers; locate by the `header {`, `#tabs {`, `.tab {` selectors)

- [ ] **Step 1: Replace the existing `header`, `#tabs`, `.tab`, `.tab.active`, `main` rules with the new responsive nav**

Find and replace this whole block (originally `style.css:29-76`, selectors `header`, `header h1`, `#tabs`, `#tabs::-webkit-scrollbar`, `.tab`, `.tab.active`, `main`):

```css
header {
  background: var(--card);
  color: var(--text);
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 100;
}

header h1 {
  font-size: 1.1rem;
  font-weight: 600;
}

#tabs {
  display: flex;
  gap: 4px;
  background: var(--card);
  border-top: 1px solid var(--border);
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  padding: 4px 4px env(safe-area-inset-bottom, 4px);
}

.tab {
  flex: 1;
  background: none;
  border: none;
  color: var(--text-secondary);
  padding: 8px 4px;
  border-radius: var(--radius);
  font-size: 0.68rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transition: color 0.15s, background 0.15s;
}

.tab svg { stroke: currentColor; }

.tab.active {
  background: var(--bg);
  color: var(--primary);
  font-weight: 600;
}

main {
  padding: 16px;
  padding-bottom: 84px;
  max-width: 900px;
  margin: 0 auto;
}

@media (min-width: 768px) {
  header {
    margin-left: 88px;
  }

  #tabs {
    top: 0;
    bottom: 0;
    right: auto;
    width: 88px;
    flex-direction: column;
    border-top: none;
    border-right: 1px solid var(--border);
    padding: 16px 6px;
    gap: 8px;
  }

  .tab {
    font-size: 0.7rem;
    padding: 10px 4px;
  }

  main {
    margin-left: 88px;
    padding-bottom: 16px;
    max-width: 760px;
  }

  footer {
    margin-left: 88px;
  }
}
```

- [ ] **Step 2: Verify the media query and selector count**

Run:
```bash
cd /home/luca/pwa/fuel-manager && grep -c '@media (min-width: 768px)' style.css
```
Expected: `1`

Run:
```bash
cd /home/luca/pwa/fuel-manager && python3 -c "
css = open('style.css').read()
assert css.count('{') == css.count('}'), 'unbalanced braces'
print('OK', css.count('{'))
"
```
Expected: `OK <number>` with no error.

- [ ] **Step 3: Commit**

```bash
cd /home/luca/pwa && git add fuel-manager/style.css && git commit -m "style(fuel-manager): nav responsive, bottom bar mobile / sidebar desktop"
```

---

## Task 4: Forms, buttons, tags, footer restyle

**Files:**
- Modify: `fuel-manager/style.css` (the `form`, `.form-grid`, `button`, `.table-wrapper`, `.person-tag`, `.person-checkbox`, `footer`, `.hint` rules)

- [ ] **Step 1: Replace shadow-based surfaces with border-based surfaces and reduced radius**

Find every occurrence of `box-shadow: var(--shadow);` in `fuel-manager/style.css` (in the `form`, `.table-wrapper`, `.info-card` rules) and replace each with `border: 1px solid var(--border);`. Use this command to confirm the exact occurrences first:

```bash
cd /home/luca/pwa/fuel-manager && grep -n 'box-shadow: var(--shadow)' style.css
```
Expected output (3 lines, exact line numbers may differ slightly after Task 1/3 edits but the selectors are these three):
```
<N>:  box-shadow: var(--shadow);   (inside `form { ... }`)
<N>:  box-shadow: var(--shadow);   (inside `.table-wrapper { ... }`)
<N>:  box-shadow: var(--shadow);   (inside `.info-card { ... }`)
```

Then for each of those 3 rules, change the line from:
```css
  box-shadow: var(--shadow);
```
to:
```css
  border: 1px solid var(--border);
```

- [ ] **Step 2: Restyle buttons (less saturated hover, smaller radius already inherited from `--radius`)**

Find the `button`, `button:hover`, `button.danger`, `button.danger:hover` rules and replace with:

```css
button {
  background: var(--primary);
  color: #fff;
  border: none;
  padding: 10px 20px;
  border-radius: var(--radius);
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
}

button:hover { opacity: 0.88; }
button.danger { background: var(--danger); }
button.danger:hover { opacity: 0.88; }
```

- [ ] **Step 3: Restyle person tags and checkboxes to use the new tokens (replace hardcoded `#e8f0fe` etc.)**

Find `.person-checkbox:has(input:checked)` and replace:
```css
.person-checkbox:has(input:checked) {
  background: var(--bg);
  border-color: var(--primary);
  color: var(--primary);
  font-weight: 500;
}
```

Find `.person-tag` and ensure it uses `var(--primary)`/`var(--radius)` (it already does — no change needed there beyond what Task 1 already updated via the custom properties).

- [ ] **Step 4: Verify no leftover hardcoded Material-blue hex values remain**

Run:
```bash
cd /home/luca/pwa/fuel-manager && grep -inE '#1a73e8|#1557b0|#e8f0fe|#d93025|#188038' style.css
```
Expected: no output (empty — all replaced by tokens).

- [ ] **Step 5: Commit**

```bash
cd /home/luca/pwa && git add fuel-manager/style.css && git commit -m "style(fuel-manager): form/button/tag restyle, sostituiti colori hardcoded con token"
```

---

## Task 5: Responsive table → card collapse (mobile only, CSS-only)

**Files:**
- Modify: `fuel-manager/style.css` (the existing `@media (max-width: 600px)` block, and `table`/`th`/`td` rules)

This must work for all four tables without touching `app.js`. Column order per table (from `index.html` `<thead>`, already existing):
- `#tabella-tragitti`: Data, KM, l/100km, €/l, Persone, Totale, Tot/testa, Coeff/km, Incongr., (azione)
- `#tabella-benzina`: Data, Spesa, €/l, Litri, Mese, (azione)
- `#tabella-restituzioni`: Data, Totale, Dettaglio per persona, (azione)
- `#tabella-spese`: Data, Totale, Dettaglio per persona, (azione)

- [ ] **Step 1: Replace the breakpoint block at the end of `style.css` (originally lines 311-315, `@media (max-width: 600px) { .form-grid {...} .info-grid {...} th, td {...} }`) with the full responsive-table-to-card ruleset**

This uses per-table, per-column `nth-of-type` selectors with literal label text (not `attr(data-label)`) — `app.js` generates plain `<td>` elements with no `data-label` attribute, and `attr()` can only read attributes that actually exist on the element, so hardcoded `nth-of-type` labels are the only zero-HTML/JS-change option here. Column order matches the `<thead>` order listed above.

```css
@media (max-width: 767px) {
  .form-grid { grid-template-columns: 1fr; }
  .info-grid { grid-template-columns: 1fr 1fr; }

  .table-wrapper { overflow-x: visible; }

  table, thead, tbody, tr, td { display: block; width: 100%; }
  thead { display: none; }

  table tbody tr {
    border: 1px solid var(--border);
    border-radius: var(--radius);
    margin: 0 0 10px;
    padding: 10px 12px;
    position: relative;
  }

  table td {
    border-bottom: none;
    padding: 4px 0;
    white-space: normal;
    text-align: left;
  }

  table td::before {
    display: inline-block;
    min-width: 90px;
    font-size: 0.7rem;
    color: var(--text-secondary);
    font-weight: 600;
  }

  #tabella-tragitti td:nth-of-type(1)::before { content: "Data"; }
  #tabella-tragitti td:nth-of-type(2)::before { content: "KM"; }
  #tabella-tragitti td:nth-of-type(3)::before { content: "l/100km"; }
  #tabella-tragitti td:nth-of-type(4)::before { content: "€/l"; }
  #tabella-tragitti td:nth-of-type(5)::before { content: "Persone"; }
  #tabella-tragitti td:nth-of-type(6)::before { content: "Totale"; }
  #tabella-tragitti td:nth-of-type(7)::before { content: "Tot/testa"; }
  #tabella-tragitti td:nth-of-type(8)::before { content: "Coeff/km"; }
  #tabella-tragitti td:nth-of-type(9)::before { content: "Incongr."; }

  #tabella-benzina td:nth-of-type(1)::before { content: "Data"; }
  #tabella-benzina td:nth-of-type(2)::before { content: "Spesa"; }
  #tabella-benzina td:nth-of-type(3)::before { content: "€/l"; }
  #tabella-benzina td:nth-of-type(4)::before { content: "Litri"; }
  #tabella-benzina td:nth-of-type(5)::before { content: "Mese"; }

  #tabella-restituzioni td:nth-of-type(1)::before,
  #tabella-spese td:nth-of-type(1)::before { content: "Data"; }
  #tabella-restituzioni td:nth-of-type(2)::before,
  #tabella-spese td:nth-of-type(2)::before { content: "Totale"; }
  #tabella-restituzioni td:nth-of-type(3)::before,
  #tabella-spese td:nth-of-type(3)::before { content: "Dettaglio"; }

  table td:last-child {
    position: absolute;
    top: 8px;
    right: 8px;
    text-align: right;
  }
  table td:last-child::before { content: none; }
}
```

- [ ] **Step 2: Verify CSS validity and that the breakpoint now covers 768px (matching Task 3's desktop breakpoint exactly, no gap/overlap)**

Run:
```bash
cd /home/luca/pwa/fuel-manager && grep -n '@media (max-width: 767px)\|@media (min-width: 768px)' style.css
```
Expected: both lines present, one with `max-width: 767px` (mobile rules) and one with `min-width: 768px` (Task 3's desktop nav rules) — confirming no gap (767/768 are adjacent integers).

Run:
```bash
cd /home/luca/pwa/fuel-manager && python3 -c "
css = open('style.css').read()
assert css.count('{') == css.count('}'), 'unbalanced braces'
print('OK', css.count('{'))
"
```
Expected: `OK <number>`.

- [ ] **Step 3: Visual verification in headless Chromium — table rows collapse to cards under 767px and stay as a table at 768px+**

```bash
mkdir -p /tmp/fueltest-redesign && cp -r /home/luca/pwa/fuel-manager/* /tmp/fueltest-redesign/
cd /tmp/fueltest-redesign
openssl req -x509 -newkey rsa:2048 -keyout debian.tail234659.ts.net.key -out debian.tail234659.ts.net.crt -days 1 -nodes -subj "/CN=debian.tail234659.ts.net" >/tmp/openssl.log 2>&1
rm -f dati.json
DATA_DIR=/tmp/fueltest-redesign nohup python3 server.py > server.log 2>&1 &
sleep 1
curl -sk https://127.0.0.1:8599/api/data >/dev/null && echo "server up"
```

```bash
cat > /tmp/fueltest-redesign/check_table_layout.js <<'EOF'
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  for (const width of [375, 1024]) {
    const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width, height: 800 } });
    await page.goto('https://127.0.0.1:8599/index.html', { waitUntil: 'networkidle' });
    await page.fill('input[name="km"]', '50');
    await page.fill('input[name="consumo"]', '6');
    await page.fill('input[name="costoCarburante"]', '1.8');
    await page.click('#form-tragitto button[type="submit"]');
    await page.waitForTimeout(300);
    const trDisplay = await page.$eval('#tabella-tragitti tbody tr', el => getComputedStyle(el).display);
    console.log(`width=${width} tr.display=${trDisplay}`);
  }
  await browser.close();
})();
EOF
cd /tmp/fueltest-redesign && npm init -y >/dev/null 2>&1 && npm install playwright >/tmp/npm.log 2>&1 && node check_table_layout.js
```
Expected output:
```
width=375 tr.display=block
width=1024 tr.display=table-row
```

```bash
pkill -f "/tmp/fueltest-redesign/server.py" 2>/dev/null; rm -rf /tmp/fueltest-redesign
```

- [ ] **Step 4: Commit**

```bash
cd /home/luca/pwa && git add fuel-manager/style.css && git commit -m "style(fuel-manager): collasso tabelle in card su mobile, solo CSS"
```

---

## Task 6: Info dashboard bento grid + serif numbers

**Files:**
- Modify: `fuel-manager/style.css` (`.info-grid`, `.info-card`, `.info-card .value` rules)

- [ ] **Step 1: Replace `.info-grid` and `.info-card .value` rules**

Find `.info-grid` (currently `grid-template-columns: 1fr 1fr;`) and replace with:

```css
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  grid-auto-flow: dense;
  gap: 10px;
  margin-bottom: 20px;
}

@media (min-width: 768px) {
  .info-grid { grid-template-columns: repeat(4, 1fr); }
}

.info-card[style*="grid-column"] {
  padding: 20px;
}
```

Note: `renderInfo()` in `app.js` already sets `style="grid-column:1/-1"` inline on the "Saldo Netto" card (see `app.js:476`) — this is the existing hero-card marker, no JS change needed. The `[style*="grid-column"]` attribute selector targets exactly that card to give it extra padding for the "hero" bento treatment.

Find `.info-card .value` and replace with:

```css
.info-card .value {
  font-family: var(--font-serif);
  font-size: 1.4rem;
  font-weight: 600;
  margin-top: 4px;
}

.info-card[style*="grid-column"] .value {
  font-size: 2rem;
}
```

- [ ] **Step 2: Verify the hero card selector matches the markup `app.js` actually produces**

Run:
```bash
cd /home/luca/pwa/fuel-manager && grep -n 'grid-column:1/-1' app.js
```
Expected: one match, inside the template literal for the "Saldo Netto" card (confirms the `[style*="grid-column"]` CSS selector in Step 1 will match it; this is a read-only check, `app.js` is not modified).

- [ ] **Step 3: Verify CSS validity**

```bash
cd /home/luca/pwa/fuel-manager && python3 -c "
css = open('style.css').read()
assert css.count('{') == css.count('}'), 'unbalanced braces'
print('OK', css.count('{'))
"
```
Expected: `OK <number>`.

- [ ] **Step 4: Commit**

```bash
cd /home/luca/pwa && git add fuel-manager/style.css && git commit -m "style(fuel-manager): dashboard Info in bento grid, numeri in serif"
```

---

## Task 7: manifest.json + meta theme-color

**Files:**
- Modify: `fuel-manager/manifest.json:1-22`
- Modify: `fuel-manager/index.html:6` (`<meta name="theme-color">`)

- [ ] **Step 1: Update `manifest.json` colors**

Replace lines 6–8 of `fuel-manager/manifest.json`:
```json
  "background_color": "#f8f9fa",
  "theme_color": "#1a73e8",
```
with:
```json
  "background_color": "#f7f3ee",
  "theme_color": "#c2562f",
```

- [ ] **Step 2: Update the `<meta name="theme-color">` in `index.html`**

Replace line 6 of `fuel-manager/index.html`:
```html
  <meta name="theme-color" content="#1a73e8">
```
with:
```html
  <meta name="theme-color" content="#c2562f">
```

- [ ] **Step 3: Verify `manifest.json` is still valid JSON**

```bash
cd /home/luca/pwa/fuel-manager && python3 -c "import json; json.load(open('manifest.json')); print('valid JSON')"
```
Expected: `valid JSON`

- [ ] **Step 4: Commit**

```bash
cd /home/luca/pwa && git add fuel-manager/manifest.json fuel-manager/index.html && git commit -m "feat(fuel-manager): theme-color manifest/meta allineati alla nuova palette"
```

---

## Task 8: Generate new PWA icons (local-only, gitignored)

**Files:**
- Create (local, not committed — matched by `.gitignore` patterns `icon-192.png`/`icon-512.png`): `fuel-manager/icon-192.png`, `fuel-manager/icon-512.png`
- Create then delete (scratch file): `/tmp/fuel-icon.html`

- [ ] **Step 1: Write a throwaway HTML file rendering the icon at 512×512**

```bash
cat > /tmp/fuel-icon.html <<'EOF'
<!DOCTYPE html>
<html><head><style>
  html,body{margin:0;padding:0}
  svg{display:block}
</style></head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#c2562f"/>
  <g transform="translate(256,256)">
    <path d="M-70 110 V-30 L-20 -90 H40 L90 -30 V110 Z" fill="none" stroke="#fffdfb" stroke-width="22" stroke-linejoin="round"/>
    <rect x="-70" y="10" width="160" height="100" fill="none" stroke="#fffdfb" stroke-width="22"/>
    <circle cx="-30" cy="60" r="8" fill="#fffdfb"/>
    <circle cx="30" cy="60" r="8" fill="#fffdfb"/>
  </g>
</svg>
</body></html>
EOF
echo written
```
Expected: `written`

- [ ] **Step 2: Rasterize to icon-512.png via headless Chromium**

```bash
chromium --headless --disable-gpu --screenshot=/home/luca/pwa/fuel-manager/icon-512.png --window-size=512,512 --default-background-color=00000000 "file:///tmp/fuel-icon.html" 2>&1 | tail -5
ls -la /home/luca/pwa/fuel-manager/icon-512.png
```
Expected: a non-empty PNG file listed (size > 0 bytes).

- [ ] **Step 3: Rasterize to icon-192.png at the smaller size**

```bash
chromium --headless --disable-gpu --screenshot=/home/luca/pwa/fuel-manager/icon-192.png --window-size=192,192 --default-background-color=00000000 "file:///tmp/fuel-icon.html" 2>&1 | tail -5
ls -la /home/luca/pwa/fuel-manager/icon-192.png
```
Expected: a non-empty PNG file listed.

- [ ] **Step 4: Verify both icons are correctly ignored by git (per existing `.gitignore`, not a new exclusion needed)**

```bash
cd /home/luca/pwa && git status --short fuel-manager/icon-192.png fuel-manager/icon-512.png
git check-ignore -v fuel-manager/icon-192.png fuel-manager/icon-512.png
```
Expected: `git status --short` prints nothing (files are ignored, not untracked); `git check-ignore -v` prints two lines showing `.gitignore` matching `icon-192.png` and `icon-512.png`.

- [ ] **Step 5: Clean up the scratch HTML file (not part of the repo)**

```bash
rm -f /tmp/fuel-icon.html
```

- [ ] **Step 6: No commit needed** — these PNGs are intentionally untracked (gitignored). Nothing to commit for this task; verify `git status` in the repo is otherwise clean before moving to Task 9.

```bash
cd /home/luca/pwa && git status --short
```
Expected: empty (everything from Tasks 1–7 was already committed).

---

## Task 9: Full visual + functional regression check

**Files:** none modified — verification only.

- [ ] **Step 1: Boot a throwaway instance of the redesigned app**

```bash
mkdir -p /tmp/fueltest-final && cp -r /home/luca/pwa/fuel-manager/* /tmp/fueltest-final/
cd /tmp/fueltest-final
openssl req -x509 -newkey rsa:2048 -keyout debian.tail234659.ts.net.key -out debian.tail234659.ts.net.crt -days 1 -nodes -subj "/CN=debian.tail234659.ts.net" >/tmp/openssl.log 2>&1
rm -f dati.json
DATA_DIR=/tmp/fueltest-final nohup python3 server.py > server.log 2>&1 &
sleep 1
curl -sk https://127.0.0.1:8599/api/data >/dev/null && echo "server up"
```

- [ ] **Step 2: Run a full Playwright pass covering all 5 tabs, both breakpoints, and both color schemes, asserting zero console errors**

```bash
cat > /tmp/fueltest-final/full_check.js <<'EOF'
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const results = [];
  for (const colorScheme of ['light', 'dark']) {
    for (const width of [375, 1280]) {
      const page = await browser.newPage({ ignoreHTTPSErrors: true, viewport: { width, height: 800 }, colorScheme });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto('https://127.0.0.1:8599/index.html', { waitUntil: 'networkidle' });
      for (const tab of ['tragitti','benzina','restituzioni','spese','info']) {
        await page.click(`button[data-tab="${tab}"]`);
        await page.waitForTimeout(100);
      }
      results.push({ colorScheme, width, errors });
    }
  }
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
})();
EOF
cd /tmp/fueltest-final && npm init -y >/dev/null 2>&1 && npm install playwright >/tmp/npm.log 2>&1 && node full_check.js
```
Expected: JSON output with 4 entries (light/375, light/1280, dark/375, dark/1280), each with `"errors": []`.

- [ ] **Step 3: Submit the Tragitto form end-to-end and confirm persistence, matching the existing verified flow**

```bash
cat > /tmp/fueltest-final/submit_check.js <<'EOF'
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.goto('https://127.0.0.1:8599/index.html', { waitUntil: 'networkidle' });
  await page.fill('input[name="km"]', '88');
  await page.fill('input[name="consumo"]', '6.2');
  await page.fill('input[name="costoCarburante"]', '1.80');
  await page.click('#form-tragitto button[type="submit"]');
  await page.waitForTimeout(300);
  const apiData = await page.evaluate(async () => (await fetch('/api/data')).json());
  console.log(JSON.stringify({ tragittiCount: apiData.tragitti.length }));
  await browser.close();
})();
EOF
cd /tmp/fueltest-final && node submit_check.js
```
Expected: `{"tragittiCount":1}`

- [ ] **Step 4: Clean up the throwaway instance**

```bash
pkill -f "/tmp/fueltest-final/server.py" 2>/dev/null
rm -rf /tmp/fueltest-final
```

- [ ] **Step 5: Confirm working tree is clean (all redesign commits already made in Tasks 1-7; icons from Task 8 stay untracked by design)**

```bash
cd /home/luca/pwa && git status --short && git log --oneline -10
```
Expected: empty status output, and the log shows the sequence of redesign commits from Tasks 1–7 on top of the earlier bugfix/spec commits.

---

## Plan Self-Review Notes

- **Spec coverage:** §1 Identità visiva → Task 1 + Task 4 (hardcoded color sweep) + Task 6 (serif numbers). §2 Navigazione → Task 2 + Task 3. §3 Liste dati → Task 5. §4 Dashboard Info → Task 6. §5 Icone/manifest → Task 7 + Task 8. "Cosa non cambia" (`app.js`/`server.py` untouched) → verified read-only in Tasks 2 Step 2, 5 Step 4, 6 Step 2; no task ever opens those files for writing. Verification section of the spec → Task 9.
- **Placeholder scan:** no TBD/TODO; every step has literal code/commands and literal expected output.
- **Type/selector consistency:** `data-tab` values (`tragitti`/`benzina`/`restituzioni`/`spese`/`info`) match across Task 2 and the pre-existing `<section id="...">`s referenced in Task 2 Step 2's check. Table ids (`#tabella-tragitti` etc.) used in Task 5 match the ids already in `index.html`. CSS custom property names (`--primary`, `--bg`, `--font-serif`, etc.) introduced in Task 1 are the only ones referenced in Tasks 3/4/6 — no mismatched token names.
