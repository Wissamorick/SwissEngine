"""Public façade: Tournament(config) → add_players → generate_round → enter_results → standings.

The tournament also keeps the full history of its rounds (pairings, colors and
results). That history is enough to rebuild the exact state of the tournament
at any point, which is what `to_dict` / `from_dict` rely on for saving,
loading and going back to an earlier round.
"""

from __future__ import annotations

from dataclasses import asdict, fields
from typing import Any

from engine.common.models import (
    GameResult,
    Pairing,
    PairingImpossibleError,
    is_forfeit,
    normalize_result,
    result_fractions,
)
from engine.common.performance import performance
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

# Round-robin: the results grid (one row and one column per player) stays
# readable up to this size; above it, use a Swiss system.
MAX_ROUND_ROBIN_PLAYERS = 24

FILE_FORMAT = "swissengine-tournament"
# Version 2 adds absences, late arrivals, withdrawals and forfeits. A file
# that uses none of them is still written as version 1, so that it stays
# readable by older versions of SwissEngine (which refuse newer versions
# with a clear message instead of misreading them).
FILE_VERSION = 2


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
            parsed.append(GameResult(table=int(item["table"]), white_score=normalize_result(item["white_score"])))
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
        #                       "results": dict[table, white_score] | None,
        #                       "absent": dict[name, fraction of the win value]}
        # white_score: 1.0 / 0.5 / 0.0, or a forfeit code "1-F" / "F-1" / "F-F".
        self._rounds: list[dict] = []
        # Display option: show the (optional) club / team of each player
        self.show_club = False
        # True when the player order is already the pairing order and must not
        # be re-sorted at start (rebuilding a tournament that has rounds).
        # Player indices drive the round-robin schedule: re-sorting after an
        # Elo change would silently change the remaining schedule and make
        # players meet twice.
        self._keep_order = False
        # Late arrivals registered while a round awaits its results: they join
        # when the results are validated (that round counts as missed).
        # Each entry: {"player": dict, "missed": fraction 0 or ½}
        self._pending_late: list[dict] = []
        # Absences declared for the next round to pair: name -> fraction of
        # the win value scored by the absent player (0 or ½). Withdrawn
        # players (player["withdrawn_from"]) are absent automatically.
        self._next_absent: dict[str, float] = {}

    # ---------------------------------------------------------------- players
    def add_players(self, players: list[dict], enforce_limit: bool = True) -> None:
        if self._started:
            raise RuntimeError("Cannot add players after the tournament has started")
        if enforce_limit and self.is_round_robin and len(self.players) + len(players) > MAX_ROUND_ROBIN_PLAYERS:
            raise ValueError(
                f"Un round-robin est limité à {MAX_ROUND_ROBIN_PLAYERS} joueurs "
                f"({len(self.players)} déjà inscrits, {len(players)} à ajouter). "
                "Au-delà, choisissez un système suisse."
            )
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

    def remove_player(self, name: str) -> None:
        """Unregister a player (only before the first round is generated)."""
        if self._started:
            raise RuntimeError("Cannot remove players after the tournament has started")
        for i, p in enumerate(self._players):
            if p["Name"] == name:
                del self._players[i]
                self._next_absent.pop(name, None)
                return
        raise ValueError(f"Joueur inconnu : « {name} »")

    # ------------------------------------------- absences, late arrivals, withdrawals
    # Swiss and random systems only: the round-robin calendar is fixed (a
    # game that does not take place is entered as a forfeit).
    def _check_presence_allowed(self) -> None:
        if self.is_round_robin:
            raise RuntimeError(
                "En round-robin, le calendrier est fixe : saisissez un forfait pour une partie non jouée"
            )
        if self.is_finished:
            raise RuntimeError("Le tournoi est terminé")

    def _player(self, name: str) -> dict:
        player = next((p for p in self.players if p["Name"] == name), None)
        if player is None:
            raise ValueError(f"Joueur inconnu : « {name} »")
        return player

    @property
    def next_round_number(self) -> int:
        """Number of the next round to pair (after the pending one, if any)."""
        if self._system is None:
            return 1
        return self._system.current_round + (1 if self._system.awaiting_results else 0)

    def _joined_after(self, name: str, round_number: int) -> bool:
        player = next((p for p in self._players if p["Name"] == name), None)
        return bool(player and player.get("joined") and round_number < player["joined"])

    def _withdrawn_in(self, name: str, round_number: int) -> bool:
        player = next((p for p in self._players if p["Name"] == name), None)
        start = player.get("withdrawn_from") if player else None
        return start is not None and round_number >= start

    def set_absence(self, name: str, fraction: float | None) -> None:
        """Declare a player absent from the next round to pair (0 or ½ point), or cancel it (None).

        The absence applies to one round only. The player is not paired and
        scores `fraction` of the win value of the round; in the Buchholz the
        round counts as an opponent with 0 point (like a bye).
        """
        self._check_presence_allowed()
        player = self._player(name)
        if fraction is None:
            self._next_absent.pop(name, None)
            return
        if float(fraction) not in (0.0, 0.5):
            raise ValueError("Une absence vaut 0 ou ½ point")
        if self._withdrawn_in(name, self.next_round_number):
            raise ValueError(f"« {name} » s'est retiré du tournoi")
        self._next_absent[player["Name"]] = float(fraction)

    @property
    def next_absences(self) -> dict[str, float]:
        """Absences of the next round to pair, withdrawn players included (0 point)."""
        r = self.next_round_number
        out = {name: f for name, f in self._next_absent.items() if not self._withdrawn_in(name, r)}
        for p in self.players:
            if self._withdrawn_in(p["Name"], r):
                out[p["Name"]] = 0.0
        return out

    def withdraw(self, name: str) -> None:
        """The player leaves the tournament: absent (0 point) from the next round to pair on.

        A game already paired must still get a result (a forfeit if it is not played).
        """
        self._check_presence_allowed()
        if not self._started:
            raise RuntimeError("Le tournoi n'a pas commencé : retirez simplement le joueur de la liste")
        player = self._player(name)
        if player.get("withdrawn_from") is not None:
            raise ValueError(f"« {name} » s'est déjà retiré")
        player["withdrawn_from"] = self.next_round_number
        self._next_absent.pop(name, None)

    def reinstate(self, name: str) -> None:
        """Cancel a withdrawal: the player is paired again from the next round on.

        The rounds already missed stay absences (0 point).
        """
        self._check_presence_allowed()
        player = self._player(name)
        if player.get("withdrawn_from") is None:
            raise ValueError(f"« {name} » ne s'est pas retiré")
        player.pop("withdrawn_from")

    def add_late_player(self, player: dict, missed_fraction: float = 0.0) -> None:
        """Register a player after the start (late arrival).

        The player is paired from the next round on; each round already
        paired counts as an absence worth `missed_fraction` (0 or ½) of its
        win value. While a round awaits its results, the player is put on
        hold and registered when the results are validated (that round then
        counts as missed too).
        """
        if not self._started:
            self.add_players([player])
            return
        self._check_presence_allowed()
        if float(missed_fraction) not in (0.0, 0.5):
            raise ValueError("Une ronde manquée vaut 0 ou ½ point")
        ensure_player_fields(player)
        name = player["Name"]
        if name.strip().lower() == "bye":
            raise ValueError("Player name 'bye' is reserved")
        taken = [p["Name"] for p in self.players] + [e["player"]["Name"] for e in self._pending_late]
        if any(n.strip().lower() == name.strip().lower() for n in taken):
            raise ValueError(f"Duplicate player name: {name}")
        if self.awaiting_results:
            assert self._system is not None
            if self._system.current_round >= self._system.total_rounds:
                raise RuntimeError("La ronde en cours est la dernière : le joueur ne pourrait plus jouer")
            self._pending_late.append({"player": player, "missed": float(missed_fraction)})
            return
        self._add_late_now(player, float(missed_fraction))

    @property
    def pending_late(self) -> list[dict]:
        """Players waiting for the results of the pending round to join: name, Elo, club, missed value."""
        return [
            {
                "name": e["player"]["Name"],
                "elo": int(e["player"].get("Elo", 0)),
                "club": e["player"].get("Club"),
                "missed": e["missed"],
            }
            for e in self._pending_late
        ]

    def cancel_late(self, name: str) -> None:
        """Cancel the registration of a player still on hold."""
        before = len(self._pending_late)
        self._pending_late = [e for e in self._pending_late if e["player"]["Name"] != name]
        if len(self._pending_late) == before:
            raise ValueError(f"Aucun joueur en attente nommé « {name} »")

    def _flush_pending_late(self) -> None:
        """Register the players on hold (no round is awaiting results any more)."""
        waiting, self._pending_late = self._pending_late, []
        if self.is_finished:
            return  # nothing left to play
        for e in waiting:
            self._add_late_now(e["player"], e["missed"])

    def _add_late_now(self, player: dict, missed_fraction: float) -> None:
        name = player["Name"]
        for rnd in self._rounds:
            rnd.setdefault("absent", {})[name] = float(missed_fraction)
        self._join(player, self.next_round_number)

    def _join(self, player: dict, round_number: int) -> None:
        """Add a player to the running system before `round_number` (missed rounds read from the history)."""
        assert self._system is not None
        name = player["Name"]
        missed = [
            float((rnd.get("absent") or {}).get(name, 0.0)) * rnd["win_value"]
            for rnd in self._rounds[: round_number - 1]
        ]
        player["joined"] = round_number
        self._system.add_player(player, missed)  # appended to self._players (same list)

    def update_settings(self, config: TournamentConfig, name: str | None = None) -> None:
        """Replace the configuration (system, rounds, points…) before the start.

        Nothing depends on the configuration until the first round is
        generated (the pairing system is built at that moment), so the new
        settings apply exactly as if the tournament had been created with them.
        """
        if self._started:
            raise RuntimeError("Cannot change the settings after the tournament has started")
        if name is not None:
            name = name.strip()
            if not name:
                raise ValueError("Le nom du tournoi ne peut pas être vide")
        if config.system.lower() == "roundrobin" and len(self.players) > MAX_ROUND_ROBIN_PLAYERS:
            raise ValueError(
                f"Un round-robin est limité à {MAX_ROUND_ROBIN_PLAYERS} joueurs "
                f"({len(self.players)} inscrits). Retirez des joueurs ou choisissez un système suisse."
            )
        self.config = config
        if self.is_round_robin:
            self._next_absent = {}  # no absences in a round-robin (fixed calendar)
        if name is not None:
            self.name = name

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
        if self.is_round_robin:
            # the whole calendar is made at once; return the next round to fill
            self.start_schedule()
            if self.is_finished:
                raise RuntimeError("Tournament is already finished")
            return list(self._rounds[self.current_round - 1]["pairings"])
        was_started, registered = self._started, list(self._players)
        self._start()
        assert self._system is not None
        try:
            return self._generate_round()
        except PairingImpossibleError:
            if not was_started:
                # the first round could not be paired (too many absents): not started
                self._system, self._started, self._players = None, False, registered
            raise

    def _generate_round(self) -> list[Pairing]:
        assert self._system is not None
        round_number = self._system.current_round
        absent = {}
        if not (self._system.awaiting_results or self._system.is_finished):
            absent = self.next_absences
            # the system creates the bye itself if needed (and removes it if the pairing fails)
            self._prepare_presence(absent, create_bye=False)
        pairings = self._system.generate_round()
        self._rounds.append(
            {
                "round": round_number,
                "win_value": self.config.win_value(round_number),
                "pairings": pairings,
                "results": None,
                "absent": absent,
            }
        )
        self._next_absent = {}  # an absence is declared for one round
        return pairings

    def _prepare_presence(self, absent: dict[str, float], create_bye: bool = True) -> None:
        """Tell the system who is absent from the next round.

        create_bye: also create the bye now if this round needs it for the
        first time (replay of a saved round, whose pairings name the bye).
        """
        assert self._system is not None
        index = {p["Name"]: i for i, p in enumerate(self._players)}
        for name in absent:
            if name not in index:
                raise ValueError(f"Unknown absent player '{name}'")
        self._system.set_absences({index[n]: f for n, f in absent.items()})
        if create_bye and not self.is_round_robin:
            self._system.active_players()

    def _apply_round(self, pairs: list[tuple[int, int]], absent: dict[str, float] | None = None) -> list[Pairing]:
        self._start()
        assert self._system is not None
        round_number = self._system.current_round
        absent = dict(absent or {})
        self._prepare_presence(absent)
        pairings = self._system.apply_round(pairs)
        self._rounds.append(
            {
                "round": round_number,
                "win_value": self.config.win_value(round_number),
                "pairings": pairings,
                "results": None,
                "absent": absent,
            }
        )
        return pairings

    def enter_results(self, results: list[GameResult] | list[dict]) -> None:
        if self._system is None:
            raise RuntimeError("No round has been generated yet")
        parsed = _parse_results(results)
        if self.is_round_robin:
            # all the results of the next round to fill (same contract as the Swiss systems)
            if self.is_finished:
                raise RuntimeError("No round is awaiting results")
            rnd = self._rounds[self.current_round - 1]
            tables = {p.table for p in rnd["pairings"] if not p.is_bye}
            given = {r.table for r in parsed}
            if given != tables or len(parsed) != len(tables):
                raise ValueError(f"Expected one result for each of the tables {sorted(tables)}")
            scores = {r.table: self._check_score(r.white_score, r.table) for r in parsed}
            rnd["results"] = {**(rnd["results"] or {}), **scores}
            self._refresh_round_robin()
            return
        self._system.enter_results(parsed)
        self._rounds[-1]["results"] = {r.table: normalize_result(r.white_score, r.table) for r in parsed}
        self._flush_pending_late()

    # ------------------------------------------------------------ round-robin
    @property
    def is_round_robin(self) -> bool:
        return self.config.system.lower() == "roundrobin"

    def start_schedule(self) -> None:
        """Round-robin: generate the whole calendar (results entered later, in any order).

        Pairings and colors of a round-robin do not depend on the results, so
        generating all the rounds now gives exactly the pairings and colors
        of playing them one by one. Closes the registrations.
        """
        if not self.is_round_robin:
            raise RuntimeError("Only a round-robin has a calendar")
        self._start()
        system = self._system
        assert system is not None
        while not system.is_finished:
            round_number = system.current_round
            pairings = system.generate_round()
            system.skip_results()
            self._rounds.append(
                {
                    "round": round_number,
                    "win_value": self.config.win_value(round_number),
                    "pairings": pairings,
                    "results": {},
                }
            )
        self._refresh_round_robin()

    @staticmethod
    def _check_score(score: object, table: int) -> float | str | None:
        """Validated result (None = no result): game score or forfeit code."""
        return None if score is None else normalize_result(score, table)

    def set_result(self, round_number: int, table: int, white_score: float | str | None) -> None:
        """Round-robin: enter, change or clear (None) the result of one game, any time."""
        if not self.is_round_robin:
            raise RuntimeError("Results are entered round by round in this system")
        if not self._started or not self._rounds:
            raise RuntimeError("Le calendrier n'a pas encore été généré")
        if not 1 <= round_number <= len(self._rounds):
            raise ValueError(f"La ronde {round_number} n'existe pas")
        rnd = self._rounds[round_number - 1]
        game = next((p for p in rnd["pairings"] if p.table == table), None)
        if game is None or game.is_bye:
            raise ValueError(f"Pas de partie à la table {table} de la ronde {round_number}")
        score = self._check_score(white_score, table)
        results = rnd["results"] if rnd["results"] is not None else {}
        if score is None:
            results.pop(table, None)
        else:
            results[table] = score
        rnd["results"] = results
        self._refresh_round_robin()

    def _refresh_round_robin(self) -> None:
        """Scores and tiebreaks of a round-robin from every result entered so far."""
        games = []
        for rnd in self._rounds:
            results = rnd["results"] or {}
            win = rnd["win_value"]
            for p in rnd["pairings"]:
                if p.is_bye or p.table not in results:
                    continue
                w, b = result_fractions(results[p.table])
                games.append((p.white_index, p.black_index, w * win, b * win))
        self._system.rebuild_results(games)  # type: ignore[union-attr]

    @staticmethod
    def _round_complete(rnd: dict) -> bool:
        results = rnd["results"]
        if results is None:
            return False
        return all(p.table in results for p in rnd["pairings"] if not p.is_bye)

    @property
    def games_total(self) -> int:
        return sum(1 for rnd in self._rounds for p in rnd["pairings"] if not p.is_bye)

    @property
    def games_played(self) -> int:
        return sum(
            1
            for rnd in self._rounds
            for p in rnd["pairings"]
            if not p.is_bye and rnd["results"] is not None and p.table in rnd["results"]
        )

    def _calendar(self) -> bool:
        """Round-robin whose calendar exists (results in any order)."""
        return self.is_round_robin and self._started

    def get_standings(self) -> list[dict]:
        if self._system is None:
            # Not started: show registration order without bye
            return [dict(p) for p in self._players]
        standings = self._system.get_standings()
        if not any(int(p.get("Elo", 0)) > 0 for p in self.players):
            return standings  # nobody is rated: no performance
        return self._with_performance(standings)

    def _with_performance(self, standings: list[dict]) -> list[dict]:
        """Add the performance ("Perf", last tiebreak) to the standings.

        Copies are returned: the engine's players are left untouched (the
        pairings never depend on the performance). Ties left by the system's
        own criteria are broken by the performance, the system's order being
        kept otherwise (stable sort).
        """
        elo = {p["Name"]: float(p.get("Elo", 0)) for p in self._players}
        games: dict[str, list[tuple[float, float]]] = {p["Name"]: [] for p in standings}
        for rnd in self._rounds:
            results = rnd["results"] or {}
            for p in rnd["pairings"]:
                if p.is_bye or p.table not in results or is_forfeit(results[p.table]):
                    continue  # forfeits are not games played over the board
                s = float(results[p.table])  # game result, not weighted by the round
                if p.white_name in games:
                    games[p.white_name].append((elo.get(p.black_name, 0.0), s))
                if p.black_name in games:
                    games[p.black_name].append((elo.get(p.white_name, 0.0), 1.0 - s))
        keys = list(standings[0].get("TB", {}).keys()) if standings else []
        out, sort_value = [], {}
        for p in standings:
            shown, internal = performance(games[p["Name"]])
            q = dict(p)
            q["TB"] = {**p.get("TB", {}), "Perf": shown}
            sort_value[p["Name"]] = internal
            out.append(q)
        out.sort(
            key=lambda q: (
                -float(q.get("pts", 0.0)),
                *(-float(q["TB"][k]) for k in keys),
                -sort_value[q["Name"]],
            )
        )
        return out

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
        if self._calendar():
            # first round with a missing result
            for k, rnd in enumerate(self._rounds, start=1):
                if not self._round_complete(rnd):
                    return k
            return len(self._rounds) + 1
        return self._system.current_round

    @property
    def total_rounds(self) -> int:
        if self._system is not None:
            return self._system.total_rounds
        if self.config.system.lower() == "roundrobin":
            # Everyone meets everyone: n - 1 rounds (n rounded up to even, bye included)
            n = len(self.players)
            full = max(n + n % 2 - 1, 0) * (2 if self.config.double_round_robin else 1)
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
        if self._calendar():
            # keep the rounds up to the last one with a result; they must be complete
            last = max(k for k, rnd in enumerate(self._rounds, start=1) if rnd["results"])
            missing = [k for k, rnd in enumerate(self._rounds[:last], start=1) if not self._round_complete(rnd)]
            if missing:
                listed = ", ".join(str(k) for k in missing)
                raise RuntimeError(
                    f"Impossible de terminer maintenant : la ronde {last} a déjà des résultats, mais "
                    f"{'la ronde' if len(missing) == 1 else 'les rondes'} {listed} "
                    f"{'est incomplète' if len(missing) == 1 else 'sont incomplètes'}. Complétez-les, "
                    "ou effacez les résultats des rondes à retirer du calendrier."
                )
            if last == len(self._rounds) and self.is_finished:
                raise RuntimeError("Le tournoi est déjà terminé")
            del self._rounds[last:]
            self.config.rounds = last
            self._system.total_rounds = last
            self._refresh_round_robin()
            return
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
        return sum(1 for r in self._rounds if self._round_complete(r))

    @property
    def is_finished(self) -> bool:
        if self._calendar():
            return len(self._rounds) == self._system.total_rounds and all(  # type: ignore[union-attr]
                self._round_complete(r) for r in self._rounds
            )
        return self._system is not None and self._system.is_finished

    @property
    def awaiting_results(self) -> bool:
        if self._calendar():
            return False  # no pending round: results are entered in any order
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
            # number of the next round to pair (absences are declared for it)
            "next_round": self.next_round_number,
            # round-robin calendar: progress game by game (None otherwise)
            "games_total": self.games_total if self._calendar() else None,
            "games_played": self.games_played if self._calendar() else None,
            "config": asdict(self.config),
        }

    def rounds(self) -> list[dict]:
        """History of the rounds, ready to display (points/Elo before each round)."""
        out: list[dict] = []
        calendar = self._calendar()
        # round-robin calendar: the whole calendar is made at the start, so the
        # points "before the round" are recomputed from the results entered
        # in the previous rounds (0 for the exempt player, as in the scores)
        running: dict[str, float] = {}
        for rnd in self._rounds:
            results = rnd["results"]
            pairings = []
            for p in rnd["pairings"]:
                score = None
                if results is not None and not p.is_bye:
                    score = results.get(p.table)
                white_pts, black_pts = p.white_pts, p.black_pts
                if calendar:
                    white_pts = running.get(p.white_name, 0.0)
                    black_pts = 0.0 if p.is_bye else running.get(p.black_name, 0.0)
                pairings.append(
                    {
                        "table": p.table,
                        "white": p.white_name,
                        "black": p.black_name,
                        "is_bye": p.is_bye,
                        "white_elo": p.white_elo,
                        "black_elo": p.black_elo,
                        "white_pts": white_pts,
                        "black_pts": black_pts,
                        "white_score": score,
                    }
                )
            if calendar:
                win = rnd["win_value"]
                for p in rnd["pairings"]:
                    if not p.is_bye and results and p.table in results:
                        w, b = result_fractions(results[p.table])
                        running[p.white_name] = running.get(p.white_name, 0.0) + w * win
                        running[p.black_name] = running.get(p.black_name, 0.0) + b * win
            out.append(
                {
                    "round": rnd["round"],
                    "win_value": rnd["win_value"],
                    "completed": self._round_complete(rnd),
                    "pairings": pairings,
                    # players not paired: absent, withdrawn or not arrived yet
                    "absent": [
                        {
                            "name": name,
                            "points": fraction * rnd["win_value"],
                            "reason": (
                                "withdrawn"
                                if self._withdrawn_in(name, rnd["round"])
                                else "late"
                                if self._joined_after(name, rnd["round"])
                                else "absent"
                            ),
                        }
                        for name, fraction in (rnd.get("absent") or {}).items()
                    ],
                }
            )
        return out

    # ---------------------------------------------------------- save / load
    def to_dict(self) -> dict:
        """Everything needed to rebuild the tournament (see `from_dict`)."""
        return {
            "format": FILE_FORMAT,
            "version": FILE_VERSION if self._uses_v2_features() else 1,
            "name": self.name,
            "config": asdict(self.config),
            "options": {"show_club": self.show_club},
            "players": [
                {
                    "name": p["Name"],
                    "elo": int(p.get("Elo", 0)),
                    **({"club": p["Club"]} if p.get("Club") else {}),
                    # late arrival: first round the player could be paired in
                    **({"joined": int(p["joined"])} if p.get("joined") else {}),
                    # withdrawal: first round the player is no longer paired in
                    **({"withdrawn_from": int(p["withdrawn_from"])} if p.get("withdrawn_from") else {}),
                }
                for p in self.players
            ],
            **({"next_absent": dict(self._next_absent)} if self._next_absent else {}),
            # late arrivals waiting for the results of the pending round
            **(
                {
                    "pending_late": [
                        {**{k: v for k, v in e.items() if k != "missed"}, "missed": e["missed"]}
                        for e in self.pending_late
                    ]
                }
                if self._pending_late
                else {}
            ),
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
                    # players not paired in this round -> fraction of the win value scored
                    **({"absent": dict(rnd["absent"])} if rnd.get("absent") else {}),
                }
                for rnd in self._rounds
            ],
        }

    def _uses_v2_features(self) -> bool:
        return bool(
            self._next_absent
            or self._pending_late
            or any(rnd.get("absent") for rnd in self._rounds)
            or any(p.get("joined") or p.get("withdrawn_from") for p in self.players)
            or any(is_forfeit(s) for rnd in self._rounds for s in (rnd["results"] or {}).values())
        )

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

        rounds = list(data.get("rounds", []))
        if up_to_round is not None:
            if up_to_round < 0:
                raise ValueError("up_to_round must be >= 0")
            rounds = rounds[:up_to_round]

        def last_round_pending() -> bool:
            if not rounds or tournament.is_round_robin:
                return False
            return any(
                pg.get("black") != "bye" and pg.get("white_score") is None for pg in rounds[-1].get("pairings", [])
            )

        records = [
            {
                "Name": str(p["name"]),
                "Elo": int(p.get("elo", 0) or 0),
                **({"Club": str(p["club"]).strip()} if str(p.get("club") or "").strip() else {}),
                # going back in time: the withdrawal holds from the next round to pair
                **(
                    {"withdrawn_from": min(int(p["withdrawn_from"]), len(rounds) + 1)}
                    if p.get("withdrawn_from")
                    else {}
                ),
            }
            for p in players
        ]
        # Late arrivals join the running tournament before the round they
        # joined at (as they did when it was played). Going back in time can
        # bring that round forward: they then join before the next round to
        # pair (or before the last kept round when it is still pending; the
        # rounds before joining hold their absences).
        joined: dict[str, int] = {}
        for rec, p in zip(records, players):
            r = int(p.get("joined") or 0)
            if r > 1 and rounds:
                limit = len(rounds) + 1
                if r >= limit and last_round_pending():
                    limit = len(rounds)
                r = min(r, limit)
                if r > 1:
                    joined[rec["Name"]] = r
        tournament.add_players(
            enforce_limit=False,  # files saved before the round-robin limit still open
            players=[rec for rec in records if rec["Name"] not in joined],
        )
        late = [rec for rec in records if rec["Name"] in joined]

        # Once a round exists, the saved player order is the starting order
        # (to_dict writes the players in that order): keep it.
        tournament._keep_order = bool(rounds)

        for position, rnd in enumerate(rounds):
            round_number = position + 1
            saved = sorted(rnd.get("pairings", []), key=lambda p: int(p.get("table", 0)))
            if not saved:
                raise ValueError(f"Round {round_number} has no pairings")

            tournament._start()
            for rec in late:
                if joined[rec["Name"]] == round_number:
                    tournament._join(rec, round_number)
            present_names = {p["Name"] for p in tournament._players}
            absent = {
                str(name): float(f)
                for name, f in dict(rnd.get("absent") or {}).items()
                if str(name) in present_names
            }
            # absences before joining are kept in the round (displayed), not given to the system
            all_absent = {str(name): float(f) for name, f in dict(rnd.get("absent") or {}).items()}
            tournament._prepare_presence(absent)
            index = {p["Name"]: i for i, p in enumerate(tournament._players)}
            pairs: list[tuple[int, int]] = []
            for p in saved:
                white, black = str(p["white"]), str(p["black"])
                for name in (white, black):
                    if name not in index:
                        raise ValueError(f"Round {round_number}: unknown player '{name}'")
                pairs.append((index[white], index[black]))

            pairings = tournament._apply_round(pairs, absent)
            tournament._rounds[-1]["absent"] = all_absent

            if tournament.is_round_robin:
                # calendar: results may be missing anywhere
                tournament._system.skip_results()  # type: ignore[union-attr]
                results: dict[int, float] = {}
                for pg, sv in zip(pairings, saved):
                    score = sv.get("white_score")
                    if pg.is_bye or score is None:
                        continue
                    results[pg.table] = cls._check_score(score, pg.table)
                tournament._rounds[-1]["results"] = results
                continue

            games = [(pg, sv) for pg, sv in zip(pairings, saved) if not pg.is_bye]
            scores = [sv.get("white_score") for _, sv in games]
            if all(s is not None for s in scores):
                tournament.enter_results(
                    [GameResult(table=pg.table, white_score=normalize_result(s, pg.table)) for (pg, _), s in zip(games, scores)]
                )
            elif position != len(rounds) - 1:
                raise ValueError(f"Round {round_number} has missing results")

        if tournament.is_round_robin and rounds:
            # rounds not saved yet (files from before the calendar, truncation)
            # are generated now; the scores are rebuilt from the results
            tournament.start_schedule()

        for rec in late:
            if joined[rec["Name"]] == len(rounds) + 1:
                tournament._join(rec, len(rounds) + 1)

        # late arrivals on hold: still on hold while a round awaits its results,
        # registered at once otherwise (e.g. after cancelling that round's pairings)
        for e in list(data.get("pending_late") or []):
            rec = {
                "Name": str(e["name"]),
                "Elo": int(e.get("elo", 0) or 0),
                **({"Club": str(e["club"]).strip()} if str(e.get("club") or "").strip() else {}),
            }
            tournament.add_late_player(rec, float(e.get("missed", 0.0)))

        names = {p["Name"] for p in tournament.players}
        tournament._next_absent = {
            str(n): float(f) for n, f in dict(data.get("next_absent") or {}).items() if str(n) in names
        }
        return tournament

    def truncated(self, rounds_to_keep: int) -> "Tournament":
        """Copy of this tournament keeping only its first `rounds_to_keep` rounds.

        The absences declared for the first round removed are declared again
        for the next round to pair (cancelling a pairing keeps them).
        """
        data = self.to_dict()
        if 0 <= rounds_to_keep < len(self._rounds):
            r = rounds_to_keep + 1
            declared = {
                name: f
                for name, f in (self._rounds[rounds_to_keep].get("absent") or {}).items()
                if not self._withdrawn_in(name, r) and not self._joined_after(name, r)
            }
            if declared:
                data["next_absent"] = {**declared, **data.get("next_absent", {})}
        return Tournament.from_dict(data, up_to_round=rounds_to_keep)

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
            p["white_score"] = normalize_result(results[p["table"]], p["table"])
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
            for rnd in self._rounds:
                absent = rnd.get("absent") or {}
                if name in absent:
                    rnd["absent"] = {target if k == name else k: v for k, v in absent.items()}
            if name in self._next_absent:
                self._next_absent = {target if k == name else k: v for k, v in self._next_absent.items()}
        if elo is not None:
            player["Elo"] = elo
            player["strength"] = elo  # same as a freshly loaded player
            for p in pairings:
                if p.white_name == target:
                    p.white_elo = elo
                if p.black_name == target:
                    p.black_elo = elo

    # --------------------------------------------------------- results grid
    def results_grid(self) -> dict:
        """Round-robin results table (one row and one column per player).

        Rows and columns follow the current ranking. Cell (row, col) lists
        the games of the row player against the column player, in round
        order (two games in a double round-robin): color of the row player
        and his result (1, 0.5, 0), None while the game has no result.
        Results are game results, not weighted by the points of the round.
        """
        if not self.is_round_robin:
            raise RuntimeError("The results grid is for round-robin tournaments")
        standings = self.get_standings()
        names = [p["Name"] for p in standings]
        rank_of = {n: i for i, n in enumerate(names)}
        games: dict[tuple[str, str], list[dict]] = {}
        played = {n: 0 for n in names}
        for rnd in self._rounds:
            results = rnd["results"] or {}
            for p in rnd["pairings"]:
                if p.is_bye:
                    continue
                s = results.get(p.table)
                w, b = (None, None) if s is None else result_fractions(s)
                forfeit = is_forfeit(s)
                games.setdefault((p.white_name, p.black_name), []).append(
                    {"round": rnd["round"], "color": "W", "score": w, "forfeit": forfeit}
                )
                games.setdefault((p.black_name, p.white_name), []).append(
                    {"round": rnd["round"], "color": "B", "score": b, "forfeit": forfeit}
                )
                if s is not None:
                    played[p.white_name] += 1
                    played[p.black_name] += 1
        rows = []
        for p in standings:
            me = p["Name"]
            rows.append(
                {
                    "rank": rank_of[me] + 1,
                    "name": me,
                    "club": p.get("Club"),
                    "elo": int(p.get("Elo", 0)),
                    "pts": float(p.get("pts", 0.0)),
                    "tiebreaks": {k: None if v is None else float(v) for k, v in p.get("TB", {}).items()},
                    "played": played[me],
                    "cells": [None if other == me else games.get((me, other), []) for other in names],
                }
            )
        return {
            "legs": 2 if self.config.double_round_robin else 1,
            "tiebreak_keys": list(standings[0].get("TB", {}).keys()) if standings else [],
            "games_total": self.games_total,
            "games_played": self.games_played,
            "rows": rows,
        }

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
                                "kind": "bye",
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
                forfeit = is_forfeit(score)
                w, b = result_fractions(score)
                for me, opp, color, frac in (
                    (p.white_name, p.black_name, "W", w),
                    (p.black_name, p.white_name, "B", b),
                ):
                    if me in cells:
                        cells[me].append(
                            {
                                "round": rnd["round"],
                                "bye": False,
                                "kind": "forfeit" if forfeit else "game",
                                "opponent": opp,
                                "opponent_rank": rank_of.get(opp),
                                # a forfeited game was not played: no color
                                "color": None if forfeit else color,
                                "result": _result_symbol(frac),
                                "points": frac * win_value,
                            }
                        )
                        played.add(me)
            for name, fraction in (rnd.get("absent") or {}).items():
                if name in cells and name not in played:
                    cells[name].append(
                        {
                            "round": rnd["round"],
                            "bye": False,
                            "kind": (
                                "withdrawn"
                                if source._withdrawn_in(name, rnd["round"])
                                else "late"
                                if source._joined_after(name, rnd["round"])
                                else "absent"
                            ),
                            "opponent": None,
                            "opponent_rank": None,
                            "color": None,
                            "result": _result_symbol(fraction),
                            "points": fraction * win_value,
                        }
                    )
                    played.add(name)
            for name, lst in cells.items():
                if name not in played:
                    lst.append(
                        {
                            "round": rnd["round"],
                            "bye": False,
                            "kind": None,
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
                "tiebreaks": {key: None if v is None else float(v) for key, v in p.get("TB", {}).items()},
                "cells": cells[p["Name"]],
            }
            for p in standings
        ]
        return {"after_round": k, "rounds": k, "tiebreak_keys": tiebreak_keys, "rows": rows}
