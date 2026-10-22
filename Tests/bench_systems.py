"""Benchmark (not a unit test): ranking quality of the pairing systems.

Reproduces the evaluation protocol of the master thesis (section 7.4, model
of functions.py: generate_players / match), through the public engine API:

- 32 players by default, 7 rounds; true strength ~ N(1600, 400);
  Elo = max(1000, strength + N(0, 1) * (3000 - strength) / 20);
- each player belongs to the subcategory (women in the thesis) with
  probability 0.15;
- game result: expected score of the stronger player 1 / (1 + 10^(-d/400)),
  draw probability 1 - expected score (no colour advantage).

Metrics (same definitions as eval_top_k / eval_select_k / eval_subcat_select_k):
- tau   : Kendall tau-b between the final ranking and the strengths (higher is better);
- RWE5  : top-5 Ranking Weighted Evaluation, sum (k-i+1)|x_i - y_i| (lower is better);
- MS5   : select-5 missing strength (lower is better);
- SC3   : subcategory select-3 missing strength (lower is better).

Every system plays exactly the same pools of players (paired comparison).

Run from the project root:
    python -m Tests.bench_systems [tournaments] [system ...]
"""

from __future__ import annotations

import random
import statistics as st
import sys

from scipy import stats

from engine import GameResult, Tournament


def generate_players(rng: random.Random, n: int, sub_freq: float = 0.15) -> list[dict]:
    players = []
    for k in range(n):
        strength = round(rng.gauss(1600, 400))
        elo = max(1000, round(strength + rng.gauss(0, 1) * (3000 - strength) / 20))
        players.append({"Name": f"P{k}", "Elo": elo, "strength": strength, "sub": rng.random() < sub_freq})
    return players


def match(a: int, b: int, rng: random.Random) -> float:
    """Score of the first player (thesis model, colour has no influence)."""
    diff = abs(a - b)
    exp = 1 / (1 + 10 ** (-diff / 400))
    p_draw = 1 - exp
    r = rng.random()
    if r < exp - p_draw / 2:
        return 1.0 if a > b else 0.0
    if r > exp + p_draw / 2:
        return 0.0 if a > b else 1.0
    return 0.5


def top_k_rwe(ranking: list[int], k: int) -> float:
    ideal = sorted(ranking, reverse=True)
    return sum((k - i) * abs(ranking[i] - ideal[i]) for i in range(k))


def select_k(ranking: list[int], k: int) -> float:
    if k > len(ranking):
        return 0.0
    ideal = sorted(ranking, reverse=True)
    return sum(ideal[:k]) - sum(ranking[:k])


def run(system: str, seed: int, n: int = 32, rounds: int = 7) -> tuple[float, float, float, float]:
    pool = generate_players(random.Random(seed), n)
    games = random.Random(10_000 + seed)
    random.seed(20_000 + seed)  # pairing randomness (Swiss Random, colours...)
    info = {p["Name"]: p for p in pool}
    t = Tournament({"system": system, "rounds": rounds})
    t.add_players([{"Name": p["Name"], "Elo": p["Elo"]} for p in pool])
    while not t.is_finished:
        results = []
        for p in t.generate_round():
            if not p.is_bye:
                results.append(GameResult(p.table, match(info[p.white_name]["strength"], info[p.black_name]["strength"], games)))
        t.enter_results(results)
    final = [info[p["Name"]] for p in t.get_standings()]
    strengths = [p["strength"] for p in final]
    sub = [p["strength"] for p in final if p["sub"]]
    tau = stats.kendalltau(strengths, sorted(strengths, reverse=True))[0]
    return tau, top_k_rwe(strengths, 5), select_k(strengths, 5), select_k(sub, 3)


def summary(results: dict[str, list[tuple]], reference: str | None = None) -> None:
    names = ("tau", "RWE5", "MS5", "SC3")
    print(f"{'system':<24}" + "".join(f"{m:>22}" for m in names))
    for system, res in results.items():
        cells = []
        for k in range(4):
            vals = [r[k] for r in res]
            if reference and system != reference:
                d = [a[k] - b[k] for a, b in zip(res, results[reference])]
                cells.append(f"{st.mean(vals):.4f} ({st.mean(d):+.4f}±{1.96 * st.stdev(d) / len(d) ** 0.5:.4f})"
                             if k == 0 else f"{st.mean(vals):.1f} ({st.mean(d):+.1f}±{1.96 * st.stdev(d) / len(d) ** 0.5:.1f})")
            else:
                cells.append(f"{st.mean(vals):.4f}" if k == 0 else f"{st.mean(vals):.1f}")
        print(f"{system:<24}" + "".join(f"{c:>22}" for c in cells))


if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 200
    systems = sys.argv[2:] or ["dutch", "swissrandom", "swissrandom2"]
    summary({s: [run(s, seed) for seed in range(count)] for s in systems}, reference=systems[0])
