"""Round-robin pairings via the circle method — round-by-round API.

Everyone meets everyone over (n - 1) rounds when n is even (bye already added if odd).
"""

import numpy as np

from engine.common.round_system import RoundBasedSystem
from engine.common.tiebreaks import Sonneborn_Berger
from engine.common.utils import standings_roundrobin
from engine.config import TournamentConfig


def build_circle_schedule(n: int) -> list[list[tuple[int, int]]]:
    """Standard circle / Berger tables. n must be even."""
    if n % 2 != 0:
        raise ValueError("Circle schedule requires an even number of players (add a bye)")

    arr = list(range(n))
    rounds: list[list[tuple[int, int]]] = []
    for _ in range(n - 1):
        pairs = []
        for i in range(n // 2):
            a, b = arr[i], arr[n - 1 - i]
            pairs.append((a, b))
        rounds.append(pairs)
        arr = [arr[0]] + [arr[-1]] + arr[1:-1]
    return rounds


class RoundRobinSystem(RoundBasedSystem):
    def __init__(self, players: list[dict], config: TournamentConfig):
        super().__init__(players, config)

        # Full RR needs n-1 rounds; honor config.rounds if smaller
        max_rounds = self.n - 1
        self.total_rounds = min(config.rounds, max_rounds) if config.rounds > 0 else max_rounds
        self._schedule = build_circle_schedule(self.n)

    def _empty_tiebreaks(self) -> dict[str, float]:
        return {"SB": 0.0}

    def _refresh_scores_and_tiebreaks(self) -> None:
        SB = Sonneborn_Berger(self.results)
        for i in range(self.n):
            self.players[i]["pts"] = float(np.sum(self.results[i]))
            self.players[i]["TB"]["SB"] = float(SB[i])

    def _standings_order(self) -> list[dict]:
        return standings_roundrobin(self.players)

    def _compute_raw_pairings(self) -> list[tuple[int, int]]:
        return list(self._schedule[self._current_round - 1])
