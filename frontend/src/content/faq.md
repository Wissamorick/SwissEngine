<!--
  FAQ & documentation de SwissEngine
  ==================================
  Ce fichier est affiché tel quel dans l'onglet « FAQ & documentation ».
  Avec `npm run dev`, chaque enregistrement se voit aussitôt dans le navigateur.
  Les commentaires comme celui-ci n'apparaissent pas à l'écran.

  STRUCTURE
    # Titre de la page
    ## Titre de section {#ancre}       → une section (le sommaire se construit tout seul)
    ### Question ? {#ancre}            → une question repliable
    L'ancre {#…} est facultative mais permet les liens : [texte](#ancre).

  TEXTE
    **gras**   *italique*   `code`   1^er^ (exposant)
    [lien interne](#pheng)   [lien externe](https://exemple.org)
    Un paragraphe = des lignes qui se suivent ; une ligne vide sépare les paragraphes.
    > Ligne commençant par « > »   → petite note grise.
    - élément                       → liste à puces
    1. élément                      → liste numérotée (étapes)

  TABLEAUX
    {.compact .center}               ← facultatif, juste au-dessus du tableau :
                                       compact = largeur réduite, center = colonnes centrées
    | Colonne 1 | Colonne 2 |
    | --- | --- |
    | texte | texte |

  BLOCS SPÉCIAUX
    :::points                        → encadré « Points forts / Points faibles »
    + un point fort
    - un point faible
    :::

    :::appariements                  → pastilles « 1 – 6 », séparées par des virgules
    1 – 6, 2 – 7, 3 – 8
    :::

    :::glossaire                     → « Terme : définition », une par ligne
    Ronde : Un tour du tournoi…
    :::

    :::graphique-justesse            → graphique en barres (Kendall τb ramené de 0 à 100)
    titre: …
    zéro: libellé du 0 de l'axe
    cent: libellé du 100 de l'axe
    série: Titre du groupe | τb du 0 | τb du 100   ← chaque série a sa propre échelle
    * Système mis en avant (en rouge) | 0.8254
    Autre système | 0.7894
    Système sans mesure | non mesuré
    note: texte sous le graphique
    :::

    :::araignees                     → diagrammes araignées de tous les systèmes
    titre: …
    critères: Court = libellé complet | Court 2 = libellé complet 2 | …
    référence: Swiss Dutch           ← contour pointillé repris sur chaque diagramme
    * Système mis en avant | 4 | 4 | 3 | 3,5 | 4
    Autre système | 2,5 | 5 | 3 | 2 | 1,5
    note: …
    :::

    [[araignee: Swiss Dutch]]        → le diagramme d'un seul système (données prises dans
                                       le bloc :::araignees). Placé juste avant un bloc
                                       :::points, il s'affiche à côté.
    [[sommaire]]                     → sommaire automatique des sections
    [[pdf: Texte du bouton]]         → bouton vers le rapport PDF
-->

# FAQ & documentation

SwissEngine organise des tournois en plusieurs rondes : échecs, e-sport, jeux de société, sports de raquette… Cette page explique comment utiliser l'outil, comment choisir le bon système et comment fonctionnent les appariements, sans jargon mathématique.

[[sommaire]]

## 1. Utiliser SwissEngine {#utiliser}

### Comment organiser un tournoi, étape par étape ? {#etapes}

1. **Créer le tournoi.** Dans l'onglet « Tournoi », donnez un nom, choisissez le système (voir [Choisir un système](#choisir)) et le nombre de rondes, puis cliquez sur **Créer le tournoi**. Les réglages fins sont dans [Paramètres avancés](#options).
2. **Inscrire les joueurs.** Saisissez le nom et l'Elo (classement) de chaque joueur, puis cliquez sur **Enregistrer N joueur(s)**. Pas d'Elo ? Mettez 0. Vous pouvez aussi [importer une liste](#import) (export Google Forms, Excel, CSV). Vous pouvez inscrire des joueurs jusqu'à la génération de la première ronde.
3. **Enregistrer le tournoi** (recommandé) : bouton **Enregistrer…** en haut, choisissez un dossier. Ensuite tout est sauvegardé automatiquement.
4. **Générer la ronde.** SwissEngine affiche qui joue contre qui, à quelle table et avec quelle couleur, ainsi que l'Elo et les points de chaque joueur avant la ronde. Le bouton **Imprimer** produit une feuille à afficher dans la salle.
5. **Saisir les résultats** (1-0, ½-½, 0-1) puis **Valider les résultats**. Le classement et la grille américaine se mettent à jour.
6. Recommencez à l'étape 4 jusqu'à la dernière ronde.

En **round-robin**, les étapes 4 à 6 sont remplacées par un seul bouton, **Générer le calendrier** : toutes les rondes sont créées d'un coup et les résultats se saisissent dans n'importe quel ordre (voir [Round-robin](#roundrobin)).

### Comment importer une liste de joueurs (Google Forms, Excel, CSV) ? {#import}

Dans la carte **Joueurs**, cliquez sur **Importer une liste** et choisissez un fichier **CSV**, **Excel (XLSX)** ou **LibreOffice (ODS)**, par exemple l'export des réponses d'un Google Forms. L'import se fait en deux étapes.

**1. Les colonnes.** SwissEngine reconnaît automatiquement les colonnes utiles, quel que soit leur intitulé exact : « Nom », « Prénom », « First name », « Nom d'utilisateur », « Pseudo », « Elo FIDE », « Rating », « Club », « Équipe »… Les colonnes inutiles (horodatage, e-mail…) sont ignorées. Vérifiez les choix proposés et corrigez-les si besoin. Le nom retenu est :

- le **nom d'utilisateur** s'il existe et qu'il est rempli ;
- sinon **« Nom, Prénom »** ;
- sinon la seule colonne de nom disponible (nom complet, nom ou prénom).

Si plusieurs colonnes peuvent contenir l'Elo (« Elo FIDE » et « Elo rapide », par exemple), aucune n'est choisie d'office : indiquez celle à utiliser.

**2. La vérification.** Chaque joueur apparaît sur une ligne modifiable. Les cases à compléter sont signalées : Elo manquant ou illisible (« NC », « 1850 / 1700 »…), nom vide, doublon. Le bouton **Mettre 0 aux Elo manquants ou illisibles** remplit d'un coup les Elo inconnus. Un doublon (même nom qu'un joueur déjà inscrit ou qu'une ligne précédente) est décoché : laissez-le de côté, ou renommez-le et cochez-le s'il s'agit de deux personnes différentes.

Cliquez enfin sur **Importer N joueurs** : ils sont inscrits directement, et vous pouvez toujours en ajouter d'autres à la main. Si le fichier contient une colonne club ou équipe, l'option [Afficher club / équipe](#club) est activée automatiquement (vous pouvez la désactiver).

### Comment sont sauvegardés mes tournois ? Que faire en cas de coupure ? {#sauvegarde}

Après un premier **Enregistrer…**, chaque action (inscription, appariements, résultats) est immédiatement écrite dans le dossier choisi. En cas de coupure de courant, de fermeture du navigateur ou de plantage, rien n'est perdu.

Pour reprendre : onglet « Tournoi » → **Ouvrir un tournoi**. Le tournoi apparaît dans la liste des *récents*, ou retrouvez-le avec **Parcourir les dossiers…**. Vous pouvez aussi importer un fichier `.json` obtenu avec le bouton **.json** (téléchargement) (pratique pour envoyer un tournoi à quelqu'un).

Le dossier d'un tournoi contient :

- `tournoi.json` : l'état complet du tournoi, celui qui est relu à l'ouverture (et `tournoi.precedent.json`, la version d'avant, par sécurité) ;
- `joueurs.csv` : la liste des inscrits ;
- `rondes/` : pour chaque ronde, les appariements et la grille américaine, en HTML (à ouvrir et imprimer) et en CSV (à ouvrir dans Excel ou LibreOffice). En round-robin : les appariements de chaque ronde et la grille des résultats (`grille_resultats`).

Tout reste sur votre ordinateur : rien n'est envoyé sur internet.

### Je me suis trompé dans un résultat. Comment corriger ? {#erreur}

**Ronde en cours :** cliquez simplement sur le bon résultat (1-0, ½-½, 0-1 ou un forfait) avant de valider. Recliquez sur un résultat pour l'effacer.

**Round-robin :** il n'y a rien à valider. Dans le calendrier, cliquez sur le bon résultat dans n'importe quelle ronde : il remplace l'ancien. Recliquez sur le résultat choisi pour l'effacer (partie pas encore jouée).

**Ronde déjà validée :** cliquez sur **Corriger la ronde N** (à côté des appariements), ou allez dans **Rondes jouées** → choisissez la ronde → **Modifier les résultats**. Si les rondes suivantes existent déjà, deux choix s'offrent à vous :

- **Les conserver** : les parties déjà annoncées ou jouées restent identiques, seuls les scores et le classement sont recalculés. C'est le bon choix si la ronde suivante a déjà commencé.
- **Les annuler** : les appariements suivants sont refaits avec les scores corrigés. C'est le plus juste si personne n'a encore joué.

**Refaire les appariements** de la ronde en cours : **Annuler les appariements**, puis générez à nouveau. **Revenir en arrière** de plusieurs rondes : **Rondes jouées** → **Revenir à la fin de cette ronde** (les fichiers des rondes annulées sont rangés dans un sous-dossier `archives`, pas supprimés).

### Comment imprimer les appariements, les résultats ou la grille ? {#imprimer}

Chaque tableau a un bouton **Imprimer** qui ouvre une page prête à imprimer (format A4, paysage automatiquement si la grille est large). Les mêmes pages sont aussi enregistrées dans le dossier `rondes` du tournoi, pour chaque ronde : pratique pour réimprimer plus tard ou les envoyer par e-mail.

### Comment lire la grille américaine ? {#lire-grille}

La grille américaine résume tout le tournoi sur une page : une ligne par joueur, dans l'ordre du classement, et une colonne par ronde. Une case comme `+5N` se lit :

- `+` : victoire (`=` nulle, `−` défaite) ;
- `5` : contre le joueur classé 5^e^ ;
- `N` : avec les Noirs (`B` = Blancs).

`EXE` signifie « exempt » : le joueur n'a pas joué cette ronde (nombre impair de joueurs). `ABS` : absent (`ABS ½` s'il a reçu ½ point), `OUT` : retiré du tournoi, `F` à la place de la couleur : [forfait](#forfaits). Dans l'application, cliquez sur un joueur : sa ligne passe en noir et ses adversaires sont surlignés selon le résultat, en vert ceux qu'il a battus, en rouge ceux qui l'ont battu, en gris foncé les nulles (la case de leur rencontre est encadrée) ; les autres joueurs s'estompent. Cliquez à nouveau ou sur « Effacer » pour revenir à la grille complète. Vous pouvez afficher la grille après n'importe quelle ronde.

### Comment lire la grille d'un round-robin ? {#grille-rr}

En round-robin, la grille est un tableau à double entrée : une ligne et une colonne par joueur, dans l'ordre du classement (les colonnes sont numérotées par la place). La case à l'intersection donne le résultat du joueur de la **ligne** contre le joueur de la **colonne** : `1` gain, `½` nulle, `0` perte, `·` partie pas encore jouée. En aller-retour, chaque case contient deux résultats : l'aller à gauche, le retour à droite. Survolez une case pour voir la ronde et la couleur. La colonne `J` donne le nombre de parties jouées : pratique pour comparer des joueurs quand toutes les parties n'ont pas encore eu lieu.

### À quoi sert « Afficher club / équipe » ? {#club}

Cette option ajoute un champ facultatif « club / équipe » à chaque joueur, affiché dans le classement, la grille et les fichiers exportés. Elle n'a aucun effet sur les appariements. Vous pouvez l'activer ou la désactiver à tout moment, et compléter les clubs même pendant le tournoi.

## 2. Choisir un système {#choisir}

### Quelles questions se poser avant de choisir ? {#questions}

- **Quel est l'objectif ?** Désigner un vainqueur, obtenir un classement juste du premier au dernier, qualifier les *k* premiers pour une autre compétition, récompenser des catégories (jeunes, féminines, tranches d'Elo…), ou simplement passer un bon moment ?
- **Combien de joueurs, combien de temps ?** Avec peu de joueurs et assez de temps, tout le monde peut affronter tout le monde. Sinon, il faut un système « suisse » qui apparie à chaque ronde les joueurs ayant le même nombre de points.
- **Les joueurs ont-ils un classement fiable (Elo) ?** Certains systèmes s'en servent pour répartir les rencontres ; sans classement, d'autres sont plus adaptés.
- **Le spectacle compte-t-il ?** Voir les favoris s'affronter tôt, garder du suspense jusqu'au bout…
- **Faut-il respecter des habitudes ou un règlement ?** Les joueurs habitués aux tournois officiels connaissent surtout le Swiss Dutch.

### Quel système pour quel tournoi ? {#conseils}

| Votre priorité | Notre conseil |
| --- | --- |
| Peu de joueurs (jusqu'à une dizaine) et assez de temps | **Round-robin** : chacun rencontre tout le monde, c'est le classement le plus juste. |
| Le classement le plus juste possible : prix, places qualificatives, catégories | **Swiss Pheng** : le Swiss Dutch habituel avec des [points dégressifs](#pheng). Mêmes appariements que d'habitude, mais un classement nettement plus juste. |
| Un tournoi « classique », comme les joueurs en ont l'habitude | **Swiss Dutch** : la référence actuelle, reconnue par la FIDE (fédération internationale des échecs). |
| Pas de classement Elo, ou des classements peu fiables (e-sport, sport loisir…) | **Swiss Random** ou **Swiss Random 2**, éventuellement avec des points 2,2,1 (voir [points par ronde](#pheng)). |
| Du spectacle : les favoris s'affrontent dès le début | **Monrad**, en sachant que le classement final sera moins fiable. |
| Une rencontre détente, sans enjeu | **Aléatoire** : les adversaires sont tirés au hasard à chaque ronde, sans aucun critère. |

> Pour un tournoi homologué par une fédération, vérifiez ses exigences : SwissEngine n'est pas un logiciel d'appariement homologué.

### Comparer les systèmes en un coup d'œil {#profils}

Chaque système est noté sur 5 selon cinq critères. Plus la surface est grande, plus le système est complet ; le contour pointillé reprend le Swiss Dutch, la référence actuelle, pour comparer.

:::araignees
critères: Classement = Qualité du classement | Jouabilité = Jouabilité pratique | Spectacle | Top 3–5 = Qualification du top 3 à 5 | Catégories = Classer des sous-catégories (jeunes, seniors, féminines…)
référence: Swiss Dutch
* Swiss Pheng (Dutch) | 4 | 4 | 3 | 3,5 | 4
Swiss Dutch | 2,5 | 5 | 3 | 2 | 1,5
Swiss Burstein | 3 | 1 | 2 | 3 | 2
Mixte | 3 | 3,5 | 3 | 3 | 2
Swiss Random | 2 | 3 | 3 | 2 | 1
Swiss Random 2 | 3 | 3 | 3 | 2,5 | 2
Monrad | 0 | 2 | 4 | 1 | 0
Round-robin | 5 | 5 | 2 | 5 | 5
Aléatoire | 0,5 | 2 | 2 | 0 | 0,5
note: Notes attribuées par l'auteur de l'étude, d'après les simulations et l'expérience des tournois. Swiss Random 2 : notes revues après correction du système (voir sa fiche).
:::

### Combien de rondes prévoir ? {#nb-rondes}

Deux repères simples :

- **Minimum** : le nombre de fois qu'on peut diviser le nombre de joueurs par 2. En dessous, plusieurs joueurs risquent de finir avec 100 % des points et le vainqueur ne se distingue pas.
- **Maximum** : moins de la moitié du nombre de joueurs. Au-delà, l'ordinateur peut ne plus trouver d'adversaire inédit pour chacun.

Les systèmes Swiss Dutch et Swiss Burstein donnent de bons résultats entre ce minimum et ce minimum + 3. Ajouter beaucoup de rondes n'améliore pas toujours les choses : l'étude montre qu'avec trop de rondes, le Swiss Dutch devient même moins précis que le système [Aléatoire](#aleatoire), qui apparie les joueurs au hasard sans aucun critère.

{.compact}
| Joueurs | Rondes conseillées |
| --- | --- |
| jusqu'à 10 | Round-robin (tout le monde se rencontre) |
| 11 à 16 | 4 à 6 |
| 17 à 32 | 5 à 7 |
| 33 à 64 | 6 à 9 |
| 65 à 128 | 7 à 9 |

Pour qualifier plusieurs joueurs ou récompenser des catégories, visez plutôt le haut de la fourchette : il faut plus de parties pour bien départager le milieu du classement que pour trouver le seul vainqueur.

### Quel système classe le mieux les joueurs ? (résultats de l'étude) {#comparaison}

L'étude a simulé des dizaines de milliers de tournois où le niveau réel de chaque joueur est connu, puis a mesuré à quel point le classement final ressemble au « vrai » classement par niveau.

Le Swiss Dutch est aujourd'hui la référence. Pour une amélioration conséquente, le plus simple est de garder ses appariements et de changer seulement le nombre de points par ronde : c'est le [Swiss Pheng](#pheng).

:::graphique-justesse
titre: Justesse du classement final — 0 = système Aléatoire (appariements au hasard, sans critère), 100 = round-robin (tout le monde se rencontre)
zéro: système Aléatoire
cent: round-robin
série: | 0.7209 | 0.8898
* Swiss Pheng | 0.8360
Swiss Burstein | 0.8019
Swiss Dutch | 0.7778
Swiss Random 2 | 0.7951
Swiss Random | 0.7642
Mixte | non mesuré
Monrad | 0.6384
note: 10 000 tournois simulés de 32 joueurs en 7 rondes ; points 3-2-1-1-1-1-1 pour le Swiss Pheng. Swiss Random 2 : version corrigée, mesurée avec le même protocole sur 2 000 tournois (0,7669 dans l'étude, avant correction).
:::

Sur le papier, le Burstein fait un peu mieux que le Dutch, mais il est peu agréable en pratique (voir [Swiss Burstein](#burstein)). Le [Swiss Random 2](#swissrandom2), une fois corrigé, se place entre les deux. Le Swiss Pheng fait beaucoup mieux que tous les autres, en gardant les appariements habituels.

Classement des systèmes selon trois objectifs (1 = le meilleur) :

{.compact .center}
| Système | Classement complet | Trouver les 5 meilleurs | Meilleurs d'une catégorie |
| --- | --- | --- | --- |
| Swiss Pheng | 1 | 1 | 1 |
| Swiss Burstein | 2 | 2 | 2 |
| Swiss Random 2 | 3 | 3 | 3 |
| Swiss Dutch | 4 | 5 | 4 |
| Swiss Random | 5 | 4 | 5 |
| Monrad | 6 | 6 | 6 |

> Simulations de tournois de 32 joueurs en 7 rondes. « Meilleurs d'une catégorie » : retrouver les 3 meilleurs d'un groupe représentant environ 15 % des joueurs. Swiss Random 2 : version corrigée (voir sa fiche) ; pour les catégories, son avance sur le Dutch est faible et reste à confirmer.

## 3. Les systèmes un par un {#systemes}

Dans un système **suisse**, personne n'est éliminé : à chaque ronde, on fait jouer ensemble des joueurs qui ont le même nombre de points, sans jamais refaire une partie déjà jouée. Les systèmes suisses ne diffèrent que par *la façon de répartir* les rencontres à l'intérieur d'un même groupe de points. Dans les exemples ci-dessous, 10 joueurs ont le même nombre de points et sont numérotés du plus fort (1) au plus faible (10) selon leur Elo. Le diagramme de chaque système reprend ses notes sur 5 (voir [Comparer les systèmes en un coup d'œil](#profils)).

### Swiss Dutch {#dutch}

On coupe le groupe en deux moitiés et on fait jouer le 1^er^ de la moitié haute contre le 1^er^ de la moitié basse, et ainsi de suite. Les écarts de niveau sont les mêmes à chaque table.

:::appariements
1 – 6, 2 – 7, 3 – 8, 4 – 9, 5 – 10
:::

[[araignee: Swiss Dutch]]

:::points
+ La référence actuelle, reconnue par la FIDE : les joueurs le connaissent.
+ Trouve rapidement le vainqueur.
+ Avec des points dégressifs, il devient le Swiss Pheng et corrige l’essentiel de ses défauts.
- Le milieu du classement est assez aléatoire : beaucoup de joueurs font « le yo-yo » (une victoire, puis un adversaire plus fort, une défaite, puis un plus faible…).
- La dernière ronde pèse très lourd : elle peut faire passer un joueur de la 1re place à loin derrière.
- Avec beaucoup de rondes, il classe moins bien que le système Aléatoire (appariements au hasard, sans critère).
:::

### Swiss Pheng (Swiss Dutch + points dégressifs) {#swiss-pheng}

Les appariements sont exactement ceux du Swiss Dutch ; seule change la valeur d'une victoire, plus forte aux premières rondes qu'aux dernières. Dans SwissEngine : choisissez **Swiss Dutch**, puis renseignez **Points par ronde** dans les paramètres avancés (détails dans [Swiss Pheng : pourquoi faire varier les points ?](#pheng)).

[[araignee: Swiss Pheng (Dutch)]]

:::points
+ Un classement nettement plus juste que le Swiss Dutch et le Swiss Burstein.
+ Rien ne change pour les appariements : les joueurs retrouvent le système qu’ils connaissent.
+ La dernière ronde ne décide plus de tout ; le « gambit suisse » devient bien moins intéressant.
- Il faut prévenir les joueurs : une première ronde à 3 points surprend.
- Barème non officiel : à réserver aux tournois non homologués.
:::

### Swiss Burstein {#burstein}

Le plus fort du groupe joue contre le plus faible, le 2^e^ contre l'avant-dernier, etc.

:::appariements
1 – 10, 2 – 9, 3 – 8, 4 – 7, 5 – 6
:::

[[araignee: Swiss Burstein]]

:::points
+ En théorie, plus précis que le Swiss Dutch dans l’étude.
+ Reconnu par la FIDE.
- Au début, le favori affronte le joueur le plus faible, et cela dure plusieurs rondes : beaucoup de parties sans enjeu.
- En fin de tournoi, le 1er ne rencontre pas forcément le 2e : logique pour éviter que les meilleurs s’éliminent entre eux, mais étrange sportivement.
- Peu motivant pour les moins bien classés.
:::

### Mixte (Swiss Dutch puis Swiss Burstein) {#mixte}

Les 2 premières rondes sont appariées comme en Swiss Dutch, les suivantes comme en Swiss Burstein. L'idée vient des conclusions de l'étude : les premières rondes sont les moins décisives, on peut donc y éviter les écarts extrêmes sans perdre beaucoup de précision. Les rencontres de fin de tournoi restent celles du Burstein (le 1er ne joue pas forcément le 2e) : le [Swiss Pheng](#pheng) est en général un meilleur choix.

[[araignee: Mixte]]

:::points
+ Évite les rencontres « champion contre débutant » dès la première ronde.
+ Garde l’essentiel de la précision du Burstein.
- Variante propre à SwissEngine : pas un système officiel.
- Pas mesuré dans l’étude (on s’attend à des résultats proches du Burstein).
:::

### Monrad {#monrad}

Les joueurs voisins dans le classement jouent ensemble : 1 contre 2, 3 contre 4…

:::appariements
1 – 2, 3 – 4, 5 – 6, 7 – 8, 9 – 10
:::

[[araignee: Monrad]]

:::points
+ Spectaculaire : les favoris s’affrontent dès le début.
+ Parties équilibrées à chaque table.
- Le moins juste de tous dans l’étude : il classe encore moins bien que le système Aléatoire (appariements au hasard, sans critère).
- Surtout utilisé dans les pays nordiques, peu connu ailleurs.
:::

### Swiss Random {#swissrandom}

On respecte les groupes de points, mais à l'intérieur d'un groupe les adversaires sont tirés au sort. Le classement Elo n'intervient pas.

[[araignee: Swiss Random]]

:::points
+ Aucun avantage lié au classement : adapté quand il n’y a pas d’Elo ou qu’il n’est pas fiable.
+ Simple à expliquer.
- Deux favoris peuvent se rencontrer dès la 1re ronde (c’est arrivé à l’Open de l’île de Man 2017) et l’un d’eux est vite hors course.
- Parcours très inégaux d’un joueur à l’autre ; moins précis que Dutch ou Burstein.
- Non reconnu par la FIDE.
:::

### Swiss Random 2 {#swissrandom2}

Un compromis entre Swiss Dutch et Swiss Random : chaque joueur de la moitié haute du groupe affronte un joueur de la moitié basse, tiré au sort.

[[araignee: Swiss Random 2]]

:::points
+ Plus précis que le Swiss Dutch et le Swiss Random, presque autant que le Burstein, en particulier pour trouver les 5 premiers.
+ Évite que deux favoris se rencontrent trop tôt.
- Non reconnu par la FIDE.
- Moins précis que le Burstein.
:::

> La version utilisée dans l'étude ne séparait correctement en deux moitiés que le premier groupe de points : les autres groupes étaient appariés entièrement au hasard. SwissEngine utilise la version corrigée, nettement plus précise. Dans nos simulations (même protocole que l'étude), elle classe mieux que le Swiss Dutch et trouve mieux les 5 premiers, juste derrière le Swiss Burstein : environ 44 sur l'échelle de 0 à 100 de [la comparaison](#comparaison), contre 27 pour l'ancienne version. Les graphiques et tableaux de cette page ont été mis à jour avec la version corrigée.

### Aléatoire {#aleatoire}

Les adversaires sont tirés au hasard à chaque ronde, sans aucun critère : ni les points ni le classement ne comptent (on ne rejoue simplement jamais deux fois le même adversaire). Attention, seuls les appariements sont aléatoires : le classement, lui, est calculé normalement à partir des résultats.

[[araignee: Aléatoire]]

:::points
+ Idéal pour une rencontre conviviale ou un échauffement.
+ Aucune préparation.
- Le classement final est peu fiable : c’est le niveau « zéro » de comparaison dans l’étude.
:::

### Round-robin (toutes rondes) {#roundrobin}

Chaque joueur rencontre tous les autres une fois. Avec *n* joueurs, il faut *n* − 1 rondes (*n* rondes si le nombre est impair, chacun étant exempt une fois). Le calendrier est fixé à l'avance (tables de Berger).

Avec l'option **Aller-retour**, chaque rencontre est jouée deux fois : d'abord toutes les rondes « aller », puis toutes les rondes « retour », dans le même ordre et avec les couleurs inversées. Le nombre de rondes double (2 × (*n* − 1)), et chacun finit avec autant de parties avec les Blancs qu'avec les Noirs.

**En pratique :** une fois les joueurs inscrits, **Générer le calendrier** crée toutes les rondes d'un coup (les inscriptions sont alors closes). Chaque ronde a son onglet ; un résultat est enregistré dès qu'on clique dessus, dans n'importe quelle ronde et dans n'importe quel ordre, et il peut être modifié ou effacé à tout moment. Le classement et la [grille des résultats](#grille-rr) se mettent à jour à chaque saisie, et le compteur « N parties saisies sur M » indique où en est le tournoi. Le tournoi est terminé quand tous les résultats sont saisis ; **Terminer le tournoi** permet aussi de l'arrêter plus tôt (les rondes sans aucun résultat sont alors retirées).

Avec un nombre impair de joueurs, le joueur exempt marque **0 point** : il n'y a pas d'option [Valeur du bye](#opt-bye) en round-robin, puisque chacun est exempt une fois. Un round-robin est limité à **24 joueurs** ; au-delà, choisissez un système suisse.

[[araignee: Round-robin]]

:::points
+ Le classement le plus juste possible : c’est la référence « 100 » de l’étude.
+ Aucun hasard dans les appariements.
- Demande beaucoup de rondes : réservé aux petits groupes (une dizaine de joueurs au plus).
:::

## 4. Comment l'ordinateur fait les appariements {#algorithme}

### Le principe général, en quelques étapes {#algo-general}

1. **Lister toutes les rencontres possibles.** Chaque paire de joueurs qui ne se sont pas encore affrontés est une rencontre possible. Celles qui sont interdites (déjà jouées, ou qui déséquilibreraient trop les couleurs) sont écartées.
2. **Donner une note à chaque rencontre**, d'autant plus haute qu'elle est souhaitable. Le critère principal, de très loin : les deux joueurs ont le même nombre de points. Ensuite, les couleurs : on préfère faire jouer ensemble un joueur qui doit avoir les Blancs et un joueur qui doit avoir les Noirs (voir [les couleurs](#couleurs)). Enfin, la note suit la règle du système choisi (Dutch, Burstein, Monrad…).
3. **Choisir la meilleure combinaison.** L'ordinateur cherche la façon de faire jouer tout le monde en même temps qui donne le meilleur total de notes.
4. **Attribuer les couleurs** (voir ci-dessous) et numéroter les tables : dans les systèmes suisses, les joueurs qui ont le plus de points sont aux premières tables.
5. Après la ronde, mettre à jour les points et recommencer.

### Pourquoi ne pas simplement apparier les joueurs dans l'ordre ? {#algo-pourquoi}

Parce qu'en avançant table par table, on peut se retrouver coincé à la fin : les deux derniers joueurs restants se sont peut-être déjà rencontrés, et il faut alors tout défaire. En regardant *toutes les combinaisons à la fois*, l'ordinateur garantit de trouver la meilleure répartition possible, et non la première venue.

Pour cela, SwissEngine utilise un algorithme classique de recherche de « couplage de poids maximum » (l'algorithme d'Edmonds, dit « des fleurs », 1965), très efficace même avec des centaines de joueurs. C'est la même approche que celle décrite dans les travaux de recherche récents sur le système suisse.

### Comment sont attribuées les couleurs (Blancs / Noirs) ? {#couleurs}

Aux échecs, avoir les Blancs donne un léger avantage : chacun doit donc avoir les Blancs à peu près aussi souvent que les Noirs, et si possible en alternant. SwissEngine s'en occupe à trois moments.

**1. À la première ronde : alternance de table en table.** Comme dans les tournois officiels, le mieux classé de la table 1 reçoit une couleur (tirée au sort par défaut, ou choisie dans [les options](#opt-table1)), celui de la table 2 l'autre couleur, et ainsi de suite. Les premières tables sont ainsi équilibrées, au lieu de dépendre du hasard.

**2. Pendant les appariements : on évite de redonner la même couleur.** Pour chaque joueur, l'ordinateur sait de quelle couleur il a « besoin » :

- celui qui a eu plus souvent les Blancs que les Noirs doit avoir les Noirs, et inversement ;
- à égalité, celui qui vient de jouer avec les Blancs doit plutôt avoir les Noirs, et inversement : les couleurs alternent d'une ronde à l'autre.

Entre deux rencontres possibles avec le même nombre de points, l'ordinateur préfère celle où l'un a besoin des Blancs et l'autre des Noirs. Il ne donne la même couleur deux fois de suite que s'il n'y a pas d'autre solution. La règle du système (Dutch, Burstein…) ne passe qu'après : elle est respectée chaque fois que c'est possible sans gêner les couleurs. Souvent, elle donne d'ailleurs déjà des couleurs alternées et rien ne change ; sinon, l'ordinateur échange en général juste quelques adversaires. Cette étape concerne les systèmes suisses : en aléatoire et en round-robin, seules les étapes 1 et 3 s'appliquent.

**3. Une fois les paires choisies :** celui qui a le plus besoin des Blancs les prend.

Dans nos simulations (tournois de 40 joueurs en 7 rondes, Swiss Dutch), cela divise par plus de trois le nombre de fois où un joueur a deux fois de suite la même couleur, et presque par quatorze les séries de trois. En contrepartie, le classement final est très légèrement moins juste, car le système suit un peu moins sa règle pour éviter les doublons : environ −2 points pour le Swiss Dutch et −4 pour le Swiss Burstein sur l'échelle de 0 à 100 utilisée dans [la comparaison des systèmes](#comparaison).

De plus, deux joueurs qui ont tous les deux eu trop souvent la même couleur ne peuvent pas être appariés ensemble (l'un d'eux en aurait encore une fois de trop). Le seuil est réglé par l'option [Beta](#opt-beta). Pour d'autres jeux, la « couleur » peut représenter le côté du terrain, le premier joueur, le match à domicile…

> L'étude dont sont tirés les résultats de cette page comparait les systèmes en ignorant l'équilibre des couleurs pendant les appariements (seule la règle Beta était appliquée), pour que la comparaison soit équitable. SwissEngine, lui, en tient compte, ce qui coûte quelques points de justesse (voir ci-dessus) : les chiffres de l'étude sont donc un peu optimistes pour une utilisation réelle.

### Et s'il y a un nombre impair de joueurs ? {#impair}

Un joueur est **exempt** à chaque ronde : il ne joue pas et reçoit un nombre de points fixé par l'option [Valeur du bye](#opt-bye) (une demi-victoire par défaut). L'exemption est traitée comme un adversaire fictif qui a toujours 0 point : elle revient donc en général à un joueur du bas du classement, et un même joueur ne peut pas être exempt deux fois. En round-robin, l'exempt est fixé par le calendrier et marque 0 point.

## 5. Les options {#options}

### Nombre de rondes {#opt-rondes}

Le nombre de parties que jouera chaque joueur (voir [Combien de rondes prévoir ?](#nb-rondes)). En round-robin, il n'y a rien à régler : le nombre de rondes est calculé automatiquement pour que chacun rencontre tout le monde (deux fois avec l'option **Aller-retour**).

### Swiss Pheng (points par ronde) : pourquoi faire varier les points ? {#pheng}

Par défaut, une victoire vaut 1 point à chaque ronde. Ce paramètre permet de donner **plus de points aux premières rondes qu'aux dernières**, par exemple 3 points pour une victoire à la ronde 1, 2 à la ronde 2, puis 1 point ensuite. Associé au Swiss Dutch, c'est le **Swiss Pheng**, proposé dans l'étude en lien en bas de page : les appariements restent ceux que les joueurs connaissent, seul le barème change.

Pourquoi ? Dans un système suisse classique :

- perdre la 1^re^ partie n'est pas grave, car on affronte ensuite des adversaires plus faibles. Certains joueurs en profitent même volontairement (le « gambit suisse ») ;
- la dernière partie, elle, est décisive : la gagner ou la perdre fait faire un bond énorme au classement, sans possibilité de « rattrapage » ;
- beaucoup de joueurs font le yo-yo autour de leur vraie place, et leur classement final dépend surtout de leur dernier résultat.

En donnant plus de poids au début, les écarts se creusent tôt, les joueurs se stabilisent plus vite près de leur vrai niveau, et la dernière ronde redevient une ronde parmi d'autres. Résultat dans les simulations en 7 rondes : le Swiss Pheng obtient un score de 68, contre 34 pour le Swiss Dutch classique et 48 pour le Swiss Burstein (voir [la comparaison](#comparaison)). Il est aussi le meilleur pour trouver les premiers et les meilleurs d'une catégorie.

**En pratique :**

- Écrivez les points de chaque ronde séparés par des virgules : `3,2,1` signifie 3 points à la ronde 1, 2 à la ronde 2 et 1 point pour toutes les rondes suivantes (une valeur manquante vaut 1).
- Une nulle rapporte la moitié des points de la ronde à chacun.
- Dans l'étude, la meilleure suite en 7 rondes était `3,2,1`. Plus doux, presque aussi efficace : `2,2,2,1`. Sans classement Elo : `2,2,1`. Des recommandations détaillées pour le Swiss Pheng selon le nombre de rondes seront ajoutées prochainement.
- Gardez des nombres simples (1 à 3) : les joueurs doivent pouvoir suivre le classement facilement.
- Prévenez les joueurs ! Le format a été testé au club d'échecs de l'EPFL en mai 2024 : surprenant au début (« la première ronde vaut 3 points ? »), mais très apprécié.

Laissez le champ vide pour un tournoi classique (1 point par victoire à chaque ronde).

> Masquée en round-robin : chaque victoire y vaut 1 point, à toutes les rondes.

### Valeur du bye {#opt-bye}

Ce que reçoit le joueur exempt, en fraction d'une victoire de la ronde : **½** (par défaut) = une nulle, **1** = une victoire, **0** = rien. La valeur la plus répandue est **1** : c'est la règle par défaut de la FIDE, et la plupart des tournois l'appliquent. L'étude recommande plutôt **½** : l'exempt est souvent un joueur du bas du classement, et une victoire entière le favoriserait trop. Avec des points par ronde, l'exemption suit la valeur de la ronde (½ × 3 = 1,5 point à une ronde qui vaut 3).

> Masquée en round-robin : l'exempt y marque toujours 0 point.

### Beta (contrainte des couleurs) {#opt-beta}

Règle à partir de quand deux joueurs ne peuvent plus être appariés parce qu'ils ont tous les deux trop souvent eu la même couleur. Avec la valeur par défaut, **2**, deux joueurs qui ont chacun eu les Blancs deux fois de plus que les Noirs ne peuvent pas jouer ensemble. C'est le réglage habituel aux échecs.

- **Plus petit (1)** : couleurs très équilibrées, mais moins de choix pour l'ordinateur, donc des rencontres parfois moins bien adaptées aux points.
- **Plus grand** (par exemple 10) : les couleurs ne limitent quasiment plus les appariements. Utile si la couleur n'a pas d'importance dans votre jeu.

> Sans effet en round-robin et en aléatoire (option masquée).

### Couleur à la table 1 (ronde 1) {#opt-table1}

La couleur du joueur le mieux classé de la table 1 à la première ronde : **Blancs**, **Noirs** ou **Aléatoire** (tirage au sort, par défaut). Les couleurs alternent ensuite d'une table à l'autre : avec « Blancs », le mieux classé a les Blancs aux tables 1, 3, 5…, et les Noirs aux tables 2, 4, 6… C'est l'usage dans les tournois d'échecs officiels, où la couleur de la table 1 est tirée au sort avant la première ronde.

Aux rondes suivantes, les couleurs dépendent de ce que chacun a déjà joué (voir [les couleurs](#couleurs)).

### Seeding par Elo (sinon Buchholz) {#opt-seeding}

Dans un groupe de joueurs à égalité de points, il faut un ordre pour appliquer la règle du système (« le 1^er^ contre le dernier », etc.). Coché (par défaut), cet ordre suit le classement **Elo**. Décoché, il suit le **Buchholz tronqué** ([voir départages](#departages)), c'est-à-dire la difficulté des adversaires déjà rencontrés. À la 1^re^ ronde, personne n'a encore d'adversaire : l'ordre d'inscription (par Elo) est alors conservé.

Gardez l'Elo s'il est disponible et fiable : l'étude montre que bien connaître le niveau des joueurs améliore nettement la qualité du classement. Décochez si les classements sont absents ou peu représentatifs.

> Sans effet en round-robin et en aléatoire (option masquée).

## 6. Classement et départages {#classement}

### Comment sont départagés les joueurs à égalité de points ? {#departages}

Dans un tournoi suisse, plusieurs joueurs finissent presque toujours avec le même nombre de points. On les départage par des critères qui mesurent la difficulté de leur parcours :

- **Tr. (Buchholz tronqué)**, 1^er^ critère : la somme des points de tous les adversaires rencontrés, *sauf le plus faible*. Exemple : des adversaires qui ont 4, 2 et 5 points donnent 4 + 5 = 9. On retire le plus faible pour ne pas pénaliser un joueur tombé sur le dernier du tournoi dès la 1^re^ ronde.
- **Buchholz**, 2^e^ critère : la somme des points de tous les adversaires (11 dans l'exemple).
- **Perf. (performance)**, 3^e^ critère : l'Elo correspondant au score obtenu contre ses adversaires (voir [Comment est calculée la performance ?](#performance)).
- Enfin, à égalité parfaite, le joueur qui a eu le plus souvent les Noirs passe devant.

En **round-robin**, tout le monde a les mêmes adversaires : on utilise le **Sonneborn-Berger (S.-B.)**, la somme des points des adversaires battus plus la moitié de ceux des adversaires avec qui on a fait nulle. Battre les meilleurs compte donc davantage. La performance vient ensuite.

### Comment est calculée la performance (Perf.) ? {#performance}

La performance d'un joueur est **l'Elo qu'il aurait fallu avoir pour marquer exactement ce score contre ces adversaires**. Exemple : contre trois adversaires classés 2200, 2100 et 2000, deux victoires et une nulle donnent une performance de 2392 : un joueur classé 2392 marque en moyenne 2½ points contre eux.

Le calcul utilise la formule de probabilité de l'Elo, partie par partie. Il a une propriété simple : **une victoire fait toujours monter la performance**, même contre un adversaire beaucoup plus faible (elle monte alors très peu), et une défaite la fait toujours baisser. Une nulle la fait monter contre un adversaire mieux classé que la performance, et baisser sinon. Ce n'est pas le cas de la méthode « moyenne des adversaires + bonus selon le score » : avec elle, battre un adversaire très faible peut faire baisser la performance de plus de 100 points.

En pratique :

- seules comptent les parties jouées : les exemptions (byes) ne sont pas prises en compte ;
- chaque partie compte pour son résultat (1, ½ ou 0), même si les [points par ronde](#pheng) varient ;
- les adversaires non classés (Elo 0) sont ignorés, ainsi que les parties jouées contre eux ;
- à 100 % ou à 0 % des points, aucune performance finie n'existe : la case reste vide. C'est aussi le cas sans aucun adversaire classé ;
- la performance est arrondie à l'unité. La colonne n'apparaît pas si aucun joueur n'a d'Elo.

La performance sert aussi de dernier départage. Pour une case vide, SwissEngine utilise une valeur interne : la moyenne Elo des adversaires classés + 800 à 100 %, − 800 à 0 %, et 0 sans adversaire classé.

### Que signifie la colonne « Pts » dans les appariements ? {#pts-appariements}

Les points de chaque joueur **avant** la ronde. Ils permettent de vérifier d'un coup d'œil que les joueurs à égalité de points jouent bien ensemble.

### Petit lexique {#glossaire}

:::glossaire
Ronde : Un tour du tournoi, pendant lequel tout le monde joue une partie en même temps.
Appariement : Le choix de qui joue contre qui lors d'une ronde.
Groupe de points : Les joueurs qui ont le même nombre de points à un moment donné.
Elo : Classement qui estime le niveau d'un joueur à partir de ses résultats passés (plus il est élevé, plus le joueur est fort).
Exempt (bye) : Joueur qui ne joue pas une ronde faute d'adversaire (nombre impair).
Forfait : Partie non jouée parce qu'un joueur (ou les deux) ne s'est pas présenté. Notée 1-F, F-1 ou F-F.
Départage : Critère qui sépare les joueurs à égalité de points.
Performance (Perf.) : L'Elo qu'il aurait fallu avoir pour marquer exactement son score contre ses adversaires du tournoi.
Grille américaine : Tableau récapitulatif de tous les résultats, une ligne par joueur.
Gambit suisse : Stratégie qui consiste à perdre (ou annuler) au début pour affronter des adversaires plus faibles ensuite.
:::

## 7. Autres questions {#autres}

### Puis-je utiliser SwissEngine pour autre chose que les échecs ? {#autres-sports}

Oui : e-sport, jeux de société, tennis de table, badminton, concours de débat… Tout jeu à deux où toutes les parties d'une ronde peuvent se jouer en même temps. Sans classement de niveau, mettez 0 comme Elo et préférez **Swiss Random 2**. Si la notion de couleur ou de côté n'a pas d'importance, augmentez [Beta](#opt-beta). L'option [club / équipe](#club) permet d'afficher l'équipe de chaque participant.

### Un joueur est absent, abandonne ou arrive en retard : que faire ? {#abandon}

Tout se gère dans la carte **Joueurs** (systèmes suisses et Aléatoire). Les absences peuvent être déclarées dès la ronde 1 ; le retrait et l'arrivée en cours de tournoi apparaissent une fois le tournoi commencé. En résumé :

- **Absent à une ronde** : choisissez « Absent (0) » ou « Absent (½) » à côté de son nom, *avant* de générer la ronde (voir [Que signifie « Absent » ?](#absent)).
- **Abandon** : bouton **Retrait** (voir [Que fait le bouton « Retrait » ?](#retrait)).
- **Arrivée en retard** : formulaire **Arrivée en cours de tournoi** (voir [Comment inscrire un retardataire ?](#retard)).
- **Joueur apparié qui ne vient pas** : saisissez un [forfait](#forfaits) pour sa partie, ou annulez les appariements de la ronde, déclarez-le absent et générez à nouveau.

En round-robin, le calendrier est fixe : une partie qui n'a pas lieu se saisit comme un forfait.

### Que signifie « Absent » ? Pourquoi 0 ou ½ point ? {#absent}

Un joueur **absent** ne joue pas la ronde : il n'est pas apparié, et les autres joueurs sont appariés entre eux comme s'il n'existait pas pour cette ronde. Il garde sa place dans le tournoi et sera apparié normalement à la ronde suivante : une absence ne vaut que pour **une ronde**. Elle se déclare avant de générer la ronde ; la ligne « Ronde N » en haut de la carte indique pour quelle ronde.

Le choix entre 0 et ½ point dépend du règlement de votre tournoi :

- **Absent (0)** : le joueur ne marque rien. C'est le choix par défaut, en particulier pour une absence non prévenue.
- **Absent (½)** : le joueur marque la moitié des points de la ronde, comme une nulle. Aux échecs, de nombreux tournois accordent ce « bye demandé » à un joueur qui prévient à l'avance qu'il ne pourra pas jouer une ronde, souvent avec une limite (par exemple une seule fois par tournoi, et pas aux dernières rondes). SwissEngine ne fixe pas de limite : c'est à vous d'appliquer votre règlement.

Une absence n'est pas une exemption : elle n'empêche pas le joueur d'être exempt plus tard, et si le nombre de joueurs présents est impair, un autre joueur est exempt comme d'habitude.

Oubli de déclarer une absence ? Si la ronde est déjà générée, saisissez un forfait pour la partie du joueur absent (son adversaire gagne), ou cliquez sur **Annuler les appariements** : les absences déjà déclarées sont conservées, il suffit d'ajouter l'oubli et de générer à nouveau.

### Que fait le bouton « Retrait » ? {#retrait}

**Retrait** sert quand un joueur quitte définitivement le tournoi. Il n'est plus apparié à partir de la ronde suivante et marque 0 point à chaque ronde restante. Il reste dans le classement, avec la mention « retiré », et ses parties déjà jouées restent valables pour lui comme pour ses adversaires.

- Si le joueur se retire pendant une ronde, sa partie de cette ronde doit quand même recevoir un résultat : un forfait si elle n'est pas jouée.
- Le retrait peut être annulé avec **Réintégrer** : le joueur est de nouveau apparié à partir de la ronde suivante, et les rondes manquées comptent comme des absences à 0 point.
- À ne pas confondre avec la croix qui **supprime** un joueur de la liste : elle n'existe qu'avant la première ronde, pour un joueur inscrit par erreur.

### Comment inscrire un retardataire ? {#retard}

Avec le formulaire **Arrivée en cours de tournoi** de la carte Joueurs. Le joueur est apparié à partir de la ronde suivante ; chaque ronde qu'il a manquée compte comme une absence, à 0 ou ½ point selon votre choix (le même pour toutes ses rondes manquées).

Si une ronde est en cours, le joueur est mis en attente et inscrit à la validation de ses résultats : cette ronde compte alors aussi comme manquée. L'inscription en attente peut être annulée. Aucune arrivée n'est possible pendant la dernière ronde, puisque le joueur ne pourrait plus jouer.

Si vous savez dès le départ qu'un joueur arrivera en retard, vous pouvez aussi l'inscrire normalement et le déclarer absent aux premières rondes : le résultat est le même.

### Absences, retraits, retards : ce qu'il faut savoir {#absences-impacts}

- **Classement** : les points d'une absence (0 ou ½) comptent comme les autres. Avec ½, le joueur est apparié ensuite avec les joueurs de son nouveau total de points.
- **Buchholz** : une ronde non jouée (absence, retrait, ronde manquée par un retardataire, exemption) compte comme un adversaire à 0 point. Elle fait donc baisser le Buchholz du joueur absent. Le Buchholz tronqué (Tr.) retire la plus petite contribution : avec une seule ronde non jouée, c'est elle qui est retirée à la place de l'adversaire le plus faible, ce qui pénalise peu ; à partir de la deuxième, la pénalité est réelle. Pour ses adversaires, le joueur absent compte simplement avec son score final, points d'absence compris.
- **Couleurs et performance** : une ronde non jouée ne change ni l'équilibre des couleurs ni la [performance](#performance), calculée sur les parties jouées.
- **Appariements** : avec beaucoup d'absents, les joueurs présents se sont plus vite tous rencontrés. Si aucun appariement complet n'existe, rien n'est enregistré et un message l'indique : vous pouvez modifier les absences ou terminer le tournoi. Si cela arrive à la première ronde, le tournoi ne démarre pas et les inscriptions restent ouvertes.
- **Grille américaine** : `ABS` = absent (`ABS ½` avec ½ point), `OUT` = retiré.
- **Revenir en arrière** : annuler des appariements ou revenir à une ronde précédente conserve les absences déclarées pour la ronde à refaire, les retraits et les retardataires.

### Comment saisir un forfait ? {#forfaits}

À côté des boutons de résultat, le menu **Forfait…** propose :

- **1-F** : les Noirs ne se sont pas présentés, les Blancs gagnent la partie ;
- **F-1** : les Blancs ne se sont pas présentés, les Noirs gagnent ;
- **F-F** : double forfait, aucun des deux ne marque.

Un forfait rapporte les points d'une victoire au joueur présent. La partie n'ayant pas été jouée, elle ne compte pas pour les couleurs ni pour la [performance](#performance). Pour le reste, elle compte comme une rencontre : les deux joueurs ne seront plus appariés ensemble, et chacun compte l'autre dans son Buchholz. Dans la grille américaine, un forfait s'écrit avec un F à la place de la couleur (`+5F`).

### Peut-on « tricher » en perdant exprès au début ? {#gambit}

C'est le « gambit suisse » : perdre une partie au début pour affronter des adversaires plus faibles ensuite. Les recherches montrent que la stratégie n'est pas toujours payante, et les départages (Buchholz) la limitent. Les [points dégressifs](#pheng) la rendent encore moins intéressante : une défaite à la 1^re^ ronde coûte alors beaucoup plus cher.

## 8. Pour aller plus loin {#aller-plus-loin}

Les explications et les chiffres de cette page sont tirés du mémoire de master *Improving the Swiss Pairing System* (Wissam Nael Pheng, EPFL, 2024, en anglais) : histoire du système suisse, modélisation, méthode de simulation et résultats détaillés.

[[pdf: Consulter le rapport (PDF)]]
