from dataclasses import dataclass, field


@dataclass
class TournamentConfig:
    """Configuration of a tournament.

    system:
        Swiss styles: "dutch" (default), "burstein", "monrad",
        "swissrandom", "swissrandom2", "mixed"
        Other formats: "random", "roundrobin"
    points:
        Win value for each round (Pheng). Missing entries default to 1.
    beta:
        Color constraint: pairing forbidden if |cd_i + cd_j| > 2*beta - 1.
    bye_value:
        Fraction of win_value awarded for a bye (default 0.5).
    seeding:
        If True, order within scoregroups by Elo; else by Buchholz Cut-1.
    first_board_color:
        Round 1: color of the higher-ranked player on table 1, "white",
        "black" or "random" (drawn by lot). Colors then alternate from one
        table to the next (FIDE practice), see RoundBasedSystem.
    """

    system: str = "dutch"
    rounds: int = 5
    points: list[float] = field(default_factory=list)
    beta: int = 2
    bye_value: float = 0.5
    seeding: bool = True
    first_board_color: str = "random"

    def __post_init__(self) -> None:
        from engine.common.colors import FIRST_BOARD_COLORS

        if self.first_board_color not in FIRST_BOARD_COLORS:
            raise ValueError(
                f"first_board_color must be one of {FIRST_BOARD_COLORS}, got {self.first_board_color!r}"
            )

    def win_value(self, round_number: int) -> float:
        """Points for a win in the given 1-based round."""
        if len(self.points) >= round_number:
            return self.points[round_number - 1]
        return 1.0
