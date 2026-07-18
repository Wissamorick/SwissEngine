def player_rank(ranking: list[dict], player: str) -> int:
    """Returns the 0-based rank of a player given their name."""
    for i in range(len(ranking)):
        if ranking[i]["Name"] == player:
            return i
    raise ValueError(f"Player '{player}' not found in ranking")


def ensure_player_fields(player: dict) -> dict:
    """Normalize a player dict to the engine schema without overwriting existing data."""
    if "Name" not in player:
        raise ValueError("Each player must have a 'Name'")
    player.setdefault("Elo", 0)
    player.setdefault("strength", player.get("Elo", 0))
    player.setdefault("pts", 0.0)
    player.setdefault("color_diff", 0)
    player.setdefault("TB", {})
    player["TB"].setdefault("Bu1", 0.0)
    player["TB"].setdefault("Bu", 0.0)
    return player


def standings_swiss(players: list[dict]) -> list[dict]:
    return sorted(
        players,
        key=lambda x: (-x["pts"], -x["TB"]["Bu1"], -x["TB"]["Bu"], x["color_diff"]),
    )


def standings_roundrobin(players: list[dict]) -> list[dict]:
    return sorted(players, key=lambda x: (-x["pts"], -x["TB"]["SB"]))
