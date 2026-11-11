# Richtwerk Studio

Baukasten und Entwickler-Tool für die Digitalisierung kleiner Handwerksbetriebe.

## Aufbau

- `baukasten/richtwerk-studio.html` ist das Entwickler-Tool in einer einzigen Datei. Startseite mit Betrieben, dahinter Studio mit Kunden, Bausteinen, Code-Editor, Live-Vorschau und Export.
- `kunden/<betrieb>/` enthält alles, was nur einen Betrieb betrifft.
  - `ludwig-hammer/ludwig-hammer-app.html`: die Hammer Betriebszentrale (Musterfirma, alle Daten erfunden).
  - `ludwig-hammer/kunde.json`: Einstellungen des Betriebs aus dem Studio (Bausteine, Farbe, Personen, eigener Code).

## Arbeitsweise

Solange nur wenige Betriebe existieren, liegt alles in diesem einen Repo. Ein eigenes Repo pro Kunde lohnt sich erst, wenn ein Kunde selbst Zugriff oder ein eigenes Hosting braucht.

Das Studio läuft als Seite auf claude.ai. Änderungen an `richtwerk-studio.html` müssen dort neu veröffentlicht werden, damit sie live sind.

## Drei getrennte Teile (Stand 2026-11-11)
1. **Büro-Tool Bautest**: `kunden/bautest/bautest-app.html`, Seite `#buero` (Standard).
2. **Handy-App Bautest**: dieselbe Datei, Seite `#handy` (Vollbild fürs Handy). Beide Seiten gleichen sich live über die Artifact-Datenbank ab (Dokument `betrieb/daten`).
3. **Entwickler-Tool Richtwerk Studio**: `baukasten/richtwerk-studio.html`, verwaltet alle Betriebe.
Neu bauen: `python3 baukasten/standalone.py kunden/bautest/kunde.json kunden/bautest/bautest-app.html`
