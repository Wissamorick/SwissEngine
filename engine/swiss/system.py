"""Swiss system with Maximum Weight Matching — round-by-round API.

Logic taken from TOURNAMENT_Swiss_MWM_decr, split into generate_round / enter_results.
The shared bookkeeping (colors, byes, results) lives in RoundBasedSystem.
"""

import networkx as nx

from engine.common.matching import MWM
from engine.common.round_system import RoundBasedSystem
from engine.config import TournamentConfig
from engine.swiss.weights import resolve_system, update_graph_weights


class SwissSystem(RoundBasedSystem):
    def __init__(self, players: list[dict], config: TournamentConfig):
        super().__init__(players, config)
        # Edge (i, j) present <=> i and j have not met yet
        self.G = nx.complete_graph(self.n)

    def _mark_played(self, a: int, b: int) -> None:
        if self.G.has_edge(a, b):
            self.G.remove_edge(a, b)

    def _compute_raw_pairings(self) -> list[tuple[int, int]]:
        system, _mixed = resolve_system(self.config.system, self._current_round)

        if self.config.seeding:
            pairing_ranking = sorted(self.players, key=lambda x: (-x["pts"], -x["Elo"]))
        else:
            pairing_ranking = sorted(self.players, key=lambda x: (-x["pts"], -x["TB"]["Bu1"]))

        update_graph_weights(self.G, self.players, pairing_ranking, system, self.config.beta)

        raw_pairings = MWM(self.G)

        # Best boards first (same sort as TOURNAMENT_Swiss_MWM_decr)
        return sorted(
            raw_pairings,
            key=lambda x: (
                -(self.players[x[0]]["pts"] + self.players[x[1]]["pts"]),
                -(self.players[x[0]]["Elo"] + self.players[x[1]]["Elo"]),
            ),
        )
