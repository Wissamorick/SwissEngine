"""Tests: tournament performance ("Perf.", last tiebreak).

Run from the project root:  python -m unittest discover Tests
"""

from __future__ import annotations

import copy
import math
import random
import unittest

from engine import GameResult, PairingImpossibleError, Tournament
from engine.common.performance import _solve, expected_score, performance
from engine.tournament import SWISS_SYSTEMS

ALL_SYSTEMS = sorted(SWISS_SYSTEMS | {"random", "roundrobin"})


def make(system: str, n: int, rounds: int = 5, seed: int = 0, **cfg) -> Tournament:
    rng = random.Random(seed)
    t = Tournament({"system": system, "rounds": rounds, **cfg}, name="Test")
    t.add_players([{"Name": f"J{i}", "Elo": rng.choice([0, rng.randint(1000, 2600)])} for i in range(n)])
    return t


def play(t: Tournament, rng: random.Random) -> None:
    while not t.is_finished:
        try:
            pairings = t.generate_round()
        except PairingImpossibleError:
            t.end_tournament()
            return
        t.enter_results([GameResult(p.table, rng.choice([0.0, 0.5, 1.0])) for p in pairings if not p.is_bye])


def manual_games(t: Tournament) -> dict[str, list[tuple[float, float]]]:
    """(opponent Elo, game result) of every game played over the board."""
    elo = {p["Name"]: p["Elo"] for p in t._players}
    games: dict[str, list] = {p["Name"]: [] for p in t.players}
    for rnd in t._rounds:
        for p in rnd["pairings"]:
            if p.is_bye or not rnd["results"] or p.table not in rnd["results"]:
                continue
            s = rnd["results"][p.table]
            games[p.white_name].append((elo[p.black_name], s))
            games[p.black_name].append((elo[p.white_name], 1 - s))
    return games


class FormulaTests(unittest.TestCase):
    def test_example_values(self):
        base = [(2200, 1.0), (2100, 1.0), (2000, 0.5)]
        self.assertEqual(performance(base)[0], 2392)
        self.assertEqual(performance(base + [(1400, 1.0)])[0], 2394)  # a win never lowers it
        self.assertEqual(performance(base + [(1400, 0.5)])[0], 2229)

    def test_same_opponent_closed_form(self):
        for o in (0.0, 1200.0, 2500.0):
            for n in range(1, 30):
                for k in range(1, 2 * n):
                    s = k / 2
                    expected = o + 400 * math.log10(s / (n - s))
                    self.assertAlmostEqual(_solve([o] * n, s), expected, places=5)

    def test_solution_is_exact(self):
        rng = random.Random(1)
        for _ in range(2000):
            n = rng.randint(1, 60)
            opp = [rng.randint(100, 2900) for _ in range(n)]
            s = rng.randint(1, 2 * n - 1) / 2
            p = _solve(opp, s)
            self.assertAlmostEqual(sum(expected_score(o, p) for o in opp), s, places=6)

    def test_bracket_widens_beyond_800(self):
        # 59½ / 60 against equal opponents: 400 * log10(119) ≈ 830 > 800
        self.assertAlmostEqual(_solve([2000.0] * 60, 59.5), 2000 + 400 * math.log10(119), places=5)
        self.assertAlmostEqual(_solve([2000.0] * 60, 0.5), 2000 - 400 * math.log10(119), places=5)

    def test_monotonic(self):
        """Win: never lower; loss: never higher; draw: up iff the opponent is above."""
        rng = random.Random(2)
        for _ in range(3000):
            n = rng.randint(1, 15)
            games = [(float(rng.randint(1000, 2700)), rng.choice([0.0, 0.5, 1.0])) for _ in range(n)]
            opp, s = [o for o, _ in games], sum(r for _, r in games)
            if not 0 < s < n:
                continue
            p0 = _solve(opp, s)
            o = float(rng.randint(800, 2900))
            win, loss, draw = _solve(opp + [o], s + 1), _solve(opp + [o], s), _solve(opp + [o], s + 0.5)
            self.assertGreater(win, p0)
            self.assertLess(loss, p0)
            if abs(o - p0) > 1e-6:
                self.assertEqual(draw > p0, o > p0)
            # displayed (rounded) values follow the same order
            shown = performance(list(zip(opp, [r for _, r in games])))[0]
            self.assertGreaterEqual(performance(games + [(o, 1.0)])[0], shown)
            self.assertLessEqual(performance(games + [(o, 0.0)])[0], shown)

    def test_extremes_and_unrated(self):
        self.assertEqual(performance([]), (None, 0.0))
        self.assertEqual(performance([(0, 1.0), (0, 0.5)]), (None, 0.0))  # only unrated opponents
        self.assertEqual(performance([(2000, 1.0), (2101, 1.0)]), (None, 2851.0))  # 100 %: average + 800
        self.assertEqual(performance([(2000, 0.0), (2101, 0.0)]), (None, 1251.0))  # 0 %: average - 800
        # unrated opponents are ignored, together with their games
        self.assertEqual(performance([(2000, 1.0), (0, 0.0), (2000, 0.0)]), performance([(2000, 1.0), (2000, 0.0)]))
        self.assertEqual(performance([(2000, 1.0), (0, 0.0)]), (None, 2800.0))
        # rounding half up
        self.assertEqual(performance([(2000.5, 0.5)])[0], 2001)


class TournamentTests(unittest.TestCase):
    def test_matches_manual_computation_in_every_system(self):
        for system in ALL_SYSTEMS:
            for seed in range(6):
                rng = random.Random(seed)
                t = make(system, rng.randint(3, 11), rounds=4, seed=seed,
                         points=[3, 2] if system != "roundrobin" else [])
                play(t, rng)
                games = manual_games(t)
                for p in t.get_standings():
                    self.assertEqual(p["TB"]["Perf"], performance(games[p["Name"]])[0], (system, seed))

    def test_points_per_round_do_not_change_the_performance(self):
        """Swiss Pheng: game results, not weighted points."""
        for seed in range(5):
            a = make("dutch", 8, rounds=4, seed=seed)
            b = make("dutch", 8, rounds=4, seed=seed, points=[3, 2, 1])
            rng = random.Random(seed)
            # same pairings in both: replay a's rounds in b
            for _ in range(4):
                pa = a.generate_round()
                res = [GameResult(p.table, rng.choice([0.0, 0.5, 1.0])) for p in pa if not p.is_bye]
                a.enter_results(res)
                b._apply_round([(p.white_index, p.black_index) for p in pa])
                b.enter_results(res)
            perf = lambda t: {p["Name"]: p["TB"]["Perf"] for p in t.get_standings()}
            self.assertEqual(perf(a), perf(b))

    def test_order_only_breaks_remaining_ties(self):
        for system in ALL_SYSTEMS:
            for seed in range(8):
                rng = random.Random(seed)
                t = make(system, rng.randint(4, 12), rounds=5, seed=seed)
                play(t, rng)
                system_order = [p["Name"] for p in t._system.get_standings()]
                st = t.get_standings()
                keys = [k for k in st[0]["TB"] if k != "Perf"]
                crit = lambda p: (-p["pts"], *(-p["TB"][k] for k in keys))
                # same groups of system criteria, in the same order
                self.assertEqual([crit(p) for p in st], sorted(crit(p) for p in st))
                # inside a group: performance (internal value) decreasing, else system order
                games = manual_games(t)
                for a, b in zip(st, st[1:]):
                    if crit(a) == crit(b):
                        va, vb = performance(games[a["Name"]])[1], performance(games[b["Name"]])[1]
                        self.assertGreaterEqual(va, vb)
                        if va == vb:
                            self.assertLess(system_order.index(a["Name"]), system_order.index(b["Name"]))

    def test_engine_state_untouched(self):
        """Computing the standings changes nothing (the pairings never use the performance)."""
        for system in ALL_SYSTEMS:
            rng = random.Random(4)
            t = make(system, 9, rounds=4, seed=4)
            for _ in range(2):
                pairings = t.generate_round()
                t.enter_results([GameResult(p.table, rng.choice([0.0, 0.5, 1.0])) for p in pairings if not p.is_bye])
            before = copy.deepcopy(t.to_dict())
            players = copy.deepcopy(t._players)
            t.get_standings()
            t.crosstable()
            self.assertEqual(t.to_dict(), before)
            self.assertEqual(t._players, players)
            self.assertNotIn("Perf", t._players[0]["TB"])

    def test_no_rated_player_no_column(self):
        t = Tournament({"system": "dutch", "rounds": 3})
        t.add_players([{"Name": f"J{i}", "Elo": 0} for i in range(6)])
        play(t, random.Random(0))
        self.assertNotIn("Perf", t.get_standings()[0]["TB"])
        self.assertNotIn("Perf", t.crosstable()["tiebreak_keys"])

    def test_byes_excluded_and_round_robin_partial(self):
        t = Tournament({"system": "roundrobin", "rounds": 0})
        t.add_players([{"Name": n, "Elo": e} for n, e in (("A", 2000), ("B", 1800), ("C", 1600))])
        t.start_schedule()
        rnd, tbl = next((r["round"], p.table) for r in t._rounds for p in r["pairings"]
                        if not p.is_bye and {p.white_name, p.black_name} == {"A", "B"})
        p = next(p for p in t._rounds[rnd - 1]["pairings"] if p.table == tbl)
        t.set_result(rnd, tbl, 0.5)
        st = {q["Name"]: q["TB"]["Perf"] for q in t.get_standings()}
        self.assertEqual(st["A"], 1800)  # one draw against B
        self.assertEqual(st["B"], 2000)
        self.assertIsNone(st["C"])  # no game yet (byes do not count)
        self.assertTrue(p)

    def test_crosstable_and_grid_carry_it(self):
        rng = random.Random(0)
        t = make("dutch", 8, rounds=3, seed=1)
        play(t, rng)
        ct = t.crosstable()
        self.assertEqual(ct["tiebreak_keys"][-1], "Perf")
        self.assertEqual([r["name"] for r in ct["rows"]], [p["Name"] for p in t.get_standings()])
        early = t.crosstable(1)
        games1 = manual_games(t.truncated(1))
        for r in early["rows"]:
            self.assertEqual(r["tiebreaks"]["Perf"], performance(games1[r["name"]])[0])


if __name__ == "__main__":
    unittest.main()
