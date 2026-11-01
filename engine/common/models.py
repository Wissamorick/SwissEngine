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


# Forfeits: the game was not played. Codes written from White's side, as on
# a score sheet: "1-F" Black forfeited (White gets the win), "F-1" White
# forfeited, "F-F" both forfeited (no point for anyone).
# Result fractions (White, Black) of each code:
FORFEITS: dict[str, tuple[float, float]] = {"1-F": (1.0, 0.0), "F-1": (0.0, 1.0), "F-F": (0.0, 0.0)}
GAME_SCORES = (0.0, 0.5, 1.0)

Result = float | str  # 1.0, 0.5, 0.0 or a forfeit code


def normalize_result(value: object, table: int | None = None) -> Result:
    """Validated result: a game score (float) or a forfeit code (str)."""
    if isinstance(value, str):
        code = value.strip().upper()
        if code in FORFEITS:
            return code
        try:
            value = float(code)
        except ValueError:
            pass
    if isinstance(value, (int, float)) and not isinstance(value, bool) and float(value) in GAME_SCORES:
        return float(value)
    where = f" at table {table}" if table is not None else ""
    raise ValueError(f"Invalid white_score {value!r}{where}")


def is_forfeit(result: Result | None) -> bool:
    return isinstance(result, str)


def result_fractions(result: Result) -> tuple[float, float]:
    """(White, Black) share of the win value: (1, 0), (½, ½), (0, 1)… (0, 0) for a double forfeit."""
    if isinstance(result, str):
        return FORFEITS[result]
    return float(result), 1.0 - float(result)


@dataclass
class GameResult:
    """Result from White's perspective, before win_value scaling.

    white_score: 1.0 (White wins), 0.5 (draw), 0.0 (Black wins), or a
    forfeit code "1-F", "F-1", "F-F" (see FORFEITS).
    """

    table: int
    white_score: Result


class PairingImpossibleError(RuntimeError):
    """The pairing algorithm could not give an opponent to every player.

    Raised before anything is recorded: the tournament is left unchanged and
    can still be ended (Tournament.end_tournament) or rolled back.
    """
