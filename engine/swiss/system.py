"""Swiss system with Maximum Weight Matching — round-by-round API.

Logic taken from TOURNAMENT_Swiss_MWM_decr, split into generate_round / enter_results.
"""

import random as rd

import networkx as nx
import numpy as np

from engine.common.base import BaseTournamentSystem
from engine.common.matching import MWM
from engine.common.models import GameResult, Pairing
from engine.common.tiebreaks import Bucholz
from engine.common.utils import standings_swiss
from engine.config import TournamentConfig
from engine.swiss.weights import resolve_system, update_graph_weights


class SwissSystem(BaseTournamentSystem):
    def __init__(self, players: list[dict], config: TournamentConfig):
        self.players = players
        self.config = config
        self.n = len(players)
        self.total_rounds = config.rounds
        self._current_round = 1
        self._awaiting_results = False
        self._finished = False

        self.results = np.zeros((self.n, self.n), dtype=float)
        self.G = nx.complete_graph(self.n)

        self._pending_pairings: list[Pairing] = []
        self._win_value = 1.0

        for player in self.players:
            player["color_diff"] = 0
            player["pts"] = 0.0
            player["TB"] = {"Bu1": 0.0, "Bu": 0.0}

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
        Bu1 = Bucholz(self.results, 1)
        Bu = Bucholz(self.results)
        for i in range(self.n):
            self.players[i]["pts"] = float(np.sum(self.results[i]))
            self.players[i]["TB"]["Bu1"] = Bu1[i]
            self.players[i]["TB"]["Bu"] = Bu[i]

    def generate_round(self) -> list[Pairing]:
        if self._finished:
            raise RuntimeError("Tournament is already finished")
        if self._awaiting_results:
            raise RuntimeError("Results for the current round have not been entered yet")
        if self._current_round > self.total_rounds:
            self._finished = True
            raise RuntimeError("No rounds remaining")

        self._refresh_scores_and_tiebreaks()

        system, _mixed = resolve_system(self.config.system, self._current_round)
        self._win_value = self.config.win_value(self._current_round)

        if self.config.seeding:
            pairing_ranking = sorted(self.players, key=lambda x: (-x["pts"], -x["Elo"]))
        else:
            pairing_ranking = sorted(self.players, key=lambda x: (-x["pts"], -x["TB"]["Bu1"]))

        update_graph_weights(self.G, self.players, pairing_ranking, system, self.config.beta)

        raw_pairings = MWM(self.G)

        # Best boards first (same sort as TOURNAMENT_Swiss_MWM_decr)
        raw_pairings = sorted(
            raw_pairings,
            key=lambda x: (
                -(self.players[x[0]]["pts"] + self.players[x[1]]["pts"]),
                -(self.players[x[0]]["Elo"] + self.players[x[1]]["Elo"]),
            ),
        )

        pairings: list[Pairing] = []
        for table_idx, (a, b) in enumerate(raw_pairings, start=1):
            self.G.remove_edge(a, b)

            # Bye always on Black side
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

            # Color assignment (same logic as original)
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
        ranking = standings_swiss(self.players)
        return [p for p in ranking if p["Name"] != "bye"]
