"""Tests: round-robin calendar (whole schedule at once, results in any order).

Run from the project root:  python -m unittest discover Tests
"""

from __future__ import annotations

import json
import random
import unittest

from engine import GameResult, Tournament
from engine.tournament import MAX_ROUND_ROBIN_PLAYERS, TournamentConfig


def make(n: int, double: bool = False, points=None, seed: int = 0, bye_value: float = 0.5) -> Tournament:
    rng = random.Random(seed)
    t = Tournament({"system": "roundrobin", "rounds": 0, "double_round_robin": double,
                    "points": points or [], "bye_value": bye_value}, name="RR")
    t.add_players([{"Name": f"J{i}", "Elo": rng.randint(1000, 2400)} for i in range(n)])
    return t


def all_games(t: Tournament) -> list[tuple[int, int]]:
    return [(r["round"], p["table"]) for r in t.rounds() for p in r["pairings"] if not p["is_bye"]]


def standings(t: Tournament) -> list[tuple]:
    return [(p["Name"], p["pts"], p["TB"]) for p in t.get_standings()]


class Calendar(unittest.TestCase):
    def test_whole_calendar_at_start(self):
        for n, rounds in ((6, 5), (7, 7)):
            t = make(n)
            t.start_schedule()
            self.assertTrue(t.started)
            self.assertEqual(len(t.rounds()), rounds)
            self.assertEqual(t.games_total, n * (n - 1) // 2)
            self.assertEqual(t.status()["games_played"], 0)
            self.assertFalse(t.awaiting_results)
            self.assertEqual(t.current_round, 1)
            with self.assertRaises(RuntimeError):
                t.add_players([{"Name": "Late", "Elo": 1000}])
            t.start_schedule()  # idempotent
            self.assertEqual(len(t.rounds()), rounds)

    def test_any_order_gives_the_same_result(self):
        """Same results entered round by round or in a random order: same tournament."""
        for n in (5, 6, 9):
            for double in (False, True):
                for seed in range(5):
                    random.seed(seed)
                    a = make(n, double, points=[2, 1], seed=seed)
                    a.start_schedule()
                    random.seed(seed)
                    b = make(n, double, points=[2, 1], seed=seed)
                    b.start_schedule()
                    rng = random.Random(seed)
                    results = {g: rng.choice([0.0, 0.5, 1.0]) for g in all_games(a)}
                    for g, s in results.items():
                        a.set_result(*g, s)
                    order = list(results)
                    random.Random(99 + seed).shuffle(order)
                    for k, g in enumerate(order):
                        b.set_result(*g, results[g])
                        if k < len(order) - 1:
                            self.assertFalse(b.is_finished)
                    self.assertTrue(a.is_finished and b.is_finished)
                    self.assertEqual(a.to_dict(), b.to_dict())
                    self.assertEqual(standings(a), standings(b))

    def test_partial_results_scores(self):
        t = make(7, points=[3, 2, 1], seed=4)
        t.start_schedule()
        rng = random.Random(1)
        games = all_games(t)
        chosen = rng.sample(games, 9)
        expected = {p["Name"]: 0.0 for p in t.players}
        rounds = {r["round"]: r for r in t.rounds()}
        for rnd, table in chosen:
            s = rng.choice([0.0, 0.5, 1.0])
            t.set_result(rnd, table, s)
            game = next(p for p in rounds[rnd]["pairings"] if p["table"] == table)
            win = t.config.win_value(rnd)
            expected[game["white"]] += s * win
            expected[game["black"]] += (1 - s) * win
        got = {p["Name"]: p["pts"] for p in t.get_standings()}
        self.assertEqual(got, expected)  # exempt player: 0 point
        self.assertEqual(t.games_played, 9)
        self.assertFalse(t.is_finished)

    def test_change_and_clear(self):
        t = make(4)
        t.start_schedule()
        (r, table) = all_games(t)[0]
        t.set_result(r, table, 1.0)
        t.set_result(r, table, 0.0)
        game = next(p for p in t.rounds()[r - 1]["pairings"] if p["table"] == table)
        pts = {p["Name"]: p["pts"] for p in t.get_standings()}
        self.assertEqual((pts[game["white"]], pts[game["black"]]), (0.0, 1.0))
        t.set_result(r, table, None)
        self.assertEqual(sum(p["pts"] for p in t.get_standings()), 0.0)
        self.assertEqual(t.games_played, 0)

    def test_exempt_scores_nothing(self):
        t = make(5, bye_value=1.0)
        t.start_schedule()
        for g in all_games(t):
            t.set_result(*g, 0.5)
        # 10 games, 1 point each; byes give nothing whatever bye_value says
        self.assertEqual(sum(p["pts"] for p in t.get_standings()), 10.0)
        self.assertTrue(all(p["pts"] == 2.0 for p in t.get_standings()))

    def test_errors(self):
        t = make(5)
        with self.assertRaises(RuntimeError):
            t.set_result(1, 1, 1.0)  # no calendar yet
        t.start_schedule()
        bye_table = next(p["table"] for p in t.rounds()[0]["pairings"] if p["is_bye"])
        with self.assertRaises(ValueError):
            t.set_result(1, bye_table, 1.0)
        with self.assertRaises(ValueError):
            t.set_result(1, 99, 1.0)
        with self.assertRaises(ValueError):
            t.set_result(9, 1, 1.0)
        game_table = next(p["table"] for p in t.rounds()[0]["pairings"] if not p["is_bye"])
        with self.assertRaises(ValueError):
            t.set_result(1, game_table, 2.0)
        swiss = Tournament({"system": "dutch", "rounds": 3})
        swiss.add_players([{"Name": f"S{i}", "Elo": 1500} for i in range(4)])
        swiss.generate_round()
        with self.assertRaises(RuntimeError):
            swiss.set_result(1, 1, 1.0)

    def test_save_reload_partial(self):
        t = make(8, double=True, seed=2)
        t.start_schedule()
        rng = random.Random(3)
        for g in rng.sample(all_games(t), 20):
            t.set_result(*g, rng.choice([0.0, 0.5, 1.0]))
        data = json.loads(json.dumps(t.to_dict()))
        r = Tournament.from_dict(data)
        self.assertEqual(r.to_dict(), t.to_dict())
        self.assertEqual(standings(r), standings(t))
        self.assertEqual(r.status(), t.status())
        self.assertEqual(r.results_grid(), t.results_grid())

    def test_old_sequential_file(self):
        """A file saved before the calendar (3 rounds, the 3rd pending) opens as a full calendar."""
        random.seed(5)
        t = make(6, seed=5)
        t.start_schedule()
        rng = random.Random(5)
        for g in all_games(t):
            if g[0] <= 2:
                t.set_result(*g, rng.choice([0.0, 0.5, 1.0]))
        full = t.to_dict()
        old = json.loads(json.dumps(full))
        old["rounds"] = old["rounds"][:3]  # what the old app saved
        r = Tournament.from_dict(old)
        self.assertEqual(len(r.rounds()), 5)
        self.assertEqual(r.to_dict()["rounds"][:3], full["rounds"][:3])
        self.assertEqual(r.completed_rounds, 2)
        # every pair exactly once over the calendar
        pairs = [frozenset((p["white"], p["black"])) for x in r.rounds() for p in x["pairings"] if not p["is_bye"]]
        self.assertEqual(len(pairs), len(set(pairs)))
        self.assertEqual(len(pairs), 15)

    def test_points_before_round(self):
        t = make(4, seed=1)
        t.start_schedule()
        r1 = t.rounds()[0]["pairings"]
        t.set_result(1, r1[0]["table"], 1.0)
        later = t.rounds()[1]["pairings"]
        winner = r1[0]["white"]
        pts = {p["white"]: p["white_pts"] for p in later} | {p["black"]: p["black_pts"] for p in later}
        self.assertEqual(pts[winner], 1.0)
        self.assertEqual(sorted(pts.values()), [0.0, 0.0, 0.0, 1.0])

    def test_results_grid(self):
        t = make(5, double=True, seed=6)
        t.start_schedule()
        rng = random.Random(6)
        for g in all_games(t)[:-3]:
            t.set_result(*g, rng.choice([0.0, 0.5, 1.0]))
        grid = t.results_grid()
        self.assertEqual(grid["legs"], 2)
        rows = grid["rows"]
        names = [r["name"] for r in rows]
        self.assertEqual(names, [p["Name"] for p in t.get_standings()])
        for i, row in enumerate(rows):
            self.assertIsNone(row["cells"][i])
            total = 0.0
            for j, cell in enumerate(row["cells"]):
                if i == j:
                    continue
                self.assertEqual(len(cell), 2)  # aller + retour
                self.assertEqual({g["color"] for g in cell}, {"W", "B"})
                mirror = rows[j]["cells"][i]
                for g, m in zip(cell, mirror):
                    self.assertEqual(g["round"], m["round"])
                    if g["score"] is None:
                        self.assertIsNone(m["score"])
                    else:
                        self.assertEqual(g["score"] + m["score"], 1.0)
                        total += g["score"] * t.config.win_value(g["round"])
            self.assertAlmostEqual(total, row["pts"])
        self.assertEqual(grid["games_played"], len(all_games(t)) - 3)

    def test_end_early_on_calendar(self):
        t = make(6)
        t.start_schedule()
        for g in all_games(t):
            if g[0] <= 2:
                t.set_result(*g, 1.0)
        t.end_tournament()
        self.assertTrue(t.is_finished)
        self.assertEqual(t.total_rounds, 2)
        self.assertTrue(Tournament.from_dict(t.to_dict()).is_finished)


class PlayerLimit(unittest.TestCase):
    def test_limit_on_registration(self):
        t = make(MAX_ROUND_ROBIN_PLAYERS)
        with self.assertRaises(ValueError):
            t.add_players([{"Name": "Un de trop", "Elo": 1000}])
        self.assertEqual(len(t.players), MAX_ROUND_ROBIN_PLAYERS)
        swiss = Tournament({"system": "dutch", "rounds": 5})
        swiss.add_players([{"Name": f"S{i}", "Elo": 1000} for i in range(40)])  # no limit
        with self.assertRaises(ValueError):
            swiss.update_settings(TournamentConfig(system="roundrobin", rounds=0))
        self.assertEqual(swiss.config.system, "dutch")

    def test_old_big_file_still_opens(self):
        t = Tournament({"system": "dutch", "rounds": 3})
        t.add_players([{"Name": f"S{i}", "Elo": 1000} for i in range(30)])
        data = t.to_dict()
        data["config"]["system"] = "roundrobin"
        r = Tournament.from_dict(data)
        self.assertEqual(len(r.players), 30)


if __name__ == "__main__":
    unittest.main()
