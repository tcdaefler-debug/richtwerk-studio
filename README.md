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
