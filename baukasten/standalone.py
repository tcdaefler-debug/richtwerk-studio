#!/usr/bin/env python3
"""Baut aus der Betriebszentrale (kunden/ludwig-hammer/ludwig-hammer-app.html) eine eigenständige App
für einen Betrieb: eigene Seite für Büro (#buero) und Handy (#handy), live abgeglichen über die Artifact-Datenbank.
Aufruf: python3 baukasten/standalone.py kunden/bautest/kunde.json kunden/bautest/bautest-app.html"""
import json,sys,pathlib
root=pathlib.Path(__file__).resolve().parent.parent
cfg=json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
cfg.update({'leer':True,'sync':True})
src=(root/'kunden/ludwig-hammer/ludwig-hammer-app.html').read_text(encoding='utf-8')
js=json.dumps(cfg,ensure_ascii=False).replace('<','\\u003c')
src=src.replace('<title>Hammer Betriebszentrale</title>',f"<title>{cfg['firma']['name']}</title>")
out=f'<script>window.RICHTWERK={js};</script>\n'+src
pathlib.Path(sys.argv[2]).write_text(out,encoding='utf-8')
print('geschrieben',sys.argv[2],len(out))
