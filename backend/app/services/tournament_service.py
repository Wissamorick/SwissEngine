"""Tournament store + thin wrappers around the engine.

Tournaments live in memory while the server runs. Once a tournament has been
saved to a folder ("Enregistrer sous…"), every change is automatically written
there (see storage.py), so it can be reopened after a restart or a crash.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from pathlib import Path

from engine import GameResult, Tournament, TournamentConfig
from engine.tournament import SWISS_SYSTEMS

from backend.app.models.schemas import (
    AddPlayersRequest,
    CreateTournamentRequest,
    Crosstable,
    EnterResultsRequest,
    PairingResponse,
    PlayerOut,
    RoundInfo,
    StandingEntry,
    TournamentState,
    TournamentStatus,
)
from backend.app.services import exports, storage


class TournamentNotFoundError(KeyError):
    pass


@dataclass
class _Entry:
    tournament: Tournament
    folder: Path | None = None
    last_saved: str | None = None
    save_error: str | None = None


ALL_SYSTEMS = SWISS_SYSTEMS | {"random", "roundrobin"}

# tournament_id -> entry
_TOURNAMENTS: dict[str, _Entry] = {}


# -------------------------------------------------------------- internals
def _entry(tournament_id: str) -> _Entry:
    try:
        return _TOURNAMENTS[tournament_id]
    except KeyError as exc:
        raise TournamentNotFoundError(tournament_id) from exc


def get_tournament(tournament_id: str) -> Tournament:
    return _entry(tournament_id).tournament


def _register(tournament: Tournament, folder: Path | None = None) -> str:
    # Reopening a folder that is already open replaces it (avoid two writers).
    if folder is not None:
        for tid, entry in _TOURNAMENTS.items():
            if entry.folder is not None and entry.folder.resolve() == folder.resolve():
                _TOURNAMENTS[tid] = _Entry(tournament, folder)
                return tid
    tournament_id = str(uuid.uuid4())
    _TOURNAMENTS[tournament_id] = _Entry(tournament, folder)
    return tournament_id


def _autosave(tournament_id: str, refresh_from: int | None = None) -> None:
    entry = _entry(tournament_id)
    if entry.folder is None:
        return
    try:
        entry.last_saved = storage.save_tournament(
            entry.tournament, entry.folder, _status(tournament_id).model_dump(), refresh_from
        )
        entry.save_error = None
    except OSError as exc:
        # Never lose the in-memory state because the disk failed: report it instead.
        entry.save_error = f"Échec de la sauvegarde automatique : {exc}"


def _pairing_out(p: dict) -> PairingResponse:
    return PairingResponse(
        table=p["table"],
        white_name=p["white"],
        black_name=p["black"],
        is_bye=p["is_bye"],
        white_elo=p["white_elo"],
        black_elo=p["black_elo"],
        white_pts=p["white_pts"],
        black_pts=p["black_pts"],
        white_score=p["white_score"],
    )


def _status(tournament_id: str) -> TournamentStatus:
    entry = _entry(tournament_id)
    raw = entry.tournament.status()
    return TournamentStatus(
        id=tournament_id,
        name=raw["name"],
        system=raw["system"],
        total_rounds=raw["total_rounds"],
        current_round=raw["current_round"],
        completed_rounds=raw["completed_rounds"],
        started=raw["started"],
        awaiting_results=raw["awaiting_results"],
        finished=raw["finished"],
        player_count=raw["player_count"],
        show_club=raw["show_club"],
        config=raw["config"],
        save_dir=str(entry.folder) if entry.folder else None,
        last_saved=entry.last_saved,
        save_error=entry.save_error,
    )


# ------------------------------------------------------------------ public
def create_tournament(body: CreateTournamentRequest) -> TournamentStatus:
    config = TournamentConfig(
        system=body.system,
        rounds=body.rounds,
        points=list(body.points),
        beta=body.beta,
        bye_value=body.bye_value,
        seeding=body.seeding,
    )
    # Validate the system name now rather than at the first round
    if config.system.lower() not in ALL_SYSTEMS:
        raise ValueError(f"Unknown system '{config.system}'. Choose among: {sorted(ALL_SYSTEMS)}")
    if config.rounds < 1 and config.system.lower() != "roundrobin":
        raise ValueError("The number of rounds must be at least 1")

    tournament = Tournament(config, name=body.name.strip())
    tournament.show_club = body.show_club
    tournament_id = _register(tournament)
    return _status(tournament_id)


def add_players(tournament_id: str, body: AddPlayersRequest) -> TournamentStatus:
    tournament = get_tournament(tournament_id)
    tournament.add_players(
        [
            {"Name": p.name.strip(), "Elo": p.elo, **({"Club": p.club.strip()} if p.club and p.club.strip() else {})}
            for p in body.players
        ]
    )
    _autosave(tournament_id)
    return _status(tournament_id)


def set_options(tournament_id: str, show_club: bool) -> TournamentStatus:
    get_tournament(tournament_id).show_club = show_club
    _autosave(tournament_id, refresh_from=1)
    return _status(tournament_id)


def set_player_club(tournament_id: str, name: str, club: str) -> TournamentStatus:
    get_tournament(tournament_id).set_club(name, club)
    _autosave(tournament_id, refresh_from=1)
    return _status(tournament_id)


def correct_results(
    tournament_id: str, round_number: int, results: dict[int, float], keep_later_rounds: bool
) -> TournamentStatus:
    """Fix the results of an already completed round (typo, wrong entry...)."""
    entry = _entry(tournament_id)
    entry.tournament = entry.tournament.with_corrected_results(round_number, results, keep_later_rounds)
    _autosave(tournament_id, refresh_from=round_number)
    return _status(tournament_id)


def generate_round(tournament_id: str) -> list[PairingResponse]:
    tournament = get_tournament(tournament_id)
    tournament.generate_round()
    _autosave(tournament_id)
    return [_pairing_out(p) for p in tournament.rounds()[-1]["pairings"]]


def enter_results(tournament_id: str, body: EnterResultsRequest) -> TournamentStatus:
    tournament = get_tournament(tournament_id)
    tournament.enter_results(
        [GameResult(table=r.table, white_score=r.white_score) for r in body.results]
    )
    _autosave(tournament_id)
    return _status(tournament_id)


def get_standings(tournament_id: str) -> list[StandingEntry]:
    tournament = get_tournament(tournament_id)
    standings = tournament.get_standings()
    entries: list[StandingEntry] = []
    for i, player in enumerate(standings, start=1):
        tb = player.get("TB", {})
        entries.append(
            StandingEntry(
                rank=i,
                name=player["Name"],
                club=player.get("Club"),
                elo=int(player.get("Elo", 0)),
                pts=float(player.get("pts", 0)),
                color_diff=int(player.get("color_diff", 0)),
                tiebreaks={k: float(v) for k, v in tb.items()},
            )
        )
    return entries


def get_rounds(tournament_id: str) -> list[RoundInfo]:
    tournament = get_tournament(tournament_id)
    return [
        RoundInfo(
            round=r["round"],
            win_value=r["win_value"],
            completed=r["completed"],
            pairings=[_pairing_out(p) for p in r["pairings"]],
        )
        for r in tournament.rounds()
    ]


def get_crosstable(tournament_id: str, after_round: int | None = None) -> Crosstable:
    table = get_tournament(tournament_id).crosstable(after_round)
    return Crosstable.model_validate(table)


def get_state(tournament_id: str) -> TournamentState:
    tournament = get_tournament(tournament_id)
    return TournamentState(
        status=_status(tournament_id),
        players=[
            PlayerOut(name=p["Name"], elo=int(p.get("Elo", 0)), club=p.get("Club"))
            for p in tournament.players
        ],
        rounds=get_rounds(tournament_id),
        standings=get_standings(tournament_id),
    )


def get_status(tournament_id: str) -> TournamentStatus:
    return _status(tournament_id)


def list_tournaments() -> list[TournamentStatus]:
    return [_status(tid) for tid in _TOURNAMENTS]


# ------------------------------------------------------- save / load / undo
def save_as(tournament_id: str, directory: str, folder_name: str, overwrite: bool) -> TournamentStatus:
    entry = _entry(tournament_id)
    folder = storage.prepare_save_folder(directory, folder_name, overwrite)
    if overwrite:
        storage.archive_round_files(folder)
    # If another open tournament was bound to this folder, detach it.
    for tid, other in _TOURNAMENTS.items():
        if tid != tournament_id and other.folder is not None and other.folder.resolve() == folder.resolve():
            other.folder = None
    entry.folder = folder
    entry.last_saved = storage.save_tournament(entry.tournament, folder, _status(tournament_id).model_dump())
    entry.save_error = None
    return _status(tournament_id)


def open_folder(path: str) -> TournamentStatus:
    data, folder = storage.load_tournament_data(path)
    tournament = Tournament.from_dict(data)
    tournament_id = _register(tournament, folder)
    _entry(tournament_id).last_saved = data.get("saved_at")
    return _status(tournament_id)


def import_data(data: dict) -> TournamentStatus:
    tournament = Tournament.from_dict(data)
    return _status(_register(tournament))


def export_data(tournament_id: str) -> dict:
    data = get_tournament(tournament_id).to_dict()
    data["saved_at"] = storage.now_iso()
    return data


def rollback(tournament_id: str, rounds_to_keep: int) -> TournamentStatus:
    """Go back to the state right after round `rounds_to_keep`.

    The rounds after it (and a round awaiting results) are cancelled.
    """
    entry = _entry(tournament_id)
    tournament = entry.tournament
    if rounds_to_keep > tournament.completed_rounds:
        raise ValueError(f"La ronde {rounds_to_keep} n'est pas terminée")
    entry.tournament = tournament.truncated(rounds_to_keep)
    _autosave(tournament_id)
    return _status(tournament_id)


# ------------------------------------------------------------- printables
def print_pairings(tournament_id: str, round_number: int, auto_print: bool) -> str:
    rounds = get_tournament(tournament_id).rounds()
    if not 1 <= round_number <= len(rounds):
        raise ValueError(f"La ronde {round_number} n'existe pas")
    return exports.pairings_html(_status(tournament_id).model_dump(), rounds[round_number - 1], auto_print)


def print_crosstable(tournament_id: str, round_number: int | None, auto_print: bool) -> str:
    table = get_tournament(tournament_id).crosstable(round_number)
    return exports.crosstable_html(_status(tournament_id).model_dump(), table, auto_print)


__all__ = [
    "TournamentNotFoundError",
    "create_tournament",
    "get_tournament",
    "add_players",
    "generate_round",
    "enter_results",
    "get_standings",
    "get_rounds",
    "get_crosstable",
    "get_state",
    "get_status",
    "list_tournaments",
    "save_as",
    "open_folder",
    "import_data",
    "export_data",
    "rollback",
    "set_options",
    "set_player_club",
    "correct_results",
    "print_pairings",
    "print_crosstable",
]
