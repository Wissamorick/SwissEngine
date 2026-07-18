"""Pydantic schemas: shape of JSON going in and out of the API.

These are NOT the engine models — they only describe the HTTP contract.
"""

from pydantic import BaseModel, Field


class CreateTournamentRequest(BaseModel):
    system: str = "dutch"
    rounds: int = Field(default=5, ge=1)
    points: list[float] = Field(default_factory=list)
    beta: int = Field(default=2, ge=1)
    bye_value: float = Field(default=0.5, ge=0)
    seeding: bool = True


class PlayerInput(BaseModel):
    name: str = Field(min_length=1)
    elo: int = Field(default=0, ge=0)


class AddPlayersRequest(BaseModel):
    players: list[PlayerInput]


class ResultInput(BaseModel):
    table: int = Field(ge=1)
    white_score: float  # 1.0, 0.5 or 0.0 from White's perspective


class EnterResultsRequest(BaseModel):
    results: list[ResultInput]


class PairingResponse(BaseModel):
    table: int
    white_name: str
    black_name: str
    is_bye: bool


class StandingEntry(BaseModel):
    rank: int
    name: str
    elo: int
    pts: float
    color_diff: int
    tiebreaks: dict[str, float]


class TournamentStatus(BaseModel):
    id: str
    system: str
    total_rounds: int
    current_round: int
    started: bool
    awaiting_results: bool
    finished: bool
    player_count: int
