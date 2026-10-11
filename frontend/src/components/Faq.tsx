// FAQ & documentation tab.
// Written for organisers and players, not mathematicians. Figures come from
// the study "Improving the Swiss Pairing System" (W. N. Pheng, EPFL, 2024),
// available as a PDF at the end of the page.

import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

const PDF_URL = `${import.meta.env.BASE_URL}Pheng_New_Pairing_System.pdf`

interface Props {
  /** id of a section or question to open and scroll to */
  anchor?: string | null
}

function Q({ id, q, children }: { id: string; q: string; children: ReactNode }) {
  return (
    <details className="faq-q" id={id}>
      <summary>{q}</summary>
      <div className="faq-a">{children}</div>
    </details>
  )
}

function ProsCons({ pros, cons }: { pros: string[]; cons: string[] }) {
  return (
    <div className="pros-cons">
      <div>
        <div className="pc-title pc-pros">Points forts</div>
        <ul>
          {pros.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </div>
      <div>
        <div className="pc-title pc-cons">Points faibles</div>
        <ul>
          {cons.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** "1 contre 10" style example of who meets whom in a group of 10 players */
function PairingExample({ pairs }: { pairs: string[] }) {
  return (
    <div className="pairing-example" aria-label="Exemple d'appariements">
      {pairs.map((p) => (
        <span key={p} className="pe-chip">
          {p}
        </span>
      ))}
    </div>
  )
}

// Ranking quality, 10 000 simulated tournaments (32 players, 7 rounds).
// Kendall tau-b rescaled: 0 = random pairings (0.7209), 100 = round-robin (0.8898).
const QUALITY = [
  { name: 'Swiss Burstein + points 3-2-1-1-1-1-1 (Pheng)', tau: 0.836, highlight: true },
  { name: 'Swiss Burstein', tau: 0.8019 },
  { name: 'Swiss Dutch', tau: 0.7778 },
  { name: 'Swiss Random 2', tau: 0.7669 },
  { name: 'Swiss Random', tau: 0.7642 },
  { name: 'Monrad', tau: 0.6384 },
]
const TAU_RANDOM = 0.7209
const TAU_RR = 0.8898
const SCALE_MIN = -60
const SCALE_MAX = 108

function QualityChart() {
  const pct = (v: number) => ((v - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100
  const zero = pct(0)
  return (
    <figure className="quality-chart">
      <figcaption>
        Justesse du classement final — 0 = appariements tirés au hasard, 100 = round-robin (tout le
        monde se rencontre)
      </figcaption>
      <div className="qc-rows">
        {QUALITY.map((row) => {
          const score = Math.round(((row.tau - TAU_RANDOM) / (TAU_RR - TAU_RANDOM)) * 100)
          const left = score >= 0 ? zero : pct(score)
          const width = Math.abs(pct(score) - zero)
          return (
            <div
              className="qc-row"
              key={row.name}
              title={`${row.name} : ${score} (Kendall τb = ${row.tau})`}
            >
              <div className="qc-label">{row.name}</div>
              <div className="qc-track">
                <div className="qc-zero" style={{ left: `${zero}%` }} />
                <div className="qc-hundred" style={{ left: `${pct(100)}%` }} />
                <div
                  className={`qc-bar${row.highlight ? ' hl' : ''}${score < 0 ? ' neg' : ''}`}
                  style={{ left: `${left}%`, width: `${width}%` }}
                />
              </div>
              <div className="qc-value">{score}</div>
            </div>
          )
        })}
      </div>
      <div className="qc-axis">
        <span style={{ left: `${pct(0)}%` }}>0 · hasard</span>
        <span className="qc-axis-end" style={{ left: `${pct(100)}%` }}>
          100 · round-robin
        </span>
      </div>
      <p className="hint">
        10 000 tournois simulés de 32 joueurs en 7 rondes. Un score négatif signifie « moins juste
        qu'un tirage au sort ». Le système Mixte n'a pas été mesuré dans l'étude.
      </p>
    </figure>
  )
}

export function Faq({ anchor }: Props) {
  const root = useRef<HTMLDivElement>(null)

  // Open and scroll to the requested section / question
  useEffect(() => {
    if (!anchor) {
      window.scrollTo({ top: 0 })
      return
    }
    const el = document.getElementById(anchor)
    if (!el) return
    if (el instanceof HTMLDetailsElement) el.open = true
    el.querySelectorAll('details').forEach((d) => {
      if (d.dataset.autoOpen === 'true') d.open = true
    })
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [anchor])

  function toggleAll(open: boolean) {
    root.current?.querySelectorAll<HTMLDetailsElement>('details.faq-q').forEach((d) => {
      d.open = open
    })
  }

  return (
    <div className="faq" ref={root}>
      <div className="card faq-intro">
        <h2>FAQ &amp; documentation</h2>
        <p>
          SwissEngine organise des tournois en plusieurs rondes : échecs, e-sport, jeux de
          société, sports de raquette… Cette page explique comment utiliser l'outil, comment
          choisir le bon système et comment fonctionnent les appariements, sans jargon
          mathématique.
        </p>
        <nav className="faq-toc" aria-label="Sommaire">
          <a href="#utiliser">1. Utiliser SwissEngine</a>
          <a href="#choisir">2. Choisir un système</a>
          <a href="#systemes">3. Les systèmes un par un</a>
          <a href="#algorithme">4. Comment l'ordinateur fait les appariements</a>
          <a href="#options">5. Les options</a>
          <a href="#classement">6. Classement et départages</a>
          <a href="#autres">7. Autres questions</a>
          <a href="#aller-plus-loin">8. Pour aller plus loin</a>
        </nav>
        <div className="actions">
          <button className="secondary" onClick={() => toggleAll(true)}>
            Tout déplier
          </button>
          <button className="secondary" onClick={() => toggleAll(false)}>
            Tout replier
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------ 1 */}
      <section className="card faq-section" id="utiliser">
        <h2>1. Utiliser SwissEngine</h2>

        <Q id="etapes" q="Comment organiser un tournoi, étape par étape ?">
          <ol className="steps">
            <li>
              <b>Créer le tournoi.</b> Dans l'onglet « Tournoi », donnez un nom, choisissez le
              système (voir <a href="#choisir">Choisir un système</a>) et le nombre de rondes,
              puis cliquez sur <b>Créer</b>. Les réglages fins sont dans{' '}
              <a href="#options">Paramètres avancés</a>.
            </li>
            <li>
              <b>Inscrire les joueurs.</b> Saisissez le nom et l'Elo (classement) de chaque
              joueur, puis cliquez sur <b>Enregistrer N joueur(s)</b>. Pas d'Elo ? Mettez 0.
              Vous pouvez inscrire des joueurs jusqu'à la génération de la première ronde.
            </li>
            <li>
              <b>Enregistrer le tournoi</b> (recommandé) : bouton <b>Enregistrer…</b> en haut,
              choisissez un dossier. Ensuite tout est sauvegardé automatiquement.
            </li>
            <li>
              <b>Générer la ronde.</b> SwissEngine affiche qui joue contre qui, à quelle table et
              avec quelle couleur, ainsi que l'Elo et les points de chaque joueur avant la ronde.
              Le bouton <b>Imprimer</b> produit une feuille à afficher dans la salle.
            </li>
            <li>
              <b>Saisir les résultats</b> (1-0, ½-½, 0-1) puis <b>Valider les résultats</b>. Le
              classement et la grille américaine se mettent à jour.
            </li>
            <li>Recommencez à l'étape 4 jusqu'à la dernière ronde.</li>
          </ol>
        </Q>

        <Q id="sauvegarde" q="Comment sont sauvegardés mes tournois ? Que faire en cas de coupure ?">
          <p>
            Après un premier <b>Enregistrer…</b>, chaque action (inscription, appariements,
            résultats) est immédiatement écrite dans le dossier choisi. En cas de coupure de
            courant, de fermeture du navigateur ou de plantage, rien n'est perdu.
          </p>
          <p>
            Pour reprendre : onglet « Tournoi » → <b>Ouvrir un tournoi</b>. Le tournoi apparaît
            dans la liste des <i>récents</i>, ou retrouvez-le avec <b>Parcourir les dossiers…</b>
            . Vous pouvez aussi importer un fichier <code>.json</code> obtenu avec{' '}
            <b>Télécharger (.json)</b> (pratique pour envoyer un tournoi à quelqu'un).
          </p>
          <p>Le dossier d'un tournoi contient :</p>
          <ul>
            <li>
              <code>tournoi.json</code> : l'état complet du tournoi, celui qui est relu à
              l'ouverture (et <code>tournoi.precedent.json</code>, la version d'avant, par
              sécurité) ;
            </li>
            <li>
              <code>joueurs.csv</code> : la liste des inscrits ;
            </li>
            <li>
              <code>rondes/</code> : pour chaque ronde, les appariements et la grille américaine,
              en HTML (à ouvrir et imprimer) et en CSV (à ouvrir dans Excel ou LibreOffice).
            </li>
          </ul>
          <p>
            Tout reste sur votre ordinateur : rien n'est envoyé sur internet.
          </p>
        </Q>

        <Q id="erreur" q="Je me suis trompé dans un résultat. Comment corriger ?">
          <p>
            <b>Ronde en cours :</b> changez simplement le résultat dans la liste avant de valider.
          </p>
          <p>
            <b>Ronde déjà validée :</b> cliquez sur <b>Corriger la ronde N</b> (à côté des
            appariements), ou allez dans <b>Rondes jouées</b> → choisissez la ronde →{' '}
            <b>Modifier les résultats</b>. Si les rondes suivantes existent déjà, deux choix
            s'offrent à vous :
          </p>
          <ul>
            <li>
              <b>Les conserver</b> : les parties déjà annoncées ou jouées restent identiques, seuls
              les scores et le classement sont recalculés. C'est le bon choix si la ronde suivante
              a déjà commencé.
            </li>
            <li>
              <b>Les annuler</b> : les appariements suivants sont refaits avec les scores
              corrigés. C'est le plus juste si personne n'a encore joué.
            </li>
          </ul>
          <p>
            <b>Refaire les appariements</b> de la ronde en cours : <b>Annuler les appariements</b>
            , puis générez à nouveau. <b>Revenir en arrière</b> de plusieurs rondes :{' '}
            <b>Rondes jouées</b> → <b>Revenir à la fin de cette ronde</b> (les fichiers des
            rondes annulées sont rangés dans un sous-dossier <code>archives</code>, pas
            supprimés).
          </p>
        </Q>

        <Q id="imprimer" q="Comment imprimer les appariements, les résultats ou la grille ?">
          <p>
            Chaque tableau a un bouton <b>Imprimer</b> qui ouvre une page prête à imprimer (format
            A4, paysage automatiquement si la grille est large). Les mêmes pages sont aussi
            enregistrées dans le dossier <code>rondes</code> du tournoi, pour chaque ronde :
            pratique pour réimprimer plus tard ou les envoyer par e-mail.
          </p>
        </Q>

        <Q id="lire-grille" q="Comment lire la grille américaine ?">
          <p>
            La grille américaine résume tout le tournoi sur une page : une ligne par joueur, dans
            l'ordre du classement, et une colonne par ronde. Une case comme <code>+5N</code> se
            lit :
          </p>
          <ul>
            <li>
              <code>+</code> : victoire (<code>=</code> nulle, <code>−</code> défaite) ;
            </li>
            <li>
              <code>5</code> : contre le joueur classé 5<sup>e</sup> ;
            </li>
            <li>
              <code>N</code> : avec les Noirs (<code>B</code> = Blancs).
            </li>
          </ul>
          <p>
            <code>EXE</code> signifie « exempt » : le joueur n'a pas joué cette ronde (nombre
            impair de joueurs). Dans l'application, cliquez sur un joueur pour surligner ses
            adversaires. Vous pouvez afficher la grille après n'importe quelle ronde.
          </p>
        </Q>

        <Q id="club" q="À quoi sert « Afficher club / équipe » ?">
          <p>
            Cette option ajoute un champ facultatif « club / équipe » à chaque joueur, affiché
            dans le classement, la grille et les fichiers exportés. Elle n'a aucun effet sur les
            appariements. Vous pouvez l'activer ou la désactiver à tout moment, et compléter les
            clubs même pendant le tournoi.
          </p>
        </Q>
      </section>

      {/* ------------------------------------------------------------ 2 */}
      <section className="card faq-section" id="choisir">
        <h2>2. Choisir un système</h2>

        <Q id="questions" q="Quelles questions se poser avant de choisir ?">
          <ul>
            <li>
              <b>Quel est l'objectif ?</b> Désigner un vainqueur, obtenir un classement juste du
              premier au dernier, qualifier les <i>k</i> premiers pour une autre compétition,
              récompenser des catégories (jeunes, féminines, tranches d'Elo…), ou simplement
              passer un bon moment ?
            </li>
            <li>
              <b>Combien de joueurs, combien de temps ?</b> Avec peu de joueurs et assez de temps,
              tout le monde peut affronter tout le monde. Sinon, il faut un système « suisse » qui
              apparie à chaque ronde les joueurs ayant le même nombre de points.
            </li>
            <li>
              <b>Les joueurs ont-ils un classement fiable (Elo) ?</b> Certains systèmes s'en
              servent pour répartir les rencontres ; sans classement, d'autres sont plus adaptés.
            </li>
            <li>
              <b>Le spectacle compte-t-il ?</b> Voir les favoris s'affronter tôt, garder du
              suspense jusqu'au bout…
            </li>
            <li>
              <b>Faut-il respecter des habitudes ou un règlement ?</b> Les joueurs habitués aux
              tournois officiels connaissent surtout le système hollandais (Dutch).
            </li>
          </ul>
        </Q>

        <Q id="conseils" q="Quel système pour quel tournoi ?">
          <div className="table-scroll">
            <table className="advice">
              <thead>
                <tr>
                  <th>Votre priorité</th>
                  <th>Notre conseil</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Peu de joueurs (jusqu'à une dizaine) et assez de temps</td>
                  <td>
                    <b>Round-robin</b> : chacun rencontre tout le monde, c'est le classement le
                    plus juste.
                  </td>
                </tr>
                <tr>
                  <td>
                    Le classement le plus juste possible : prix, places qualificatives, catégories
                  </td>
                  <td>
                    <b>Swiss Burstein</b> avec des <a href="#pheng">points dégressifs</a> (par
                    exemple 3,2,1). C'est la combinaison la plus précise mesurée dans l'étude.
                  </td>
                </tr>
                <tr>
                  <td>Un tournoi « classique », comme les joueurs en ont l'habitude</td>
                  <td>
                    <b>Swiss Dutch</b> : le plus répandu, reconnu par la FIDE (fédération
                    internationale des échecs).
                  </td>
                </tr>
                <tr>
                  <td>Éviter les rencontres très déséquilibrées en début de tournoi</td>
                  <td>
                    <b>Mixte</b> : Swiss Dutch pendant 2 rondes, puis Swiss Burstein.
                  </td>
                </tr>
                <tr>
                  <td>Pas de classement Elo, ou des classements peu fiables (e-sport, sport loisir…)</td>
                  <td>
                    <b>Swiss Random</b> ou <b>Swiss Random 2</b>, éventuellement avec des points
                    2,2,1 (voir <a href="#pheng">points par ronde</a>).
                  </td>
                </tr>
                <tr>
                  <td>Du spectacle : les favoris s'affrontent dès le début</td>
                  <td>
                    <b>Monrad</b>, en sachant que le classement final sera moins fiable.
                  </td>
                </tr>
                <tr>
                  <td>Une rencontre détente, sans enjeu</td>
                  <td>
                    <b>Aléatoire</b> : tirage au sort complet à chaque ronde.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="hint">
            Pour un tournoi homologué par une fédération, vérifiez ses exigences : SwissEngine
            n'est pas un logiciel d'appariement homologué.
          </p>
        </Q>

        <Q id="nb-rondes" q="Combien de rondes prévoir ?">
          <p>Deux repères simples :</p>
          <ul>
            <li>
              <b>Minimum</b> : le nombre de fois qu'on peut diviser le nombre de joueurs par 2.
              En dessous, plusieurs joueurs risquent de finir avec 100 % des points et le
              vainqueur ne se distingue pas.
            </li>
            <li>
              <b>Maximum</b> : moins de la moitié du nombre de joueurs. Au-delà, l'ordinateur
              peut ne plus trouver d'adversaire inédit pour chacun.
            </li>
          </ul>
          <p>
            Les systèmes Swiss Dutch et Swiss Burstein donnent de bons résultats entre ce minimum
            et ce minimum + 3. Ajouter beaucoup de rondes n'améliore pas toujours les choses :
            l'étude montre qu'avec trop de rondes, le système hollandais devient même moins
            précis qu'un tirage au sort.
          </p>
          <div className="table-scroll">
            <table className="advice compact">
              <thead>
                <tr>
                  <th>Joueurs</th>
                  <th>Rondes conseillées</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>jusqu'à 10</td>
                  <td>Round-robin (tout le monde se rencontre)</td>
                </tr>
                <tr>
                  <td>11 à 16</td>
                  <td>4 à 6</td>
                </tr>
                <tr>
                  <td>17 à 32</td>
                  <td>5 à 7</td>
                </tr>
                <tr>
                  <td>33 à 64</td>
                  <td>6 à 9</td>
                </tr>
                <tr>
                  <td>65 à 128</td>
                  <td>7 à 9</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Pour qualifier plusieurs joueurs ou récompenser des catégories, visez plutôt le haut
            de la fourchette : il faut plus de parties pour bien départager le milieu du
            classement que pour trouver le seul vainqueur.
          </p>
        </Q>

        <Q id="comparaison" q="Quel système classe le mieux les joueurs ? (résultats de l'étude)">
          <p>
            L'étude a simulé des dizaines de milliers de tournois où le niveau réel de chaque
            joueur est connu, puis a mesuré à quel point le classement final ressemble au « vrai »
            classement par niveau.
          </p>
          <QualityChart />
          <p>Classement des systèmes selon trois objectifs (1 = le meilleur) :</p>
          <div className="table-scroll">
            <table className="advice compact center">
              <thead>
                <tr>
                  <th>Système</th>
                  <th>Classement complet</th>
                  <th>Trouver les 5 meilleurs</th>
                  <th>Meilleurs d'une catégorie</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Swiss Burstein + points dégressifs (Pheng)</td>
                  <td>1</td>
                  <td>1</td>
                  <td>1</td>
                </tr>
                <tr>
                  <td>Swiss Burstein</td>
                  <td>2</td>
                  <td>2</td>
                  <td>2</td>
                </tr>
                <tr>
                  <td>Swiss Dutch</td>
                  <td>3</td>
                  <td>5</td>
                  <td>3</td>
                </tr>
                <tr>
                  <td>Swiss Random 2</td>
                  <td>4</td>
                  <td>3</td>
                  <td>4</td>
                </tr>
                <tr>
                  <td>Swiss Random</td>
                  <td>5</td>
                  <td>4</td>
                  <td>5</td>
                </tr>
                <tr>
                  <td>Monrad</td>
                  <td>6</td>
                  <td>6</td>
                  <td>6</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="hint">
            Simulations de tournois de 32 joueurs en 7 rondes. « Meilleurs d'une catégorie » :
            retrouver les 3 meilleurs d'un groupe représentant environ 20 % des joueurs.
          </p>
        </Q>
      </section>

      {/* ------------------------------------------------------------ 3 */}
      <section className="card faq-section" id="systemes">
        <h2>3. Les systèmes un par un</h2>
        <p>
          Dans un système <b>suisse</b>, personne n'est éliminé : à chaque ronde, on fait jouer
          ensemble des joueurs qui ont le même nombre de points, sans jamais refaire une partie
          déjà jouée. Les systèmes suisses ne diffèrent que par <i>la façon de répartir</i> les
          rencontres à l'intérieur d'un même groupe de points. Dans les exemples ci-dessous, 10
          joueurs ont le même nombre de points et sont numérotés du plus fort (1) au plus faible
          (10) selon leur Elo.
        </p>

        <Q id="dutch" q="Swiss Dutch (système hollandais)">
          <p>
            On coupe le groupe en deux moitiés et on fait jouer le 1<sup>er</sup> de la moitié
            haute contre le 1<sup>er</sup> de la moitié basse, et ainsi de suite. Les écarts de
            niveau sont les mêmes à chaque table.
          </p>
          <PairingExample pairs={['1 – 6', '2 – 7', '3 – 8', '4 – 9', '5 – 10']} />
          <ProsCons
            pros={[
              'Le plus utilisé au monde et reconnu par la FIDE : les joueurs le connaissent.',
              'Trouve rapidement le vainqueur.',
            ]}
            cons={[
              "Le milieu du classement est assez aléatoire : beaucoup de joueurs font « le yo-yo » (une victoire, puis un adversaire plus fort, une défaite, puis un plus faible…).",
              'La dernière ronde pèse très lourd : elle peut faire passer un joueur de la 1re place à loin derrière.',
              'Avec beaucoup de rondes, il devient moins précis qu’un simple tirage au sort.',
            ]}
          />
        </Q>

        <Q id="burstein" q="Swiss Burstein">
          <p>
            Le plus fort du groupe joue contre le plus faible, le 2<sup>e</sup> contre l'avant-dernier,
            etc.
          </p>
          <PairingExample pairs={['1 – 10', '2 – 9', '3 – 8', '4 – 7', '5 – 6']} />
          <ProsCons
            pros={[
              'Le plus précis des systèmes classiques dans l’étude, pour tous les objectifs (vainqueur, premiers, catégories).',
              'Reconnu par la FIDE.',
            ]}
            cons={[
              'Les favoris affrontent les joueurs les plus faibles : parties très déséquilibrées en début de tournoi.',
              'Avantage les mieux classés, qui ont des adversaires plus faibles au début : peut sembler injuste, et peu motivant pour les moins bien classés.',
            ]}
          />
        </Q>

        <Q id="mixte" q="Mixte (Swiss Dutch puis Swiss Burstein)">
          <p>
            Les 2 premières rondes sont appariées comme en Swiss Dutch, les suivantes comme en
            Swiss Burstein. L'idée vient des conclusions de l'étude : les premières rondes sont les
            moins décisives, on peut donc y éviter les écarts extrêmes sans perdre beaucoup de
            précision, puis profiter de la justesse du Burstein.
          </p>
          <ProsCons
            pros={[
              'Évite les rencontres « champion contre débutant » dès la première ronde.',
              'Garde l’essentiel de la précision du Burstein.',
            ]}
            cons={[
              'Variante propre à SwissEngine : pas un système officiel.',
              'Pas mesuré dans l’étude (on s’attend à des résultats proches du Burstein).',
            ]}
          />
        </Q>

        <Q id="monrad" q="Monrad">
          <p>Les joueurs voisins dans le classement jouent ensemble : 1 contre 2, 3 contre 4…</p>
          <PairingExample pairs={['1 – 2', '3 – 4', '5 – 6', '7 – 8', '9 – 10']} />
          <ProsCons
            pros={[
              'Spectaculaire : les favoris s’affrontent dès le début.',
              'Parties équilibrées à chaque table.',
            ]}
            cons={[
              'Le moins juste de tous dans l’étude, encore moins qu’un tirage au sort.',
              'Surtout utilisé dans les pays nordiques, peu connu ailleurs.',
            ]}
          />
        </Q>

        <Q id="swissrandom" q="Swiss Random">
          <p>
            On respecte les groupes de points, mais à l'intérieur d'un groupe les adversaires sont
            tirés au sort. Le classement Elo n'intervient pas.
          </p>
          <ProsCons
            pros={[
              'Aucun avantage lié au classement : adapté quand il n’y a pas d’Elo ou qu’il n’est pas fiable.',
              'Simple à expliquer.',
            ]}
            cons={[
              'Deux favoris peuvent se rencontrer dès la 1re ronde (c’est arrivé à l’Open de l’île de Man 2017) et l’un d’eux est vite hors course.',
              'Parcours très inégaux d’un joueur à l’autre ; moins précis que Dutch ou Burstein.',
              'Non reconnu par la FIDE.',
            ]}
          />
        </Q>

        <Q id="swissrandom2" q="Swiss Random 2">
          <p>
            Un compromis entre Swiss Dutch et Swiss Random : chaque joueur de la moitié haute du
            groupe affronte un joueur de la moitié basse, tiré au sort.
          </p>
          <ProsCons
            pros={[
              'Légèrement plus précis que le Swiss Random, et meilleur que le Dutch pour trouver les 5 premiers.',
              'Évite que deux favoris se rencontrent trop tôt.',
            ]}
            cons={['Non reconnu par la FIDE.', 'Moins précis que le Burstein.']}
          />
        </Q>

        <Q id="aleatoire" q="Aléatoire">
          <p>
            Tirage au sort complet à chaque ronde, sans tenir compte des points (on ne rejoue
            simplement jamais deux fois le même adversaire).
          </p>
          <ProsCons
            pros={['Idéal pour une rencontre conviviale ou un échauffement.', 'Aucune préparation.']}
            cons={[
              'Le classement final est peu fiable : c’est le niveau « zéro » de comparaison dans l’étude.',
            ]}
          />
        </Q>

        <Q id="roundrobin" q="Round-robin (toutes rondes)">
          <p>
            Chaque joueur rencontre tous les autres une fois. Avec <i>n</i> joueurs, il faut{' '}
            <i>n</i> − 1 rondes (<i>n</i> rondes si le nombre est impair, chacun étant exempt
            une fois). Le calendrier est fixé à l'avance (tables de Berger).
          </p>
          <ProsCons
            pros={[
              'Le classement le plus juste possible : c’est la référence « 100 » de l’étude.',
              'Aucun hasard dans les appariements.',
            ]}
            cons={[
              'Demande beaucoup de rondes : réservé aux petits groupes (une dizaine de joueurs au plus).',
            ]}
          />
        </Q>
      </section>

      {/* ------------------------------------------------------------ 4 */}
      <section className="card faq-section" id="algorithme">
        <h2>4. Comment l'ordinateur fait les appariements</h2>

        <Q id="algo-general" q="Le principe général, en quelques étapes">
          <ol className="steps">
            <li>
              <b>Lister toutes les rencontres possibles.</b> Chaque paire de joueurs qui ne se
              sont pas encore affrontés est une rencontre possible. Celles qui sont interdites
              (déjà jouées, ou qui déséquilibreraient trop les couleurs) sont écartées.
            </li>
            <li>
              <b>Donner une note à chaque rencontre</b>, d'autant plus haute qu'elle est
              souhaitable. Le critère principal, de très loin : les deux joueurs ont le même
              nombre de points. Ensuite, à égalité, la note suit la règle du système choisi
              (Dutch, Burstein, Monrad…).
            </li>
            <li>
              <b>Choisir la meilleure combinaison.</b> L'ordinateur cherche la façon de faire
              jouer tout le monde en même temps qui donne le meilleur total de notes.
            </li>
            <li>
              <b>Attribuer les couleurs</b> (voir ci-dessous) et numéroter les tables : dans les
              systèmes suisses, les joueurs qui ont le plus de points sont aux premières tables.
            </li>
            <li>Après la ronde, mettre à jour les points et recommencer.</li>
          </ol>
        </Q>

        <Q id="algo-pourquoi" q="Pourquoi ne pas simplement apparier les joueurs dans l'ordre ?">
          <p>
            Parce qu'en avançant table par table, on peut se retrouver coincé à la fin : les deux
            derniers joueurs restants se sont peut-être déjà rencontrés, et il faut alors tout
            défaire. En regardant <i>toutes les combinaisons à la fois</i>, l'ordinateur garantit
            de trouver la meilleure répartition possible, et non la première venue.
          </p>
          <p>
            Pour cela, SwissEngine utilise un algorithme classique de recherche de « couplage de
            poids maximum » (l'algorithme d'Edmonds, dit « des fleurs », 1965), très efficace
            même avec des centaines de joueurs. C'est la même approche que celle décrite dans les
            travaux de recherche récents sur le système suisse.
          </p>
        </Q>

        <Q id="couleurs" q="Comment sont attribuées les couleurs (Blancs / Noirs) ?">
          <p>
            Aux échecs, avoir les Blancs donne un léger avantage : chacun doit donc avoir les
            Blancs à peu près aussi souvent que les Noirs. Une fois les paires choisies, le
            joueur qui a eu le plus souvent les Noirs prend les Blancs ; à égalité, c'est tiré au
            sort.
          </p>
          <p>
            De plus, deux joueurs qui ont tous les deux eu trop souvent la même couleur ne
            peuvent pas être appariés ensemble (l'un d'eux en aurait encore une fois de trop).
            Le seuil est réglé par l'option <a href="#opt-beta">Beta</a>. Pour d'autres jeux, la
            « couleur » peut représenter le côté du terrain, le premier joueur, le match à
            domicile…
          </p>
        </Q>

        <Q id="impair" q="Et s'il y a un nombre impair de joueurs ?">
          <p>
            Un joueur est <b>exempt</b> à chaque ronde : il ne joue pas et reçoit un nombre de
            points fixé par l'option <a href="#opt-bye">Valeur du bye</a> (une demi-victoire par
            défaut). L'exemption est traitée comme un adversaire fictif qui a toujours 0 point :
            elle revient donc en général à un joueur du bas du classement, et un même joueur ne
            peut pas être exempt deux fois.
          </p>
        </Q>
      </section>

      {/* ------------------------------------------------------------ 5 */}
      <section className="card faq-section" id="options">
        <h2>5. Les options</h2>

        <Q id="opt-rondes" q="Nombre de rondes / Toutes les rondes">
          <p>
            Le nombre de parties que jouera chaque joueur (voir{' '}
            <a href="#nb-rondes">Combien de rondes prévoir ?</a>). En round-robin, la case{' '}
            <b>Toutes les rondes</b> calcule automatiquement le nombre nécessaire pour que chacun
            rencontre tout le monde.
          </p>
        </Q>

        <Q id="pheng" q="Points par ronde (système Pheng) : pourquoi faire varier les points ?">
          <p>
            Par défaut, une victoire vaut 1 point à chaque ronde. Ce paramètre permet de donner{' '}
            <b>plus de points aux premières rondes qu'aux dernières</b>, par exemple 3 points
            pour une victoire à la ronde 1, 2 à la ronde 2, puis 1 point ensuite. C'est l'idée du{' '}
            <b>système Pheng</b>, proposé dans l'étude en lien en bas de page.
          </p>
          <p>Pourquoi ? Dans un système suisse classique :</p>
          <ul>
            <li>
              perdre la 1<sup>re</sup> partie n'est pas grave, car on affronte ensuite des
              adversaires plus faibles. Certains joueurs en profitent même volontairement (le «
              gambit suisse ») ;
            </li>
            <li>
              la dernière partie, elle, est décisive : la gagner ou la perdre fait faire un bond
              énorme au classement, sans possibilité de « rattrapage » ;
            </li>
            <li>
              beaucoup de joueurs font le yo-yo autour de leur vraie place, et leur classement
              final dépend surtout de leur dernier résultat.
            </li>
          </ul>
          <p>
            En donnant plus de poids au début, les écarts se creusent tôt, les joueurs se
            stabilisent plus vite près de leur vrai niveau, et la dernière ronde redevient une
            ronde parmi d'autres. Résultat dans les simulations : avec <code>3,2,1</code> en 7
            rondes (Swiss Burstein), le classement est nettement plus juste qu'avec n'importe
            quel système classique (score de 68 contre 48 pour le meilleur d'entre eux, voir{' '}
            <a href="#comparaison">la comparaison</a>), et c'est aussi le meilleur pour trouver
            les premiers et les meilleurs d'une catégorie.
          </p>
          <p>
            <b>En pratique :</b>
          </p>
          <ul>
            <li>
              Écrivez les points de chaque ronde séparés par des virgules : <code>3,2,1</code>{' '}
              signifie 3 points à la ronde 1, 2 à la ronde 2 et 1 point pour toutes les rondes
              suivantes (une valeur manquante vaut 1).
            </li>
            <li>Une nulle rapporte la moitié des points de la ronde à chacun.</li>
            <li>
              Recommandé pour 7 rondes : <code>3,2,1</code>. Plus doux, presque aussi efficace :{' '}
              <code>2,2,2,1</code>. Sans classement Elo : <code>2,2,1</code>.
            </li>
            <li>
              Gardez des nombres simples (1 à 3) : les joueurs doivent pouvoir suivre le
              classement facilement.
            </li>
            <li>
              Prévenez les joueurs ! Le format a été testé au club d'échecs de l'EPFL en mai 2024
              : surprenant au début (« la première ronde vaut 3 points ? »), mais très apprécié.
            </li>
          </ul>
          <p>
            Laissez le champ vide pour un tournoi classique (1 point par victoire à chaque ronde).
          </p>
        </Q>

        <Q id="opt-bye" q="Valeur du bye">
          <p>
            Ce que reçoit le joueur exempt, en fraction d'une victoire de la ronde : <code>0.5</code>{' '}
            (par défaut) = une nulle, <code>1</code> = une victoire, <code>0</code> = rien. Avec
            des points par ronde, l'exemption suit la valeur de la ronde (0.5 × 3 = 1,5 point à
            une ronde qui vaut 3). L'étude recommande une demi-victoire : l'exempt est souvent un
            joueur du bas du classement, une victoire entière le favoriserait trop.
          </p>
        </Q>

        <Q id="opt-beta" q="Beta (contrainte des couleurs)">
          <p>
            Règle à partir de quand deux joueurs ne peuvent plus être appariés parce qu'ils ont
            tous les deux trop souvent eu la même couleur. Avec la valeur par défaut, <b>2</b>,
            deux joueurs qui ont chacun eu les Blancs deux fois de plus que les Noirs ne peuvent
            pas jouer ensemble. C'est le réglage habituel aux échecs.
          </p>
          <ul>
            <li>
              <b>Plus petit (1)</b> : couleurs très équilibrées, mais moins de choix pour
              l'ordinateur, donc des rencontres parfois moins bien adaptées aux points.
            </li>
            <li>
              <b>Plus grand</b> (par exemple 10) : les couleurs ne limitent quasiment plus les
              appariements. Utile si la couleur n'a pas d'importance dans votre jeu.
            </li>
          </ul>
          <p className="hint">Sans effet en round-robin et en aléatoire (option masquée).</p>
        </Q>

        <Q id="opt-seeding" q="Seeding par Elo (sinon Buchholz)">
          <p>
            Dans un groupe de joueurs à égalité de points, il faut un ordre pour appliquer la
            règle du système (« le 1<sup>er</sup> contre le dernier », etc.). Coché (par défaut),
            cet ordre suit le classement <b>Elo</b>. Décoché, il suit le <b>Buchholz tronqué</b>{' '}
            (<a href="#departages">voir départages</a>), c'est-à-dire la difficulté des
            adversaires déjà rencontrés. À la 1<sup>re</sup> ronde, personne n'a encore
            d'adversaire : l'ordre d'inscription (par Elo) est alors conservé.
          </p>
          <p>
            Gardez l'Elo s'il est disponible et fiable : l'étude montre que bien connaître le
            niveau des joueurs améliore nettement la qualité du classement. Décochez si les
            classements sont absents ou peu représentatifs.
          </p>
          <p className="hint">Sans effet en round-robin et en aléatoire (option masquée).</p>
        </Q>
      </section>

      {/* ------------------------------------------------------------ 6 */}
      <section className="card faq-section" id="classement">
        <h2>6. Classement et départages</h2>

        <Q id="departages" q="Comment sont départagés les joueurs à égalité de points ?">
          <p>
            Dans un tournoi suisse, plusieurs joueurs finissent presque toujours avec le même
            nombre de points. On les départage par des critères qui mesurent la difficulté de
            leur parcours :
          </p>
          <ul>
            <li>
              <b>Tr. (Buchholz tronqué)</b>, 1<sup>er</sup> critère : la somme des points de tous
              les adversaires rencontrés, <i>sauf le plus faible</i>. Exemple : des adversaires
              qui ont 4, 2 et 5 points donnent 4 + 5 = 9. On retire le plus faible pour ne pas
              pénaliser un joueur tombé sur le dernier du tournoi dès la 1<sup>re</sup> ronde.
            </li>
            <li>
              <b>Buchholz</b>, 2<sup>e</sup> critère : la somme des points de tous les
              adversaires (11 dans l'exemple).
            </li>
            <li>
              Enfin, à égalité parfaite, le joueur qui a eu le plus souvent les Noirs passe
              devant.
            </li>
          </ul>
          <p>
            En <b>round-robin</b>, tout le monde a les mêmes adversaires : on utilise le{' '}
            <b>Sonneborn-Berger (S.-B.)</b>, la somme des points des adversaires battus plus la
            moitié de ceux des adversaires avec qui on a fait nulle. Battre les meilleurs compte
            donc davantage.
          </p>
        </Q>

        <Q id="pts-appariements" q="Que signifie la colonne « Pts » dans les appariements ?">
          <p>
            Les points de chaque joueur <b>avant</b> la ronde. Ils permettent de vérifier d'un
            coup d'œil que les joueurs à égalité de points jouent bien ensemble.
          </p>
        </Q>

        <Q id="glossaire" q="Petit lexique">
          <dl className="glossary">
            <dt>Ronde</dt>
            <dd>Un tour du tournoi, pendant lequel tout le monde joue une partie en même temps.</dd>
            <dt>Appariement</dt>
            <dd>Le choix de qui joue contre qui lors d'une ronde.</dd>
            <dt>Groupe de points</dt>
            <dd>Les joueurs qui ont le même nombre de points à un moment donné.</dd>
            <dt>Elo</dt>
            <dd>
              Classement qui estime le niveau d'un joueur à partir de ses résultats passés (plus
              il est élevé, plus le joueur est fort).
            </dd>
            <dt>Exempt (bye)</dt>
            <dd>Joueur qui ne joue pas une ronde faute d'adversaire (nombre impair).</dd>
            <dt>Départage</dt>
            <dd>Critère qui sépare les joueurs à égalité de points.</dd>
            <dt>Grille américaine</dt>
            <dd>Tableau récapitulatif de tous les résultats, une ligne par joueur.</dd>
            <dt>Gambit suisse</dt>
            <dd>
              Stratégie qui consiste à perdre (ou annuler) au début pour affronter des adversaires
              plus faibles ensuite.
            </dd>
          </dl>
        </Q>
      </section>

      {/* ------------------------------------------------------------ 7 */}
      <section className="card faq-section" id="autres">
        <h2>7. Autres questions</h2>

        <Q id="autres-sports" q="Puis-je utiliser SwissEngine pour autre chose que les échecs ?">
          <p>
            Oui : e-sport, jeux de société, tennis de table, badminton, concours de débat… Tout
            jeu à deux où toutes les parties d'une ronde peuvent se jouer en même temps. Sans
            classement de niveau, mettez 0 comme Elo et préférez <b>Swiss Random 2</b>. Si la
            notion de couleur ou de côté n'a pas d'importance, augmentez{' '}
            <a href="#opt-beta">Beta</a>. L'option <a href="#club">club / équipe</a> permet
            d'afficher l'équipe de chaque participant.
          </p>
        </Q>

        <Q id="abandon" q="Un joueur abandonne ou arrive en retard : que faire ?">
          <p>
            Ce n'est pas encore possible : pour l'instant, la liste des joueurs est figée dès la
            première ronde. La gestion des absents, des abandons et des arrivées en cours de
            tournoi est prévue dans une prochaine version.
          </p>
        </Q>

        <Q id="gambit" q="Peut-on « tricher » en perdant exprès au début ?">
          <p>
            C'est le « gambit suisse » : perdre une partie au début pour affronter des adversaires
            plus faibles ensuite. Les recherches montrent que la stratégie n'est pas toujours
            payante, et les départages (Buchholz) la limitent. Les{' '}
            <a href="#pheng">points dégressifs</a> la rendent encore moins intéressante : une
            défaite à la 1<sup>re</sup> ronde coûte alors beaucoup plus cher.
          </p>
        </Q>
      </section>

      {/* ------------------------------------------------------------ 8 */}
      <section className="card faq-section" id="aller-plus-loin">
        <h2>8. Pour aller plus loin</h2>
        <p>
          Les explications et les chiffres de cette page sont tirés du mémoire de master{' '}
          <i>Improving the Swiss Pairing System</i> (Wissam Nael Pheng, EPFL, 2024, en anglais)
          : histoire du système suisse, modélisation, méthode de simulation et résultats
          détaillés.
        </p>
        <p>
          <a className="pdf-link" href={PDF_URL} target="_blank" rel="noreferrer">
            Consulter le rapport (PDF)
          </a>
        </p>
      </section>
    </div>
  )
}
