"""Round-robin pairings via the circle method — round-by-round API.

Everyone meets everyone over (n - 1) rounds when n is even (bye already added if odd).
"""

import random as rd

import numpy as np

from engine.common.base import BaseTournamentSystem
from engine.common.models import GameResult, Pairing
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


class RoundRobinSystem(BaseTournamentSystem):
    def __init__(self, players: list[dict], config: TournamentConfig):
        self.players = players
        self.config = config
        self.n = len(players)

        # Full RR needs n-1 rounds; honor config.rounds if smaller
        max_rounds = self.n - 1
        self.total_rounds = min(config.rounds, max_rounds) if config.rounds > 0 else max_rounds

        self._current_round = 1
        self._awaiting_results = False
        self._finished = False

        self.results = np.zeros((self.n, self.n), dtype=float)
        self._schedule = build_circle_schedule(self.n)

        self._pending_pairings: list[Pairing] = []
        self._win_value = 1.0

        for player in self.players:
            player["color_diff"] = 0
            player["pts"] = 0.0
            player["TB"] = {"SB": 0.0}

    @property
    def current_round(self) -> int:
        return self._current_round

    @property
    def is_finished(self) -> bool:
        return self._finished

    @property
    def awaiting_results(self) -> bool:
        return self._awaiting_results

    def _refresh_scores_and_tiebreaks(self) -> None:
        SB = Sonneborn_Berger(self.results)
        for i in range(self.n):
            self.players[i]["pts"] = float(np.sum(self.results[i]))
            self.players[i]["TB"]["SB"] = SB[i]

    def generate_round(self) -> list[Pairing]:
        if self._finished:
            raise RuntimeError("Tournament is already finished")
        if self._awaiting_results:
            raise RuntimeError("Results for the current round have not been entered yet")
        if self._current_round > self.total_rounds:
            self._finished = True
            raise RuntimeError("No rounds remaining")

        self._win_value = self.config.win_value(self._current_round)
        raw_pairings = self._schedule[self._current_round - 1]

        pairings: list[Pairing] = []
        for table_idx, (a, b) in enumerate(raw_pairings, start=1):
            if self.players[a]["Name"] == "bye":
                a, b = b, a
            if self.players[b]["Name"] == "bye":
                self.results[a][b] = self.config.bye_value * self._win_value
                pairings.append(
                    Pairing(
                        table=table_idx,
                        white_name=self.players[a]["Name"],
                        black_name="bye",
                        white_index=a,
                        black_index=b,
                        is_bye=True,
                    )
                )
                continue

            # Alternate colors: prefer balancing color_diff
            if self.players[a]["color_diff"] > self.players[b]["color_diff"]:
                a, b = b, a
            elif self.players[a]["color_diff"] == self.players[b]["color_diff"]:
                if rd.random() > 0.5:
                    a, b = b, a

            self.players[a]["color_diff"] += 1
            self.players[b]["color_diff"] -= 1

            pairings.append(
                Pairing(
                    table=table_idx,
                    white_name=self.players[a]["Name"],
                    black_name=self.players[b]["Name"],
                    white_index=a,
                    black_index=b,
                    is_bye=False,
                )
            )

        self._pending_pairings = pairings
        self._awaiting_results = True
        return list(pairings)

    def enter_results(self, results: list[GameResult]) -> None:
        if not self._awaiting_results:
            raise RuntimeError("No round is awaiting results")

        pending_games = [p for p in self._pending_pairings if not p.is_bye]
        if len(results) != len(pending_games):
            raise ValueError(
                f"Expected {len(pending_games)} results (non-bye games), got {len(results)}"
            )

        by_table = {r.table: r for r in results}
        for pairing in pending_games:
            if pairing.table not in by_table:
                raise ValueError(f"Missing result for table {pairing.table}")
            res = by_table[pairing.table].white_score
            if res not in (0.0, 0.5, 1.0):
                raise ValueError(f"Invalid white_score {res} at table {pairing.table}")

            a, b = pairing.white_index, pairing.black_index
            self.results[a][b] = res * self._win_value
            self.results[b][a] = (1 - res) * self._win_value

        self._refresh_scores_and_tiebreaks()
        self._pending_pairings = []
        self._awaiting_results = False
        self._current_round += 1

        if self._current_round > self.total_rounds:
            self._finished = True

    def get_standings(self) -> list[dict]:
        self._refresh_scores_and_tiebreaks()
        ranking = standings_roundrobin(self.players)
        return [p for p in ranking if p["Name"] != "bye"]
