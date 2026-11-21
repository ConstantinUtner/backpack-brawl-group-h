# Workflow

## 1. Analyse der Codebasis und Analyse der Requirements (README.md und REQUIREMENTS.md)

a. Suchen nach Key Functions (STRG + SHIFT + F), exploratives Testen der Oberfläche und Herausfinden, wann was aufgerufen wird  
b. Projektarchitektur-Analyse: Frontend/Backend? Aus welchen Komponenten besteht es?  
c. Wie kommunizieren die einzelnen Komponenten miteinander?  
d. Welche Schichten existieren und wie kommunizieren diese? (Was ist ein Run, was ist ein Game, was ist ein Shop? ...)  
e. API.md Basis wurde analysiert, noch Unklarheiten über das Einbinden eines eigenen Endpoints

## 2. Requirements in 50/50 aufteilen (mit Abhängigkeiten)

a. Welche Requirements passen gut zusammen und haben weniger Konflikte?  
b. KI-unterstützte Hilfe bei Abhängigkeitsmatrix/Gruppierung der Requirements, um Merge-Konflikten vorzubeugen
c. Aufteilungsmöglichkeit laut AI

> Constantin:
     --> B1, B2, B5 und B6 (Shop, Rucksack, Matchmaking und Save)
     [B3 und B4 ändern selbe Effekte bei Kämpfe, Saving ist komplett extern]
     [B1, B2 und B5 treffen sich bei Shop, daher Konflikte größer]
     [B5 und B6 teilen sich die Zustandsübergänge, B5 sichert Übergänge, B6 baut darauf auf]

     - Übergang von B6(SAVE auch mit RunID) auf B7-Aufbau
     - Run benötigt eine RunID, B7 erhält die ID, erneuter Submit darf keinen Eintrag in HallOfFame erzeuge, daher Run abspeichern und abfragen
     - Shop zurückkehren, Opponent steht fest und Kampf wird erneut gestartet, Kampfdaten sichern?

> Julia:
     --> B3, B4 und B7 (Status Effect, Item Sets und HallOfFame)
     [B3 und B4 ändern selbe Kampfstrategien]
     [B6 sollte vor B7 ausgemacht sein, oder die Basis für B7 sein]



## 3. Für jedes Feature / jedes Requirement ein Branch

a. Von `master` weg wird ein Branch erstellt  
b. `feature/name` (z. B. `req1-julia`)  
c. Committen von Änderungen (siehe Commit-Strategy)  
d. **VOR Merge**: sinnvolle Tests für VITEST schreiben und positiv durchlaufen lassen (nach allen Commits im Requirement-Branch)

### Merge-Prozess

a. `pull` → `commit` → `pull` → `push` onto feature/requirement branch

> **⚠️ Merge `master` into feature/requirement branch**
>
> 1. Lösen von Konflikten
> 2. Linting (`npm eslint`)
> 3. VITEST Testing
> 4. `npm run build` (preview?)
> 5. Manueller UI-Check (Exploratives Testing)

b. Ready to merge into `master`  
c. Push/Merge into `master`

## 4. Konflikt-Strategie

a. Ohne Merge-Konflikt kann man mergen  
b. Bei Merge-Konflikt: gemeinsames Durchgehen des Konflikts und die richtige Lösung herausfinden

## 5. Commit-Strategy

a. Kleine Commits  
b. Gut beschriebene Commits  
c. `[req1]` → oder `[req1.1]` bei mehreren geplanten Commits, danach (`feat:`, `docs:`, `test:` …) und eine Beschreibung

## 6. AI usage - Strategy

a. Nach jedem Feature, wenn merge-ready  
b. Diary-Informationen und Decisions durchdenken bei jedem Requirement  
c. Was habe ich getroffen, warum und welche Auswirkungen hat diese  
d. Check: Diary requirements and qualitative requirements --> **DECISIONS.md**