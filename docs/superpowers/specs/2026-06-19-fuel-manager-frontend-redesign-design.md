# Fuel Manager — Frontend Redesign (Design Spec)

Data: 2026-06-19
Progetto: `fuel-manager/` (PWA personale, hub `/home/luca/pwa`)
Scope: solo `index.html`, `style.css`, `manifest.json`, icone PWA. **`app.js` non viene modificato** — tutta la logica di stato, fetch API, render delle tabelle e gestione form resta identica. Le modifiche HTML sono limitate a markup/attributi necessari per il nuovo stile (es. icone SVG nei tab), senza toccare id/name usati da `app.js`.

## Obiettivo

Sostituire l'attuale stile "Material standard" (blu Google, ombre leggere, tab a pillola) con un'estetica minimal/editoriale curata, mobile-first ma con una buona esperienza desktop dedicata, mantenendo intatta la struttura a 5 sezioni (Tragitti, Benzina, Restituzioni, Spese, Info) e tutto il comportamento esistente.

## 1. Identità visiva

- **Palette**: monocromatica calda su base neutra.
  - Light: sfondo avorio/crema chiaro (`#f7f3ee` circa), testo quasi-nero caldo (`#241f1a`), superfici card leggermente più chiare del sfondo con bordo sottile invece di ombra pesante.
  - Dark (via `prefers-color-scheme: dark`, automatico, nessun toggle manuale): sfondo quasi-nero caldo (`#1b1714`), testo crema (`#f2ece4`), stessa logica di accenti.
  - **Accento**: terracotta/ambra (`#c2562f` circa famiglia) per CTA, stati attivi, tab selezionata, valori positivi nei saldi.
  - Valori negativi: rosso desaturato coerente con la palette calda (non un rosso semaforico puro), es. `#a8412f`/variante più scura del rosso terracotta.
- **Bordi e raggi**: bordi 1px sottili come elemento primario di separazione; `border-radius` ridotto (4–6px) rispetto agli 8px attuali, per un tono meno "app generica".
- **Ombre**: minime o assenti; dove serve profondità, si usa contrasto di superficie (sfondo card vs sfondo pagina) invece di `box-shadow` marcate.
- **Tipografia**: stack di sistema sans-serif per body/UI (stesso stack attuale: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`). Per i **valori numerici in evidenza** (importi € e KM totali nelle card della dashboard Info, e i valori principali nelle card-liste su mobile) si usa un font serif/display via stack locale (`ui-serif, Georgia, 'Times New Roman', serif`) — nessun font esterno caricato, zero impatto su performance/offline.

## 2. Navigazione responsive

Stessa struttura DOM esistente (`<nav id="tabs">` con 5 `<button class="tab" data-tab="...">`), nessuna modifica alla logica JS di switch tab in `app.js`. Cambia solo markup interno dei bottoni (icona SVG inline + etichetta) e posizionamento via CSS:

- **Mobile (`< 768px`)**: `#tabs` diventa una bottom tab bar fissa (`position: fixed; bottom: 0; left: 0; right: 0`), icona sopra/affianco a etichetta breve, header in alto ridotto al solo titolo dell'app (niente più tab scrollabili in header).
- **Desktop (`≥ 768px`)**: `#tabs` diventa una sidebar verticale fissa a sinistra (`position: fixed; top:0; left:0; height:100vh; flex-direction: column`), contenuto principale (`main`) con `margin-left` pari alla larghezza sidebar e `max-width` centrato (~760px) nello spazio rimanente per leggibilità.
- Icone: SVG inline semplici (linee, coerenti con la palette), una per tab — niente emoji.

## 3. Liste dati (Tragitti, Benzina, Restituzioni, Spese)

Le tabelle (`<table id="tabella-...">`) restano generate da `app.js` esattamente come oggi (stesso markup `<tr><td>...`). Il cambio di presentazione è **100% CSS, responsive table → card**:

- **Desktop**: tabella tradizionale, restyling (header meno pesante, riga con hover sottile, meno densità verticale).
- **Mobile (`< 768px`)**: ogni `<tr>` diventa una card a blocco (`display: block` su `tr`, con padding/bordo/radius), ogni `<td>` mostra un'etichetta automatica via `::before { content: "..." }` posizionata per indice colonna (`nth-of-type`), dato che l'ordine delle colonne è fisso per ciascuna tabella. Il `<thead>` viene nascosto (`display:none`) sotto il breakpoint.
- L'ultima colonna (bottone elimina) resta visibile come azione in alto a destra della card, senza etichetta.

Questa tecnica non richiede alcuna modifica ad `app.js`: le etichette sono hardcoded in CSS nello stesso ordine delle colonne `<th>` esistenti in `index.html`.

## 4. Dashboard "Info"

- Le card generate da `renderInfo()` in `app.js` (stessa struttura `.info-card` con `.label`/`.value`/`.sub`) vengono ristilizzate in una **bento grid asimmetrica**: la card "Saldo Netto" (già marcata `grid-column:1/-1` nel JS esistente) diventa la card "hero" più grande/prominente, le altre si dispongono in griglia 2 colonne (mobile) / più colonne (desktop) di dimensione minore.
- I valori (`€`, KM) usano il font serif descritto sopra.
- La sezione "Saldi per persona" (generata via `insertAdjacentHTML`, stessa struttura `.info-card`) viene ristilizzata con una barra di colore proporzionale al valore (positiva = accento terracotta, negativa = rosso desaturato) sotto il nome — solo CSS (`background` a gradiente lineare o pseudo-elemento), nessuna modifica al markup generato da JS necessaria oltre a quanto già presente.

## 5. Icone PWA e manifest

- Genero nuove `icon-192.png` e `icon-512.png` (simbolo benzina/goccia stilizzato, sfondo terracotta, simbolo crema) coerenti con la nuova identità. Questi file sono gitignorati (per design del repo, vedi `.gitignore` root) — verranno generati localmente e referenziati, non commitati nel repo (coerente con la pratica attuale per asset generati).
- Aggiorno `manifest.json`: `theme_color` e `background_color` allineati alla nuova palette (light).
- Aggiorno `<meta name="theme-color">` in `index.html` allineato.

## Cosa NON cambia

- `app.js`: nessuna modifica. Tutta la logica di stato, fetch `/api/data`, validazione form, calcoli (saldi, totali, coefficienti), import/export CSV/JSON/XLSX resta identica.
- `server.py`: nessuna modifica (fuori scope, già verificato funzionante in sessione precedente).
- Struttura dei 5 form e dei rispettivi campi/name: identica, solo restyling visivo.
- Nessun toggle manuale dark/light: solo `prefers-color-scheme` automatico.

## Verifica

- Apertura della pagina in Chromium (headless e/o con `/run` skill) per controllare: nessun errore console, le 5 tab funzionano, submit dei 4 form principali funziona e i dati arrivano a `/api/data`, layout corretto sia in viewport mobile (≤768px) che desktop (≥768px), dark mode visivamente coerente forzando `prefers-color-scheme: dark` negli strumenti dev.
- Nessun test automatico esistente nel repo da rompere (non ce ne sono); verifica manuale/visuale è il criterio di accettazione.
