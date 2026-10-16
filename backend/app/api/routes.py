"""HTTP routes — translate requests to service calls, nothing more."""

from collections.abc import Callable
from typing import Any, TypeVar

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse

from backend.app.models.schemas import (
    AddPlayersRequest,
    CorrectResultsRequest,
    CreateTournamentRequest,
    Crosstable,
    DirListing,
    EnterResultsRequest,
    ImportRequest,
    OpenRequest,
    OptionsRequest,
    PairingResponse,
    PlayerClubRequest,
    PlayerEditRequest,
    RecentTournament,
    RollbackRequest,
    RoundInfo,
    SaveRequest,
    StandingEntry,
    TournamentState,
    TournamentStatus,
)
from engine import PairingImpossibleError

from backend.app.services import storage, tournament_service
from backend.app.services.tournament_service import TournamentNotFoundError

router = APIRouter()

T = TypeVar("T")


def _call(fn: Callable[..., T], *args: Any, tournament_id: str | None = None) -> T:
    """Run a service call and map errors to HTTP status codes."""
    try:
        return fn(*args)
    except TournamentNotFoundError:
        raise HTTPException(status_code=404, detail=f"Tournament '{tournament_id}' not found")
    except PairingImpossibleError as exc:
        # 409: the request is valid but the tournament cannot go on as planned
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except FileExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except (ValueError, RuntimeError, KeyError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except OSError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ------------------------------------------------------------- tournaments
@router.post("/tournament", response_model=TournamentStatus, status_code=201)
def create_tournament(body: CreateTournamentRequest) -> TournamentStatus:
    return _call(tournament_service.create_tournament, body)


@router.get("/tournaments", response_model=list[TournamentStatus])
def list_tournaments() -> list[TournamentStatus]:
    return tournament_service.list_tournaments()


@router.get("/tournament/{tournament_id}", response_model=TournamentStatus)
def get_tournament(tournament_id: str) -> TournamentStatus:
    return _call(tournament_service.get_status, tournament_id, tournament_id=tournament_id)


@router.get("/tournament/{tournament_id}/state", response_model=TournamentState)
def get_state(tournament_id: str) -> TournamentState:
    return _call(tournament_service.get_state, tournament_id, tournament_id=tournament_id)


@router.post("/tournament/{tournament_id}/players", response_model=TournamentStatus)
def add_players(tournament_id: str, body: AddPlayersRequest) -> TournamentStatus:
    return _call(tournament_service.add_players, tournament_id, body, tournament_id=tournament_id)


@router.post(
    "/tournament/{tournament_id}/generate-round",
    response_model=list[PairingResponse],
)
def generate_round(tournament_id: str) -> list[PairingResponse]:
    return _call(tournament_service.generate_round, tournament_id, tournament_id=tournament_id)


@router.post("/tournament/{tournament_id}/results", response_model=TournamentStatus)
def enter_results(tournament_id: str, body: EnterResultsRequest) -> TournamentStatus:
    return _call(tournament_service.enter_results, tournament_id, body, tournament_id=tournament_id)


@router.post("/tournament/{tournament_id}/rounds/{round_number}/results", response_model=TournamentStatus)
def correct_results(tournament_id: str, round_number: int, body: CorrectResultsRequest) -> TournamentStatus:
    """Correct the results of a round already completed."""
    return _call(
        tournament_service.correct_results,
        tournament_id,
        round_number,
        {r.table: r.white_score for r in body.results},
        body.keep_later_rounds,
        tournament_id=tournament_id,
    )


@router.post("/tournament/{tournament_id}/options", response_model=TournamentStatus)
def set_options(tournament_id: str, body: OptionsRequest) -> TournamentStatus:
    return _call(tournament_service.set_options, tournament_id, body.show_club, tournament_id=tournament_id)


@router.post("/tournament/{tournament_id}/player-club", response_model=TournamentStatus)
def set_player_club(tournament_id: str, body: PlayerClubRequest) -> TournamentStatus:
    return _call(
        tournament_service.set_player_club, tournament_id, body.name, body.club, tournament_id=tournament_id
    )


@router.post("/tournament/{tournament_id}/player-edit", response_model=TournamentStatus)
def edit_player(tournament_id: str, body: PlayerEditRequest) -> TournamentStatus:
    """Rename a player and/or change their Elo (also during the tournament)."""
    return _call(
        tournament_service.edit_player,
        tournament_id,
        body.name,
        body.new_name,
        body.elo,
        tournament_id=tournament_id,
    )


@router.get("/tournament/{tournament_id}/standings", response_model=list[StandingEntry])
def get_standings(tournament_id: str) -> list[StandingEntry]:
    return _call(tournament_service.get_standings, tournament_id, tournament_id=tournament_id)


@router.get("/tournament/{tournament_id}/rounds", response_model=list[RoundInfo])
def get_rounds(tournament_id: str) -> list[RoundInfo]:
    return _call(tournament_service.get_rounds, tournament_id, tournament_id=tournament_id)


@router.get("/tournament/{tournament_id}/crosstable", response_model=Crosstable)
def get_crosstable(tournament_id: str, round: int | None = Query(default=None, ge=0)) -> Crosstable:
    """Grille américaine after `round` (default: last completed round)."""
    return _call(tournament_service.get_crosstable, tournament_id, round, tournament_id=tournament_id)


# ------------------------------------------------------ save / load / undo
@router.post("/tournament/{tournament_id}/save", response_model=TournamentStatus)
def save_tournament(tournament_id: str, body: SaveRequest) -> TournamentStatus:
    return _call(
        tournament_service.save_as,
        tournament_id,
        body.directory,
        body.folder_name,
        body.overwrite,
        tournament_id=tournament_id,
    )


@router.get("/tournament/{tournament_id}/export")
def export_tournament(tournament_id: str) -> JSONResponse:
    data = _call(tournament_service.export_data, tournament_id, tournament_id=tournament_id)
    filename = storage.sanitize_folder_name(data.get("name", "tournoi")) + ".json"
    return JSONResponse(
        content=data,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{_quote(filename)}"},
    )


@router.post("/tournament/{tournament_id}/end", response_model=TournamentStatus)
def end_tournament(tournament_id: str) -> TournamentStatus:
    """End the tournament now, after the last completed round."""
    return _call(tournament_service.end_tournament, tournament_id, tournament_id=tournament_id)


@router.post("/tournament/{tournament_id}/rollback", response_model=TournamentStatus)
def rollback(tournament_id: str, body: RollbackRequest) -> TournamentStatus:
    return _call(tournament_service.rollback, tournament_id, body.rounds_to_keep, tournament_id=tournament_id)


@router.post("/tournaments/open", response_model=TournamentStatus)
def open_tournament(body: OpenRequest) -> TournamentStatus:
    return _call(tournament_service.open_folder, body.path)


@router.post("/tournaments/import", response_model=TournamentStatus)
def import_tournament(body: ImportRequest) -> TournamentStatus:
    return _call(tournament_service.import_data, body.data)


@router.get("/recent", response_model=list[RecentTournament])
def recent_tournaments() -> list[RecentTournament]:
    return [RecentTournament(**item) for item in storage.list_recent()]


@router.get("/fs/list", response_model=DirListing)
def list_directory(path: str | None = None) -> DirListing:
    return DirListing.model_validate(_call(storage.list_directory, path))


# -------------------------------------------------------------- printables
@router.get("/tournament/{tournament_id}/print/pairings/{round_number}", response_class=HTMLResponse)
def print_pairings(tournament_id: str, round_number: int, auto: bool = False) -> HTMLResponse:
    html = _call(tournament_service.print_pairings, tournament_id, round_number, auto, tournament_id=tournament_id)
    return HTMLResponse(html)


@router.get("/tournament/{tournament_id}/print/crosstable/{round_number}", response_class=HTMLResponse)
def print_crosstable(tournament_id: str, round_number: int, auto: bool = False) -> HTMLResponse:
    html = _call(tournament_service.print_crosstable, tournament_id, round_number, auto, tournament_id=tournament_id)
    return HTMLResponse(html)


def _quote(value: str) -> str:
    from urllib.parse import quote

    return quote(value)
