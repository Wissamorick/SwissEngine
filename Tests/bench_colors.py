"""Benchmark (not a unit test): colors and ranking quality of the Swiss Dutch.

Simulates complete tournaments through the public engine API and prints:
- players getting the same color twice in a row (per player),
- players getting the same color three times in a row (per player),
- Kendall tau between the final ranking and the true strengths.

Results model: true strength ~ N(1600, 300), Elo = strength + N(0, 80),
Elo-based expected score with a 35-point White advantage and ~25 % draws.

Run from the project root:  python -m Tests.bench_colors [players] [rounds] [tournaments]
"""

from __future__ import annotations

import random
import statistics as st
import sys

from scipy import stats

from engine import GameResult, Tournament


def play(white: float, black: float, rng: random.Random) -> float:
    p = 1 / (1 + 10 ** (-(white + 35 - black) / 400))
    draw = 0.25 * (1 - abs(2 * p - 1))
    u = rng.random()
    return 1.0 if u < p - draw / 2 else (0.5 if u < p + draw / 2 else 0.0)


def run(n: int, rounds: int, seed: int, system: str = "dutch") -> tuple[float, float, float]:
    rng = random.Random(seed)
    random.seed(seed)
    strength = {f"P{k}": rng.gauss(1600, 300) for k in range(n)}
    t = Tournament({"system": system, "rounds": rounds})
    t.add_players([{"Name": name, "Elo": round(s + rng.gauss(0, 80))} for name, s in strength.items()])
    colors: dict[str, list[int]] = {name: [] for name in strength}
    while not t.is_finished:
        pairings = t.generate_round()
        results = []
        for p in pairings:
            if p.is_bye:
                continue
            colors[p.white_name].append(1)
            colors[p.black_name].append(-1)
            results.append(GameResult(p.table, play(strength[p.white_name], strength[p.black_name], rng)))
        t.enter_results(results)
    doubles = sum(1 for h in colors.values() for a, b in zip(h, h[1:]) if a == b) / n
    triples = sum(1 for h in colors.values() for a, b, c in zip(h, h[1:], h[2:]) if a == b == c) / n
    final = [strength[p["Name"]] for p in t.get_standings()]
    tau = stats.kendalltau(final, sorted(final, reverse=True))[0]
    return doubles, triples, tau


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 40
    rounds = int(sys.argv[2]) if len(sys.argv) > 2 else 7
    count = int(sys.argv[3]) if len(sys.argv) > 3 else 100
    res = [run(n, rounds, seed) for seed in range(count)]
    for label, k in (("same color twice in a row / player", 0), ("three times in a row / player", 1), ("Kendall tau", 2)):
        values = [r[k] for r in res]
        print(f"{label:<38} {st.mean(values):.4f}  (+- {1.96 * st.stdev(values) / count ** 0.5:.4f})")
