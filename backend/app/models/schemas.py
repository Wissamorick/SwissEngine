"""Pydantic schemas: shape of JSON going in and out of the API.

These are NOT the engine models — they only describe the HTTP contract.
"""

from typing import Any

from pydantic import BaseModel, Field


class CreateTournamentRequest(BaseModel):
    name: str = Field(default="Tournoi", min_length=1)
    system: str = "dutch"
    rounds: int = Field(default=5, ge=0)  # 0 = automatic (round-robin only)
    points: list[float] = Field(default_factory=list)
    beta: int = Field(default=2, ge=1)
    bye_value: float = Field(default=0.5, ge=0)
    seeding: bool = True
    show_club: bool = False


class PlayerInput(BaseModel):
    name: str = Field(min_length=1)
    elo: int = Field(default=0, ge=0)
    club: str | None = None


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
    white_elo: int = 0
    black_elo: int = 0
    white_pts: float = 0.0  # points before the round
    black_pts: float = 0.0
    white_score: float | None = None  # result once entered (White's perspective)


class RoundInfo(BaseModel):
    round: int
    win_value: float
    completed: bool
    pairings: list[PairingResponse]


class StandingEntry(BaseModel):
    rank: int
    name: str
    club: str | None = None
    elo: int
    pts: float
    color_diff: int
    tiebreaks: dict[str, float]


class CrosstableCell(BaseModel):
    round: int
    bye: bool
    opponent: str | None
    opponent_rank: int | None
    color: str | None  # "W" / "B"
    result: str | None  # "+", "=", "-"
    points: float


class CrosstableRow(BaseModel):
    rank: int
    name: str
    club: str | None = None
    elo: int
    pts: float
    tiebreaks: dict[str, float]
    cells: list[CrosstableCell]


class Crosstable(BaseModel):
    after_round: int
    tiebreak_keys: list[str]
    rows: list[CrosstableRow]


class TournamentStatus(BaseModel):
    id: str
    name: str
    system: str
    total_rounds: int
    current_round: int
    completed_rounds: int
    started: bool
    awaiting_results: bool
    finished: bool
    player_count: int
    show_club: bool = False
    config: dict[str, Any]
    # Folder where the tournament is automatically saved (None = not saved yet)
    save_dir: str | None = None
    last_saved: str | None = None
    save_error: str | None = None


class PlayerOut(BaseModel):
    name: str
    elo: int
    club: str | None = None


class TournamentState(BaseModel):
    """Everything the interface needs to display a tournament."""

    status: TournamentStatus
    players: list[PlayerOut]
    rounds: list[RoundInfo]
    standings: list[StandingEntry]


class SaveRequest(BaseModel):
    directory: str = Field(min_length=1)  # parent folder
    folder_name: str = Field(min_length=1)  # folder created inside `directory`
    overwrite: bool = False


class OpenRequest(BaseModel):
    path: str = Field(min_length=1)  # tournament folder (or its tournoi.json)


class ImportRequest(BaseModel):
    data: dict[str, Any]


class OptionsRequest(BaseModel):
    show_club: bool


class PlayerClubRequest(BaseModel):
    name: str = Field(min_length=1)
    club: str = ""


class CorrectResultsRequest(BaseModel):
    results: list[ResultInput]
    # True: later rounds keep their pairings (only scores change)
    # False: later rounds are cancelled and must be paired again
    keep_later_rounds: bool = False


class RollbackRequest(BaseModel):
    rounds_to_keep: int = Field(ge=0)


class RecentTournament(BaseModel):
    name: str
    path: str
    saved_at: str | None = None


class DirEntry(BaseModel):
    name: str
    path: str
    is_tournament: bool


class DirListing(BaseModel):
    path: str
    parent: str | None
    is_tournament: bool
    entries: list[DirEntry]
    roots: list[str]
    home: str
    default_dir: str
