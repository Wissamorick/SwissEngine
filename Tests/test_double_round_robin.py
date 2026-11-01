"""Tests: double round-robin ("aller-retour").

Run from the project root:  python -m unittest discover Tests
"""

from __future__ import annotations

import json
import random
import unittest
from collections import Counter

from engine import GameResult, Tournament


def make(n: int, double: bool = True, rounds: int = 0, points=None, seed: int = 0) -> Tournament:
    rng = random.Random(seed)
    t = Tournament({"system": "roundrobin", "rounds": rounds, "double_round_robin": double,
                    "points": points or []}, name="RR")
    t.add_players([{"Name": f"J{i}", "Elo": rng.randint(1000, 2400)} for i in range(n)])
    return t


def play_all(t: Tournament, seed: int = 1, stop_after: int | None = None) -> None:
    rng = random.Random(seed)
    played = 0
    while not t.is_finished and (stop_after is None or played < stop_after):
        ps = t.generate_round()
        t.enter_results([GameResult(p.table, rng.choice([0.0, 0.5, 1.0])) for p in ps if not p.is_bye])
        played += 1


def games(t: Tournament) -> list[tuple[int, str, str]]:
    """(round, white, black) of every game, byes excluded."""
    return [(r["round"], p["white"], p["black"]) for r in t.rounds() for p in r["pairings"] if not p["is_bye"]]


class DoubleRoundRobin(unittest.TestCase):
    def test_number_of_rounds(self):
        for n, single in ((6, 5), (7, 7), (2, 1), (3, 3)):
            t = make(n)
            self.assertEqual(t.total_rounds, 2 * single, n)  # before the start
            play_all(t)
            self.assertEqual(t.completed_rounds, 2 * single, n)
            self.assertTrue(t.is_finished)
            self.assertEqual(make(n, double=False).total_rounds, single)

    def test_every_pair_twice_once_with_each_color(self):
        for n in (4, 6, 7, 10, 11):
            t = make(n, seed=n)
            play_all(t, seed=n)
            leg = t.total_rounds // 2
            g = games(t)
            # each ordered (white, black) exactly once => each pair twice, colors reversed
            ordered = Counter((w, b) for _, w, b in g)
            self.assertTrue(all(c == 1 for c in ordered.values()), n)
            names = [p["Name"] for p in t.players]
            for i, a in enumerate(names):
                for b in names[i + 1:]:
                    self.assertIn((a, b), ordered, (n, a, b))
                    self.assertIn((b, a), ordered, (n, a, b))
            # all first-leg games come before all second-leg games
            first = {frozenset((w, b)) for r, w, b in g if r <= leg}
            self.assertEqual(len(first), n * (n - 1) // 2, n)

    def test_second_leg_mirrors_first_leg(self):
        t = make(8, seed=3)
        play_all(t, seed=3)
        rounds = t.rounds()
        leg = len(rounds) // 2
        for k in range(leg):
            a, b = rounds[k]["pairings"], rounds[k + leg]["pairings"]
            self.assertEqual([(p["table"], p["white"], p["black"]) for p in a],
                             [(p["table"], p["black"], p["white"]) for p in b])

    def test_colors_balanced_and_byes(self):
        for n in (6, 7):
            t = make(n)
            play_all(t)
            whites, blacks, byes = Counter(), Counter(), Counter()
            for r in t.rounds():
                for p in r["pairings"]:
                    if p["is_bye"]:
                        byes[p["white"]] += 1
                    else:
                        whites[p["white"]] += 1
                        blacks[p["black"]] += 1
            for p in t.players:
                self.assertEqual(whites[p["Name"]], blacks[p["Name"]], (n, p["Name"]))
                self.assertEqual(byes[p["Name"]], 2 if n % 2 else 0, (n, p["Name"]))

    def test_scores_and_sonneborn_berger_accumulate(self):
        """Points and S.-B. recomputed by hand from the game history."""
        t = make(7, points=[2, 1], seed=5)
        play_all(t, seed=5)
        cfg = t.config
        pts = Counter()
        per_opp = Counter()  # (player, opponent) -> points scored against him
        for r in t.rounds():
            win = cfg.win_value(r["round"])
            for p in r["pairings"]:
                if p["is_bye"]:
                    continue  # round-robin: the exempt player rests, 0 point
                s = p["white_score"]
                pts[p["white"]] += s * win
                pts[p["black"]] += (1 - s) * win
                per_opp[(p["white"], p["black"])] += s * win
                per_opp[(p["black"], p["white"])] += (1 - s) * win
        st = {p["Name"]: p for p in t.get_standings()}
        for name, p in st.items():
            self.assertAlmostEqual(p["pts"], pts[name], msg=name)
            sb = sum(v * pts[opp] for (me, opp), v in per_opp.items() if me == name)
            self.assertAlmostEqual(p["TB"]["SB"], sb, msg=name)
        # the bye is a pseudo-player with 0 points: it adds nothing to S.-B.

    def test_save_reload_in_second_leg(self):
        """Reloading in the middle of the second leg gives the same continuation."""
        t = make(7, seed=9)
        play_all(t, seed=9, stop_after=9)   # first leg = 7 rounds, then 2 return rounds
        t.generate_round()                  # round 10 pending
        data = json.loads(json.dumps(t.to_dict()))
        r = Tournament.from_dict(data)
        self.assertEqual(r.to_dict(), data)
        self.assertEqual(r.status(), t.status())
        # finish both the same way: second-leg pairings are fully determined
        res = [GameResult(p["table"], 1.0) for p in t.rounds()[t.current_round - 1]["pairings"] if not p["is_bye"]]
        t.enter_results(res)
        r.enter_results(res)
        play_all(t, seed=4)
        play_all(r, seed=4)
        self.assertEqual(r.to_dict(), t.to_dict())

    def test_rollback_into_first_leg(self):
        t = make(6, seed=2)
        play_all(t, seed=2)
        back = t.truncated(3)
        self.assertEqual(back.completed_rounds, 3)
        play_all(back, seed=8)
        self.assertEqual(back.completed_rounds, 10)
        g = games(back)
        self.assertTrue(all(c == 1 for c in Counter((w, b) for _, w, b in g).values()))

    def test_old_files_without_the_option(self):
        """Files saved before the option existed load as single round-robin."""
        t = make(6, double=False)
        play_all(t, stop_after=2)
        data = t.to_dict()
        del data["config"]["double_round_robin"]
        r = Tournament.from_dict(data)
        self.assertFalse(r.config.double_round_robin)
        self.assertEqual(r.total_rounds, 5)

    def test_partial_number_of_rounds(self):
        t = make(6, rounds=7)  # first leg (5) + 2 return rounds
        play_all(t)
        self.assertEqual(t.completed_rounds, 7)


if __name__ == "__main__":
    unittest.main()
