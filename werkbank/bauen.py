#!/usr/bin/env python3
"""Baut aus werkbank/src/ eine einzige HTML-Datei (werkbank/richtwerk-werkbank.html).
Aufruf: python3 werkbank/bauen.py"""
import pathlib

ordner = pathlib.Path(__file__).resolve().parent
src = ordner / 'src'
# Reihenfolge ist wichtig: Hilfen und Speicher zuerst, Start (app.js) zuletzt
REIHENFOLGE = ['hilfen.js', 'store.js', 'bausteine.js', 'demo.js', 'gemeinsam.js', 'buero.js', 'auftraege.js', 'tafel.js', 'kunde.js', 'handy.js', 'studio.js', 'app.js']

css = (src / 'stil.css').read_text(encoding='utf-8')
js = '\n'.join(f'/* ---- {name} ---- */\n' + (src / name).read_text(encoding='utf-8') for name in REIHENFOLGE)

seite = f"""<title>Richtwerk Werkbank</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<meta name="theme-color" content="#0c1424">
<style>
{css}
</style>
<div id="wurzel"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
<script>
"use strict";
{js}
</script>
"""
ziel = ordner / 'richtwerk-werkbank.html'
ziel.write_text(seite, encoding='utf-8')

# Eigenständige Fassung zum direkten Öffnen im Browser (mit Dokumentrahmen)
voll = '<!doctype html>\n<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>\n' + seite + '</body></html>\n'
(ordner / 'richtwerk-werkbank-offline.html').write_text(voll, encoding='utf-8')
print('geschrieben', ziel, len(seite), 'Zeichen')
