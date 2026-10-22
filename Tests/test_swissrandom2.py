"""Tests: Swiss Random 2 splits every scoregroup into an upper and a lower half.

Run from the project root:  python -m unittest discover Tests
"""

from __future__ import annotations

import random
import unittest

from engine import GameResult, Tournament
from engine.swiss.weights import compute_d_pi


def group_players(sizes: list[int]) -> tuple[list[dict], list[dict]]:
    players, k = [], 0
    for g, size in enumerate(sizes):
        for _ in range(size):
            players.append({"Name": f"P{k}", "Elo": 3000 - k, "pts": float(len(sizes) - g), "color_diff": 0, "TB": {}})
            k += 1
    ranking = sorted(players, key=lambda x: (-x["pts"], -x["Elo"]))
    return players, ranking


class HalvesTests(unittest.TestCase):
    def test_bonus_only_between_halves_of_every_group(self):
        for sizes in ([12], [6, 6], [3, 6, 3], [4, 8, 4], [5, 7, 1, 9], [2, 2, 2]):
            players, ranking = group_players(sizes)
            start = 0
            for size in sizes:
                members = list(range(start, start + size))
                upper = set(members[: size // 2])
                for a in members:
                    for b in members:
                        if a >= b:
                            continue
                        value = compute_d_pi("swissrandom2", players, ranking, a, b)
                        between = (a in upper) != (b in upper)
                        self.assertEqual(value >= 0, between, (sizes, a, b, value))
                start += size
            # two players of different groups: never the bonus
            if len(sizes) > 1:
                self.assertLess(compute_d_pi("swissrandom2", players, ranking, 0, sizes[0]), 0)

    def test_round1_is_upper_half_against_lower_half(self):
        for n in (8, 9, 16, 21):
            for seed in range(10):
                random.seed(seed)
                t = Tournament({"system": "swissrandom2", "rounds": 3})
                t.add_players([{"Name": f"J{i}", "Elo": 2500 - i} for i in range(n)])
                pairings = t.generate_round()
                m = n + n % 2
                rank = {p["Name"]: k for k, p in enumerate(t._players)}
                for p in pairings:
                    a, b = rank[p.white_name], rank[p.black_name]
                    self.assertNotEqual(a < m // 2, b < m // 2, (n, seed, p))

    def test_lower_groups_are_split_too(self):
        """Round 2: inside the 0-point group, pairs are upper vs lower half
        whenever colors allow it (they always do with board alternation and
        this group, checked over many draws)."""
        crossed = total = 0
        for seed in range(30):
            random.seed(seed)
            rng = random.Random(seed)
            t = Tournament({"system": "swissrandom2", "rounds": 3, "first_board_color": "white"})
            t.add_players([{"Name": f"J{i}", "Elo": 2500 - i} for i in range(16)])
            t.enter_results([GameResult(p.table, 1.0) for p in t.generate_round()])  # higher rated... White wins
            ranking = sorted(t._players, key=lambda x: (-x["pts"], -x["Elo"]))
            losers = [p["Name"] for p in ranking if p["pts"] == 0]
            upper = set(losers[: len(losers) // 2])
            for p in t.generate_round():
                if p.white_name in losers and p.black_name in losers:
                    total += 1
                    crossed += (p.white_name in upper) != (p.black_name in upper)
        self.assertGreater(total, 0)
        self.assertGreater(crossed / total, 0.9)


if __name__ == "__main__":
    unittest.main()
