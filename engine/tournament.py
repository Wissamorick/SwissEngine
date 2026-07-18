"""Public façade: Tournament(config) → add_players → generate_round → enter_results → standings."""

from dataclasses import asdict
from typing import Any

from engine.common.base import BaseTournamentSystem
from engine.common.models import GameResult, Pairing
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


def _build_system(players: list[dict], config: TournamentConfig) -> BaseTournamentSystem:
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


class Tournament:
    """High-level API for organizing a tournament round by round."""

    def __init__(self, config: TournamentConfig | dict | None = None):
        if config is None:
            self.config = TournamentConfig()
        elif isinstance(config, dict):
            self.config = TournamentConfig(**config)
        else:
            self.config = config

        self._players: list[dict] = []
        self._system: BaseTournamentSystem | None = None
        self._started = False

    def add_players(self, players: list[dict]) -> None:
        if self._started:
            raise RuntimeError("Cannot add players after the tournament has started")
        for player in players:
            ensure_player_fields(player)
            if player["Name"] == "bye":
                raise ValueError("Player name 'bye' is reserved")
            if any(p["Name"] == player["Name"] for p in self._players):
                raise ValueError(f"Duplicate player name: {player['Name']}")
            self._players.append(player)

    def add_player(self, name: str, elo: int = 0, **extra: Any) -> None:
        self.add_players([{"Name": name, "Elo": elo, **extra}])

    def _start(self) -> None:
        if self._started:
            return
        if len(self._players) < 2:
            raise RuntimeError("Need at least 2 players to start")

        # Sort by Elo descending (same as TestSwissPheng registration flow)
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

    def generate_round(self) -> list[Pairing]:
        self._start()
        assert self._system is not None
        return self._system.generate_round()

    def enter_results(self, results: list[GameResult] | list[dict]) -> None:
        if self._system is None:
            raise RuntimeError("No round has been generated yet")
        self._system.enter_results(_parse_results(results))

    def get_standings(self) -> list[dict]:
        if self._system is None:
            # Not started: show registration order without bye
            return [dict(p) for p in self._players]
        return self._system.get_standings()

    @property
    def players(self) -> list[dict]:
        return [p for p in self._players if p["Name"] != "bye"]

    @property
    def current_round(self) -> int:
        if self._system is None:
            return 1
        return self._system.current_round

    @property
    def is_finished(self) -> bool:
        return self._system is not None and self._system.is_finished

    @property
    def awaiting_results(self) -> bool:
        return self._system is not None and self._system.awaiting_results

    def status(self) -> dict:
        return {
            "system": self.config.system,
            "total_rounds": self.config.rounds,
            "current_round": self.current_round,
            "started": self._started,
            "awaiting_results": self.awaiting_results,
            "finished": self.is_finished,
            "player_count": len(self.players),
            "config": asdict(self.config),
        }
