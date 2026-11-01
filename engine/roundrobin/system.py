"""Round-robin pairings via the circle method — round-by-round API.

Everyone meets everyone over (n - 1) rounds when n is even (bye already added if odd).

Double round-robin ("aller-retour", config.double_round_robin): the n - 1
first-leg rounds are played first, then the same rounds again, in the same
order and with the same tables, colors reversed. The second-leg colors are
taken from the games actually played in the first leg.

Calendar mode (used by Tournament for every round-robin): pairings and
colors do not depend on the results, so the whole calendar is generated at
once (generate_round + skip_results for each round, which gives exactly the
same pairings and colors as playing the rounds one by one), and the results
are entered later in any order (rebuild_results). The exempt player of a
round only rests: 0 point (every player is exempt once per leg).
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

        # One leg = n-1 rounds (everyone meets everyone once); two legs for a
        # double round-robin. Honor config.rounds if smaller.
        self.leg_rounds = self.n - 1
        max_rounds = self.leg_rounds * (2 if config.double_round_robin else 1)
        self.total_rounds = min(config.rounds, max_rounds) if config.rounds > 0 else max_rounds
        self._schedule = build_circle_schedule(self.n)
        # (white, black) indices of every first-leg round, as actually played
        # (bye pairs included, as (player, bye))
        self._first_leg: dict[int, list[tuple[int, int]]] = {}

    def _empty_tiebreaks(self) -> dict[str, float]:
        return {"SB": 0.0}

    def _refresh_scores_and_tiebreaks(self) -> None:
        SB = Sonneborn_Berger(self.results)
        for i in range(self.n):
            self.players[i]["pts"] = float(np.sum(self.results[i]))
            self.players[i]["TB"]["SB"] = float(SB[i])

    def _standings_order(self) -> list[dict]:
        return standings_roundrobin(self.players)

    def _compute_raw_pairings(self, active: list[int]) -> list[tuple[int, int]]:
        # fixed calendar: nobody is ever absent in a round-robin
        return list(self._schedule[self._current_round - 1])

    def generate_round(self):
        if self._current_round <= self.leg_rounds:
            return super().generate_round()
        # second leg: same round of the first leg, colors reversed
        self._prepare_round()
        first = self._first_leg[self._current_round - self.leg_rounds]
        return self._register_round([(black, white) for white, black in first], assign_colors=False)

    def skip_results(self) -> None:
        """Close the pending round without results (calendar mode)."""
        if not self._awaiting_results:
            raise RuntimeError("No round is awaiting results")
        self._pending_pairings = []
        self._awaiting_results = False
        self._current_round += 1
        if self._current_round > self.total_rounds:
            self._finished = True

    def rebuild_results(self, games: list[tuple[int, int, float, float]]) -> None:
        """Scores from the games entered so far: (white, black, white points, black points).

        Byes are not games: the exempt player gets 0 point in a round-robin.
        """
        self.results = np.zeros((self.n, self.n), dtype=float)
        for a, b, pa, pb in games:
            self.results[a][b] += pa
            self.results[b][a] += pb
        self._refresh_scores_and_tiebreaks()

    def _register_round(self, raw_pairings, assign_colors):
        # remember the first-leg colors, whether the round was generated or
        # replayed from a saved file (apply_round)
        round_number = self._current_round
        pairings = super()._register_round(raw_pairings, assign_colors)
        if round_number <= self.leg_rounds:
            self._first_leg[round_number] = [(p.white_index, p.black_index) for p in pairings]
        return pairings
