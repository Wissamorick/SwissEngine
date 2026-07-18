"""In-memory tournament store + thin wrappers around the engine.

Restarting the server clears all tournaments — fine for learning.
Later this can be replaced by a database without changing the API routes.
"""

from __future__ import annotations

import uuid
from engine import GameResult, Tournament, TournamentConfig
from engine.common.models import Pairing

from backend.app.models.schemas import (
    AddPlayersRequest,
    CreateTournamentRequest,
    EnterResultsRequest,
    PairingResponse,
    StandingEntry,
    TournamentStatus,
)


class TournamentNotFoundError(KeyError):
    pass


# tournament_id -> Tournament instance
_TOURNAMENTS: dict[str, Tournament] = {}


def create_tournament(body: CreateTournamentRequest) -> TournamentStatus:
    config = TournamentConfig(
        system=body.system,
        rounds=body.rounds,
        points=list(body.points),
        beta=body.beta,
        bye_value=body.bye_value,
        seeding=body.seeding,
    )
    tournament_id = str(uuid.uuid4())
    _TOURNAMENTS[tournament_id] = Tournament(config)
    return _status(tournament_id)


def get_tournament(tournament_id: str) -> Tournament:
    try:
        return _TOURNAMENTS[tournament_id]
    except KeyError as exc:
        raise TournamentNotFoundError(tournament_id) from exc


def add_players(tournament_id: str, body: AddPlayersRequest) -> TournamentStatus:
    tournament = get_tournament(tournament_id)
    tournament.add_players(
        [{"Name": p.name, "Elo": p.elo} for p in body.players]
    )
    return _status(tournament_id)


def generate_round(tournament_id: str) -> list[PairingResponse]:
    tournament = get_tournament(tournament_id)
    pairings: list[Pairing] = tournament.generate_round()
    return [
        PairingResponse(
            table=p.table,
            white_name=p.white_name,
            black_name=p.black_name,
            is_bye=p.is_bye,
        )
        for p in pairings
    ]


def enter_results(tournament_id: str, body: EnterResultsRequest) -> TournamentStatus:
    tournament = get_tournament(tournament_id)
    tournament.enter_results(
        [GameResult(table=r.table, white_score=r.white_score) for r in body.results]
    )
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
                elo=int(player.get("Elo", 0)),
                pts=float(player.get("pts", 0)),
                color_diff=int(player.get("color_diff", 0)),
                tiebreaks={k: float(v) for k, v in tb.items()},
            )
        )
    return entries


def get_status(tournament_id: str) -> TournamentStatus:
    return _status(tournament_id)


def list_tournaments() -> list[TournamentStatus]:
    return [_status(tid) for tid in _TOURNAMENTS]


def _status(tournament_id: str) -> TournamentStatus:
    tournament = get_tournament(tournament_id)
    raw = tournament.status()
    return TournamentStatus(
        id=tournament_id,
        system=raw["system"],
        total_rounds=raw["total_rounds"],
        current_round=raw["current_round"],
        started=raw["started"],
        awaiting_results=raw["awaiting_results"],
        finished=raw["finished"],
        player_count=raw["player_count"],
    )


__all__ = [
    "TournamentNotFoundError",
    "create_tournament",
    "get_tournament",
    "add_players",
    "generate_round",
    "enter_results",
    "get_standings",
    "get_status",
    "list_tournaments",
]
