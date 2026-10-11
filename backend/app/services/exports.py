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


def result_label(white_score: float | None) -> str:
    if white_score is None:
        return ""
    return RESULT_LABELS.get(float(white_score), str(white_score))


def cell_label(cell: dict) -> str:
    """Crosstable cell: '+12N' = win against #12 with Black; 'EXE' = bye."""
    if cell.get("bye"):
        return "EXE"
    if cell.get("result") is None:
        return "—"
    color = "B" if cell.get("color") == "W" else "N"
    return f"{cell['result']}{cell.get('opponent_rank') or '?'}{color}"


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
* { box-sizing: border-box; }
body { font-family: system-ui, 'Segoe UI', Roboto, sans-serif; color: #111; margin: 24px; }
header { margin-bottom: 14px; }
h1 { font-size: 20px; margin: 0 0 2px; }
h2 { font-size: 15px; margin: 0 0 4px; font-weight: 600; color: #333; }
.meta { color: #666; font-size: 12px; }
table { border-collapse: collapse; width: 100%; font-size: 13px; }
th, td { border: 1px solid #c9ced6; padding: 5px 7px; text-align: left; vertical-align: middle; }
thead th { background: #1f2937; color: #fff; font-weight: 600; text-align: center; border-color: #1f2937; }
tbody tr:nth-child(even) td { background: #f5f7fa; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
td.center, th.center { text-align: center; }
td.rank { text-align: center; font-weight: 700; width: 36px; }
td.pl { text-align: center; width: 36px; }
td.name { font-weight: 700; }
td.club, td.elo { color: #555; }
td.club { font-size: 12px; }
td.elo { text-align: center; font-variant-numeric: tabular-nums; }
td.pts { text-align: center; font-weight: 800; font-size: 14px; background: #e8eefc !important; }
td.tb { text-align: center; color: #444; font-variant-numeric: tabular-nums; }
td.res { font-weight: 700; text-align: center; white-space: nowrap; }
td.rc { text-align: center; white-space: nowrap; padding: 4px 3px; font-variant-numeric: tabular-nums; }
td.rc span { display: inline-block; }
td.rc .sym { width: 0.9em; text-align: center; font-weight: 800; }
td.rc .opp { min-width: 1.6em; text-align: right; }
td.rc .col { width: 1.1em; text-align: left; font-size: 11px; color: #666; padding-left: 1px; }
td.rc.win .sym { color: #1b6e2a; }
td.rc.loss .sym { color: #b42318; }
td.rc.draw .sym { color: #555; }
td.rc.bye { color: #777; font-size: 12px; letter-spacing: 0.04em; }
.legend { margin-top: 10px; font-size: 11px; color: #555; }
.toolbar { margin-bottom: 16px; }
.toolbar button { padding: 6px 12px; font-size: 13px; cursor: pointer; }
@media print {
  body { margin: 0; }
  .toolbar { display: none; }
  @page { size: A4; margin: 10mm; }
  tr { break-inside: avoid; }
  thead { display: table-header-group; }
  thead th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  td.pts, tbody tr:nth-child(even) td { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
        + "<p class='legend'>Pts = points avant la ronde.</p>"
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
    if cell.get("result") is None:
        return "<td class='rc'>—</td>"
    kind = {"+": "win", "-": "loss"}.get(cell["result"], "draw")
    color = "B" if cell.get("color") == "W" else "N"
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
        "B = Blancs, N = Noirs · EXE = exempt · Tr. = Buchholz tronqué.</p>"
    )
    return _page(
        tournament_status["name"],
        f"Grille américaine après la ronde {k}",
        _meta(tournament_status),
        body,
        auto_print,
        landscape=k > 7 or (show_club and k > 5),
    )
