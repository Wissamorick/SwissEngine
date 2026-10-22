# Swiss Random 2 : correctif de la « moitié haute »

## Le principe du système

Swiss Random 2 (Sauer et al.) apparie au hasard **à l'intérieur de chaque
groupe de points**, mais en opposant toujours un joueur de la moitié haute
du groupe à un joueur de la moitié basse (compromis entre Swiss Dutch et
Swiss Random). Dans le poids de l'arête, `π` vaut un nombre aléatoire de
[0, 1[ pour une paire « haut contre bas » du même groupe, et un nombre de
[−1, 0[ sinon.

## Le bug

Pour savoir si un joueur est dans la moitié haute, le code comparait son
**rang global** (0 = premier du tournoi) à la moitié de la **taille de son
groupe** :

```python
# engine/swiss/weights.py (avant), même code dans TestSwissPheng.ipynb
# (run_tournament_csv et les autres) et dans TOURNAMENT_Swiss_MWM_decr
i_prem = player_rank(pairing_ranking, players[i]["Name"]) <= sg_size / 2
j_prem = player_rank(pairing_ranking, players[j]["Name"]) <= sg_size / 2
```

```python
# functions.py, TOURNAMENT_Swiss_MWM (code des résultats de la thèse, § 8)
i_prem = rank(pairing_ranking, players[i]['Name']) <= sg_size/2 -1
j_prem = rank(pairing_ranking, players[j]['Name']) <= sg_size/2 -1
```

Conséquences (H = classé « moitié haute », b = « moitié basse ») :

| Situation | Moteur (`<= s/2`) | Thèse (`<= s/2 - 1`) | Correct |
| --- | --- | --- | --- |
| Ronde 1, 12 joueurs | `HHHHHHHbbbbb` | `HHHHHHbbbbbb` | `HHHHHHbbbbbb` |
| Ronde 2, groupes 6 + 6 | `HHHHbb` · `bbbbbb` | `HHHbbb` · `bbbbbb` | `HHHbbb` · `HHHbbb` |
| Ronde 3, groupes 3 + 6 + 3 | `HHb` · `Hbbbbb` · `bbb` | `Hbb` · `bbbbbb` · `bbb` | `Hbb` · `HHHbbb` · `Hbb` |

- Seul le **premier groupe de points** est découpé correctement (et encore,
  avec un joueur « haut » de trop dans la version du moteur, ce qui force
  une paire haut–haut dès la ronde 1).
- Tous les autres groupes ont leurs rangs globaux trop grands : tout le
  monde y est « bas », il n'y a plus de bonus, et ces groupes sont appariés
  **purement au hasard**, comme en Swiss Random.
- Le premier joueur d'un groupe du milieu peut être compté « haut » par
  erreur.

## Le correctif

```python
# engine/swiss/weights.py (après)
start = starts[players[i]["pts"]]          # rang du premier joueur du groupe
i_upper = ri - start < sg_size // 2        # rang DANS le groupe, 0-based
j_upper = rj - start < sg_size // 2
if i_upper != j_upper:
    return random()
return random() - 1
```

- Le rang est pris **à l'intérieur du groupe de points** (le classement
  d'appariement est trié par points d'abord, donc chaque groupe est un bloc
  contigu).
- La moitié haute contient les `floor(taille / 2)` premiers joueurs, comme
  la sous-moitié S1 de la FIDE ; avec un groupe impair, le joueur en plus
  est dans la moitié basse.

Tests : `Tests/test_swissrandom2.py` (les deux versions buggées échouent,
la version corrigée passe).

## Effet sur la qualité du classement

Protocole de la thèse (§ 7.4, modèle de `functions.py`) : 32 joueurs,
7 rondes, force ~ N(1600, 400), Elo bruité, sous-catégorie de 15 % des
joueurs ; 2 000 tournois, **les mêmes groupes de joueurs pour tous les
systèmes** (comparaison appariée). Écart = moyenne de la différence avec
Swiss Random 2 corrigé, ± intervalle de confiance à 95 %.

- **τ** : Kendall τb du classement final (plus haut = mieux) ;
- **RWE5** : top-5, distance pondérée (plus bas = mieux) ;
- **MS5** : sélection des 5 meilleurs, force manquante (plus bas = mieux) ;
- **SC3** : 3 meilleurs de la sous-catégorie, force manquante (plus bas = mieux).

### Dans les conditions de l'étude (terme de couleur désactivé)

| Système | τ | RWE5 | MS5 | SC3 |
| --- | --- | --- | --- | --- |
| Swiss Random | 0,7630 (−0,032 ± 0,002) | 1149 (+54 ± 45) | 202 (+39 ± 10) | 36,1 (+6,0 ± 4,7) |
| Swiss Random 2, bug de la thèse | 0,7665 (−0,029 ± 0,002) | 1117 (+22 ± 40) | 190 (+27 ± 9) | 38,4 (+8,3 ± 4,5) |
| **Swiss Random 2 corrigé** | **0,7951** | **1094** | **163** | **30,1** |
| Swiss Dutch | 0,7771 (−0,018 ± 0,002) | 1108 (+14 ± 40) | 213 (+49 ± 9) | 34,7 (+4,6 ± 4,4) |
| Swiss Burstein | 0,8024 (+0,007 ± 0,002) | 1053 (−41 ± 42) | 154 (−9 ± 8) | 26,3 (−3,8 ± 4,1) |

Validation du protocole : Swiss Random, Swiss Random 2 (bug de la thèse),
Dutch et Burstein retrouvent les τ de la thèse (0,7642 / 0,7669 / 0,7778 /
0,8019) à ±0,001 près. Les valeurs absolues de SC3 sont plus basses que
dans la thèse (le protocole exact de la sous-catégorie n'a pas pu être
retrouvé), seules les comparaisons entre systèmes ont un sens.

### Avec le moteur actuel (terme de couleur actif)

| Système | τ | RWE5 | MS5 | SC3 |
| --- | --- | --- | --- | --- |
| Aléatoire | 0,7222 (−0,066 ± 0,003) | 2102 (+995 ± 68) | 312 (+136 ± 13) | 54,0 (+21,6 ± 5,6) |
| Swiss Random | 0,7643 (−0,024 ± 0,002) | 1167 (+60 ± 44) | 205 (+29 ± 10) | 36,1 (+3,7 ± 4,7) |
| Swiss Random 2, bug de la thèse (`<= s/2 - 1`) | 0,7674 (−0,021 ± 0,002) | 1121 (+15 ± 36) | 194 (+18 ± 9) | 39,8 (+7,4 ± 4,8) |
| Swiss Random 2, bug du moteur (`<= s/2`) | 0,7671 (−0,021 ± 0,002) | 1127 (+20 ± 42) | 194 (+18 ± 9) | 38,0 (+5,6 ± 4,5) |
| **Swiss Random 2 corrigé** | **0,7880** | **1107** | **176** | **32,4** |
| Swiss Dutch | 0,7732 (−0,015 ± 0,002) | 1133 (+27 ± 42) | 216 (+40 ± 9) | 35,8 (+3,4 ± 4,6) |
| Swiss Burstein | 0,7953 (+0,007 ± 0,002) | 1071 (−35 ± 42) | 168 (−8 ± 9) | 28,9 (−3,5 ± 4,2) |

### Conclusions

- Le correctif change nettement le système : le Swiss Random 2 corrigé
  passe **devant le Swiss Dutch** en justesse globale (+0,018 de τ) et
  pour sélectionner les 5 meilleurs (−49 de force manquante), et se place
  juste derrière le Burstein.
- Sur RWE5 et SC3, les écarts sont dans l'intervalle de confiance : pas de
  différence démontrée avec le Dutch.
- Les deux versions buggées sont équivalentes entre elles, et à peine
  meilleures que le Swiss Random : c'est attendu, puisque seuls les
  joueurs du premier groupe de points profitaient de la règle des moitiés.
- FAQ mise à jour : τ du graphique « justesse » (0,7669 → 0,7951, même
  protocole, 2 000 tournois), classement des systèmes (Swiss Random 2 :
  3^e^ / 3^e^ / 3^e^, le Dutch passe 4^e^ pour le classement complet et les
  catégories) et notes du diagramme araignée (Classement 3, Top 3–5 2,5,
  Catégories 2 : proposition à valider par l'auteur). L'avance sur le Dutch
  pour les catégories (−4,6 ± 4,4) reste à confirmer avec plus de
  tournois.

Reproduire : `python -m Tests.bench_systems 2000 swissrandom2 dutch swissrandom`.
