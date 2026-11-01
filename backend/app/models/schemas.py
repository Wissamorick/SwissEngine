"""Pydantic schemas: shape of JSON going in and out of the API.

These are NOT the engine models — they only describe the HTTP contract.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field


class CreateTournamentRequest(BaseModel):
    name: str = Field(default="Tournoi", min_length=1)
    system: str = "dutch"
    rounds: int = Field(default=5, ge=0)  # 0 = automatic (round-robin only)
    points: list[float] = Field(default_factory=list)
    beta: int = Field(default=2, ge=1)
    bye_value: float = Field(default=0.5, ge=0)
    seeding: bool = True
    # Round 1: color of the higher-ranked player on table 1, then alternating
    first_board_color: Literal["white", "random", "black"] = "random"
    # Round-robin only: every game played twice, colors reversed (all first-leg rounds first)
    double_round_robin: bool = False
    show_club: bool = False


class PlayerInput(BaseModel):
    name: str = Field(min_length=1)
    elo: int = Field(default=0, ge=0)
    club: str | None = None


class AddPlayersRequest(BaseModel):
    players: list[PlayerInput]


class ResultInput(BaseModel):
    table: int = Field(ge=1)
    # 1.0, 0.5 or 0.0 from White's perspective, or a forfeit "1-F", "F-1", "F-F"
    white_score: float | str


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
    white_score: float | str | None = None  # result once entered (White's perspective, or forfeit code)


class AbsentEntry(BaseModel):
    name: str
    points: float  # points scored for the round
    reason: Literal["absent", "withdrawn", "late"]


class RoundInfo(BaseModel):
    round: int
    win_value: float
    completed: bool
    pairings: list[PairingResponse]
    absent: list[AbsentEntry] = Field(default_factory=list)  # players not paired


class StandingEntry(BaseModel):
    rank: int
    name: str
    club: str | None = None
    elo: int
    pts: float
    color_diff: int
    tiebreaks: dict[str, float | None]  # None: no value (e.g. Perf at 100 %)
    withdrawn: bool = False


class CrosstableCell(BaseModel):
    round: int
    bye: bool
    # "game", "forfeit", "bye", "absent", "withdrawn", "late"; None: no result yet
    kind: str | None = None
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
    tiebreaks: dict[str, float | None]  # None: no value (e.g. Perf at 100 %)
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
    # Above this number of rounds a full pairing may not exist (None: round-robin)
    max_safe_rounds: int | None = None
    # number of the next round to pair (absences are declared for it)
    next_round: int = 1
    # round-robin calendar: games with a result / all games (None otherwise)
    games_total: int | None = None
    games_played: int | None = None
    config: dict[str, Any]
    # Folder where the tournament is automatically saved (None = not saved yet)
    save_dir: str | None = None
    last_saved: str | None = None
    save_error: str | None = None


class PlayerOut(BaseModel):
    name: str
    elo: int
    club: str | None = None
    joined: int | None = None  # late arrival: first round the player could play
    withdrawn_from: int | None = None  # withdrawal: first round no longer played
    absent_next: float | None = None  # declared absent from the next round (0 or ½)


class PendingLate(BaseModel):
    """Player registered during a round: joins when its results are validated."""

    name: str
    elo: int
    club: str | None = None
    missed: float  # points of each missed round (0 or ½)


class TournamentState(BaseModel):
    """Everything the interface needs to display a tournament."""

    status: TournamentStatus
    players: list[PlayerOut]
    pending_late: list[PendingLate] = Field(default_factory=list)
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


class GameResultRequest(BaseModel):
    """Round-robin: result of one game, entered in any order; None clears it."""

    round: int = Field(ge=1)
    table: int = Field(ge=1)
    white_score: float | str | None = None  # forfeit codes "1-F", "F-1", "F-F" accepted


class GridGame(BaseModel):
    round: int
    color: str  # "W" / "B" for the row player
    score: float | None  # row player's result (1, 0.5, 0), None = not played yet
    forfeit: bool = False


class GridRow(BaseModel):
    rank: int
    name: str
    club: str | None = None
    elo: int
    pts: float
    tiebreaks: dict[str, float | None]  # None: no value (e.g. Perf at 100 %)
    played: int
    cells: list[list[GridGame] | None]  # one per column (same order as rows), None on the diagonal


class ResultsGrid(BaseModel):
    legs: int
    tiebreak_keys: list[str]
    games_total: int
    games_played: int
    rows: list[GridRow]


class PlayerRemoveRequest(BaseModel):
    name: str = Field(min_length=1)


class AbsenceRequest(BaseModel):
    """Absence from the next round to pair: 0 or ½ point; None cancels it."""

    name: str = Field(min_length=1)
    value: float | None = None


class LatePlayersRequest(BaseModel):
    """Players registered after the start: each missed round is worth missed_value (0 or ½)."""

    players: list[PlayerInput]
    missed_value: float = 0.0


class PlayerClubRequest(BaseModel):
    name: str = Field(min_length=1)
    club: str = ""


class PlayerEditRequest(BaseModel):
    """Rename a player and/or change their Elo (allowed during the tournament)."""

    name: str = Field(min_length=1)  # current name
    new_name: str | None = None  # None = keep the name
    elo: int | None = Field(default=None, ge=0)  # None = keep the Elo


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
