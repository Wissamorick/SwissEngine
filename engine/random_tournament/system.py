"""Random pairings — round-by-round API.

Each pair of players who have not met yet gets an independent random weight,
and the round is a maximum weight matching among maximum cardinality
matchings (same machinery as the Swiss systems, without any score term).

Compared with the former naive_max_matching (random greedy choice with
backtracking and a cap of n² attempts), the draw is just as random (close to
uniform over the possible rounds) but a full round is always found whenever
one exists, i.e. at least up to m / 2 rounds (see Tournament.max_safe_rounds).
"""

import random as rd

import networkx as nx

from engine.common.matching import MWM
from engine.common.round_system import RoundBasedSystem
from engine.config import TournamentConfig


class RandomSystem(RoundBasedSystem):
    def __init__(self, players: list[dict], config: TournamentConfig):
        super().__init__(players, config)
        # Edge (i, j) present <=> i and j have not met yet
        self.G = nx.complete_graph(self.n)

    def _mark_played(self, a: int, b: int) -> None:
        if self.G.has_edge(a, b):
            self.G.remove_edge(a, b)

    def _on_player_added(self, idx: int) -> None:
        self.G.add_node(idx)
        self.G.add_edges_from((j, idx) for j in range(idx))

    def _on_player_removed(self, idx: int) -> None:
        self.G.remove_node(idx)

    def _compute_raw_pairings(self, active: list[int]) -> list[tuple[int, int]]:
        if len(active) == self.n:
            G = self.G
        else:
            # absent players are left out of the draw
            G = self.G.subgraph(active).copy()
        for i, j in G.edges:
            G[i][j]["weight"] = rd.random()
        raw_pairings = MWM(G)

        # Order boards by combined score / Elo for display consistency
        return sorted(
            raw_pairings,
            key=lambda x: (
                -(self.players[x[0]]["pts"] + self.players[x[1]]["pts"]),
                -(self.players[x[0]]["Elo"] + self.players[x[1]]["Elo"]),
            ),
        )
