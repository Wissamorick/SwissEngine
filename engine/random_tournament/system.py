"""Random pairings via naive_max_matching — round-by-round API.

Logic taken from TOURNAMENT_random, without simulation / print.
"""

import numpy as np

from engine.common.matching import naive_max_matching
from engine.common.round_system import RoundBasedSystem
from engine.config import TournamentConfig


class RandomSystem(RoundBasedSystem):
    def __init__(self, players: list[dict], config: TournamentConfig):
        super().__init__(players, config)
        # A[i][j] = 1 <=> i and j may still be paired
        self.A = np.ones((self.n, self.n)) - np.identity(self.n)

    def _mark_played(self, a: int, b: int) -> None:
        self.A[a][b] = 0
        self.A[b][a] = 0

    def _compute_raw_pairings(self) -> list[tuple[int, int]]:
        raw_pairings = naive_max_matching(self.A)

        # Order boards by combined score / Elo for display consistency
        return sorted(
            raw_pairings,
            key=lambda x: (
                -(self.players[x[0]]["pts"] + self.players[x[1]]["pts"]),
                -(self.players[x[0]]["Elo"] + self.players[x[1]]["Elo"]),
            ),
        )
