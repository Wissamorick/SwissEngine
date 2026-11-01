"""Tournament performance rating ("Perf.").

Definition: the rating P at which a player's expected score against the
opponents actually met equals the score obtained (Elo logistic model):

    sum_i 1 / (1 + 10 ** ((O_i - P) / 400)) = sum_i S_i

This is the maximum-likelihood rating of the tournament (close to FIDE's
"perfect tournament performance"). Unlike "average opponent + dp", it is
monotonic: a win always raises it, a loss always lowers it, a draw raises
it only against an opponent rated above the current performance.

Conventions (SwissEngine):
- only games played over the board count: byes are excluded;
- S_i is the game result (1, ½, 0), never weighted by the points of the
  round (Swiss Pheng);
- unrated opponents (Elo 0) are excluded;
- no finite value exists at 100 % or 0 %, and none at all without rated
  opponents: nothing is displayed, and the tiebreak uses an internal value
  (average rated opponent + 800, average - 800, 0).
"""

from __future__ import annotations

import math

PERFECT_OFFSET = 800.0


def expected_score(opponent: float, rating: float) -> float:
    return 1.0 / (1.0 + 10.0 ** ((opponent - rating) / 400.0))


def _solve(opponents: list[float], score: float) -> float:
    """Rating whose expected score equals `score` (0 < score < len(opponents))."""

    def total(r: float) -> float:
        return sum(expected_score(o, r) for o in opponents)

    # The solution lies within 400*log10(2n - 1) of the opponents' range
    # (results are multiples of ½): ±800 covers up to 50 games; widen if needed.
    lo, hi = min(opponents) - PERFECT_OFFSET, max(opponents) + PERFECT_OFFSET
    while total(lo) > score:
        lo -= PERFECT_OFFSET
    while total(hi) < score:
        hi += PERFECT_OFFSET
    for _ in range(100):
        mid = (lo + hi) / 2
        if total(mid) < score:
            lo = mid
        else:
            hi = mid
        if hi - lo < 1e-7:
            break
    return (lo + hi) / 2


def round_half_up(x: float) -> int:
    return math.floor(x + 0.5)


def performance(games: list[tuple[float, float]]) -> tuple[int | None, float]:
    """Performance from (opponent Elo, game result in [0, 1]) pairs.

    Returns (value displayed or None, value used to break ties).
    """
    rated = [(o, s) for o, s in games if o > 0]
    if not rated:
        return None, 0.0
    opponents = [o for o, _ in rated]
    score = sum(s for _, s in rated)
    n = len(rated)
    avg = sum(opponents) / n
    eps = 1e-9
    if score >= n - eps:
        return None, float(round_half_up(avg + PERFECT_OFFSET))
    if score <= eps:
        return None, float(round_half_up(avg - PERFECT_OFFSET))
    # rounded to 1e-6 first: the numerical solution of an exact .5 is never exactly .5
    value = round_half_up(round(_solve(opponents, score), 6))
    return value, float(value)
