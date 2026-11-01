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

    def _on_player_added(self, idx: int) -> None:
        # a new player (late arrival, or the bye) has met nobody yet
        self.G.add_node(idx)
        self.G.add_edges_from((j, idx) for j in range(idx))

    def _on_player_removed(self, idx: int) -> None:
        self.G.remove_node(idx)

    def _compute_raw_pairings(self, active: list[int]) -> list[tuple[int, int]]:
        if len(active) == self.n:
            # everybody plays: the historical computation, on the full graph
            return self._pair(self.G, self.players, list(range(self.n)))
        # some players are absent: pair the others only (same weights,
        # computed among the players present, as if the absent ones did not exist)
        sub = [self.players[k] for k in active]
        H = nx.Graph()
        H.add_nodes_from(range(len(active)))
        H.add_edges_from(
            (a, b)
            for a in range(len(active))
            for b in range(a + 1, len(active))
            if self.G.has_edge(active[a], active[b])
        )
        return self._pair(H, sub, active)

    def _pair(self, G, players: list[dict], labels: list[int]) -> list[tuple[int, int]]:
        """Maximum weight matching of G (nodes 0..m-1 = players), mapped back to labels."""
        system, _mixed = resolve_system(self.config.system, self._current_round)

        if self.config.seeding:
            pairing_ranking = sorted(players, key=lambda x: (-x["pts"], -x["Elo"]))
        else:
            pairing_ranking = sorted(players, key=lambda x: (-x["pts"], -x["TB"]["Bu1"]))

        update_graph_weights(G, players, pairing_ranking, system, self.config.beta)

        raw_pairings = [(labels[a], labels[b]) for a, b in MWM(G)]

        # Best boards first (same sort as TOURNAMENT_Swiss_MWM_decr)
        return sorted(
            raw_pairings,
            key=lambda x: (
                -(self.players[x[0]]["pts"] + self.players[x[1]]["pts"]),
                -(self.players[x[0]]["Elo"] + self.players[x[1]]["Elo"]),
            ),
        )
