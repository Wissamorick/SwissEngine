"""Tests: rounds that cannot be paired, and ending a tournament early.

Run from the project root:  python -m unittest discover Tests
"""

from __future__ import annotations

import random
import unittest

from engine import GameResult, PairingImpossibleError, Tournament
from engine.tournament import SWISS_SYSTEMS


def make(system: str, n: int, rounds: int) -> Tournament:
    t = Tournament({"system": system, "rounds": rounds}, name="Test")
    t.add_players([{"Name": f"J{i}", "Elo": 2000 - 7 * i} for i in range(n)])
    return t


def finish_round(t: Tournament, rng: random.Random) -> None:
    pairings = t._rounds[-1]["pairings"]
    t.enter_results([GameResult(p.table, rng.choice([0.0, 0.5, 1.0])) for p in pairings if not p.is_bye])


def assert_full_round(test: unittest.TestCase, t: Tournament) -> None:
    names = [x for p in t._rounds[-1]["pairings"] for x in (p.white_name, p.black_name)]
    test.assertEqual(sorted(names), sorted(p["Name"] for p in t._players))


class SafeLimitTests(unittest.TestCase):
    def test_max_safe_rounds_value(self):
        for n, expected in ((2, 1), (3, 2), (4, 2), (7, 4), (8, 4), (9, 5), (20, 10)):
            self.assertEqual(make("dutch", n, 3).max_safe_rounds, expected)
            self.assertEqual(make("random", n, 3).max_safe_rounds, expected)
        self.assertIsNone(make("roundrobin", 6, 0).max_safe_rounds)
        self.assertEqual(make("dutch", 7, 3).status()["max_safe_rounds"], 4)

    def test_swiss_and_random_always_pair_up_to_the_limit(self):
        """Dirac: up to m/2 rounds, a full pairing exists and MWM finds it."""
        count = 0
        for system in sorted(SWISS_SYSTEMS | {"random"}):
            for n in range(2, 17):
                for seed in range(12):
                    random.seed(seed)
                    rng = random.Random(seed)
                    t = make(system, n, make(system, n, 1).max_safe_rounds)
                    while not t.is_finished:
                        t.generate_round()  # must never raise
                        assert_full_round(self, t)
                        finish_round(t, rng)
                    count += 1
        self.assertEqual(count, 7 * 15 * 12)


class RandomDrawTests(unittest.TestCase):
    def test_random_round_is_close_to_uniform(self):
        """8 players after round 1: the 60 possible rounds come out evenly."""
        counts: dict = {}
        draws = 6000
        for seed in range(draws):
            random.seed(seed)
            t = make("random", 8, 2)
            t._apply_round([(0, 1), (2, 3), (4, 5), (6, 7)])
            t.enter_results([GameResult(k, 1.0) for k in range(1, 5)])
            pairs = t.generate_round()
            key = frozenset(frozenset((p.white_name, p.black_name)) for p in pairs)
            counts[key] = counts.get(key, 0) + 1
        self.assertEqual(len(counts), 60)
        expected = draws / 60
        for c in counts.values():
            self.assertTrue(0.6 * expected < c < 1.4 * expected, (c, expected))


class ImpossibleRoundTests(unittest.TestCase):
    def failing_tournament(self, system: str, n: int, seed: int) -> Tournament | None:
        """Play n - 1 rounds until a round cannot be paired (None if it never happens)."""
        random.seed(seed)
        rng = random.Random(seed)
        t = make(system, n, n - 1)
        while not t.is_finished:
            before = t.to_dict()
            snapshot = (t.status(), t.get_standings(), t.rounds())
            try:
                t.generate_round()
            except PairingImpossibleError as exc:
                # nothing was recorded
                self.assertEqual(t.to_dict(), before)
                self.assertEqual((t.status(), t.get_standings(), t.rounds()), snapshot)
                self.assertIn(f"ronde {t.current_round}", str(exc))
                return t
            assert_full_round(self, t)
            finish_round(t, rng)
        return None

    def test_failure_is_detected_and_tournament_can_end(self):
        failures = 0
        for system in sorted(SWISS_SYSTEMS | {"random"}):
            for n in (5, 6, 8, 10):
                for seed in range(15):
                    t = self.failing_tournament(system, n, seed)
                    if t is None:
                        continue
                    failures += 1
                    played = t.completed_rounds
                    self.assertGreater(played, t.max_safe_rounds - 1)  # only beyond the limit... or random
                    t.end_tournament()
                    self.assertTrue(t.is_finished)
                    self.assertEqual(t.total_rounds, played)
                    self.assertEqual(t.status()["total_rounds"], played)
                    with self.assertRaises(RuntimeError):
                        t.generate_round()
                    # reloads as a finished tournament, identical
                    t2 = Tournament.from_dict(t.to_dict())
                    self.assertTrue(t2.is_finished)
                    self.assertEqual(t2.to_dict(), t.to_dict())
                    self.assertEqual(t2.get_standings(), t.get_standings())
                    # going back one round: one round left to play
                    t3 = t.truncated(played - 1)
                    self.assertFalse(t3.is_finished)
                    self.assertEqual(t3.total_rounds, played)
        self.assertGreater(failures, 30)

    def test_end_tournament_preconditions(self):
        t = make("dutch", 6, 5)
        with self.assertRaises(RuntimeError):
            t.end_tournament()  # not started
        t.generate_round()
        with self.assertRaises(RuntimeError):
            t.end_tournament()  # awaiting results
        finish_round(t, random.Random(0))
        t.end_tournament()
        self.assertEqual(t.total_rounds, 1)
        with self.assertRaises(RuntimeError):
            t.end_tournament()  # already finished

    def test_end_roundrobin_early(self):
        t = make("roundrobin", 6, 0)
        rng = random.Random(0)
        for _ in range(2):
            t.generate_round()
            finish_round(t, rng)
        t.end_tournament()
        self.assertTrue(t.is_finished)
        t2 = Tournament.from_dict(t.to_dict())
        self.assertTrue(t2.is_finished)
        self.assertEqual(t2.total_rounds, 2)


if __name__ == "__main__":
    unittest.main()
