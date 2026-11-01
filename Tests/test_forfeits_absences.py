"""Tests: forfeits, absences, late arrivals and withdrawals.

Run from the project root:  python -m unittest discover Tests
"""

from __future__ import annotations

import copy
import random
import unittest

from engine import GameResult, PairingImpossibleError, Tournament
from engine.tournament import SWISS_SYSTEMS

PAIRED_SYSTEMS = sorted(SWISS_SYSTEMS | {"random"})
FORFEITS = ("1-F", "F-1", "F-F")


def make(system: str, n: int, rounds: int = 5, seed: int = 0, **cfg) -> Tournament:
    rng = random.Random(seed)
    t = Tournament({"system": system, "rounds": rounds, **cfg}, name="Test")
    t.add_players([{"Name": f"J{i}", "Elo": rng.randint(1000, 2400)} for i in range(n)])
    return t


def random_results(pairings, rng: random.Random, forfeit_rate: float = 0.0) -> list[GameResult]:
    out = []
    for p in pairings:
        if p.is_bye:
            continue
        if rng.random() < forfeit_rate:
            out.append(GameResult(p.table, rng.choice(FORFEITS)))
        else:
            out.append(GameResult(p.table, rng.choice([0.0, 0.5, 1.0])))
    return out


def fractions(score) -> tuple[float, float]:
    return {"1-F": (1.0, 0.0), "F-1": (0.0, 1.0), "F-F": (0.0, 0.0)}.get(score, (score, None)) if isinstance(
        score, str
    ) else (float(score), 1.0 - float(score))


def expected_from_file(data: dict) -> dict[str, dict]:
    """Points, Buchholz, Cut-1 and colors rebuilt from the saved file only (complete rounds)."""
    bye_value = data["config"]["bye_value"]
    points = data["config"]["points"]
    names = [p["name"] for p in data["players"]]
    pts = {n: 0.0 for n in names}
    cd = {n: 0 for n in names}
    rounds_of: dict[str, list] = {n: [] for n in names}  # (kind, opponent)
    for k, rnd in enumerate(data["rounds"], start=1):
        win = points[k - 1] if len(points) >= k else 1.0
        for name, f in (rnd.get("absent") or {}).items():
            pts[name] += f * win
            rounds_of[name].append(("absent", None))
        for p in rnd["pairings"]:
            w, b, s = p["white"], p["black"], p["white_score"]
            if b == "bye":
                pts[w] += bye_value * win
                rounds_of[w].append(("bye", None))
                continue
            fw, fb = fractions(s)
            pts[w] += fw * win
            pts[b] += fb * win
            rounds_of[w].append(("game", b))
            rounds_of[b].append(("game", w))
            if not isinstance(s, str):
                cd[w] += 1
                cd[b] -= 1
    out = {}
    for n in names:
        contrib = [pts[o] if o is not None else 0.0 for _, o in rounds_of[n]]
        bu = sum(contrib)
        out[n] = {"pts": pts[n], "Bu": bu, "Bu1": bu - min(contrib) if contrib else 0.0, "cd": cd[n]}
    return out


def observable(t: Tournament) -> dict:
    return {
        "dict": t.to_dict(),
        "status": t.status(),
        "rounds": t.rounds(),
        "standings": [(p["Name"], p["pts"], dict(p["TB"]), p["color_diff"], p.get("last_color")) for p in t.get_standings()],
    }


class ForfeitTests(unittest.TestCase):
    def test_points_and_colors(self):
        t = make("dutch", 6, rounds=3, seed=1, points=[3, 2, 1])
        t.generate_round()
        t.enter_results([GameResult(p.table, 1.0) for p in t._rounds[0]["pairings"]])
        before = {p["Name"]: (p["pts"], p["color_diff"], p["last_color"]) for p in t.players}
        ps = t.generate_round()  # round 2 is worth 2 points
        codes = dict(zip([p.table for p in ps], FORFEITS))
        t.enter_results([GameResult(tbl, c) for tbl, c in codes.items()])
        after = {p["Name"]: p for p in t.players}
        for p in ps:
            w, b = after[p.white_name], after[p.black_name]
            code = codes[p.table]
            gain = {"1-F": (2, 0), "F-1": (0, 2), "F-F": (0, 0)}[code]
            self.assertEqual(w["pts"] - before[p.white_name][0], gain[0])
            self.assertEqual(b["pts"] - before[p.black_name][0], gain[1])
            # the game was not played: colors unchanged
            self.assertEqual((w["color_diff"], w["last_color"]), before[p.white_name][1:])
            self.assertEqual((b["color_diff"], b["last_color"]), before[p.black_name][1:])
        # saved as codes
        self.assertEqual(
            sorted(p["white_score"] for p in t.to_dict()["rounds"][1]["pairings"]), sorted(FORFEITS)
        )

    def test_invalid_codes(self):
        t = make("dutch", 4, rounds=2)
        ps = t.generate_round()
        for bad in ("2-F", "F", "1-0", 2.0, "", None):
            with self.assertRaises((ValueError, TypeError)):
                t.enter_results([GameResult(p.table, bad) for p in ps])
        t.enter_results([GameResult(ps[0].table, "f-f"), GameResult(ps[1].table, "0.5")])  # normalized
        self.assertEqual(t._rounds[0]["results"], {ps[0].table: "F-F", ps[1].table: 0.5})

    def test_forfeit_counts_as_met_and_in_buchholz(self):
        checked = 0
        for system in PAIRED_SYSTEMS:
            for seed in range(8):
                random.seed(seed)
                rng = random.Random(seed)
                n = rng.randint(5, 11)
                t = make(system, n, rounds=min(5, (n + n % 2) // 2), seed=seed, bye_value=rng.choice([0.0, 0.5, 1.0]))
                met = set()
                while not t.is_finished:
                    ps = t.generate_round()
                    for p in ps:
                        if not p.is_bye:
                            pair = frozenset((p.white_name, p.black_name))
                            self.assertNotIn(pair, met)  # never paired twice, forfeits included
                            met.add(pair)
                    t.enter_results(random_results(ps, rng, forfeit_rate=0.3))
                exp = expected_from_file(t.to_dict())
                for p in t.get_standings():
                    e = exp[p["Name"]]
                    self.assertAlmostEqual(p["pts"], e["pts"])
                    self.assertAlmostEqual(p["TB"]["Bu"], e["Bu"], msg=(system, seed))
                    self.assertAlmostEqual(p["TB"]["Bu1"], e["Bu1"], msg=(system, seed))
                    self.assertEqual(p["color_diff"], e["cd"])
                    checked += 1
        self.assertGreater(checked, 300)

    def test_performance_ignores_forfeits(self):
        t = Tournament({"system": "dutch", "rounds": 2})
        t.add_players([{"Name": n, "Elo": e} for n, e in (("A", 2000), ("B", 1800), ("C", 1600), ("D", 1400))])
        ps = t.generate_round()
        t.enter_results([GameResult(ps[0].table, "1-F"), GameResult(ps[1].table, 0.5)])
        perf = {p["Name"]: p["TB"]["Perf"] for p in t.get_standings()}
        for name in (ps[0].white_name, ps[0].black_name):
            self.assertIsNone(perf[name])  # no game played over the board
        self.assertIsNotNone(perf[ps[1].white_name])

    def test_reload_and_correction(self):
        rng = random.Random(3)
        t = make("burstein", 9, rounds=4, seed=3)
        for _ in range(3):
            ps = t.generate_round()
            t.enter_results(random_results(ps, rng, forfeit_rate=0.4))
        t2 = Tournament.from_dict(t.to_dict())
        self.assertEqual(observable(t2), observable(t))
        # correct round 1 with a forfeit
        games = [p for p in t._rounds[0]["pairings"] if not p.is_bye]
        fixed = {p.table: "F-1" for p in games}
        t3 = t.with_corrected_results(1, fixed, keep_later_rounds=True)
        self.assertTrue(all(v == "F-1" for v in t3._rounds[0]["results"].values()))
        exp = expected_from_file(t3.to_dict())
        for p in t3.get_standings():
            self.assertAlmostEqual(p["TB"]["Bu"], exp[p["Name"]]["Bu"])

    def test_round_robin_forfeits(self):
        t = Tournament({"system": "roundrobin", "rounds": 0, "double_round_robin": True})
        t.add_players([{"Name": f"P{i}", "Elo": 2000 - i} for i in range(5)])
        t.start_schedule()
        rnd = t._rounds[0]
        games = [p for p in rnd["pairings"] if not p.is_bye]
        t.set_result(1, games[0].table, "1-F")
        t.set_result(1, games[1].table, "F-F")
        pts = {p["Name"]: p["pts"] for p in t.get_standings()}
        self.assertEqual(pts[games[0].white_name], 1.0)
        self.assertEqual(pts[games[0].black_name], 0.0)
        self.assertEqual(pts[games[1].white_name] + pts[games[1].black_name], 0.0)
        grid = t.results_grid()
        cell = next(r for r in grid["rows"] if r["name"] == games[0].white_name)
        col = [r["name"] for r in grid["rows"]].index(games[0].black_name)
        self.assertEqual(cell["cells"][col][0], {"round": 1, "color": "W", "score": 1.0, "forfeit": True})
        t2 = Tournament.from_dict(t.to_dict())
        self.assertEqual(observable(t2), observable(t))
        self.assertEqual(t.games_played, 2)
        with self.assertRaises(RuntimeError):
            t.set_absence("P1", 0.0)


class AbsenceTests(unittest.TestCase):
    def test_absent_player_scores_and_is_not_paired(self):
        t = make("dutch", 6, rounds=3, seed=2, points=[2, 1])
        t.set_absence("J0", 0.5)
        t.set_absence("J1", 0.0)
        ps = t.generate_round()
        names = {x for p in ps for x in (p.white_name, p.black_name)}
        self.assertNotIn("J0", names)
        self.assertNotIn("J1", names)
        self.assertEqual(sum(p.is_bye for p in ps), 0)  # 4 present: no bye
        t.enter_results([GameResult(p.table, 0.5) for p in ps])
        st = {p["Name"]: p for p in t.get_standings()}
        self.assertEqual(st["J0"]["pts"], 1.0)  # ½ of a round worth 2
        self.assertEqual(st["J1"]["pts"], 0.0)
        self.assertEqual(st["J0"]["TB"]["Bu"], 0.0)  # opponent with 0 point
        self.assertEqual(t.rounds()[0]["absent"], [
            {"name": "J0", "points": 1.0, "reason": "absent"},
            {"name": "J1", "points": 0.0, "reason": "absent"},
        ])
        # one round only
        ps = t.generate_round()
        names = {x for p in ps for x in (p.white_name, p.black_name)}
        self.assertTrue({"J0", "J1"} <= names)

    def test_bye_created_when_needed_and_given_once(self):
        t = make("dutch", 6, rounds=5, seed=4)
        self.assertNotIn("bye", [p["Name"] for p in t._players])
        rng = random.Random(4)
        byes = []
        for r in range(5):
            t.set_absence(f"J{r}", 0.0)  # 5 present: a bye every round
            ps = t.generate_round()
            bye = [p.white_name for p in ps if p.is_bye]
            self.assertEqual(len(bye), 1)
            byes += bye
            t.enter_results(random_results(ps, rng))
        self.assertEqual(len(byes), len(set(byes)))  # never twice to the same player

    def test_odd_with_one_absent_has_no_bye(self):
        t = make("monrad", 7, rounds=3)
        t.generate_round()
        t.enter_results([GameResult(p.table, 1.0) for p in t._rounds[0]["pairings"] if not p.is_bye])
        t.set_absence("J3", 0.5)
        ps = t.generate_round()
        self.assertFalse(any(p.is_bye for p in ps))
        self.assertEqual(len(ps), 3)

    def test_withdraw_and_reinstate(self):
        t = make("dutch", 8, rounds=5, seed=5)
        rng = random.Random(5)
        ps = t.generate_round()
        with self.assertRaises(ValueError):
            t.withdraw("nobody")
        t.withdraw("J2")  # during round 1: still has to get a result there
        self.assertEqual(t.next_round_number, 2)
        t.enter_results(random_results(ps, rng))
        for _ in range(2):
            ps = t.generate_round()
            self.assertNotIn("J2", {x for p in ps for x in (p.white_name, p.black_name)})
            self.assertEqual(sum(p.is_bye for p in ps), 1)  # 7 present
            t.enter_results(random_results(ps, rng))
        reasons = [a["reason"] for r in t.rounds()[1:] for a in r["absent"]]
        self.assertEqual(reasons, ["withdrawn", "withdrawn"])
        with self.assertRaises(ValueError):
            t.set_absence("J2", 0.5)
        t.reinstate("J2")
        ps = t.generate_round()
        self.assertIn("J2", {x for p in ps for x in (p.white_name, p.black_name)})
        # the missed rounds stay absences (0 point), shown as such
        self.assertEqual([a["reason"] for r in t.rounds()[1:3] for a in r["absent"]], ["absent", "absent"])

    def test_late_arrival(self):
        t = make("dutch", 6, rounds=5, seed=6, points=[3, 2, 1])
        rng = random.Random(6)
        ps = t.generate_round()
        t.enter_results(random_results(ps, rng))
        ps = t.generate_round()
        t.enter_results(random_results(ps, rng))
        with self.assertRaises(ValueError):
            t.add_late_player({"Name": "j0", "Elo": 1900})  # duplicate (case-insensitive)
        t.add_late_player({"Name": "Zoé", "Elo": 1900}, 0.5)
        zoe = next(p for p in t.get_standings() if p["Name"] == "Zoé")
        self.assertEqual(zoe["pts"], 0.5 * 3 + 0.5 * 2)
        self.assertEqual(zoe["joined"], 3)
        self.assertEqual([a["reason"] for r in t.rounds() for a in r["absent"]], ["late", "late"])
        ps = t.generate_round()  # 7 players: a bye appears
        self.assertIn("Zoé", {x for p in ps for x in (p.white_name, p.black_name)})
        self.assertEqual(sum(p.is_bye for p in ps), 1)
        t.enter_results(random_results(ps, rng))
        t2 = Tournament.from_dict(t.to_dict())
        self.assertEqual(observable(t2), observable(t))

    def test_late_arrival_during_a_round(self):
        """Registered while a round awaits its results: joins when they are validated."""
        t = make("dutch", 6, rounds=4, seed=8, points=[3, 2, 1])
        rng = random.Random(8)
        ps = t.generate_round()
        t.enter_results(random_results(ps, rng))
        ps = t.generate_round()  # round 2 pending
        t.add_late_player({"Name": "Zoé", "Elo": 1900}, 0.5)
        t.add_late_player({"Name": "Yann", "Elo": 1500}, 0.0)
        with self.assertRaises(ValueError):
            t.add_late_player({"Name": "zoé", "Elo": 1}, 0.0)  # already on hold
        self.assertNotIn("Zoé", [p["Name"] for p in t.players])
        self.assertEqual([e["name"] for e in t.pending_late], ["Zoé", "Yann"])
        # saved and reloaded while on hold
        t2 = Tournament.from_dict(t.to_dict())
        self.assertEqual(t2.pending_late, t.pending_late)
        self.assertEqual(observable(t2), observable(t))
        t.cancel_late("Yann")
        with self.assertRaises(ValueError):
            t.cancel_late("Yann")
        res = random_results(ps, rng)
        t.enter_results(res)
        t2.cancel_late("Yann")
        t2.enter_results(res)
        self.assertEqual(t.pending_late, [])
        zoe = next(p for p in t.get_standings() if p["Name"] == "Zoé")
        self.assertEqual(zoe["pts"], 0.5 * 3 + 0.5 * 2)  # rounds 1 and 2 missed, ½ each
        self.assertEqual(zoe["joined"], 3)
        self.assertEqual(observable(t2), observable(t))
        ps = t.generate_round()
        self.assertIn("Zoé", {x for p in ps for x in (p.white_name, p.black_name)})
        # not during the last round
        t.enter_results(random_results(ps, rng))
        t.generate_round()
        with self.assertRaises(RuntimeError):
            t.add_late_player({"Name": "Xavier", "Elo": 1500}, 0.0)

    def test_cancelling_the_round_registers_players_on_hold(self):
        t = make("dutch", 6, rounds=4, seed=9)
        rng = random.Random(9)
        ps = t.generate_round()
        t.enter_results(random_results(ps, rng))
        t.generate_round()
        t.add_late_player({"Name": "Zoé", "Elo": 1900}, 0.5)
        back = t.truncated(1)  # "Annuler les appariements" of round 2
        self.assertEqual(back.pending_late, [])
        zoe = next(p for p in back.players if p["Name"] == "Zoé")
        self.assertEqual(zoe["joined"], 2)  # plays the round paired again
        self.assertEqual(back.get_standings()[0]["Name"] != "", True)
        self.assertEqual(next(p for p in back.get_standings() if p["Name"] == "Zoé")["pts"], 0.5)

    def test_too_few_present(self):
        t = make("dutch", 3, rounds=2)
        t.set_absence("J0", 0.0)
        t.set_absence("J1", 0.0)
        before = t.to_dict()
        with self.assertRaises(PairingImpossibleError):
            t.generate_round()
        self.assertEqual(t.to_dict(), before)
        self.assertFalse(t.started)  # registrations still open
        self.assertNotIn("bye", [p["Name"] for p in t._players])

    def test_failed_pairing_leaves_no_bye(self):
        """A bye created for a round that cannot be paired is removed."""
        found = 0
        for seed in range(60):
            random.seed(seed)
            rng = random.Random(seed)
            t = make("dutch", 6, rounds=5, seed=seed)
            for r in range(5):
                if r >= 2:
                    t.set_absence(f"J{rng.randrange(6)}", 0.0)
                before, n_before = t.to_dict(), len(t._players)
                try:
                    ps = t.generate_round()
                except PairingImpossibleError:
                    self.assertEqual(t.to_dict(), before)
                    self.assertEqual(len(t._players), n_before)
                    self.assertEqual(t._system.n, n_before)
                    found += 1
                    break
                t.enter_results(random_results(ps, rng))
        self.assertGreater(found, 0)

    def test_cancel_pairings_keeps_declared_absences(self):
        t = make("dutch", 8, rounds=4, seed=7)
        ps = t.generate_round()
        t.enter_results([GameResult(p.table, 0.5) for p in ps])
        t.withdraw("J7")
        t.set_absence("J1", 0.5)
        t.generate_round()
        back = t.truncated(1)  # "Annuler les appariements" of round 2
        self.assertEqual(back.next_absences, {"J1": 0.5, "J7": 0.0})
        self.assertEqual(back._next_absent, {"J1": 0.5})

    def test_file_version(self):
        t = make("dutch", 6, rounds=3)
        self.assertEqual(t.to_dict()["version"], 1)  # nothing new: readable by older versions
        ps = t.generate_round()
        t.enter_results([GameResult(p.table, 1.0) for p in ps])
        self.assertEqual(t.to_dict()["version"], 1)
        for change in (
            lambda x: x.set_absence("J1", 0.0),
            lambda x: x.withdraw("J1"),
            lambda x: x.add_late_player({"Name": "Zoé", "Elo": 1500}),
        ):
            c = copy.deepcopy(t)
            change(c)
            self.assertEqual(c.to_dict()["version"], 2)
            self.assertEqual(Tournament.from_dict(c.to_dict()).to_dict(), c.to_dict())
        c = copy.deepcopy(t)
        ps = c.generate_round()
        c.enter_results([GameResult(ps[0].table, "F-F")] + [GameResult(p.table, 0.5) for p in ps[1:]])
        self.assertEqual(c.to_dict()["version"], 2)
        data = c.to_dict()
        data["version"] = 3
        with self.assertRaises(ValueError):
            Tournament.from_dict(data)

    def test_rename_keeps_absences(self):
        t = make("dutch", 6, rounds=3)
        t.set_absence("J1", 0.5)
        ps = t.generate_round()
        t.enter_results([GameResult(p.table, 1.0) for p in ps if not p.is_bye])
        t.set_absence("J2", 0.0)
        t.edit_player("J1", new_name="Jean")
        t.edit_player("J2", new_name="Paul")
        self.assertEqual(t._rounds[0]["absent"], {"Jean": 0.5})
        self.assertEqual(t.next_absences, {"Paul": 0.0})
        t2 = Tournament.from_dict(t.to_dict())
        self.assertEqual(observable(t2), observable(t))


class ScenarioTests(unittest.TestCase):
    """Random scenarios mixing everything: saving, reloading and going back stay exact."""

    def run_scenario(self, system: str, seed: int) -> int:
        rng = random.Random(seed)
        random.seed(seed)
        n = rng.randint(4, 10)
        t = make(system, n, rounds=6, seed=seed, bye_value=rng.choice([0.0, 0.5, 1.0]),
                 points=rng.choice([[], [3, 2, 1]]), seeding=rng.random() < 0.5)
        late = 0
        steps = 0
        while not t.is_finished:
            # declare things for the next round
            for p in list(t.players):
                x = rng.random()
                if p.get("withdrawn_from"):
                    if x < 0.15:
                        t.reinstate(p["Name"])
                elif x < 0.12:
                    t.set_absence(p["Name"], rng.choice([0.0, 0.5]))
                elif x < 0.16 and t.started:
                    t.withdraw(p["Name"])
            if t.started and rng.random() < 0.3:
                late += 1
                t.add_late_player({"Name": f"L{late}", "Elo": rng.randint(1000, 2400)}, rng.choice([0.0, 0.5]))
            snapshot = t.to_dict()
            try:
                ps = t.generate_round()
            except PairingImpossibleError:
                self.assertEqual(t.to_dict(), snapshot)
                if t.completed_rounds == 0:
                    return steps
                t.end_tournament()
                break
            if rng.random() < 0.25 and t._system.current_round < t._system.total_rounds:
                # arrives during the round: on hold until the results are validated
                late += 1
                t.add_late_player({"Name": f"L{late}", "Elo": rng.randint(1000, 2400)}, rng.choice([0.0, 0.5]))
                self.assertEqual(observable(Tournament.from_dict(copy.deepcopy(t.to_dict()))), observable(t))
            t.enter_results(random_results(ps, rng, forfeit_rate=0.15))
            self.assertEqual(t.pending_late, [])
            steps += 1

            # file round trip: same everything
            data = t.to_dict()
            t2 = Tournament.from_dict(copy.deepcopy(data))
            self.assertEqual(observable(t2), observable(t), (system, seed, steps))
            # scores and tiebreaks agree with an independent computation from the file
            exp = expected_from_file(data)
            for p in t.get_standings():
                e = exp[p["Name"]]
                self.assertAlmostEqual(p["pts"], e["pts"])
                self.assertAlmostEqual(p["TB"]["Bu"], e["Bu"])
                self.assertAlmostEqual(p["TB"]["Bu1"], e["Bu1"])
                self.assertEqual(p["color_diff"], e["cd"])
            # live and reloaded tournaments pair the next round identically
            if not t.is_finished:
                a, b = copy.deepcopy(t), Tournament.from_dict(copy.deepcopy(data))
                state = random.getstate()
                try:
                    pa = a.generate_round()
                    random.setstate(state)
                    pb = b.generate_round()
                    self.assertEqual([(p.white_name, p.black_name) for p in pa],
                                     [(p.white_name, p.black_name) for p in pb])
                except PairingImpossibleError:
                    random.setstate(state)
                    with self.assertRaises(PairingImpossibleError):
                        b.generate_round()
                random.setstate(state)
        # going back to any round gives a consistent tournament
        for k in range(len(t._rounds) + 1):
            tk = t.truncated(k)
            self.assertEqual(Tournament.from_dict(tk.to_dict()).to_dict(), tk.to_dict())
            self.assertEqual({p["Name"] for p in tk.players}, {p["Name"] for p in t.players})
            if k:
                self.assertEqual(tk.to_dict()["rounds"], t.to_dict()["rounds"][:k])
        return steps

    def test_scenarios(self):
        total = 0
        for system in PAIRED_SYSTEMS:
            for seed in range(10):
                total += self.run_scenario(system, seed)
        self.assertGreater(total, 200)


if __name__ == "__main__":
    unittest.main()
