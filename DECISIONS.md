# **Backpack Brawl – Team Development Plan**

**Status:** Verbindliche gemeinsame Entwicklungsgrundlage für B1–B7  
**Ziel:** Einfache Umsetzung, klare Zuständigkeiten, wenige Merge-Konflikte.

> Änderungen an diesen Vereinbarungen stimmen wir vor der Implementierung gemeinsam ab. Die Anforderungen in `REQUIREMENTS.md` haben Vorrang.

## **1. Aufgabenverteilung und Reihenfolge**

| Reihenfolge | Constantin                | Julia                        |
| ----------- | ------------------------- | ---------------------------- |
| 1           | B1 – Shop Economy   | B3 – Poison & Heal    |
| 2           | B2 – Backpack     | B4 – Item Sets & Burn  |
| 3           | B5 – Matchmaking    | B7 – Hall of Fame      |
| 4           | B6 – Save & Resume  | Integration und Tests        |

Beide entwickeln parallel auf getrennten Feature-Branches. **B5 muss vor B6 stabil sein.** B7 beginnt mit Beispieldaten und wird später an den echten Run-Abschluss angebunden.

## 2. Gemeinsamer Datenvertrag

Wir erweitern `src/types.ts` **vor dem Start der Feature-Entwicklung gemeinsam**:

- `ItemEffects`: optionale Werte `damage`, `block`, `poison`, `heal`, `burn` (positive ganze Zahlen).
- `ItemDef`: optional `set?: "fire" | "defense"` (maximal eine Set-Zugehörigkeit pro Item).
- `FighterSnapshot`: `hp`, `maxHp`, `block`, `poison`, `burn` (Zahlen).
- `BattleEventKind`: `"damage" | "block" | "poison" | "heal" | "burn"`.
- `RunState`: zusätzlich `runId: string` (bei Run-Start erzeugt, während des Runs unverändert).
- Für B7 verwenden Frontend und Server denselben JSON-Vertrag:

```ts
interface HallOfFameEntry {
  runId: string;
  name: string;
  outcome: "victory" | "defeat";
  wins: number;
  rounds: number;
  remainingLives: number;
}
```

`runId` wird mit `crypto.randomUUID()` beim Erstellen eines neuen Runs erzeugt. Das gemeinsame Typ- und Dokumentations-Setup wird **zuerst in `master` gemergt**. Danach gehören die Run-/Suchtypen primär A und die Item-/Kampftypen primär B.

## 3. B1 – Shop Economy

- **Verkaufen:** Item aus dem Rucksack entfernen, `Math.floor(price / 2)` Gold gutschreiben.
- **Reroll:** Kostet **1 Gold**; alle **vier** Shopangebote werden neu ausgewürfelt. Dazu den bestehenden gespeicherten Zufalls-Seed fortschreiben.
- **Kaufen:** Nur wenn das Angebot verfügbar ist, genug Gold vorhanden ist **und mindestens ein Rucksackslot frei** ist.
- **Keine halben Aktionen:** Bei ungültigem Kauf/Verkauf/Reroll bleibt der gesamte Run unverändert.
- **Nur Shop-Phase:** Aktionen werden im UI deaktiviert **und** in den Zustandsfunktionen abgesichert. Der Grund wird verständlich angezeigt.
- Beim Verkauf verschwindet nur die gewählte **Item-Instanz** (`uid`); gleiche Itemtypen an anderen Slots bleiben erhalten.

## 4. B2 – Backpack Arrangement

- **Click-to-Select statt Drag-and-Drop.**
- Item anklicken → markieren; anderen Slot anklicken → verschieben bzw. mit vorhandenem Item tauschen.
- Erneut auf das ausgewählte Item klicken → Auswahl aufheben; zusätzlich ein **Cancel**-Button.
- Auswahl nur im UI halten (nicht als Teil des dauerhaften Run-Spielstands speichern).
- Nur in der **Shop-Phase** verschieben oder tauschen.
- Backpack bleibt bei **2 × 3 Slots**; Items belegen je genau einen Slot. Die Position hat keinen Kampfeffekt.

## 5. B3 – Poison & Heal

### Poison

- Ein Item fügt seinem Gegner die angegebene Anzahl **Poison-Stacks** hinzu.
- **Alle 3 Ticks:** **1 HP Schaden pro aktivem Stack**; Poison ignoriert Block.
- Stacks addieren sich und bleiben bis zum Kampfende bestehen.
- Neue Stacks zählen bereits beim Schadenstick, in dem sie hinzugefügt wurden.

### Heal

- Ein Item heilt den eigenen Kämpfer um seinen `heal`-Wert je nach Ticks. Stackt nicht wie Poison
- `hp = Math.min(maxHp, hp + heal)`; Block ändert sich nicht.


### **Konkrete Items:**

| Item            | Cooldown | Effekt    |
| --------------- | -------- | --------- |
| Poison Dagger   | 4 Ticks  | +1 Poison |
| Toxic Bow       | 6 Ticks  | +2 Poison |
| Venom Blade     | 8 Ticks  | +3 Poison |
| Small Potion    | 5 Ticks  | +3 HP     |
| Healing Herb    | 7 Ticks  | +5 HP     |
| Healing Crystal | 10 Ticks | +8 HP     |

Die neuen Items erhalten Preise von 3, 5 und 7 Gold je Effektgruppe (aufsteigend nach Stärke). Sie werden zum normalen Itemkatalog hinzugefügt und können dadurch auch im Shop erscheinen.

### Diary Information:
  #### Important decisions:
    - Used automatic healing based on the items cooldown up above - changed from one-time use to real cooldown usage
    - Made poison purple and heal green in the Combat Log and visual representation of the FighterPanel
    - The HP is currently shown as a "current Heal"-text with the sum of all heal from the items inside the backpack
  
  ### AI usage:
    - AI was helpful in bugfix (the poison did not stack correctly)
    - Used AI for information about Tailwind CSS for the theme colours and classes (e.g. heal amount of the current heal)
    - AI drafted a VITEST for poison stacking, block bypass, healing limits and the targets - which helped me figure out a bug in the healing process beforehand (healing the opponent instead of myself)

  ### Reflections:
    - The combat logs are not always what is really happening. Because they are treated separately I needed to make sure that the correct thing is happening with explorative testing
    - A lot of explorative testing was needed to figure out if the items are doing what they are supposed to do because of the randomness. Testing helped immensely instead of that - visual things are still important to observe manually.

## 6. B4 – Item Sets & Burn

**Genau zwei Sets** für das MVP; ein Setbonus ist aktiv, sobald mindestens **2 Items des Sets** im Backpack des jeweiligen Kämpfers sind. Mehr als 2 Items geben **keinen zusätzlichen Setbonus**. Auch Gegner erhalten Setboni. Doppelte Item-Instanzen zählen einzeln.

| Set | Mindestens 3 zugehörige Items | Bonus bei 2+ Items |
| --- | --- | --- |
| **Fire** | Fire Dagger, Fire Bow, Fire Staff | Fire-Items geben bei jeder Burn-Anwendung **+1 Burn-Stack** zusätzlich |
| **Defense** | Oak Buckler, Pot Lid, Spiked Shield | Jedes blockgebende Item gibt bei jeder Aktivierung **+1 Block** zusätzlich |

### Burn

- Burn-Stacks addieren sich; alle **2 Ticks** verursacht **jeder Stack 2 Schaden**.
- Block nimmt zuerst Burn-Schaden auf; nur der Rest reduziert HP.
- Nach **jedem** Burn-Schadenstick nimmt die Gesamtzahl der Burn-Stacks um **1** ab (nicht um 1 pro Stack).
- Neue Stacks wirken beim Schadenstick ihrer Anwendung sofort. Bei 0 Stacks endet Burn.

| Item | Preis | Cooldown | Effekt |
| --- | ---: | ---: | --- |
| Fire Dagger | 3 | 3 | +1 Burn |
| Fire Bow | 5 | 4 | +2 Burn |
| Fire Staff | 7 | 6 | +3 Burn |

Das stellt sicher, dass Burn durch Fire-Items schneller aufgebaut werden kann und pro Stack mehr Schaden verursacht als Poison, aber durch Block und Verfall begrenzt wird. Setzugehörigkeit und aktive Boni erscheinen auf Itemkarten, im Shop und im Kampf.

**Gemeinsame Kampf-Reihenfolge:**

1. Cooldowns erhöhen und aktivierte Items bestimmen.
2. Itemeffekte für **beide** Kämpfer ausführen.
3. Auslösende Items abarbeiten: **Spieler zuerst, dann Gegner**; dabei normalen Schaden, Block, Heal und neue Status-Stacks anwenden.
4. Neue Poison- und Burn-Stacks hinzufügen.
5. Alle 2 Ticks Poison- und Burn-Schaden berechnen.
6. Burn um 1 Stack reduzieren.
7. Prüfen, ob jemand besiegt wurde.
8. Kampfereignisse und Frame speichern.

Die bestehenden Regeln bleiben erhalten: Maximal **60 Ticks**; beide gleichzeitig auf 0 HP = Niederlage des Spielers; bei Timeout entscheidet der prozentuale HP-Anteil, Gleichstand = Niederlage. Dieselben Eingaben müssen immer denselben Kampf ergeben.

Alle Statuswerte und aktiven Set-Boni werden in der Kampfansicht, im Combat Log und im Rules Panel erklärt.

## 7. B5 – Resilient Matchmaking

- Neue Suche nur bei `phase === "shop"` und mindestens einem Item im Rucksack.
- **Genau eine** aktive Anfrage; währenddessen sind Shop und Backpack gesperrt.
- Jeder Suchversuch hat eine eindeutige `searchId` und die zugehörige `round`.
- Eine API-Antwort darf nur dann einen Kampf starten, wenn **Phase, Runde und `searchId`** noch übereinstimmen. Andernfalls ignorieren.
- Bei API-Fehler: zurück zu `shop`, verständliche Fehlermeldung, erneuter Versuch möglich.
- `AbortController` bricht nicht mehr benötigte HTTP-Anfragen nach Möglichkeit ab; **die Zustandsprüfung bleibt trotzdem Pflicht**.
- Für dieselbe Runde liefert die bestehende API denselben Gegner. Antworten dürfen niemals einen Kampf neu starten oder ein Resultat doppelt verbuchen.

## 8. B6 – Save & Resume

**Technik:** `localStorage`, Schlüssel `backpack-brawl-save`, Speicherformat `version: 1`. Ein eigener State-Manager ist nicht nötig.

Zu speichern sind der **relevante `GameState`** (Run inklusive Seed, Shop, Backpack und `runId`; Phase; gegebenenfalls vollständiges Battle Replay und Ergebnis) sowie der erfolgreiche Hall-of-Fame-Submit-Status und der vor einem Retry eingegebene Name.

Speicherformat:

```
{
  "version": 1,
  "game": {
    "phase": "shop",
    "run": {},
    "battle": null,
    "error": null
  },
  "submittedRunId": null
}
```

| Phase beim Refresh | Festgelegtes Verhalten |
| --- | --- |
| `shop` | Gold, Angebote, Seed, Backpack und Runde exakt wiederherstellen |
| `searching` | Zurück in denselben Shop; neue Suche gegen denselben Gegner dieser Runde möglich, **kein neuer Shop-Roll** |
| `battle`, Replay läuft | Gespeicherten Gegner und **dasselbe gespeicherte Kampfergebnis** verwenden; Replay darf bei Frame 0 neu beginnen |
| `battle`, Replay fertig | Bereits angewendetes Ergebnis anzeigen; **nicht noch einmal werten** |
| `finished` | Ergebnis und Einreichungsstatus wiederherstellen |


- Beim Erstellen eines neuen Runs wird ein neuer Spielstand mit neuer `runId` geschrieben.
- Speichern nach **jeder relevanten Zustandsänderung** (keine ungespeicherten Rerolls oder Resultate).
- Die Wertung wird **einmal** beim Erreichen des letzten Replay-Frames durchgeführt und zusammen mit dem Replay-Endzustand gespeichert. Ein erneuter Aufruf verändert den Run nicht.
- Vor Verwendung eines Saves `version`, Phase, Run-Werte, Array-Längen, IDs, Item-IDs und Replay-Konsistenz prüfen. Bei ungültigen Daten Save verwerfen und einen **neuen spielbaren Run anbieten**.
- Ein Refresh ist kein Weg, ein anderes Kampfergebnis, einen kostenlosen Reroll oder ein Leben zurückzubekommen.

## 9. B7 – Hall of Fame

### Endpunkte

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `POST` | `/api/hall-of-fame` | Abgeschlossenen Run einreichen |
| `GET` | `/api/hall-of-fame` | Sortierte Rangliste laden |

**Speicherung:** Array im Express-Server (`server/index.js`), **keine Datenbank**. Ein Neustart des Servers darf die Liste leeren.

**Rangfolge:** (1) Victory vor Defeat; (2) mehr Wins; (3) weniger Runden; (4) bei Gleichstand frühere erfolgreiche Einreichung zuerst.

### **Ergebnisdatensatz**

```
{
  "runId": "uuid",
  "name": "Constantin",
  "outcome": "victory",
  "wins": 5,
  "rounds": 7,
  "remainingLives": 1
}
```

**Validierung auf dem Server:**

- `runId`: nichtleerer String (UUID-Format), `name`: nach Trimmen 1–30 Zeichen.
- `wins`: ganze Zahl 0–5; `remainingLives`: ganze Zahl 0–3; `rounds`: positive ganze Zahl.
- `rounds === wins + (3 - remainingLives)` (eine Runde pro Sieg oder verlorenes Leben).
- Victory nur bei `wins === 5 && remainingLives > 0`; Defeat nur bei `remainingLives === 0 && wins < 5`.
- Zusätzlich prüfen, dass die Rundenzahl innerhalb der möglichen 5 Siege und 3 Niederlagen liegt.
- **Gleiche `runId`, identische Daten:** denselben gespeicherten Eintrag als Erfolg zurückgeben, keinen zweiten erstellen.
- **Gleiche `runId`, andere Daten:** `409 Conflict`; andere ungültige Daten: `400 Bad Request` mit verständlicher Fehlermeldung.

Die Validierung erkennt unplausible Daten, ist aber kein beweissicherer Schutz vor manipulierten Clients.

### **Frontend**

- Eigene Route `/hall-of-fame` in `App.tsx`; Rangliste auch ohne aktiven Run erreichbar.
- Auf `ResultPage.tsx`: Name eingeben, einmal absenden, Erfolg/Fehler anzeigen.
- Während des Requests Button deaktivieren und Loading anzeigen; bei Fehler Name behalten und Retry erlauben.
- Dauerhafter Status pro Run: `not_submitted` oder `submitted`; `submitting` ist **nur ein temporärer UI-Zustand**.
- Erst nach bestätigtem Erfolg Status `submitted` speichern. Bei einer verlorenen Antwort ist ein Retry sicher, weil die API identische Anfragen idempotent behandelt.
- Hall-of-Fame-Seite zeigt **Loading, leere Liste und API-Fehler** getrennt an.
- Beide Endpunkte samt Beispielen und Fehlercodes in `docs/API.md` dokumentieren.

## 10. Dateiverantwortung und Konfliktvermeidung

| Entwickler A                 | Entwickler B                    |
| ---------------------------- | ------------------------------- |
| `src/run.ts`                 | `src/battle.ts`                 |
| `src/shop.ts`                | `src/items.ts`                  |
| `src/game.ts`                | `src/components/BattleView.tsx` |
| `src/pages/ShopPage.tsx`     | `server/index.js`               |
| `src/state/GameProvider.tsx` | Neue Hall-of-Fame-Komponenten   |

**Gemeinsame Dateien:**

- `src/types.ts`: gemeinsame Typen **zuerst** mergen; danach Änderungen am Vertrag vorher kommunizieren.
- `src/rules.ts`: A ergänzt Shop-/Refresh-Erklärungen; B ergänzt Kampfeffekte/Sets.
- `src/App.tsx`: B ergänzt die eigenständige Hall-of-Fame-Route.
- `src/components/Shop.tsx`, `ItemCard.tsx`, `Backpack.tsx`: A übernimmt Shop-/Backpack-Interaktion, B nur Anzeigen für Effekte und Sets; falls beide dieselbe Komponente benötigen, Änderungen nacheinander mergen.

Wenn eine Person den vereinbarten Datentyp oder das API-Format ändern möchte, wird das **vorher gemeinsam abgestimmt**. Nicht gleichzeitig dieselben Zeilen bearbeiten.

**Wichtigste gemeinsame Datenvereinbarung:** B7 verwendet ausschließlich den vereinbarten Abschlussdatensatz. Entwickler B kann die API und Oberfläche deshalb mit Testdaten entwickeln, während Entwickler A B6 implementiert.

## 11. Git-Workflow

**Ein Requirement = ein Branch = ein Pull Request.**

1. `master` aktuell holen (`git switch master && git pull`).
2. **Pro Requirement ein Feature-Branch**, z. B. `feature/b1-shop` oder `feature/b3-status-effects`.
3. Implementierung und eigene Tests abschließen.


Nach der Implementierung:

4. Branch pushen, **Pull Request nach `master`** eröffnen.
5. Andere Person prüft den PR; danach mergen.
6. Vor dem nächsten Arbeitspaket erneut aktuellen `master` holen und neuen Feature-Branch erstellen.

Commit und Branching-Strategy in `\STRATEGY.md`

Keine direkten Commits auf `master`. Bei Überschneidungen zuerst den Pull Request mit den gemeinsamen Typänderungen mergen.

## 12. Qualitative Requirements und Tests

### Reliability – Zuverlässigkeit

**Ziel:** Keine verlorenen/duplizierten Items, keine mehrfach gewerteten Kampfergebnisse, kein unspielbarer Zustand nach API-Fehlern oder Refresh.

**Nachweis:** Tests für volle Backpack-Slots, zu wenig Gold, doppelte/verspätete API-Antworten, API-Fehler, Refresh in jeder Phase, ungültige Saves und doppelte Hall-of-Fame-Einreichungen.

### Understandability – Verständlichkeit

**Ziel:** Spieler verstehen, warum eine Aktion möglich ist und wie Kampf- und Seteffekte wirken.

**Nachweis:** Tooltips, Rules Panel, Anzeigen und Combat Log stimmen mit den vereinbarten Werten überein; deterministische Beispielkämpfe prüfen Poison, Heal, Burn, Block und Set-Boni.

**Vor jedem Pull Request:** `pnpm build`, `pnpm lint` und passende `pnpm test`-Tests ausführen. Nach der Integration gemeinsam einen ganzen Run inklusive Refresh, Fehlersuche und Hall-of-Fame-Abgabe durchspielen.

---

**Grundsatz:** Wir erweitern die vorhandenen reinen TypeScript-Funktionen, React-Komponenten und Express-Endpunkte. Keine zusätzliche Datenbank, kein neues State-Management-Framework und keine unnötige Drag-and-Drop- oder Animationslogik.


## 13. Gemeinsamer Abschlusstest

Vor der Abgabe einmal den gesamten Run durchspielen:

- Kaufen, Verkaufen, Reroll und Rucksack verschieben.
- Mit Poison, Heal, Burn und beiden Sets kämpfen.
- Gegner-API absichtlich fehlschlagen lassen.
- Während Suche und Kampf neu laden.
- Run erfolgreich oder durch Niederlage beenden.
- Hall-of-Fame-Ergebnis einreichen.
- Einreichung wiederholen und prüfen, dass kein zweiter Eintrag entsteht.
- `pnpm build`, `pnpm lint` und `pnpm test` ausführen.
