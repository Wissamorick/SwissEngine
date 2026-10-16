"""Public façade: Tournament(config) → add_players → generate_round → enter_results → standings.

The tournament also keeps the full history of its rounds (pairings, colors and
results). That history is enough to rebuild the exact state of the tournament
at any point, which is what `to_dict` / `from_dict` rely on for saving,
loading and going back to an earlier round.
"""

from __future__ import annotations

from dataclasses import asdict, fields
from typing import Any

from engine.common.models import GameResult, Pairing
from engine.common.round_system import RoundBasedSystem
from engine.common.utils import ensure_player_fields
from engine.config import TournamentConfig
from engine.random_tournament.system import RandomSystem
from engine.roundrobin.system import RoundRobinSystem
from engine.swiss.system import SwissSystem

SWISS_SYSTEMS = {
    "dutch",
    "burstein",
    "monrad",
    "swissrandom",
    "swissrandom2",
    "mixed",
}

FILE_FORMAT = "swissengine-tournament"
FILE_VERSION = 1


def _build_system(players: list[dict], config: TournamentConfig) -> RoundBasedSystem:
    name = config.system.lower()
    if name in SWISS_SYSTEMS:
        return SwissSystem(players, config)
    if name == "random":
        return RandomSystem(players, config)
    if name == "roundrobin":
        return RoundRobinSystem(players, config)
    raise ValueError(
        f"Unknown system '{config.system}'. "
        f"Choose among: {sorted(SWISS_SYSTEMS | {'random', 'roundrobin'})}"
    )


def _parse_results(results: list[GameResult] | list[dict]) -> list[GameResult]:
    parsed: list[GameResult] = []
    for item in results:
        if isinstance(item, GameResult):
            parsed.append(item)
        else:
            parsed.append(GameResult(table=int(item["table"]), white_score=float(item["white_score"])))
    return parsed


def _result_symbol(score_fraction: float) -> str:
    """'+' win, '=' draw, '-' loss (score_fraction in [0, 1])."""
    if score_fraction > 0.5:
        return "+"
    if score_fraction < 0.5:
        return "-"
    return "="


class Tournament:
    """High-level API for organizing a tournament round by round."""

    def __init__(self, config: TournamentConfig | dict | None = None, name: str = "Tournoi"):
        if config is None:
            self.config = TournamentConfig()
        elif isinstance(config, dict):
            self.config = TournamentConfig(**config)
        else:
            self.config = config

        self.name = name
        self._players: list[dict] = []
        self._system: RoundBasedSystem | None = None
        self._started = False
        # One entry per round: {"round", "win_value", "pairings": list[Pairing],
        #                       "results": dict[table, white_score] | None}
        self._rounds: list[dict] = []
        # Display option: show the (optional) club / team of each player
        self.show_club = False
        # True when the player order is already the pairing order and must not
        # be re-sorted at start (rebuilding a tournament that has rounds).
        # Player indices drive the round-robin schedule: re-sorting after an
        # Elo change would silently change the remaining schedule and make
        # players meet twice.
        self._keep_order = False

    # ---------------------------------------------------------------- players
    def add_players(self, players: list[dict]) -> None:
        if self._started:
            raise RuntimeError("Cannot add players after the tournament has started")
        new_names: set[str] = set()
        for player in players:
            ensure_player_fields(player)
            name = player["Name"]
            if name.lower() == "bye":
                raise ValueError("Player name 'bye' is reserved")
            if name in new_names or any(p["Name"] == name for p in self._players):
                raise ValueError(f"Duplicate player name: {name}")
            new_names.add(name)
        self._players.extend(players)

    def set_club(self, name: str, club: str) -> None:
        """Set or clear the club / team of a player (allowed at any time)."""
        for p in self._players:
            if p["Name"] == name and name != "bye":
                club = club.strip()
                if club:
                    p["Club"] = club
                else:
                    p.pop("Club", None)
                return
        raise ValueError(f"Unknown player '{name}'")

    def add_player(self, name: str, elo: int = 0, **extra: Any) -> None:
        self.add_players([{"Name": name, "Elo": elo, **extra}])

    def _start(self) -> None:
        if self._started:
            return
        if len(self._players) < 2:
            raise RuntimeError("Need at least 2 players to start")

        # Sort by Elo descending (same as TestSwissPheng registration flow).
        # A rebuilt tournament (from_dict with rounds) keeps its saved order:
        # it is the order fixed when the tournament really started, and the
        # Elo may have been edited since then (see edit_player).
        if not self._keep_order:
            self._players = sorted(self._players, key=lambda x: -x["Elo"])

        if len(self._players) % 2 == 1:
            self._players.append(
                {
                    "Name": "bye",
                    "Elo": 0,
                    "strength": 0,
                    "pts": 0.0,
                    "color_diff": 0,
                    "TB": {},
                }
            )

        self._system = _build_system(self._players, self.config)
        self._started = True

    # ----------------------------------------------------------------- rounds
    def generate_round(self) -> list[Pairing]:
        self._start()
        assert self._system is not None
        round_number = self._system.current_round
        pairings = self._system.generate_round()
        self._rounds.append(
            {
                "round": round_number,
                "win_value": self.config.win_value(round_number),
                "pairings": pairings,
                "results": None,
            }
        )
        return pairings

    def _apply_round(self, pairs: list[tuple[int, int]]) -> list[Pairing]:
        self._start()
        assert self._system is not None
        round_number = self._system.current_round
        pairings = self._system.apply_round(pairs)
        self._rounds.append(
            {
                "round": round_number,
                "win_value": self.config.win_value(round_number),
                "pairings": pairings,
                "results": None,
            }
        )
        return pairings

    def enter_results(self, results: list[GameResult] | list[dict]) -> None:
        if self._system is None:
            raise RuntimeError("No round has been generated yet")
        parsed = _parse_results(results)
        self._system.enter_results(parsed)
        self._rounds[-1]["results"] = {r.table: float(r.white_score) for r in parsed}

    def get_standings(self) -> list[dict]:
        if self._system is None:
            # Not started: show registration order without bye
            return [dict(p) for p in self._players]
        return self._system.get_standings()

    # ------------------------------------------------------------- properties
    @property
    def players(self) -> list[dict]:
        return [p for p in self._players if p["Name"] != "bye"]

    @property
    def started(self) -> bool:
        return self._started

    @property
    def current_round(self) -> int:
        if self._system is None:
            return 1
        return self._system.current_round

    @property
    def total_rounds(self) -> int:
        if self._system is not None:
            return self._system.total_rounds
        if self.config.system.lower() == "roundrobin":
            # Everyone meets everyone: n - 1 rounds (n rounded up to even, bye included)
            n = len(self.players)
            full = max(n + n % 2 - 1, 0)
            return min(self.config.rounds, full) if self.config.rounds > 0 else full
        return self.config.rounds

    @property
    def max_safe_rounds(self) -> int | None:
        """Largest number of rounds for which a full pairing always exists.

        With m players (bye included, so m is even), after r rounds each
        player still has m - 1 - r possible opponents. While m - 1 - r >= m / 2,
        Dirac's theorem gives a Hamiltonian cycle in the graph of the games
        not played yet, hence a perfect matching. So every round up to
        round m / 2 can be paired; beyond that it may be impossible.

        Swiss and random systems find such a matching whenever one exists
        (maximum cardinality matching). None for round-robin (fixed schedule).
        """
        if self.config.system.lower() == "roundrobin":
            return None
        n = len(self.players)
        return (n + n % 2) // 2

    def end_tournament(self) -> None:
        """End the tournament now, after the last completed round.

        Used when the next round cannot be paired (too many rounds for the
        number of players), or simply to stop early. The number of rounds
        becomes the number of rounds played, so the file reloads as a
        finished tournament. Going back to an earlier round afterwards is
        still possible (the tournament then ends at this same round count).
        """
        if self._system is None or self.completed_rounds == 0:
            raise RuntimeError("Aucune ronde n'a encore été jouée")
        if self.awaiting_results:
            raise RuntimeError(
                "Une ronde attend ses résultats : saisissez-les ou annulez ses appariements d'abord"
            )
        if self.is_finished:
            raise RuntimeError("Le tournoi est déjà terminé")
        played = self.completed_rounds
        self.config.rounds = played
        self._system.total_rounds = played
        self._system._finished = True

    @property
    def completed_rounds(self) -> int:
        return sum(1 for r in self._rounds if r["results"] is not None)

    @property
    def is_finished(self) -> bool:
        return self._system is not None and self._system.is_finished

    @property
    def awaiting_results(self) -> bool:
        return self._system is not None and self._system.awaiting_results

    def status(self) -> dict:
        return {
            "name": self.name,
            "system": self.config.system,
            "total_rounds": self.total_rounds,
            "current_round": self.current_round,
            "completed_rounds": self.completed_rounds,
            "started": self._started,
            "awaiting_results": self.awaiting_results,
            "finished": self.is_finished,
            "player_count": len(self.players),
            "show_club": self.show_club,
            "max_safe_rounds": self.max_safe_rounds,
            "config": asdict(self.config),
        }

    def rounds(self) -> list[dict]:
        """History of the rounds, ready to display (points/Elo before each round)."""
        out: list[dict] = []
        for rnd in self._rounds:
            results = rnd["results"]
            pairings = []
            for p in rnd["pairings"]:
                score = None
                if results is not None and not p.is_bye:
                    score = results.get(p.table)
                pairings.append(
                    {
                        "table": p.table,
                        "white": p.white_name,
                        "black": p.black_name,
                        "is_bye": p.is_bye,
                        "white_elo": p.white_elo,
                        "black_elo": p.black_elo,
                        "white_pts": p.white_pts,
                        "black_pts": p.black_pts,
                        "white_score": score,
                    }
                )
            out.append(
                {
                    "round": rnd["round"],
                    "win_value": rnd["win_value"],
                    "completed": results is not None,
                    "pairings": pairings,
                }
            )
        return out

    # ---------------------------------------------------------- save / load
    def to_dict(self) -> dict:
        """Everything needed to rebuild the tournament (see `from_dict`)."""
        return {
            "format": FILE_FORMAT,
            "version": FILE_VERSION,
            "name": self.name,
            "config": asdict(self.config),
            "options": {"show_club": self.show_club},
            "players": [
                {"name": p["Name"], "elo": int(p.get("Elo", 0)), **({"club": p["Club"]} if p.get("Club") else {})}
                for p in self.players
            ],
            "rounds": [
                {
                    "round": rnd["round"],
                    "pairings": [
                        {
                            "table": p.table,
                            "white": p.white_name,
                            "black": p.black_name,
                            "white_score": (
                                None
                                if p.is_bye or rnd["results"] is None
                                else rnd["results"].get(p.table)
                            ),
                        }
                        for p in rnd["pairings"]
                    ],
                }
                for rnd in self._rounds
            ],
        }

    @classmethod
    def from_dict(cls, data: dict, up_to_round: int | None = None) -> "Tournament":
        """Rebuild a tournament by replaying its saved rounds.

        up_to_round: keep only the first N rounds (go back in time).
        The last kept round may have no results yet (it is then awaiting results).
        """
        if not isinstance(data, dict):
            raise ValueError("Invalid tournament file")
        if data.get("format", FILE_FORMAT) != FILE_FORMAT:
            raise ValueError("This file is not a SwissEngine tournament")
        if int(data.get("version", FILE_VERSION)) > FILE_VERSION:
            raise ValueError("This tournament was saved by a newer version of SwissEngine")

        known = {f.name for f in fields(TournamentConfig)}
        raw_config = {k: v for k, v in dict(data.get("config", {})).items() if k in known}
        tournament = cls(TournamentConfig(**raw_config), name=str(data.get("name") or "Tournoi"))

        players = data.get("players", [])
        tournament.show_club = bool(dict(data.get("options", {})).get("show_club", False))
        tournament.add_players(
            [
                {
                    "Name": str(p["name"]),
                    "Elo": int(p.get("elo", 0) or 0),
                    **({"Club": str(p["club"]).strip()} if str(p.get("club") or "").strip() else {}),
                }
                for p in players
            ]
        )

        rounds = list(data.get("rounds", []))
        if up_to_round is not None:
            if up_to_round < 0:
                raise ValueError("up_to_round must be >= 0")
            rounds = rounds[:up_to_round]

        # Once a round exists, the saved player order is the starting order
        # (to_dict writes the players in that order): keep it.
        tournament._keep_order = bool(rounds)

        for position, rnd in enumerate(rounds):
            round_number = position + 1
            saved = sorted(rnd.get("pairings", []), key=lambda p: int(p.get("table", 0)))
            if not saved:
                raise ValueError(f"Round {round_number} has no pairings")

            tournament._start()
            index = {p["Name"]: i for i, p in enumerate(tournament._players)}
            pairs: list[tuple[int, int]] = []
            for p in saved:
                white, black = str(p["white"]), str(p["black"])
                for name in (white, black):
                    if name not in index:
                        raise ValueError(f"Round {round_number}: unknown player '{name}'")
                pairs.append((index[white], index[black]))

            pairings = tournament._apply_round(pairs)

            games = [(pg, sv) for pg, sv in zip(pairings, saved) if not pg.is_bye]
            scores = [sv.get("white_score") for _, sv in games]
            if all(s is not None for s in scores):
                tournament.enter_results(
                    [GameResult(table=pg.table, white_score=float(s)) for (pg, _), s in zip(games, scores)]
                )
            elif position != len(rounds) - 1:
                raise ValueError(f"Round {round_number} has missing results")

        return tournament

    def truncated(self, rounds_to_keep: int) -> "Tournament":
        """Copy of this tournament keeping only its first `rounds_to_keep` rounds."""
        return Tournament.from_dict(self.to_dict(), up_to_round=rounds_to_keep)

    def with_corrected_results(
        self, round_number: int, results: dict[int, float], keep_later_rounds: bool
    ) -> "Tournament":
        """Copy of this tournament where the results of a completed round are corrected.

        keep_later_rounds=True: the pairings of the following rounds are kept as
        they are (only scores / tiebreaks change).
        keep_later_rounds=False: the following rounds are cancelled, so that
        they can be paired again with the corrected scores.
        """
        if not 1 <= round_number <= len(self._rounds) or self._rounds[round_number - 1]["results"] is None:
            raise ValueError(f"Round {round_number} is not completed")
        data = self.to_dict()
        saved = data["rounds"][round_number - 1]
        games = [p for p in saved["pairings"] if p["black"] != "bye"]
        for p in games:
            if p["table"] not in results:
                raise ValueError(f"Missing result for table {p['table']}")
            score = float(results[p["table"]])
            if score not in (0.0, 0.5, 1.0):
                raise ValueError(f"Invalid white_score {score} at table {p['table']}")
            p["white_score"] = score
        if not keep_later_rounds:
            data["rounds"] = data["rounds"][:round_number]
        return Tournament.from_dict(data)

    def edit_player(self, name: str, new_name: str | None = None, elo: int | None = None) -> None:
        """Rename a player and/or give them a new Elo, in place.

        Allowed at any time, including during the tournament.

        Names and Elo take no part in scores, tiebreaks or colors (those are
        computed from the results and the player indices), so the change is
        applied directly where they are stored: the player record and the
        pairings of every round (the pending one included). No round is
        replayed. The result is the same state as saving, editing the file
        and reloading it (checked in Tests/test_player_edit.py).

        - new_name must not be empty, must not be "bye", and must not be the
          name of another player (case-insensitive comparison).
        - elo must be an integer >= 0. Pairings already made are not changed;
          the new Elo is used for the next pairings (Elo order inside a score
          group when seeding is on, board order) and is shown everywhere,
          past rounds included. Player indices (round-robin schedule) are not
          affected.

        Everything is validated before anything is modified.
        """
        player = next((p for p in self.players if p["Name"] == name), None)
        if player is None:
            raise ValueError(f"Joueur inconnu : « {name} »")

        target = name
        if new_name is not None:
            target = new_name.strip()
            if not target:
                raise ValueError("Le nom ne peut pas être vide")
            if target.lower() == "bye":
                raise ValueError("Le nom « bye » est réservé")
            if target != name:
                for p in self.players:
                    if p is not player and p["Name"].strip().lower() == target.lower():
                        raise ValueError(f"Le nom « {target} » est déjà pris par un autre joueur")

        if elo is not None:
            if isinstance(elo, bool) or not isinstance(elo, int):
                raise ValueError("L'Elo doit être un nombre entier")
            if elo < 0:
                raise ValueError("L'Elo doit être positif ou nul")

        # ---- validated: apply
        # The pairings of self._rounds are the very objects held by the
        # system (pending round included), so one pass updates everything.
        pairings = [p for rnd in self._rounds for p in rnd["pairings"]]
        if target != name:
            player["Name"] = target
            for p in pairings:
                if p.white_name == name:
                    p.white_name = target
                if p.black_name == name:
                    p.black_name = target
        if elo is not None:
            player["Elo"] = elo
            player["strength"] = elo  # same as a freshly loaded player
            for p in pairings:
                if p.white_name == target:
                    p.white_elo = elo
                if p.black_name == target:
                    p.black_elo = elo

    # ------------------------------------------------------------ crosstable
    def crosstable(self, after_round: int | None = None) -> dict:
        """American grid ("grille américaine") after a given completed round.

        Each row = one player in ranking order; each cell = result, opponent
        rank and color for one round.
        """
        completed = self.completed_rounds
        k = completed if after_round is None else after_round
        if not 0 <= k <= completed:
            raise ValueError(f"Round {k} is not completed (completed rounds: {completed})")

        has_pending = any(r["results"] is None for r in self._rounds)
        source = self if (k == completed and not has_pending) else self.truncated(k)

        standings = source.get_standings()
        rank_of = {p["Name"]: i for i, p in enumerate(standings, start=1)}

        # name -> list of cells (one per round)
        cells: dict[str, list[dict]] = {p["Name"]: [] for p in standings}
        for rnd in source._rounds[:k]:
            win_value = rnd["win_value"]
            results = rnd["results"] or {}
            played: set[str] = set()
            for p in rnd["pairings"]:
                if p.is_bye:
                    fraction = source.config.bye_value
                    if p.white_name in cells:
                        cells[p.white_name].append(
                            {
                                "round": rnd["round"],
                                "bye": True,
                                "opponent": None,
                                "opponent_rank": None,
                                "color": None,
                                "result": _result_symbol(fraction),
                                "points": fraction * win_value,
                            }
                        )
                        played.add(p.white_name)
                    continue
                score = results.get(p.table)
                if score is None:
                    continue
                for me, opp, color, frac in (
                    (p.white_name, p.black_name, "W", score),
                    (p.black_name, p.white_name, "B", 1 - score),
                ):
                    if me in cells:
                        cells[me].append(
                            {
                                "round": rnd["round"],
                                "bye": False,
                                "opponent": opp,
                                "opponent_rank": rank_of.get(opp),
                                "color": color,
                                "result": _result_symbol(frac),
                                "points": frac * win_value,
                            }
                        )
                        played.add(me)
            for name, lst in cells.items():
                if name not in played:
                    lst.append(
                        {
                            "round": rnd["round"],
                            "bye": False,
                            "opponent": None,
                            "opponent_rank": None,
                            "color": None,
                            "result": None,
                            "points": 0.0,
                        }
                    )

        tiebreak_keys = list(standings[0].get("TB", {}).keys()) if standings else []
        rows = [
            {
                "rank": rank_of[p["Name"]],
                "name": p["Name"],
                "club": p.get("Club"),
                "elo": int(p.get("Elo", 0)),
                "pts": float(p.get("pts", 0.0)),
                "tiebreaks": {key: float(v) for key, v in p.get("TB", {}).items()},
                "cells": cells[p["Name"]],
            }
            for p in standings
        ]
        return {"after_round": k, "rounds": k, "tiebreak_keys": tiebreak_keys, "rows": rows}
