# SwissEngine

Web application to organize chess tournaments. The project has three parts:

- a Python tournament engine (`engine/`);
- a FastAPI backend (`backend/`);
- a React + Vite + TypeScript frontend (`frontend/`).

## Requirements

- Python 3.12 or newer;
- Node.js 22 or newer;
- npm.

## First-time setup

From the project root.

Create and activate the virtual environment, then install the backend
dependencies. The activation command depends on your terminal:

```bat
python -m venv swissengine_env

REM Command Prompt (cmd)
swissengine_env\Scripts\activate.bat

REM PowerShell
REM .\swissengine_env\Scripts\Activate.ps1

pip install -r backend\requirements.txt
```

Then install the frontend dependencies:

```bat
cd frontend
npm install
cd ..
```

If the environment and dependencies are already installed, you can skip this
section.

## Running the app

Keep two terminals open.

### Terminal 1 — FastAPI backend

From the project root, activate the environment and start the API:

```bat
REM Command Prompt (cmd)
swissengine_env\Scripts\activate.bat

REM PowerShell
REM .\swissengine_env\Scripts\Activate.ps1

uvicorn backend.app.main:app --reload
```

The API is then available at:

- http://127.0.0.1:8000
- interactive docs: http://127.0.0.1:8000/docs

### Terminal 2 — web interface

From the project root:

```bat
cd frontend
npm run dev
```

Then open http://localhost:5173 in a browser.

## Creating and running a tournament

In the web interface:

1. choose the tournament system, number of rounds and parameters;
2. click **Créer** (Create);
3. add at least two players with their name and Elo;
4. click **Enregistrer les joueurs** (Save players);
5. generate the first round;
6. enter and confirm the results;
7. check the standings and generate the next round;
8. repeat until the last round.

Available systems: Swiss Dutch, Swiss Burstein, Monrad, Swiss Random,
Swiss Random 2, Mixte (Swiss Dutch then Swiss Burstein), random and
round-robin. Points per round, Beta, bye value and seeding are under
**Paramètres avancés**.

## FAQ & documentation

The **FAQ & documentation** tab (top of the page) explains how to use the
tool, how to choose a tournament system, how each system and the pairing
algorithm work, and what every option does, in plain French for non
specialists. It links to the study `Pheng_New_Pairing_System.pdf`, served
from `frontend/public/`.

The whole text, including the bar chart data and the spider-chart scores,
lives in `frontend/src/content/faq.md` (plain Markdown plus a few blocks
documented at the top of that file). Edit it and save: with `npm run dev`
the page updates immediately, no code to touch.

## Saving and reopening tournaments

Click **Enregistrer…** and choose a parent folder and a folder name. From then
on, every change (players, pairings, results) is saved automatically in that
folder:

```text
<tournament folder>/
    tournoi.json                      full state, used to reopen the tournament
    tournoi.precedent.json            previous version (safety net)
    joueurs.csv
    rondes/
        ronde_01_appariements.html    printable pairings / results
        ronde_01_appariements.csv
        ronde_01_grille_americaine.html   printable crosstable after round 1
        ronde_01_grille_americaine.csv
        ...
    archives/<date>/                  files of rounds cancelled by a rollback
```

`tournoi.json` stores the configuration, the players (name, Elo) and, for each
round, the pairings (table, White, Black) with their result. Replaying these
rounds rebuilds the exact state of the tournament (scores, colors, opponents
already met, tiebreaks), without re-running the pairing algorithm.

- **Ouvrir un tournoi**: pick the tournament folder (recent tournaments are
  listed on the home page), or import a `.json` file.
- **Télécharger (.json)**: download the current state as a single file.
- **Rondes jouées → Revenir à la fin de cette ronde**: go back to an earlier
  round (the later rounds are cancelled; their files are moved to `archives/`).
- **Annuler les appariements**: cancel the pairings of the current round and
  generate them again.
- **Corriger la ronde N / Modifier les résultats**: fix a wrong result of an
  already completed round (typo...). If later rounds exist, choose to keep
  them as they are (only scores change) or to cancel them and pair again.
- **Afficher club / équipe**: optional club or team for each player, shown in
  the standings, the crosstable and the exported files.
- The CSV files use `;` and UTF-8 with BOM so they open directly in Excel or
  LibreOffice Calc.

Tournaments that have not been saved to a folder are kept in memory only and
are lost when the API stops.
