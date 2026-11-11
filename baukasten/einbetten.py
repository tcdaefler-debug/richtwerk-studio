#!/usr/bin/env python3
"""Bettet die Hammer Betriebszentrale in das Richtwerk Studio ein.

Aufruf (im Repo-Hauptordner):
    python3 baukasten/einbetten.py

Liest kunden/ludwig-hammer/ludwig-hammer-app.html, setzt die Ein-Klick-Anmeldung
für Personen ein und schreibt das Ergebnis als HAMMER_HTML in
baukasten/richtwerk-studio.html. Danach das Studio auf claude.ai neu veröffentlichen.
Die Hammer-Datei selbst wird nicht verändert.
"""
import json, pathlib, re, sys

root = pathlib.Path(__file__).resolve().parent.parent
hammer = root / "kunden/ludwig-hammer/ludwig-hammer-app.html"
studio = root / "baukasten/richtwerk-studio.html"

h = hammer.read_text(encoding="utf-8")
alt = "$('#loginGo').textContent='Als '+r.who.split(' ')[0]+' anmelden'});"
neu = "$('#loginGo').textContent='Als '+r.who.split(' ')[0]+' anmelden';$('#loginGo').click()});"
if h.count(alt) != 1:
    sys.exit("Anmelde-Stelle in der Hammer-Datei nicht gefunden, bitte Skript anpassen.")
h = h.replace(alt, neu)
literal = json.dumps(h, ensure_ascii=False).replace("</", "<\\/")

s = studio.read_text(encoding="utf-8")
s, n = re.subn(r"^const HAMMER_HTML=.*;$", lambda m: "const HAMMER_HTML=" + literal + ";", s, count=1, flags=re.M)
if n != 1:
    sys.exit("HAMMER_HTML im Studio nicht gefunden.")
studio.write_text(s, encoding="utf-8")
print("Eingebettet:", len(h), "Zeichen")
