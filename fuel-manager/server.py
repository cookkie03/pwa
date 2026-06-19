#!/usr/bin/env python3
"""Fuel Manager — HTTPS server with REST API + static file serving.

Endpoints:
  GET  /api/data          → full state (persone, tragitti, rifornimenti, restituzioni, spese)
  POST /api/data          → full state save (backward compat)
  GET  /api/persone       → list of persone
  POST /api/tragitti      → add a tragitto
  POST /api/rifornimenti  → add a rifornimento

Authentication: X-API-Key header (or ?api_key= query param for convenience).
"""

import json
import os
import re
import threading
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from datetime import date

PORT = 8599
APP_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("DATA_DIR", APP_DIR)
DATA_FILE = os.path.join(DATA_DIR, "dati.json")

# API key — defaults to dev key, override via env var
API_KEY = os.environ.get("FUEL_API_KEY", "fuel-dev-key-2026")

DEFAULT_DATA = {
    "persone": [
        "Luca", "Marco", "Daniel De Leo", "Federico Vessio", "Rebecca Fato",
        "Alessio Paparella", "Matteo Sangalli", "Giulia Pierin", "Alice Tonoli",
        "Ionuts Purniki", "Leonardo Scimone", "David Karpik", "Filippo Sciarpa",
        "Ilenia Boccagno", "Giorgia Bennici", "Sofia Vessio", "Romina Zeza",
        "Sonia Bertani", "Dennis Molinari", "Edoardo Ballarini", "Alessia Mongiardo",
        "Kerlins Hernandez", "Manuel Di Lanna", "Noemi Pianta", "Riccardo Carissimi",
        "Emanuele Meloni", "Marzio Foti", "Tommaso Signori", "Emanuele Radice",
        "Yuri Comelli", "Andres Lo Monaco", "Simone Lenoci", "Stella Massironi",
        "Zoe Nastrino", "Serena Malusardi", "Naike Maldifassi", "Simone Carcano"
    ],
    "tragitti": [],
    "benzina": [],
    "restituzioni": [],
    "spese": []
}

data_lock = threading.Lock()


# ── Data helpers ──────────────────────────────────────────────

def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return normalize(json.load(f))
    return DEFAULT_DATA.copy()


def save_data(data):
    with data_lock:
        with open(DATA_FILE, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


def today_iso():
    return date.today().isoformat()


def next_id(data, key):
    """Return next safe integer id for a given collection."""
    items = data.get(key, [])
    if not items:
        return 1
    max_id = 0
    for item in items:
        if isinstance(item, dict):
            max_id = max(max_id, item.get("id", 0))
    return max_id + 1


def normalize(s):
    """Ensure all expected keys exist and migrate old schema."""
    if not s:
        s = {}
    out = {
        "persone": list(s.get("persone", [])),
        "tragitti": list(s.get("tragitti", [])),
        "rifornimenti": list(s.get("rifornimenti", [])),
        "restituzioni": list(s.get("restituzioni", [])),
        "spese": list(s.get("spese", [])),
    }
    # migrate old "benzina" → "rifornimenti"
    if not out["rifornimenti"] and s.get("benzina"):
        out["rifornimenti"] = [
            {
                "id": b.get("id") or (i + 1),
                "data": b.get("data", ""),
                "importo": b.get("spesa", 0),
                "costo": b.get("costoCarburante", 0),
            }
            for i, b in enumerate(s["benzina"])
        ]
    return out


# ── Validation ───────────────────────────────────────────────

def validate_tragitto(body):
    """Validate tragitto payload, return (cleaned_dict, error_msg)."""
    if not isinstance(body, dict):
        return None, "Body must be a JSON object"

    km = body.get("km")
    if km is None:
        return None, "Missing required field: km"
    try:
        km = float(km)
    except (ValueError, TypeError):
        return None, "km must be a number"
    if km <= 0:
        return None, "km must be > 0"
    if km > 100000:
        return None, "km seems too large (max 100000)"

    consumo = body.get("consumo", 6.7)
    try:
        consumo = float(consumo)
    except (ValueError, TypeError):
        return None, "consumo must be a number"
    if consumo <= 0 or consumo > 50:
        return None, "consumo must be between 0 and 50"

    data = body.get("data", today_iso())
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", str(data)):
        return None, "data must be YYYY-MM-DD format"

    partecipanti = body.get("partecipanti", ["Luca"])
    if not isinstance(partecipanti, list) or not partecipanti:
        return None, "partecipanti must be a non-empty list"
    partecipanti = [str(p).strip() for p in partecipanti if p and str(p).strip()]
    if not partecipanti:
        return None, "partecipanti must have at least one name"

    costi_agg = body.get("costiAgg", 0)
    try:
        costi_agg = float(costi_agg)
    except (ValueError, TypeError):
        return None, "costiAgg must be a number"
    if costi_agg < 0 or costi_agg > 10000:
        return None, "costiAgg must be between 0 and 10000"

    return {
        "data": data,
        "km": round(km, 1),
        "consumo": round(consumo, 2),
        "partecipanti": partecipanti,
        "costiAgg": round(costi_agg, 2),
    }, None


def validate_rifornimento(body):
    """Validate rifornimento payload, return (cleaned_dict, error_msg)."""
    if not isinstance(body, dict):
        return None, "Body must be a JSON object"

    importo = body.get("importo")
    if importo is None:
        return None, "Missing required field: importo"
    try:
        importo = float(importo)
    except (ValueError, TypeError):
        return None, "importo must be a number"
    if importo <= 0 or importo > 10000:
        return None, "importo must be between 0 and 10000"

    costo = body.get("costo")
    if costo is None:
        return None, "Missing required field: costo"
    try:
        costo = float(costo)
    except (ValueError, TypeError):
        return None, "costo must be a number"
    if costo <= 0 or costo > 10:
        return None, "costo must be between 0 and 10"

    data = body.get("data", today_iso())
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", str(data)):
        return None, "data must be YYYY-MM-DD format"

    return {
        "data": data,
        "importo": round(importo, 2),
        "costo": round(costo, 3),
    }, None


# ── HTTP Handler ─────────────────────────────────────────────

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=APP_DIR, **kwargs)

    def _check_auth(self):
        """Check API key, return True if authorized."""
        # Check header
        key = self.headers.get("X-API-Key", "")
        if key == API_KEY:
            return True
        # Check query param (useful for simple GET requests / testing)
        if "api_key=" in self.path:
            for part in self.path.split("?")[1].split("&"):
                if part.startswith("api_key=") and part[8:] == API_KEY:
                    return True
        return False

    def _json_response(self, obj, code=200):
        payload = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
        self.send_header("Access-Control-Expose-Headers", "X-Request-Id")
        self.end_headers()
        self.wfile.write(payload)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        try:
            body = self.rfile.read(length)
            return json.loads(body)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/api/data":
            data = load_data()
            self._json_response(data)

        elif path == "/api/persone":
            data = load_data()
            persone = data.get("persone", [])
            self._json_response({"persone": persone})

        else:
            super().do_GET()

    def do_POST(self):
        path = self.path.split("?")[0]

        # Auth check for write endpoints
        if not self._check_auth():
            self._json_response({"error": "Unauthorized — provide X-API-Key header"}, 401)
            return

        if path == "/api/data":
            # Full state save (backward compat)
            body = self._read_body()
            if body is None:
                self._json_response({"error": "Invalid JSON"}, 400)
                return
            data = normalize(body)
            save_data(data)
            self._json_response({"ok": True})

        elif path == "/api/tragitti":
            body = self._read_body()
            if body is None:
                self._json_response({"error": "Invalid JSON"}, 400)
                return
            cleaned, err = validate_tragitto(body)
            if err:
                self._json_response({"error": err}, 400)
                return
            data = load_data()
            cleaned["id"] = next_id(data, "tragitti")
            data["tragitti"].append(cleaned)
            save_data(data)
            self._json_response({"ok": True, "id": cleaned["id"], "item": cleaned}, 201)

        elif path == "/api/rifornimenti":
            body = self._read_body()
            if body is None:
                self._json_response({"error": "Invalid JSON"}, 400)
                return
            cleaned, err = validate_rifornimento(body)
            if err:
                self._json_response({"error": err}, 400)
                return
            data = load_data()
            cleaned["id"] = next_id(data, "rifornimenti")
            data["rifornimenti"].append(cleaned)
            save_data(data)
            self._json_response({"ok": True, "id": cleaned["id"], "item": cleaned}, 201)

        else:
            self._json_response({"error": "not found"}, 404)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-API-Key")
        self.end_headers()

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Fuel Manager API running on http://0.0.0.0:{PORT}")
    print(f"  → http://debian.tail234659.ts.net:{PORT}")
    print(f"  API Key: {API_KEY}")
    print(f"  Endpoints:")
    print(f"    GET  /api/data")
    print(f"    GET  /api/persone")
    print(f"    POST /api/tragitti      {{data, km, consumo, partecipanti, costiAgg}}")
    print(f"    POST /api/rifornimenti  {{data, importo, costo}}")
    print(f"    POST /api/data         (full state, backward compat)")
    server.serve_forever()
