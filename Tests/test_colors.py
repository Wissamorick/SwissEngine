"""Tests: colors (effective color, table alternation in round 1, color term).

Run from the project root:  python -m unittest discover Tests
"""

from __future__ import annotations

import itertools
import random
import unittest

import networkx as nx

from engine import GameResult, Tournament, TournamentConfig
from engine.common.colors import LAST_COLOR_WEIGHT, effective_color
from engine.swiss.weights import update_graph_weights
from engine.tournament import SWISS_SYSTEMS

ALL_SYSTEMS = sorted(SWISS_SYSTEMS | {"random", "roundrobin"})


def make(system: str, n: int, rounds: int, first: str = "random") -> Tournament:
    t = Tournament({"system": system, "rounds": rounds, "first_board_color": first})
    t.add_players([{"Name": f"J{i}", "Elo": 2400 - 10 * i} for i in range(n)])
    return t


def finish(t: Tournament, rng: random.Random) -> None:
    t.enter_results(
        [GameResult(p.table, rng.choice([0.0, 0.5, 1.0])) for p in t._rounds[-1]["pairings"] if not p.is_bye]
    )


def history(t: Tournament, upto: int) -> dict[str, tuple[int, int]]:
    """(cd, last color) of every player after the first `upto` rounds, rebuilt from the pairings."""
    state = {p["Name"]: (0, 0) for p in t._players}
    for rnd in t._rounds[:upto]:
        for p in rnd["pairings"]:
            if p.is_bye:
                continue
            cw, _ = state[p.white_name]
            cb, _ = state[p.black_name]
            state[p.white_name] = (cw + 1, 1)
            state[p.black_name] = (cb - 1, -1)
    return state


class EffectiveColorTests(unittest.TestCase):
    def test_values(self):
        self.assertEqual(LAST_COLOR_WEIGHT, 0.5)
        self.assertEqual(effective_color({"color_diff": 0, "last_color": 1}), 0.5)
        self.assertEqual(effective_color({"color_diff": 0, "last_color": -1}), -0.5)
        self.assertEqual(effective_color({"color_diff": 2, "last_color": 1}), 2.5)
        self.assertEqual(effective_color({"color_diff": 1, "last_color": -1}), 0.5)  # WWB: still owes Black
        self.assertEqual(effective_color({}), 0)

    def test_bonus_never_flips_a_real_imbalance(self):
        for cd in range(-6, 7):
            for last in (-1, 1):
                e = effective_color({"color_diff": cd, "last_color": last})
                if cd != 0:
                    self.assertEqual(e > 0, cd > 0)
                else:
                    self.assertEqual(e > 0, last > 0)


class FirstRoundAlternationTests(unittest.TestCase):
    def check(self, t: Tournament, top_white_on_table1: bool) -> None:
        rank = {p["Name"]: k for k, p in enumerate(t._players)}  # round 1: starting order
        for p in t._rounds[0]["pairings"]:
            if p.is_bye:
                continue
            top_is_white = rank[p.white_name] < rank[p.black_name]
            expected = top_white_on_table1 if p.table % 2 == 1 else not top_white_on_table1
            self.assertEqual(top_is_white, expected, (p.table, p.white_name, p.black_name))

    def test_white_and_black(self):
        for system in ALL_SYSTEMS:
            for n in (2, 5, 8, 11):
                for first, top_white in (("white", True), ("black", False)):
                    random.seed(n)
                    t = make(system, n, 1 if system != "roundrobin" else 0, first)
                    t.generate_round()
                    self.check(t, top_white)

    def test_random_draws_both_and_alternates(self):
        seen = set()
        for seed in range(40):
            random.seed(seed)
            t = make("dutch", 10, 3)
            t.generate_round()
            first = t._rounds[0]["pairings"][0]
            rank = {p["Name"]: k for k, p in enumerate(t._players)}
            top_white = rank[first.white_name] < rank[first.black_name]
            self.check(t, top_white)
            seen.add(top_white)
        self.assertEqual(seen, {True, False})

    def test_dutch_round1_classic_board_colors(self):
        """8 players, top player White: 1-5 (W), 6-2 , 3-7, 8-4 like a FIDE pairing card."""
        t = make("dutch", 8, 3, "white")
        t.generate_round()
        got = [(p.white_name, p.black_name) for p in t._rounds[0]["pairings"]]
        self.assertEqual(got, [("J0", "J4"), ("J5", "J1"), ("J2", "J6"), ("J7", "J3")])

    def test_config_validation_and_old_files(self):
        with self.assertRaises(ValueError):
            TournamentConfig(first_board_color="blue")
        t = make("dutch", 6, 2)
        data = t.to_dict()
        self.assertEqual(data["config"]["first_board_color"], "random")
        del data["config"]["first_board_color"]  # file saved before this option existed
        self.assertEqual(Tournament.from_dict(data).config.first_board_color, "random")


class AssignmentTests(unittest.TestCase):
    def test_lower_effective_color_gets_white(self):
        checked = 0
        for system in ALL_SYSTEMS:
            for seed in range(10):
                random.seed(seed)
                rng = random.Random(seed)
                n = rng.randint(4, 14)
                t = make(system, n, 0 if system == "roundrobin" else max(1, n // 2))
                while not t.is_finished:
                    t.generate_round()
                    r = len(t._rounds)
                    before = history(t, r - 1)
                    for p in t._rounds[-1]["pairings"]:
                        if p.is_bye:
                            continue
                        ew = before[p.white_name][0] + 0.5 * before[p.white_name][1]
                        eb = before[p.black_name][0] + 0.5 * before[p.black_name][1]
                        self.assertLessEqual(ew, eb, (system, seed, r))
                        checked += 1
                    finish(t, rng)
                # engine counters agree with the history
                final = history(t, len(t._rounds))
                for p in t.players:
                    self.assertEqual((p["color_diff"], p["last_color"]), final[p["Name"]])
        self.assertGreater(checked, 500)

    def test_bye_keeps_last_color(self):
        t = make("dutch", 5, 2, "white")
        rng = random.Random(0)
        t.generate_round()
        finish(t, rng)
        t.generate_round()
        bye = next(p for p in t._rounds[-1]["pairings"] if p.is_bye)
        hist = history(t, 1)
        player = next(p for p in t.players if p["Name"] == bye.white_name)
        self.assertEqual((player["color_diff"], player["last_color"]), hist[bye.white_name])

    def test_replay_restores_color_state(self):
        rng = random.Random(1)
        t = make("burstein", 9, 4)
        for _ in range(3):
            t.generate_round()
            finish(t, rng)
        t2 = Tournament.from_dict(t.to_dict())
        self.assertEqual(
            [(p["Name"], p["color_diff"], p["last_color"]) for p in t._players],
            [(p["Name"], p["color_diff"], p["last_color"]) for p in t2._players],
        )


class ColorTermTests(unittest.TestCase):
    def test_pairing_gives_as_many_players_as_possible_their_color(self):
        """Same scores, no game played yet: the matching reaches the maximum
        number of pairs of opposite effective colors (min(#positive, #negative))."""
        rng = random.Random(0)
        for _ in range(300):
            n = rng.choice([4, 6, 8, 10, 12])
            players = [
                {"Name": str(k), "Elo": 2000 - k, "pts": 1.0, "color_diff": rng.choice([-1, 1]),
                 "last_color": rng.choice([-1, 1]), "TB": {}}
                for k in range(n)
            ]
            G = nx.complete_graph(n)
            update_graph_weights(G, players, players, "dutch", beta=10)
            m = nx.max_weight_matching(G, True)
            e = [effective_color(p) for p in players]
            opposite = sum(1 for a, b in m if e[a] * e[b] < 0)
            pos, neg = sum(1 for x in e if x > 0), sum(1 for x in e if x < 0)
            self.assertEqual(opposite, min(pos, neg))

    def test_brute_force_small_groups(self):
        """Compared with every possible pairing of 6 players (same score)."""
        def matchings(xs):
            if not xs:
                yield []
                return
            for k in range(1, len(xs)):
                for m in matchings(xs[1:k] + xs[k + 1:]):
                    yield [(xs[0], xs[k])] + m

        for cds in itertools.product([-1, 1], repeat=6):
            for lasts in itertools.product([-1, 1], repeat=6):
                players = [
                    {"Name": str(k), "Elo": 2000 - k, "pts": 0.0, "color_diff": cds[k], "last_color": lasts[k], "TB": {}}
                    for k in range(6)
                ]
                e = [effective_color(p) for p in players]
                best = max(sum(1 for a, b in m if e[a] * e[b] < 0) for m in matchings(list(range(6))))
                G = nx.complete_graph(6)
                update_graph_weights(G, players, players, "dutch", beta=10)
                m = nx.max_weight_matching(G, True)
                self.assertEqual(sum(1 for a, b in m if e[a] * e[b] < 0), best)


if __name__ == "__main__":
    unittest.main()
