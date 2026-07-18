"""Edge-weight formulas from TOURNAMENT_Swiss_MWM_decr — kept as close as possible."""

from random import random

from engine.common.utils import player_rank


def resolve_system(system: str, current_round: int) -> tuple[str, bool]:
    """Handle 'mixed': Dutch for rounds 1–2, then Burstein.

    Returns (effective_system, is_mixed).
    """
    if system == "mixed":
        if current_round <= 2:
            return "dutch", True
        return "burstein", True
    return system, False


def compute_d_pi(system: str, players: list[dict], pairing_ranking: list[dict], i: int, j: int) -> float:
    """Rank-affinity term d_pi depending on the chosen Swiss style."""

    if system == "monrad":  # 1-2, 3-4, 5-6, 7-8
        return -abs(
            player_rank(pairing_ranking, players[i]["Name"])
            - player_rank(pairing_ranking, players[j]["Name"])
        )

    if system == "burstein":  # 1-8, 2-7, 3-6, 4-5
        return abs(
            player_rank(pairing_ranking, players[i]["Name"])
            - player_rank(pairing_ranking, players[j]["Name"])
        ) ** 1.01

    if system == "dutch":  # 1-5, 2-6, 3-7, 4-8
        if players[i]["pts"] == players[j]["pts"]:
            sg_pts = players[i]["pts"]
            sg_size = len([player for player in players if player["pts"] == sg_pts])
        else:
            sg_size = 0
        return (
            -abs(
                sg_size / 2
                - abs(
                    player_rank(pairing_ranking, players[i]["Name"])
                    - player_rank(pairing_ranking, players[j]["Name"])
                )
            )
            ** 1.01
        )

    if system == "swissrandom":
        return random()

    if system == "swissrandom2":
        # Pair within same scoregroups but randomly between halves
        if players[i]["pts"] == players[j]["pts"]:
            sg_pts = players[i]["pts"]
            sg_size = len([player for player in players if player["pts"] == sg_pts])
            i_prem = player_rank(pairing_ranking, players[i]["Name"]) <= sg_size / 2
            j_prem = player_rank(pairing_ranking, players[j]["Name"]) <= sg_size / 2
            if (i_prem and not j_prem) or (j_prem and not i_prem):
                return random()
            return random() - 1
        return random() - 1

    raise ValueError(f"Unknown Swiss system: {system}")


def update_graph_weights(G, players: list[dict], pairing_ranking: list[dict], system: str, beta: int) -> None:
    """Set edge weights on G exactly as in TOURNAMENT_Swiss_MWM_decr."""
    n = len(players)
    for i in range(n):
        for j in range(i + 1):
            if G.has_edge(i, j):
                d_s = -abs(players[i]["pts"] - players[j]["pts"])
                d_cd = 0  # colors deactivated in weight (same as original Pheng code)
                d_pi = compute_d_pi(system, players, pairing_ranking, i, j)

                forbidden = 0
                if abs(players[i]["color_diff"] + players[j]["color_diff"]) > 2 * beta - 1:
                    forbidden = 1

                G[i][j]["weight"] = 10000 * d_s + 100 * d_cd + d_pi - 1000000 * forbidden
