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

Available systems: Dutch, Burstein, Monrad, Swiss random, Mixed, Random and
round-robin.

## Current limitation

Tournaments are kept in memory only. Stopping or restarting the API therefore
clears any ongoing tournament. A database can be added in a later step.
