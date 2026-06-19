# Deploy delle PWA del hub

Questo repo ospita più PWA personali (una cartella per app: `fuel-manager/`, …).
Tutte seguono la stessa convenzione di deploy, pensata per girare su un **Synology
NAS** ed essere raggiungibili **via HTTPS dentro la rete Tailscale**, restando
private (mai esposte direttamente su LAN o internet).

## Convenzione per ogni PWA

Ogni app è autosufficiente nella sua cartella e contiene:

- `docker-compose.yml` — un servizio dedicato, con porta pubblicata **solo su
  loopback**:
  ```yaml
  ports:
    - "127.0.0.1:<PORTA_APP>:<PORTA_APP>"
  ```
  Così l'app è raggiungibile solo dal NAS stesso; l'unica cosa esposta sulla rete
  sarà il reverse proxy.
- `data/` — bind mount con i dati persistenti (gitignored: dati personali).
- `DEPLOY-NAS.md` — note specifiche dell'app (porta, percorsi, particolarità).

**Una porta loopback distinta per ogni PWA** (es. fuel-manager = 8599). Si evitano
così conflitti quando girano più app insieme.

## Schema di rete

```
device tailnet ──HTTPS──> reverse proxy sul NAS ──HTTP──> 127.0.0.1:<PORTA_APP> (container)
                (TLS Tailscale)        (gira sul NAS, vede il loopback)
```

L'app non ascolta su nessuna interfaccia di rete: solo il proxy, che gira sul NAS,
può raggiungerla. Il proxy è ciò che viene pubblicato sulla tailnet con TLS.

## Esporre una PWA sulla tailnet

Due opzioni (entrambe sul NAS):

**A — Reverse proxy Synology** (Control Panel → Login Portal → Advanced → Reverse Proxy):
- Sorgente: `HTTPS` · `<nashost>.tail<...>.ts.net` · porta pubblica dedicata
- Destinazione: `HTTP` · `localhost` · `<PORTA_APP>`

**B — Tailscale Serve** (TLS automatico):
```
tailscale serve --bg --https=<PORTA_PUBBLICA> http://127.0.0.1:<PORTA_APP>
```

Servire su HTTPS abilita service worker e installazione PWA su iPhone.

## Regole valide per tutte le app

- **Tieni il binding `127.0.0.1`.** Non esporre su `0.0.0.0` (lo metterebbe in
  chiaro sulla LAN: inutile, ci pensa il proxy).
- **Proxy alla radice (porta dedicata), non in sotto-percorso**, se l'app usa path
  assoluti per le API (es. `/api/data`). Un subpath richiederebbe di adattare i path.
- **Tailscale attivo sul NAS** con MagicDNS, così l'hostname tailnet risolve.
- **Dati personali fuori dal repo** (gitignored): vanno copiati a mano in `data/`.
- Container Manager di Synology gira i container come root → i bind `./data` sono
  scrivibili.

## App nel hub

| App | Porta loopback | Note |
|-----|----------------|------|
| fuel-manager | 8599 | vedi `fuel-manager/DEPLOY-NAS.md` |
