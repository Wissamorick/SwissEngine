"""Tests: changing the settings and unregistering players before the start.

Run from the project root:  python -m unittest discover Tests
"""

from __future__ import annotations

import json
import random
import unittest

from engine import GameResult, Tournament, TournamentConfig
from engine.tournament import SWISS_SYSTEMS

ALL_SYSTEMS = sorted(SWISS_SYSTEMS | {"random", "roundrobin"})


def players(n: int, seed: int = 0) -> list[dict]:
    rng = random.Random(seed)
    return [{"Name": f"Joueur {i}", "Elo": rng.randint(1000, 2400)} for i in range(n)]


def play(t: Tournament, rounds: int, seed: int = 1) -> None:
    rng = random.Random(seed)
    for _ in range(rounds):
        if t.is_finished:
            return
        pairings = t.generate_round()
        t.enter_results(
            [GameResult(p.table, rng.choice([0.0, 0.5, 1.0])) for p in pairings if not p.is_bye]
        )


class SettingsBeforeStart(unittest.TestCase):
    def test_same_as_created_with_new_settings(self):
        """Changing the settings before the start == creating the tournament with them."""
        for system in ALL_SYSTEMS:
            for n in (7, 10):
                new = TournamentConfig(system=system, rounds=4, points=[3, 2, 1], bye_value=1.0, beta=3,
                                       seeding=False, first_board_color="white")
                a = Tournament({"system": "dutch", "rounds": 7}, name="Avant")
                a.add_players(players(n))
                a.update_settings(new, name="Après")
                b = Tournament(new, name="Après")
                b.add_players(players(n))
                random.seed(42)
                play(a, 4)
                random.seed(42)
                play(b, 4)
                self.assertEqual(a.to_dict(), b.to_dict(), (system, n))
                self.assertEqual(a.status(), b.status(), (system, n))

    def test_round_robin_auto_rounds(self):
        t = Tournament({"system": "dutch", "rounds": 5})
        t.add_players(players(6))
        t.update_settings(TournamentConfig(system="roundrobin", rounds=0))
        self.assertEqual(t.total_rounds, 5)
        t.add_players([{"Name": "Joueur 6", "Elo": 1500}])
        self.assertEqual(t.total_rounds, 7)  # 7 players + bye -> 7 rounds

    def test_refused_after_start(self):
        t = Tournament({"rounds": 3})
        t.add_players(players(6))
        t.generate_round()
        with self.assertRaises(RuntimeError):
            t.update_settings(TournamentConfig(rounds=5))
        self.assertEqual(t.config.rounds, 3)

    def test_empty_name_refused(self):
        t = Tournament({"rounds": 3}, name="Open")
        with self.assertRaises(ValueError):
            t.update_settings(TournamentConfig(rounds=4), name="   ")
        self.assertEqual((t.name, t.config.rounds), ("Open", 3))

    def test_saved_and_reloaded(self):
        t = Tournament({"rounds": 3}, name="Open")
        t.add_players(players(5))
        t.update_settings(TournamentConfig(system="burstein", rounds=6, points=[2, 1]), name="Open 2")
        r = Tournament.from_dict(json.loads(json.dumps(t.to_dict())))
        self.assertEqual(r.to_dict(), t.to_dict())
        self.assertEqual((r.name, r.config.system, r.config.rounds, r.config.points), ("Open 2", "burstein", 6, [2, 1]))


class RemovePlayer(unittest.TestCase):
    def test_remove_before_start(self):
        t = Tournament({"rounds": 3})
        t.add_players(players(5))
        t.remove_player("Joueur 2")
        self.assertEqual([p["Name"] for p in t.players], ["Joueur 0", "Joueur 1", "Joueur 3", "Joueur 4"])
        # the name can be used again, and the tournament plays normally
        t.add_players([{"Name": "Joueur 2", "Elo": 1200}])
        play(t, 3)
        self.assertTrue(t.is_finished)

    def test_same_as_never_registered(self):
        for system in ALL_SYSTEMS:
            a = Tournament({"system": system, "rounds": 3})
            a.add_players(players(8))
            a.remove_player("Joueur 5")
            b = Tournament({"system": system, "rounds": 3})
            b.add_players([p for p in players(8) if p["Name"] != "Joueur 5"])
            random.seed(7)
            play(a, 3)
            random.seed(7)
            play(b, 3)
            self.assertEqual(a.to_dict(), b.to_dict(), system)

    def test_unknown_and_after_start(self):
        t = Tournament({"rounds": 3})
        t.add_players(players(4))
        with self.assertRaises(ValueError):
            t.remove_player("Personne")
        t.generate_round()
        with self.assertRaises(RuntimeError):
            t.remove_player("Joueur 0")
        self.assertEqual(len(t.players), 4)


if __name__ == "__main__":
    unittest.main()
