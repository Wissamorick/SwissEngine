"""Colors (White / Black): how much a player "needs" each color.

Every player has two counters, updated when a round is registered:

- ``color_diff`` (cd): games with White minus games with Black (integer);
- ``last_color``: +1 if the last game was with White, -1 with Black, 0 before
  the first game (a bye does not change it).

The *effective color* of a player is

    e = cd + LAST_COLOR_WEIGHT * last_color

A positive e means the player should rather get Black, a negative e White.

Why the last color term (temporal alternation)? With cd alone, a player who
had White then Black (cd = 0) is "neutral" and gets a random color in round 3,
so many players get the same color twice in a row. With the bonus, that
player now leans towards White (e = -0.5): colors alternate over time.

Why 0.5? Any value strictly between 0 and 1 gives the same behavior: when
cd != 0 the sign of e is the sign of cd (|cd| >= 1 > 0.5), so the bonus never
overrides a real imbalance; when cd = 0 it only decides the direction. In
simulations (40 players, 7 rounds), 0.5, 0.7 and 0.9 gave the same results;
0.5 sits in the middle of the valid interval.

The effective color is used in two places:
- pairing (Swiss systems): weight term -|e_i + e_j| (see engine/swiss/weights.py);
- color assignment once the pairs are known: the player with the lower e gets
  White (see RoundBasedSystem._register_round).

The Beta constraint (|cd_i + cd_j| > 2*beta - 1) keeps using the integer cd.
"""

LAST_COLOR_WEIGHT = 0.5

FIRST_BOARD_COLORS = ("white", "random", "black")


def effective_color(player: dict) -> float:
    return player.get("color_diff", 0) + LAST_COLOR_WEIGHT * player.get("last_color", 0)
