"""Tests: renaming a player / changing a player's Elo during a tournament.

Run from the project root:  python -m unittest discover Tests
"""

from __future__ import annotations

import copy
import random
import unittest

from engine import GameResult, Tournament
from engine.tournament import SWISS_SYSTEMS

ALL_SYSTEMS = sorted(SWISS_SYSTEMS | {"random", "roundrobin"})


def make(system: str, n: int, rounds: int = 5, seed: int = 0) -> Tournament:
    rng = random.Random(seed)
    t = Tournament({"system": system, "rounds": rounds}, name="Test")
    t.add_players([{"Name": f"Joueur {i}", "Elo": rng.randint(1000, 2400)} for i in range(n)])
    return t


def edited(t: Tournament, name: str, new_name: str | None = None, elo: int | None = None) -> Tournament:
    """Copy of t with the edit applied in place (t itself is left untouched)."""
    c = copy.deepcopy(t)
    c.edit_player(name, new_name, elo)
    return c


def rebuilt(t: Tournament, name: str, new_name: str | None = None, elo: int | None = None) -> Tournament:
    """Reference: edit the saved form and reload it (replays every round)."""
    data = t.to_dict()
    target = new_name.strip() if new_name is not None else name
    for p in data["players"]:
        if p["name"] == name:
            p["name"] = target
            if elo is not None:
                p["elo"] = elo
    for rnd in data["rounds"]:
        for pairing in rnd["pairings"]:
            for side in ("white", "black"):
                if pairing[side] == name:
                    pairing[side] = target
    return Tournament.from_dict(data)


def observable(t: Tournament) -> dict:
    """Everything the interface and the files can show, plus internal order."""
    return {
        "dict": t.to_dict(),
        "status": t.status(),
        "rounds": t.rounds(),
        "standings": [dict(p) for p in t.get_standings()],
        "players": [dict(p) for p in t._players],
        "crosstables": [t.crosstable(k) for k in range(t.completed_rounds + 1)],
    }


def play_round(t: Tournament, rng: random.Random) -> None:
    pairings = t.generate_round()
    t.enter_results(
        [GameResult(p.table, rng.choice([0.0, 0.5, 1.0])) for p in pairings if not p.is_bye]
    )


def pairs_played(t: Tournament) -> list[frozenset[str]]:
    return [
        frozenset((p.white_name, p.black_name))
        for rnd in t._rounds
        for p in rnd["pairings"]
        if not p.is_bye
    ]


def scores(t: Tournament) -> dict[str, tuple]:
    return {
        p["Name"]: (p["pts"], tuple(sorted(p["TB"].items())), p["color_diff"])
        for p in t.get_standings()
    }


class RenameTests(unittest.TestCase):
    def test_rename_updates_everything(self):
        rng = random.Random(1)
        t = make("dutch", 9)
        for _ in range(3):
            play_round(t, rng)
        t.generate_round()  # round 4 awaiting results
        old = "Joueur 3"
        before = scores(t)
        t2 = edited(t, old, new_name="  Alice Martin  ")

        names = {p["Name"] for p in t2.players}
        self.assertIn("Alice Martin", names)
        self.assertNotIn(old, names)
        # History: no trace of the old name, same number of appearances
        hist = [n for r in t2.rounds() for p in r["pairings"] for n in (p["white"], p["black"])]
        hist_old = [n for r in t.rounds() for p in r["pairings"] for n in (p["white"], p["black"])]
        self.assertNotIn(old, hist)
        self.assertEqual(hist.count("Alice Martin"), hist_old.count(old))
        # Scores / tiebreaks / colors unchanged (only the key changes)
        after = scores(t2)
        before["Alice Martin"] = before.pop(old)
        self.assertEqual(before, after)
        # Still awaiting the results of round 4, same pairings
        self.assertTrue(t2.awaiting_results)
        self.assertEqual(t2.current_round, 4)
        # Crosstable mentions the new name as opponent
        ct = t2.crosstable()
        opps = {c["opponent"] for row in ct["rows"] for c in row["cells"]}
        self.assertNotIn(old, opps)
        # Save / reload round-trip
        self.assertEqual(Tournament.from_dict(t2.to_dict()).to_dict(), t2.to_dict())
        # The tournament can go on
        t2.enter_results([GameResult(p.table, 1.0) for p in t2._rounds[-1]["pairings"] if not p.is_bye])
        play_round(t2, rng)
        self.assertEqual(t2.completed_rounds, 5)

    def test_rename_does_not_change_next_pairings(self):
        """Names play no role in the algorithms: same seed -> same pairings."""
        for system in ALL_SYSTEMS:
            for seed in range(5):
                rng = random.Random(seed)
                t = make(system, 10, rounds=6, seed=seed)
                for _ in range(3):
                    play_round(t, rng)
                t2 = edited(t, "Joueur 0", new_name="Zoé")
                state = random.getstate()
                p1 = [(p.white_name, p.black_name) for p in t.generate_round()]
                random.setstate(state)
                p2 = [(p.white_name, p.black_name) for p in t2.generate_round()]
                rename = lambda n: "Zoé" if n == "Joueur 0" else n
                self.assertEqual([(rename(a), rename(b)) for a, b in p1], p2, (system, seed))

    def test_name_validation(self):
        t = make("dutch", 6)
        t.generate_round()
        for bad in ("", "   ", "bye", "BYE", "Joueur 1", "joueur 1", " JOUEUR 1 "):
            with self.assertRaises(ValueError, msg=repr(bad)):
                edited(t, "Joueur 0", new_name=bad)
        with self.assertRaises(ValueError):
            edited(t, "Inconnu", new_name="X")
        with self.assertRaises(ValueError):
            edited(t, "bye", new_name="X")
        # Changing only the case of one's own name is allowed
        t2 = edited(t, "Joueur 0", new_name="JOUEUR 0")
        self.assertIn("JOUEUR 0", {p["Name"] for p in t2.players})
        # Same name: no change at all
        self.assertEqual(edited(t, "Joueur 0", new_name="Joueur 0").to_dict(), t.to_dict())

    def test_swap_names_through_temporary(self):
        t = make("dutch", 4)
        play_round(t, random.Random(0))
        t = edited(t, "Joueur 0", new_name="tmp")
        t = edited(t, "Joueur 1", new_name="Joueur 0")
        t = edited(t, "tmp", new_name="Joueur 1")
        self.assertEqual(sorted(p["Name"] for p in t.players), [f"Joueur {i}" for i in range(4)])

    def test_rename_before_start(self):
        t = make("dutch", 5)
        t = edited(t, "Joueur 2", new_name="Bob", elo=3000)
        self.assertFalse(t.started)
        t.generate_round()
        # Not started yet when edited: the new Elo decides the seeding
        self.assertEqual(t._players[0]["Name"], "Bob")


class EloTests(unittest.TestCase):
    def test_elo_validation(self):
        t = make("dutch", 4)
        for bad in (-1, 1500.5, "1500", True, None.__class__):
            with self.assertRaises(ValueError, msg=repr(bad)):
                edited(t, "Joueur 0", elo=bad)  # type: ignore[arg-type]

    def test_elo_change_keeps_scores_and_indices(self):
        for system in ALL_SYSTEMS:
            rng = random.Random(3)
            t = make(system, 9, rounds=6)
            for _ in range(3):
                play_round(t, rng)
            order = [p["Name"] for p in t._players]
            before = scores(t)
            weakest = order[-2] if order[-1] == "bye" else order[-1]
            t2 = edited(t, weakest, elo=2900)
            self.assertEqual([p["Name"] for p in t2._players], order, system)
            self.assertEqual(scores(t2), before, system)
            self.assertEqual({p["Name"]: p["Elo"] for p in t2.players}[weakest], 2900)
            # reload keeps the order too
            t3 = Tournament.from_dict(t2.to_dict())
            self.assertEqual([p["Name"] for p in t3._players], order, system)

    def test_roundrobin_schedule_survives_elo_changes(self):
        """Regression: re-sorting by Elo on reload made players meet twice."""
        for n in range(3, 13):
            for seed in range(4):
                rng = random.Random(seed * 100 + n)
                t = make("roundrobin", n, rounds=0, seed=seed)
                while not t.is_finished:
                    if t.started and rng.random() < 0.6:
                        victim = rng.choice(t.players)["Name"]
                        t = edited(t, victim, elo=rng.randint(0, 3000))
                    play_round(t, rng)
                played = pairs_played(t)
                self.assertEqual(len(played), len(set(played)), (n, seed))
                self.assertEqual(len(set(played)), n * (n - 1) // 2, (n, seed))


# Note: Swiss and random tournaments are kept to at most n // 2 rounds here.
# Beyond m / 2 rounds a full round may not exist at all (tested in
# Tests/test_round_limit.py), which is unrelated to player edits.


class RandomizedTests(unittest.TestCase):
    def test_random_edits_never_break_a_tournament(self):
        for system in ALL_SYSTEMS:
            for seed in range(6):
                rng = random.Random(seed)
                random.seed(seed)
                n = rng.randint(4, 14)
                rounds = max(1, min(5, n // 2))
                t = make(system, n, rounds=rounds if system != "roundrobin" else 0, seed=seed)
                counter = 0
                while not t.is_finished:
                    for _ in range(rng.randint(0, 2)):
                        name = rng.choice(t.players)["Name"]
                        counter += 1
                        t = edited(t, 
                            name,
                            new_name=f"Renommé {counter}" if rng.random() < 0.5 else None,
                            elo=rng.randint(0, 3000) if rng.random() < 0.5 else None,
                        )
                    play_round(t, rng)
                    # every player plays exactly once per round
                    for rnd in t._rounds:
                        names = [x for p in rnd["pairings"] for x in (p.white_name, p.black_name)]
                        self.assertEqual(len(names), len(set(names)))
                    # no rematch (Swiss / round-robin / random all forbid it here)
                    played = pairs_played(t)
                    self.assertEqual(len(played), len(set(played)), (system, seed))
                    # total points = sum of distributed points
                    total = sum(p["pts"] for p in t.get_standings())
                    expected = sum(
                        rnd["win_value"] * (t.config.bye_value if p.is_bye else 1.0)
                        for rnd in t._rounds
                        for p in rnd["pairings"]
                    )
                    self.assertAlmostEqual(total, expected)
                    # reload = same tournament
                    self.assertEqual(Tournament.from_dict(t.to_dict()).to_dict(), t.to_dict())
                    self.assertEqual(scores(Tournament.from_dict(t.to_dict())), scores(t))


class InPlaceEqualsReloadTests(unittest.TestCase):
    """The in-place edit must give exactly the state of an edited-and-reloaded file."""

    def check(self, t: Tournament, name: str, new_name, elo, label) -> None:
        a = edited(t, name, new_name, elo)
        b = rebuilt(t, name, new_name, elo)
        self.assertEqual(observable(a), observable(b), label)
        # ... and the rest of the tournament unfolds identically
        rng_a, rng_b = random.Random(7), random.Random(7)
        state = random.getstate()
        while not a.is_finished:
            if a.awaiting_results:
                res = [GameResult(p.table, 1.0) for p in a._rounds[-1]["pairings"] if not p.is_bye]
                a.enter_results(res)
                b.enter_results(res)
                continue
            random.setstate(state)
            play_round(a, rng_a)
            random.setstate(state)
            play_round(b, rng_b)
            state = random.getstate()
            self.assertEqual(observable(a), observable(b), label)

    def test_random_edits(self):
        cases = 0
        for system in ALL_SYSTEMS:
            for seed in range(8):
                rng = random.Random(seed)
                random.seed(seed)
                n = rng.randint(3, 13)
                rounds = 0 if system == "roundrobin" else max(1, min(5, n // 2))
                t = make(system, n, rounds=rounds, seed=seed)
                stop = rng.randint(0, 3)  # edit before start, mid-tournament...
                for _ in range(stop):
                    if t.is_finished:
                        break
                    play_round(t, rng)
                if not t.is_finished and rng.random() < 0.5:
                    t.generate_round()  # ... or while a round awaits results
                name = rng.choice(t.players)["Name"]
                for new_name, elo in (
                    ("Nouveau", None),
                    (None, rng.randint(0, 3000)),
                    ("Nouveau", rng.randint(0, 3000)),
                    (name, None),
                    (None, None),
                ):
                    self.check(t, name, new_name, elo, (system, seed, new_name, elo))
                    cases += 1
        self.assertGreater(cases, 200)


if __name__ == "__main__":
    unittest.main()
