"""Saving tournaments to disk.

One folder per tournament, chosen by the user:

    <dossier du tournoi>/
        tournoi.json                      <- full state, used to reload (source of truth)
        tournoi.precedent.json            <- previous version (safety net)
        joueurs.csv
        rondes/
            ronde_01_appariements.html    <- printable
            ronde_01_appariements.csv
            ronde_01_grille_americaine.html
            ronde_01_grille_americaine.csv
            ...
        archives/<date>/                  <- files of rounds cancelled by a rollback

Only `tournoi.json` is read back; the other files are for humans (print,
spreadsheet, posting on the wall...). They are regenerated automatically.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import string
from datetime import datetime
from pathlib import Path

from engine import Tournament

from backend.app.services import exports

TOURNAMENT_FILE = "tournoi.json"
PREVIOUS_FILE = "tournoi.precedent.json"
ROUNDS_DIR = "rondes"
ARCHIVES_DIR = "archives"

_CONFIG_DIR = Path.home() / ".swissengine"
_RECENT_FILE = _CONFIG_DIR / "recents.json"
_MAX_RECENT = 12

_ROUND_FILE_RE = re.compile(r"^ronde_(\d+)_(appariements|grille_americaine)\.(html|csv)$")


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


# ------------------------------------------------------------------ helpers
def sanitize_folder_name(name: str) -> str:
    """Make a tournament name usable as a folder name (Windows-safe)."""
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name).strip().rstrip(". ")
    return cleaned or "Tournoi"


def default_directory() -> Path:
    documents = Path.home() / "Documents"
    return documents if documents.is_dir() else Path.home()


def _write_text(path: Path, content: str) -> None:
    """Atomic write: never leaves a half-written file if the app is interrupted."""
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)


def resolve_tournament_file(path: str) -> Path:
    """Accept a tournament folder or a direct path to a .json file."""
    p = Path(path).expanduser()
    if p.is_dir():
        p = p / TOURNAMENT_FILE
    if not p.is_file():
        raise FileNotFoundError(f"Aucun fichier {TOURNAMENT_FILE} trouvé dans « {path} »")
    return p


# --------------------------------------------------------------------- save
def save_tournament(
    tournament: Tournament, folder: Path, status: dict, refresh_from: int | None = None
) -> str:
    """Write the tournament and all its exports in `folder`. Returns the save time.

    refresh_from: crosstables from this round on are rewritten even if they
    exist (after a result correction or a display change).
    """
    folder.mkdir(parents=True, exist_ok=True)
    rounds_dir = folder / ROUNDS_DIR
    rounds_dir.mkdir(exist_ok=True)

    saved_at = now_iso()
    data = tournament.to_dict()
    data["saved_at"] = saved_at

    main_file = folder / TOURNAMENT_FILE
    if main_file.exists():
        shutil.copyfile(main_file, folder / PREVIOUS_FILE)
    _write_text(main_file, json.dumps(data, ensure_ascii=False, indent=2))

    players = [{"name": p["Name"], "elo": int(p.get("Elo", 0)), "club": p.get("Club")} for p in tournament.players]
    _write_text(folder / "joueurs.csv", exports.players_csv(players, tournament.show_club))

    rounds = tournament.rounds()
    completed = tournament.completed_rounds

    for info in rounds:
        stem = f"ronde_{info['round']:02d}_appariements"
        _write_text(rounds_dir / f"{stem}.html", exports.pairings_html(status, info))
        _write_text(rounds_dir / f"{stem}.csv", exports.pairings_csv(info))

    # Crosstables: recompute the latest one, and any that is missing.
    for k in range(1, completed + 1):
        stem = f"ronde_{k:02d}_grille_americaine"
        html_file = rounds_dir / f"{stem}.html"
        up_to_date = refresh_from is None or k < refresh_from
        if k != completed and up_to_date and html_file.exists() and (rounds_dir / f"{stem}.csv").exists():
            continue
        table = tournament.crosstable(k)
        _write_text(html_file, exports.crosstable_html(status, table))
        _write_text(rounds_dir / f"{stem}.csv", exports.crosstable_csv(table, tournament.show_club))

    _archive_stale_round_files(folder, len(rounds), completed)
    remember_recent(tournament.name, folder, saved_at)
    return saved_at


def _archive_stale_round_files(folder: Path, round_count: int, completed: int) -> None:
    """Move files of rounds that no longer exist (after going back in time)."""
    rounds_dir = folder / ROUNDS_DIR
    stale: list[Path] = []
    for f in rounds_dir.iterdir():
        m = _ROUND_FILE_RE.match(f.name)
        if not m:
            continue
        number, kind = int(m.group(1)), m.group(2)
        limit = round_count if kind == "appariements" else completed
        if number > limit:
            stale.append(f)
    if not stale:
        return
    target = folder / ARCHIVES_DIR / datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    target.mkdir(parents=True, exist_ok=True)
    for f in stale:
        shutil.move(str(f), str(target / f.name))


def prepare_save_folder(directory: str, folder_name: str, overwrite: bool) -> Path:
    parent = Path(directory).expanduser()
    if not parent.is_dir():
        raise FileNotFoundError(f"Le dossier « {directory} » n'existe pas")
    folder = parent / sanitize_folder_name(folder_name)
    if (folder / TOURNAMENT_FILE).exists() and not overwrite:
        raise FileExistsError(
            f"Le dossier « {folder} » contient déjà un tournoi. "
            "Choisissez un autre nom ou confirmez le remplacement."
        )
    return folder


# --------------------------------------------------------------------- load
def load_tournament_data(path: str) -> tuple[dict, Path]:
    file = resolve_tournament_file(path)
    try:
        data = json.loads(file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Fichier {file.name} illisible : {exc}") from exc
    return data, file.parent


# ------------------------------------------------------------------ recents
def list_recent() -> list[dict]:
    try:
        items = json.loads(_RECENT_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    return [i for i in items if isinstance(i, dict) and (Path(i.get("path", "")) / TOURNAMENT_FILE).exists()]


def remember_recent(name: str, folder: Path, saved_at: str) -> None:
    try:
        items = [i for i in list_recent() if Path(i["path"]) != folder]
        items.insert(0, {"name": name, "path": str(folder), "saved_at": saved_at})
        _CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        _write_text(_RECENT_FILE, json.dumps(items[:_MAX_RECENT], ensure_ascii=False, indent=2))
    except OSError:
        pass  # the recent list is a convenience only


# --------------------------------------------------------------- browsing
def _roots() -> list[str]:
    if os.name == "nt":
        return [f"{d}:\\" for d in string.ascii_uppercase if os.path.exists(f"{d}:\\")]
    return ["/"]


def list_directory(path: str | None) -> dict:
    p = Path(path).expanduser() if path else default_directory()
    if not p.is_dir():
        raise FileNotFoundError(f"Le dossier « {path} » n'existe pas")
    p = p.resolve()
    entries = []
    try:
        children = sorted(p.iterdir(), key=lambda c: c.name.lower())
    except PermissionError as exc:
        raise PermissionError(f"Accès refusé à « {p} »") from exc
    for child in children:
        if child.name.startswith((".", "$")):
            continue
        try:
            if not child.is_dir():
                continue
            is_tournament = (child / TOURNAMENT_FILE).is_file()
        except OSError:
            continue
        entries.append({"name": child.name, "path": str(child), "is_tournament": is_tournament})
    parent = str(p.parent) if p.parent != p else None
    return {
        "path": str(p),
        "parent": parent,
        "is_tournament": (p / TOURNAMENT_FILE).is_file(),
        "entries": entries,
        "roots": _roots(),
        "home": str(Path.home()),
        "default_dir": str(default_directory()),
    }


def archive_round_files(folder: Path) -> None:
    """Move all existing round files away (used when replacing a tournament)."""
    rounds_dir = folder / ROUNDS_DIR
    if not rounds_dir.is_dir() or not any(rounds_dir.iterdir()):
        return
    target = folder / ARCHIVES_DIR / datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    target.mkdir(parents=True, exist_ok=True)
    for f in rounds_dir.iterdir():
        shutil.move(str(f), str(target / f.name))
