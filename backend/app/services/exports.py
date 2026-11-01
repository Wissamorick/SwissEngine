"""Human-readable exports: printable HTML pages and CSV files.

Used both for the files written in the tournament folder and for the
"Imprimer" buttons of the interface (same rendering everywhere).
"""

from __future__ import annotations

import csv
import io
from html import escape

SYSTEM_LABELS = {
    "dutch": "Swiss Dutch",
    "burstein": "Swiss Burstein",
    "monrad": "Monrad",
    "swissrandom": "Swiss Random",
    "swissrandom2": "Swiss Random 2",
    "mixed": "Mixte (Swiss Dutch puis Swiss Burstein)",
    "random": "Aléatoire",
    "roundrobin": "Round-robin (toutes rondes)",
}

TIEBREAK_LABELS = {
    "Bu1": "Tr.",
    "Bu": "Buchholz",
    "SB": "S.-B.",
    "Perf": "Perf.",
}

RESULT_LABELS = {1.0: "1-0", 0.5: "½-½", 0.0: "0-1"}


def fmt_pts(value: float | None) -> str:
    """3 -> '3', 2.5 -> '2½', 2.25 -> '2.25' (chess convention)."""
    if value is None:
        return ""
    value = round(float(value), 2)
    whole = int(value)
    frac = round(value - whole, 2)
    if frac == 0:
        return str(whole)
    if frac == 0.5:
        return "½" if whole == 0 else f"{whole}½"
    return f"{value:g}"


def result_label(white_score: float | str | None) -> str:
    if white_score is None:
        return ""
    if isinstance(white_score, str):  # forfeit: "1-F", "F-1", "F-F"
        return white_score
    return RESULT_LABELS.get(float(white_score), str(white_score))


def absence_label(cell: dict) -> str:
    """ABS (absent, or not arrived yet) / OUT (withdrawn), with ½ when the round gave half a point."""
    base = "OUT" if cell.get("kind") == "withdrawn" else "ABS"
    return f"{base} ½" if cell.get("result") == "=" else base


def cell_label(cell: dict) -> str:
    """Crosstable cell: '+12N' = win against #12 with Black; '+12F' = forfeit win; 'EXE' = bye."""
    if cell.get("bye"):
        return "EXE"
    if cell.get("kind") in ("absent", "withdrawn", "late"):
        return absence_label(cell)
    if cell.get("result") is None:
        return "—"
    if cell.get("kind") == "forfeit":
        return f"{cell['result']}{cell.get('opponent_rank') or '?'}F"
    color = "B" if cell.get("color") == "W" else "N"
    return f"{cell['result']}{cell.get('opponent_rank') or '?'}{color}"


def absents_text(round_info: dict) -> str:
    """'Non appariés : Ana (½), Bob (0, retiré)' — players not paired in the round."""
    reasons = {"withdrawn": ", retiré", "late": ", arrivée ultérieure"}
    items = [
        f"{a['name']} ({fmt_pts(a['points'])}{reasons.get(a['reason'], '')})" for a in round_info.get("absent", [])
    ]
    return ("Non appariés : " + ", ".join(items)) if items else ""


def tiebreak_label(key: str) -> str:
    return TIEBREAK_LABELS.get(key, key)


# --------------------------------------------------------------------- CSV
def _csv(rows: list[list]) -> str:
    buf = io.StringIO()
    # ';' + BOM: opens directly with accents in Excel / LibreOffice (FR locale)
    writer = csv.writer(buf, delimiter=";", lineterminator="\n")
    writer.writerows(rows)
    return "﻿" + buf.getvalue()


def players_csv(players: list[dict], show_club: bool = False) -> str:
    rows = [["N°", "Nom"] + (["Club / équipe"] if show_club else []) + ["Elo"]]
    rows += [
        [i, p["name"]] + ([p.get("club") or ""] if show_club else []) + [p["elo"]]
        for i, p in enumerate(players, start=1)
    ]
    return _csv(rows)


def pairings_csv(round_info: dict) -> str:
    rows = [["Table", "Pts", "Blancs", "Elo", "Résultat", "Elo", "Noirs", "Pts"]]
    for p in round_info["pairings"]:
        if p["is_bye"]:
            rows.append([p["table"], fmt_pts(p["white_pts"]), p["white"], p["white_elo"], "EXEMPT", "", "", ""])
        else:
            rows.append(
                [
                    p["table"],
                    fmt_pts(p["white_pts"]),
                    p["white"],
                    p["white_elo"],
                    result_label(p["white_score"]),
                    p["black_elo"],
                    p["black"],
                    fmt_pts(p["black_pts"]),
                ]
            )
    for a in round_info.get("absent", []):
        rows.append(["", "", a["name"], "", "NON APPARIÉ", fmt_pts(a["points"]), "", ""])
    return _csv(rows)


def crosstable_csv(table: dict, show_club: bool = False) -> str:
    k = table["after_round"]
    keys = table["tiebreak_keys"]
    club_head = ["Club / équipe"] if show_club else []
    rows = [
        ["Pl", "Nom"] + club_head + ["Elo"]
        + [f"R{r}" for r in range(1, k + 1)] + ["Pts"] + [tiebreak_label(t) for t in keys]
    ]
    for row in table["rows"]:
        rows.append(
            [row["rank"], row["name"]]
            + ([row.get("club") or ""] if show_club else [])
            + [row["elo"]]
            + [cell_label(c) for c in row["cells"]]
            + [fmt_pts(row["pts"])]
            + [fmt_pts(row["tiebreaks"].get(t)) for t in keys]
        )
    return _csv(rows)


# -------------------------------------------------------------------- HTML
_STYLE = """
/* Same visual language as the web interface (SwissEngine brand):
   ink rules instead of filled headers (cheaper to print), the logo red
   as a single rule above the title, tabular figures everywhere. */
* { box-sizing: border-box; }
body { font-family: Inter, 'Segoe UI', system-ui, Roboto, sans-serif; color: #141414; margin: 24px; }
header { margin-bottom: 16px; padding-top: 10px; border-top: 4px solid #cc0000; }
h1 { font-size: 20px; margin: 0 0 2px; letter-spacing: -0.01em; }
h2 { font-size: 14px; margin: 0 0 4px; font-weight: 600; color: #4b4743; }
.meta { color: #78726b; font-size: 12px; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { border-bottom: 1px solid #ccc7c0; padding: 5px 7px; text-align: left; vertical-align: middle; }
thead th { background: none; color: #4b4743; font-size: 10.5px; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; text-align: center; border-bottom: 2px solid #141414; }
tbody tr:last-child td { border-bottom: 2px solid #141414; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
td.center, th.center { text-align: center; }
td.rank { text-align: center; font-weight: 700; width: 36px; }
td.pl { text-align: center; width: 36px; }
td.name { font-weight: 600; }
td.club, td.elo { color: #4b4743; }
td.club { font-size: 12px; }
td.elo { text-align: center; font-variant-numeric: tabular-nums; }
td.pts { text-align: center; font-weight: 700; font-size: 14px; border-left: 2px solid #141414; }
td.tb { text-align: center; color: #4b4743; font-variant-numeric: tabular-nums; }
td.res { font-weight: 700; text-align: center; white-space: nowrap; }
td.rc { text-align: center; white-space: nowrap; padding: 4px 3px; font-variant-numeric: tabular-nums; }
td.rc span { display: inline-block; }
td.rc .sym { width: 0.9em; text-align: center; font-weight: 700; }
td.rc .opp { min-width: 1.6em; text-align: right; }
td.rc .col { width: 1.1em; text-align: left; font-size: 11px; color: #78726b; padding-left: 1px; }
td.rc.win .sym { color: #1d6b3a; }
td.rc.loss .sym { color: #b30000; }
td.rc.draw .sym { color: #4b4743; }
td.rc.bye { color: #78726b; font-size: 12px; letter-spacing: 0.04em; }
.legend { margin-top: 10px; font-size: 11px; color: #4b4743; }
.toolbar { margin-bottom: 16px; }
.toolbar button { padding: 0 14px; height: 32px; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  color: #fff; background: #141414; border: 1px solid #141414; border-radius: 4px; box-shadow: 3px 3px 0 #cc0000; }
td.gc { text-align: center; white-space: nowrap; padding: 4px 3px; font-variant-numeric: tabular-nums; }
td.gc.self { background: #2b2b2b !important; }
td.gc .g + .g { margin-left: 6px; }
td.gc .g.todo { color: #aaa; }
th.gn { text-align: center; width: 34px; }
@media print {
  body { margin: 0; }
  .toolbar { display: none; }
  @page { size: A4; margin: 10mm; }
  tr { break-inside: avoid; }
  thead { display: table-header-group; }
  header, td.rc .sym { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
"""


def _page(title: str, subtitle: str, meta: str, body: str, auto_print: bool = False, landscape: bool = False) -> str:
    script = "<script>window.addEventListener('load', () => window.print())</script>" if auto_print else ""
    page_css = "<style>@media print { @page { size: A4 landscape; } }</style>" if landscape else ""
    return f"""<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{escape(title)} — {escape(subtitle)}</title>
<style>{_STYLE}</style>
{page_css}
</head>
<body>
<div class="toolbar"><button onclick="window.print()">Imprimer</button></div>
<header>
<h1>{escape(title)}</h1>
<h2>{escape(subtitle)}</h2>
<div class="meta">{escape(meta)}</div>
</header>
{body}
{script}
</body>
</html>
"""


def _meta(tournament_status: dict) -> str:
    system = SYSTEM_LABELS.get(tournament_status["system"], tournament_status["system"])
    if tournament_status.get("config", {}).get("double_round_robin"):
        system = "Round-robin aller-retour"
    return f"{system} · {tournament_status['player_count']} joueurs · {tournament_status['total_rounds']} rondes"


def pairings_html(tournament_status: dict, round_info: dict, auto_print: bool = False) -> str:
    lines = []
    for p in round_info["pairings"]:
        if p["is_bye"]:
            lines.append(
                f"<tr><td class='rank'>{p['table']}</td><td class='center'>{fmt_pts(p['white_pts'])}</td>"
                f"<td class='name'>{escape(p['white'])}</td><td class='elo'>{p['white_elo']}</td>"
                f"<td class='res'>EXEMPT</td><td></td><td></td><td></td></tr>"
            )
        else:
            lines.append(
                f"<tr><td class='rank'>{p['table']}</td><td class='center'>{fmt_pts(p['white_pts'])}</td>"
                f"<td class='name'>{escape(p['white'])}</td><td class='elo'>{p['white_elo']}</td>"
                f"<td class='res'>{result_label(p['white_score'])}</td>"
                f"<td class='elo'>{p['black_elo']}</td><td class='name'>{escape(p['black'])}</td>"
                f"<td class='center'>{fmt_pts(p['black_pts'])}</td></tr>"
            )
    body = (
        "<table><thead><tr><th>Table</th><th>Pts</th><th>Blancs</th>"
        "<th>Elo</th><th>Résultat</th><th>Elo</th>"
        "<th>Noirs</th><th>Pts</th></tr></thead><tbody>"
        + "".join(lines)
        + "</tbody></table>"
        + (f"<p class='legend'>{escape(absents_text(round_info))}</p>" if absents_text(round_info) else "")
        + "<p class='legend'>Pts = points avant la ronde. 1-F / F-1 : gain par forfait, F-F : double forfait.</p>"
    )
    state = "résultats" if round_info["completed"] else "appariements"
    return _page(
        tournament_status["name"],
        f"Ronde {round_info['round']} — {state}",
        _meta(tournament_status),
        body,
        auto_print,
    )


def _cell_html(cell: dict) -> str:
    if cell.get("bye"):
        return "<td class='rc bye' title='Exempt'>EXE</td>"
    if cell.get("kind") in ("absent", "withdrawn", "late"):
        return f"<td class='rc bye'>{absence_label(cell)}</td>"
    if cell.get("result") is None:
        return "<td class='rc'>—</td>"
    kind = {"+": "win", "-": "loss"}.get(cell["result"], "draw")
    color = "F" if cell.get("kind") == "forfeit" else "B" if cell.get("color") == "W" else "N"
    sym = {"-": "−"}.get(cell["result"], cell["result"])
    return (
        f"<td class='rc {kind}'><span class='sym'>{sym}</span>"
        f"<span class='opp'>{cell.get('opponent_rank') or '?'}</span>"
        f"<span class='col'>{color}</span></td>"
    )


def crosstable_html(tournament_status: dict, table: dict, auto_print: bool = False) -> str:
    k = table["after_round"]
    keys = table["tiebreak_keys"]
    show_club = bool(tournament_status.get("show_club"))
    head = (
        "<tr><th>Pl</th><th>Nom</th>"
        + ("<th>Club / équipe</th>" if show_club else "")
        + "<th>Elo</th>"
        + "".join(f"<th>R{r}</th>" for r in range(1, k + 1))
        + "<th>Pts</th>"
        + "".join(f"<th>{escape(tiebreak_label(t))}</th>" for t in keys)
        + "</tr>"
    )
    lines = []
    for row in table["rows"]:
        lines.append(
            f"<tr><td class='pl'>{row['rank']}</td><td class='name'>{escape(row['name'])}</td>"
            + (f"<td class='club'>{escape(row.get('club') or '')}</td>" if show_club else "")
            + f"<td class='elo'>{row['elo']}</td>"
            + "".join(_cell_html(c) for c in row["cells"])
            + f"<td class='pts'>{fmt_pts(row['pts'])}</td>"
            + "".join(f"<td class='tb'>{fmt_pts(row['tiebreaks'].get(t))}</td>" for t in keys)
            + "</tr>"
        )
    body = (
        f"<table><thead>{head}</thead><tbody>{''.join(lines)}</tbody></table>"
        "<p class='legend'>+ gain, = nulle, − perte · numéro = place de l'adversaire · "
        "B = Blancs, N = Noirs, F = forfait · EXE = exempt · ABS = absent, OUT = retiré · "
        "Tr. = Buchholz tronqué"
        + (" · Perf. = performance Elo" if "Perf" in keys else "")
        + ".</p>"
    )
    return _page(
        tournament_status["name"],
        f"Grille américaine après la ronde {k}",
        _meta(tournament_status),
        body,
        auto_print,
        landscape=k > 7 or (show_club and k > 5),
    )


# ------------------------------------------------------- round-robin grid
def grid_score_label(score: float | None, forfeit: bool = False) -> str:
    """1, ½, 0 — 1F / 0F for a forfeit — or · for a game still to be played."""
    if score is None:
        return "·"
    label = {1.0: "1", 0.5: "½", 0.0: "0"}.get(float(score), f"{score:g}")
    return f"{label}F" if forfeit else label


def _grid_cell_text(cell: list[dict] | None) -> str:
    if cell is None:
        return "×"
    return " ".join(grid_score_label(g["score"], g.get("forfeit", False)) for g in cell)


def results_grid_csv(grid: dict, show_club: bool = False) -> str:
    keys = grid["tiebreak_keys"]
    n = len(grid["rows"])
    head = (
        ["Pl", "Nom"] + (["Club / équipe"] if show_club else []) + ["Elo"]
        + [str(i) for i in range(1, n + 1)] + ["Pts"] + [tiebreak_label(t) for t in keys] + ["Parties"]
    )
    rows = [head]
    for row in grid["rows"]:
        rows.append(
            [row["rank"], row["name"]]
            + ([row.get("club") or ""] if show_club else [])
            + [row["elo"]]
            + [_grid_cell_text(c) for c in row["cells"]]
            + [fmt_pts(row["pts"])]
            + [fmt_pts(row["tiebreaks"].get(t)) for t in keys]
            + [row["played"]]
        )
    return _csv(rows)


def results_grid_html(tournament_status: dict, grid: dict, auto_print: bool = False) -> str:
    keys = grid["tiebreak_keys"]
    n = len(grid["rows"])
    show_club = bool(tournament_status.get("show_club"))
    head = (
        "<tr><th>Pl</th><th>Nom</th>"
        + ("<th>Club / équipe</th>" if show_club else "")
        + "<th>Elo</th>"
        + "".join(f"<th class='gn'>{i}</th>" for i in range(1, n + 1))
        + "<th>Pts</th>"
        + "".join(f"<th>{escape(tiebreak_label(t))}</th>" for t in keys)
        + "</tr>"
    )
    lines = []
    for row in grid["rows"]:
        cells = []
        for cell in row["cells"]:
            if cell is None:
                cells.append("<td class='gc self'></td>")
                continue
            parts = "".join(
                f"<span class='g{' todo' if g['score'] is None else ''}'>{grid_score_label(g['score'], g.get('forfeit', False))}</span>"
                for g in cell
            )
            cells.append(f"<td class='gc'>{parts}</td>")
        lines.append(
            f"<tr><td class='pl'>{row['rank']}</td><td class='name'>{escape(row['name'])}</td>"
            + (f"<td class='club'>{escape(row.get('club') or '')}</td>" if show_club else "")
            + f"<td class='elo'>{row['elo']}</td>"
            + "".join(cells)
            + f"<td class='pts'>{fmt_pts(row['pts'])}</td>"
            + "".join(f"<td class='tb'>{fmt_pts(row['tiebreaks'].get(t))}</td>" for t in keys)
            + "</tr>"
        )
    legs = "Chaque case : résultat du joueur de la ligne contre celui de la colonne"
    if grid["legs"] == 2:
        legs += " (aller puis retour)"
    body = (
        f"<table><thead>{head}</thead><tbody>{''.join(lines)}</tbody></table>"
        f"<p class='legend'>{legs} · 1 gain, ½ nulle, 0 perte, · à jouer · "
        f"{grid['games_played']} parties jouées sur {grid['games_total']}"
        + (" · Perf. = performance Elo" if "Perf" in keys else "")
        + ".</p>"
    )
    return _page(
        tournament_status["name"],
        "Grille des résultats",
        _meta(tournament_status),
        body,
        auto_print,
        landscape=n > 10 or (show_club and n > 7),
    )
