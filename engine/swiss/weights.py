"""Edge weights of the Swiss systems (maximum weight matching).

Derived from TOURNAMENT_Swiss_MWM_decr (master thesis code), with three
changes: the color term is active, it uses the effective color (temporal
alternation), and d_pi is normalized by the scoregroup size. See the
docstrings below and engine/common/colors.py for the justification.
"""

from random import random

from engine.common.colors import effective_color


def resolve_system(system: str, current_round: int) -> tuple[str, bool]:
    """Handle 'mixed': Dutch for rounds 1–2, then Burstein.

    Returns (effective_system, is_mixed).
    """
    if system == "mixed":
        if current_round <= 2:
            return "dutch", True
        return "burstein", True
    return system, False


# Lexicographic weights: score >> colors >> system rule.
#   w(i, j) = W_SCORE * d_s + W_COLOR * d_c + d_pi - W_FORBIDDEN * forbidden
# d_pi is normalized (|d_pi| <= 1, see compute_d_pi), d_c moves by steps of
# 0.5 (effective colors are multiples of 0.5), so one color step (5 000)
# outweighs any change of the d_pi total (<= n / 2) for tournaments of up to ~10 000
# players. One half-point of score (500 000) is worth 50 color steps: the
# algorithm may let one player "float" to another scoregroup only if this
# avoids a large number of color clashes. The ratios are the ones of the
# original code (10000 / 100 / 1, forbidden 1 000 000), multiplied by 100
# so that the normalized d_pi stays far below the color term.
W_SCORE = 1_000_000
W_COLOR = 10_000
W_FORBIDDEN = 100_000_000


def compute_d_pi(
    system: str,
    players: list[dict],
    pairing_ranking: list[dict],
    i: int,
    j: int,
    ranks: dict[str, int] | None = None,
    sizes: dict[float, int] | None = None,
    starts: dict[float, int] | None = None,
) -> float:
    """Rank-affinity term d_pi depending on the chosen Swiss style.

    Normalized: every rank distance (and the Dutch target, half the size of
    the scoregroup) is divided by the number of players n, so |d_pi| <= 1.
    This multiplies every d_pi of the round by the same positive constant
    (1 / n**1.01 for Dutch and Burstein, 1 / n for Monrad): the best pairing
    is exactly the one of the original formula (including which player
    floats to another scoregroup), but d_pi can no longer outweigh the color
    term, whatever the size of the scoregroups.

    (Dividing by the size of each scoregroup instead would also keep the
    pairing inside each group, but would change the choice of floaters, in
    particular in Burstein: checked by simulation, rejected.)

    ranks / sizes / starts: optional precomputed rank of each name in
    pairing_ranking, size of each scoregroup and rank of its first player
    (update_graph_weights passes them).
    """
    if system == "swissrandom":
        return random()

    n = len(players)
    if ranks is None:
        ranks = {p["Name"]: k for k, p in enumerate(pairing_ranking)}
    if sizes is None:
        sizes = {}
        for p in players:
            sizes[p["pts"]] = sizes.get(p["pts"], 0) + 1
    ri, rj = ranks[players[i]["Name"]], ranks[players[j]["Name"]]
    same_group = players[i]["pts"] == players[j]["pts"]
    sg_size = sizes[players[i]["pts"]] if same_group else 0
    d = abs(ri - rj) / n

    if system == "monrad":  # 1-2, 3-4, 5-6, 7-8
        return -d

    if system == "burstein":  # 1-8, 2-7, 3-6, 4-5
        return d**1.01

    if system == "dutch":  # 1-5, 2-6, 3-7, 4-8 : rank distance close to half the group
        target = sg_size / 2 / n  # 0 for two different scoregroups (as in the original code)
        return -abs(target - d) ** 1.01

    if system == "swissrandom2":
        # Pair within same scoregroups, randomly, but a player of the upper half
        # of the group against a player of the lower half.
        # The half is decided on the rank *inside the scoregroup* (0-based),
        # upper half = the first floor(size / 2) players. The original code
        # compared the *global* rank with size / 2 (bug: only the top
        # scoregroup was split correctly, the other groups were paired fully
        # at random, see docs/swiss_random_2.md).
        if same_group:
            if starts is None:
                starts = _group_starts(pairing_ranking)
            start = starts[players[i]["pts"]]
            i_upper = ri - start < sg_size // 2
            j_upper = rj - start < sg_size // 2
            if i_upper != j_upper:
                return random()
            return random() - 1
        return random() - 1

    raise ValueError(f"Unknown Swiss system: {system}")


def _group_starts(pairing_ranking: list[dict]) -> dict[float, int]:
    """Rank of the first player of each scoregroup (pairing_ranking is sorted by points first)."""
    starts: dict[float, int] = {}
    for k, p in enumerate(pairing_ranking):
        starts.setdefault(p["pts"], k)
    return starts


def update_graph_weights(G, players: list[dict], pairing_ranking: list[dict], system: str, beta: int) -> None:
    """Set the edge weights of G for the next round.

    d_s  = -|pts_i - pts_j|          (same score first)
    d_c  = -|e_i + e_j|              (colors: e = effective color, see
                                      engine/common/colors.py)
    d_pi = system rule, normalized   (compute_d_pi)
    forbidden: |cd_i + cd_j| > 2*beta - 1 (integer color difference)

    Why d_c = -|e_i + e_j|: its total over a pairing equals
    sum|e| - 2 * sum over pairs of opposite signs of min(|e_i|, |e_j|).
    Exchanging the opponents of a (+, +) pair and a (-, -) pair always
    lowers it, so the best pairing gives each player the color he needs as
    often as possible; players get the same color twice only when necessary.
    (The original code had d_c = 0, i.e. colors ignored in the weights, so
    that the systems could be compared fairly in the study.)
    """
    n = len(players)
    ranks = {p["Name"]: k for k, p in enumerate(pairing_ranking)}
    sizes: dict[float, int] = {}
    for p in players:
        sizes[p["pts"]] = sizes.get(p["pts"], 0) + 1
    starts = _group_starts(pairing_ranking)
    e = [effective_color(p) for p in players]
    for i in range(n):
        for j in range(i + 1):
            if G.has_edge(i, j):
                d_s = -abs(players[i]["pts"] - players[j]["pts"])
                d_c = -abs(e[i] + e[j])
                d_pi = compute_d_pi(system, players, pairing_ranking, i, j, ranks, sizes, starts)

                forbidden = 0
                if abs(players[i]["color_diff"] + players[j]["color_diff"]) > 2 * beta - 1:
                    forbidden = 1

                G[i][j]["weight"] = W_SCORE * d_s + W_COLOR * d_c + d_pi - W_FORBIDDEN * forbidden
