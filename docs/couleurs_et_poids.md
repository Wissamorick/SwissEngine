# Couleurs et poids des appariements

Document technique : ce que fait le moteur pour les couleurs (Blancs / Noirs)
et pourquoi. La version grand public est dans la FAQ (section « Comment sont
attribuées les couleurs ? »).

Fichiers concernés :

- `engine/common/colors.py` : couleur effective, constante λ ;
- `engine/common/round_system.py` : attribution des couleurs (`_choose_white`) ;
- `engine/swiss/weights.py` : poids des arêtes (systèmes suisses) ;
- `engine/config.py` : option `first_board_color` ;
- tests : `Tests/test_colors.py` ; mesure : `Tests/bench_colors.py`.

## 1. Historique

| Version | Terme de couleur dans le poids |
| --- | --- |
| Thèse (`functions.py`, `PDM.ipynb`) | désactivé (`d_cd = 0`) pour comparer équitablement les systèmes (thèse, section 7.3) ; seule la contrainte β est appliquée |
| `TestSwissPheng.ipynb`, `run_tournament_csv` | `-|cd_i + cd_j|` (correct) |
| `TestSwissPheng.ipynb`, autres fonctions | `-|cd_i - cd_j|` : **signe faux**, favorise les joueurs ayant eu les mêmes couleurs |
| SwissEngine avant ce changement | désactivé (repris de `functions.py`) |
| SwissEngine maintenant | `-|e_i + e_j|` avec la couleur effective `e` (ci-dessous) |

Attention : la ligne commentée `-abs(cd_i - cd_j)` de `functions.py` a le
mauvais signe ; la bonne formule est celle de la thèse (somme).

## 2. Couleur effective

Pour chaque joueur :

- `cd` (`color_diff`) = parties avec les Blancs − parties avec les Noirs ;
- `last` (`last_color`) = +1 si la dernière partie était avec les Blancs,
  −1 avec les Noirs, 0 avant la première partie (un exempt ne le change pas).

    e = cd + λ · last,   λ = 0,5

`e > 0` : le joueur doit plutôt avoir les Noirs ; `e < 0` : les Blancs.

**Pourquoi le terme `last` (alternance temporelle).** Avec `cd` seul, un
joueur Blancs puis Noirs (`cd = 0`) est neutre et reçoit une couleur au hasard
à la ronde 3 : beaucoup de joueurs ont deux fois de suite la même couleur.
Avec le bonus, il penche vers les Blancs (`e = −0,5`).

**Pourquoi λ = 0,5.** Toute valeur 0 < λ < 1 donne le même comportement :
si `cd ≠ 0`, `|cd| ≥ 1 > λ` donc le signe de `e` est celui de `cd` (le bonus
ne renverse jamais un vrai déséquilibre) ; si `cd = 0`, il donne la
direction. En simulation, 0,5 / 0,7 / 0,9 ont donné des résultats identiques
(0,598 / 0,593 / 0,593 doublons par joueur). 0,5 est au milieu de
l'intervalle valide.

La contrainte β (`|cd_i + cd_j| > 2β − 1` interdit la paire) utilise toujours
`cd` entier.

## 3. Poids des arêtes (systèmes suisses)

    w(i, j) = 10⁶ · Δs + 10⁴ · Δc + π − 10⁸ · interdit

- `Δs = −|pts_i − pts_j|` ;
- `Δc = −|e_i + e_j|` ;
- `π` = règle du système (Dutch, Burstein, Monrad…), **normalisée** (§ 4) ;
- `interdit` = 1 si la contrainte β est violée.

Les rapports sont ceux du code d'origine (10 000 / 100 / 1, interdit
10⁶), multipliés par 100 pour que `π`, désormais ≤ 1, reste loin sous le
terme de couleur.

**Le terme −|e_i + e_j| donne leur couleur au plus de joueurs possible.**
Sur un appariement complet :

    Σ |e_i + e_j| = Σ |e_k| − 2 · Σ_{paires de signes opposés} min(|e_i|, |e_j|)

Si un appariement contient une paire (+, +) et une paire (−, −), échanger
les adversaires crée deux paires opposées et fait strictement baisser la
somme. Tout appariement optimal maximise donc le nombre de paires de
couleurs opposées : un joueur n'a la même couleur deux fois de suite que si
c'est inévitable. Vérifié par force brute (`Tests/test_colors.py`).

Entre deux appariements qui satisfont autant de joueurs, la formule préfère
apparier les besoins les plus forts entre eux ((+3, −3) et (+1, −1) plutôt
que (+3, −1) et (+1, −3)), ce qui peut s'écarter de la règle du système sans
gain de couleur. Une variante « conflits seulement »
(`−min(|e_i|, |e_j|)` si même signe, 0 sinon) évite cela ; elle a été
simulée : même nombre de doublons, pas de différence mesurable de justesse.
La formule de la thèse (somme) a été retenue.

**Ordres de grandeur.** `e` est un multiple de 0,5, donc `Δc` varie par pas
de 0,5 → 5 000. Le total des `π` d'une ronde est ≤ n/2 : la couleur passe
toujours avant le système jusqu'à environ 10 000 joueurs. Un demi-point de
score (500 000) vaut 50 pas de couleur : le moteur peut faire « flotter »
un joueur vers un autre groupe de points s'il évite ainsi de nombreux
conflits de couleurs (la FIDE, elle, minimise d'abord les flotteurs).

## 4. Normalisation de π

Avant : `π` valait jusqu'à ~taille/2 (Dutch) ou ~taille (Burstein) par
paire, donc pouvait l'emporter sur la couleur dans les grands groupes.

Maintenant toutes les distances de rang (et la cible du Dutch, la moitié du
groupe) sont divisées par le nombre de joueurs `n` :

| Système | Avant | Maintenant |
| --- | --- | --- |
| Monrad | `−d` | `−d/n` |
| Burstein | `d^1.01` | `(d/n)^1.01` |
| Dutch | `−|s/2 − d|^1.01` | `−|s/(2n) − d/n|^1.01` |
| Swiss Random (2) | inchangé (déjà dans [−1, 1]) | inchangé |

C'est la même constante positive pour toutes les paires d'une ronde
(`1/n^1.01`, ou `1/n` en Monrad) : **le meilleur appariement est exactement
celui d'avant**, flotteurs compris. Vérifié sur 450 situations aléatoires
(Dutch, Burstein, Monrad, couleurs neutralisées) : toutes les différences
étaient des égalités parfaites de poids total, départagées autrement.

Une normalisation par la taille de chaque groupe a été essayée puis
rejetée : elle conserve l'appariement à l'intérieur des groupes, mais change
le choix des flotteurs (en Burstein, dans 94 cas sur 150).

## 5. Attribution des couleurs

Une fois les paires choisies (`RoundBasedSystem._choose_white`, tous les
systèmes) :

1. le joueur de plus petite couleur effective a les Blancs ;
2. ronde 1 : alternance de table en table. Le mieux classé de la table 1 a
   la couleur de l'option `first_board_color` (`"white"`, `"black"` ou
   `"random"`, tiré au sort une fois pour la ronde), celui de la table 2
   l'autre couleur, etc. C'est l'usage FIDE ;
3. égalité parfaite aux rondes suivantes (même `cd`, même dernière
   couleur) : tirage au sort.

L'alternance de la ronde 1 ne crée pas d'alternance aux rondes suivantes :
après la ronde 1, chaque joueur a `cd = ±1` de toute façon. Elle change
seulement *qui* est à +1 ou −1 (en alternance selon le classement au lieu du
hasard). C'est le bonus temporel qui fait alterner les couleurs dans le
temps.

## 6. Mesures

`python -m Tests.bench_colors 40 7 150` (Swiss Dutch, 40 joueurs, 7 rondes,
150 tournois, mêmes graines pour les deux moteurs) :

| | Avant | Après |
| --- | --- | --- |
| Même couleur deux fois de suite (par joueur, sur 6 enchaînements) | 2,12 | 0,62 |
| Même couleur trois fois de suite (par joueur) | 0,39 | 0,03 |
| Kendall τ (classement final / force réelle) | 0,716 ± 0,008 | 0,714 ± 0,007 |

Avec ce modèle (avantage des Blancs, 40 joueurs), la différence de justesse
est dans le bruit. **Avec le protocole de la thèse** (`python -m
Tests.bench_systems`, 32 joueurs, 7 rondes, 2 000 tournois appariés, aucune
influence de la couleur sur les résultats), le terme de couleur a un coût
faible mais mesurable :

| Système | τ sans couleur | τ avec couleur | Écart |
| --- | --- | --- | --- |
| Swiss Dutch | 0,7771 | 0,7732 | −0,0040 ± 0,0019 |
| Swiss Burstein | 0,8024 | 0,7953 | −0,0071 ± 0,0018 |
| Swiss Random 2 (corrigé) | 0,7951 | 0,7880 | −0,0071 |

Sur l'échelle 0–100 de la FAQ (0 = Aléatoire, 100 = round-robin), cela fait
environ −2 points pour le Dutch et −4 pour le Burstein. Pour le Burstein, la
sélection des 5 meilleurs se dégrade aussi (+14 ± 8 de force manquante).
C'est le prix d'appariements qui respectent davantage les couleurs : le
système suit un peu moins sa règle (Dutch, Burstein…) pour éviter les
doublons. Les résultats de l'étude (FAQ) ont été obtenus sans terme de
couleur.

## 7. Limites connues

- Swiss Random 2 compare le rang **global** d'un joueur à la moitié de la
  taille de son groupe pour savoir s'il est dans la moitié haute : ce n'est
  correct que pour le premier groupe de points. Comportement d'origine,
  non modifié.
- Aux rondes > 1, une égalité parfaite de couleur est tirée au sort ; la
  FIDE donnerait la préférence au mieux classé.
