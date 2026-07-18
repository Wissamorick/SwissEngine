"""HTTP routes — translate requests to service calls, nothing more."""

from fastapi import APIRouter, HTTPException

from backend.app.models.schemas import (
    AddPlayersRequest,
    CreateTournamentRequest,
    EnterResultsRequest,
    PairingResponse,
    StandingEntry,
    TournamentStatus,
)
from backend.app.services import tournament_service
from backend.app.services.tournament_service import TournamentNotFoundError

router = APIRouter()


def _not_found(tournament_id: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"Tournament '{tournament_id}' not found")


@router.post("/tournament", response_model=TournamentStatus, status_code=201)
def create_tournament(body: CreateTournamentRequest) -> TournamentStatus:
    try:
        return tournament_service.create_tournament(body)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/tournaments", response_model=list[TournamentStatus])
def list_tournaments() -> list[TournamentStatus]:
    return tournament_service.list_tournaments()


@router.get("/tournament/{tournament_id}", response_model=TournamentStatus)
def get_tournament(tournament_id: str) -> TournamentStatus:
    try:
        return tournament_service.get_status(tournament_id)
    except TournamentNotFoundError:
        raise _not_found(tournament_id)


@router.post("/tournament/{tournament_id}/players", response_model=TournamentStatus)
def add_players(tournament_id: str, body: AddPlayersRequest) -> TournamentStatus:
    try:
        return tournament_service.add_players(tournament_id, body)
    except TournamentNotFoundError:
        raise _not_found(tournament_id)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post(
    "/tournament/{tournament_id}/generate-round",
    response_model=list[PairingResponse],
)
def generate_round(tournament_id: str) -> list[PairingResponse]:
    try:
        return tournament_service.generate_round(tournament_id)
    except TournamentNotFoundError:
        raise _not_found(tournament_id)
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/tournament/{tournament_id}/results", response_model=TournamentStatus)
def enter_results(tournament_id: str, body: EnterResultsRequest) -> TournamentStatus:
    try:
        return tournament_service.enter_results(tournament_id, body)
    except TournamentNotFoundError:
        raise _not_found(tournament_id)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/tournament/{tournament_id}/standings", response_model=list[StandingEntry])
def get_standings(tournament_id: str) -> list[StandingEntry]:
    try:
        return tournament_service.get_standings(tournament_id)
    except TournamentNotFoundError:
        raise _not_found(tournament_id)
