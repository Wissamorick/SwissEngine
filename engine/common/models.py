from dataclasses import dataclass


@dataclass
class Pairing:
    table: int
    white_name: str
    black_name: str
    white_index: int
    black_index: int
    is_bye: bool = False
    # Snapshot taken when the round is paired (points *before* the round)
    white_elo: int = 0
    black_elo: int = 0
    white_pts: float = 0.0
    black_pts: float = 0.0


@dataclass
class GameResult:
    """Result from White's perspective, before win_value scaling.

    white_score: 1.0 (White wins), 0.5 (draw), 0.0 (Black wins).
    """

    table: int
    white_score: float
