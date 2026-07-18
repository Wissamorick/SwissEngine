from abc import ABC, abstractmethod

from engine.common.models import GameResult, Pairing


class BaseTournamentSystem(ABC):
    """Interface shared by all pairing systems."""

    @abstractmethod
    def generate_round(self) -> list[Pairing]:
        ...

    @abstractmethod
    def enter_results(self, results: list[GameResult]) -> None:
        ...

    @abstractmethod
    def get_standings(self) -> list[dict]:
        ...

    @property
    @abstractmethod
    def current_round(self) -> int:
        ...

    @property
    @abstractmethod
    def is_finished(self) -> bool:
        ...

    @property
    @abstractmethod
    def awaiting_results(self) -> bool:
        ...
