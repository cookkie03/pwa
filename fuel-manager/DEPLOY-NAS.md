# Deploy su Synology NAS (rete Tailscale)

Istruzioni per far girare Fuel Manager ("Serbatoio") su un NAS Synology e
renderlo accessibile via HTTPS dentro la tailnet, tramite reverse proxy.

## 1. Copia e avvio

1. Copia l'intera cartella `fuel-manager/` sul NAS (es. in una Shared Folder,
   `/volume1/docker/fuel-manager`). Assicurati che esista la sottocartella `data/`
   accanto a `docker-compose.yml` (contiene `dati.json`).
2. Da Container Manager → Progetto, oppure da SSH nella cartella:
   ```
   docker compose up -d --build
   ```

## 2. Dove è esposta

Il compose pubblica la porta **solo su loopback**:

```yaml
ports:
  - "127.0.0.1:8599:8599"
```

Quindi l'app è raggiungibile **solo dal NAS stesso** su `http://127.0.0.1:8599`.
Non è esposta sulla LAN né sulla tailnet finché non metti davanti un reverse proxy
(che gira sul NAS e può raggiungere localhost). **Non cambiare questo binding.**

## 3. Accesso HTTPS dalla tailnet — due opzioni

### Opzione A — Reverse proxy di Synology
Control Panel → Login Portal → Advanced → Reverse Proxy → Create:

| Campo | Sorgente | Destinazione |
|-------|----------|--------------|
| Protocollo | `HTTPS` | `HTTP` |
| Hostname | `synologyds224.tail234659.ts.net` | `localhost` |
| Porta | `PORT` (libera, evita 5000/5001) | `8599` |

Il certificato TLS per l'hostname tailnet è gestito da Synology + pacchetto Tailscale.

### Opzione B — Tailscale Serve (TLS automatico, più semplice)
```
tailscale serve --bg --https=443 http://127.0.0.1:8599
```
→ disponibile su `https://synologyds224.tail234659.ts.net` senza configurare certificati.

Servendo su HTTPS, il service worker si registra e la PWA diventa installabile da
iPhone ("Aggiungi a Home").

## 4. Da verificare

- **Tailscale attivo sul NAS** (pacchetto Synology) con MagicDNS abilitato, così
  `synologyds224.tail234659.ts.net` risolve.
- **Proxy alla radice, non in un sotto-percorso.** L'app chiama l'API con path
  assoluto `/api/data`, quindi deve stare su `https://...:PORT/`. Un subpath tipo
  `/fuelmanager/` romperebbe le chiamate API (in quel caso vanno adattati i path).
- **Permessi `./data`**: Container Manager gira i container come root, quindi il
  bind `./data` è scrivibile e `dati.json` viene salvato lì. Verifica solo che la
  cartella esista.
- La porta `PORT` del proxy non deve essere già usata da DSM.

## 5. Note

- `dati.json` e `Gestione Benzina.xlsx` NON sono nel repo (gitignored, dati
  personali): vanno copiati a mano nella cartella `data/` sul NAS.
- Per accesso solo locale (senza tailnet/proxy) basta `docker compose up -d` e
  aprire `http://127.0.0.1:8599` dal NAS.
