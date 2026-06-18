#!/usr/bin/env python3
"""Fuel Manager — HTTPS server with REST API + static file serving."""

import json
import os
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8599
APP_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.environ.get("DATA_DIR", APP_DIR)
DATA_FILE = os.path.join(DATA_DIR, "dati.json")

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


def load_data():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return DEFAULT_DATA.copy()


def save_data(data):
    with data_lock:
        with open(DATA_FILE, "w") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=APP_DIR, **kwargs)

    def do_GET(self):
        if self.path == "/api/data" or self.path == "/api/data/":
            data = load_data()
            self._json_response(data)
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == "/api/data" or self.path == "/api/data/":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            data = json.loads(body)
            save_data(data)
            self._json_response({"ok": True})
        else:
            self._json_response({"error": "not found"}, 404)

    def _json_response(self, obj, code=200):
        payload = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(payload)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def log_message(self, format, *args):
        pass


if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Fuel Manager HTTP running on http://0.0.0.0:{PORT}")
    print(f"  → http://debian.tail234659.ts.net:{PORT}")
    server.serve_forever()
