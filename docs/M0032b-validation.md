# M003.2b/c — Exemple jouable et guide d’intégration

Validation Windows du 15 octobre 2026, sur `fix/m0032-phaser-alpha`.
Le correctif de rendu est déjà isolé dans
`ee277fa3077382885f6863a3c7aaaf3d92e4b79a` ; le présent checkpoint ajoute
l’exemple, sa reproductibilité et la documentation. Aucune modification du
dépôt éditeur ni des formats d’export.

## Exemple livré

`examples/phaser-game` est un projet distinct, copiable hors du dépôt. Il
contient son package.json, son lockfile, son serveur statique local, ses licences,
le guide, les exports réels et deux archives npm construites localement.
L’installation n’exige aucun package runtime publié, processus éditeur ou lien
vers le dossier parent. Le jeu utilise les points d’entrée publics et les
objets publics `PhaserRig`, `root`, `player`, `crossFade` et `update`.

- Déplacement avec flèches / A-D ou boutons ; collecte de cinq éclats.
- Changement entre les vrais clips `walk` et `leg_ik` de walker, transition
  0,25 seconde, lecture en boucle selon les données exportées.
- Compteur visible des vrais événements `footstep`, nom et payload inclus.
- Le second rig est le vrai export du PSD tagged_rig, avec son unique clip
  `animation_1` et sa séquence d’attachment ; aucun clip supplémentaire inventé.
- 19 meshes visibles et les deux pages d’atlas chargées depuis des fichiers
  locaux, sans CDN ni correction manuelle des exports.

Les archives contiennent core 0.1.1 / adaptateur 0.1.0, code renderer du commit
ci-dessus. Elles sont volontairement versionnées dans l’exemple autonome avec
leurs hashes. Il ne s’agit ni d’une release ni d’une publication npm.

## Test réel de cinq minutes

Le pilote Playwright utilise des entrées clavier/bouton : déplacement d’au
moins 100 pixels avec collecte, sélection de `leg_ik`, retour à `walk` avec
Espace, puis réception d’un événement. Il observe ensuite le jeu sans accélérer
le temps et exige à la fois 300 secondes murales et 300 secondes de playback
supplémentaires. Il contrôle erreurs, warnings, requêtes en échec et poses
non finies pendant toute l’attente.

| Mesure | Résultat |
|---|---:|
| Durée murale de l’observation | **300,7715088 s** |
| Updates au terme du parcours complet | **43 402** |
| Playback cumulé depuis la création du jeu | 301 481,19 ms |
| Boucles observées | **300** |
| Événements livrés | **602**, dernier `footstep / right / int=1` |
| Textures prêtes / meshes visibles | oui / **19** |
| Erreurs JavaScript / warnings / ressources manquantes | **0 / 0 / 0** |

Environnement : Node 24.18.0, npm 11.16.0, Phaser 3.90.0, Playwright 1.58.2,
Brave installé signalant Chromium 155.0.8059.40, ANGLE Direct3D11 sur NVIDIA
GeForce RTX 3090. Le contexte est bien WebGL matériel, même avec un navigateur
de test sans fenêtre visible.

Une copie hors du dépôt a ensuite été installée avec son propre `npm ci`, puis
validée par le contrôle des hashes et un test de jeu court de 5 secondes.
Cette seconde preuve établit l’autonomie du dossier ; elle n’est pas présentée
comme un second test de cinq minutes.

Une précision documentaire a nécessité de réemballer le package Phaser en fin
de validation. Tous ses fichiers JavaScript ont été comparés aux fichiers de
l’archive du test long : ils sont byte-identiques. L’archive core est inchangée.
La nouvelle installation, ses hashes et un nouveau test court de jeu réussissent.
Un appel npm initial avec un chemin relatif depuis le mauvais dossier a été
corrigé ; ce défaut d’invocation ne subsiste pas dans les commandes documentées.

## Régressions et compatibilité

Les références CPU ont été étendues au second clip de walker. Le runner final
valide **12 poses réelles** : `walk`, `leg_ik`, `animation_1`, chacune à 0 / 0,25 /
0,5 / 0,75 s, plus le cas de sondes synthétiques UV/alpha/ordre/v1-v2.

| Contrôle final | Résultat |
|---|---|
| Tests TypeScript complets | **26 réussis**, 0 échec |
| Build et typecheck core/Phaser | Réussis, aucun nouveau warning |
| Cas navigateur réels + sondes | **13 réussis**, 0 erreur/warning/ressource en échec |
| Parité Rust/TS existante | 128 cas / 3 328 composantes ; erreur max. 0,000006437307 |
| Référence Rust des chaînes JSON | 4 cas inchangés |
| Références d’exports et CPU | **19 fichiers** avec SHA-256 vérifiés |
| Installation propre de l’exemple et hashes | Réussis |
| Copie autonome hors dépôt : installation et jeu | Réussis |
| Checkout neuf avec `core.autocrlf=true` | Hashes des 19 références et des archives/assets de l’exemple conservés |

Les `.gitattributes` protègent les bytes JSON des exports et oracles : un
checkout Windows ne doit pas modifier leurs hashes en convertissant LF en
CRLF. Le code et la documentation ordinaires suivent les conventions Git du
dépôt. Les notices Git de conversion de ces fichiers texte ne sont pas des
warnings TypeScript ou navigateur.

L’erreur maximale des sommets projetés sur les 12 poses reste inférieure à
0,00004 unité, pour une tolérance de 0,01. Les UV sont exacts dans les cas
comparés. Les pixels intérieurs concordent à 100 % ; les différences globales,
principalement aux bords rasterisés/filtrés, restent entre 0,310 % et 0,872 %,
pour un seuil de 2 %. Les tolérances initiales de M003.2a sont conservées.

Les comparateurs Rust ont utilisé un `CARGO_TARGET_DIR` extérieur à l’éditeur.
La suite Rust de l’éditeur n’a pas été relancée dans cette mission : son code
est inchangé, et les contrôles demandés ici portent sur TypeScript/WebGL et la
parité pertinente. L’éditeur reste propre au commit M003.1 accepté, et le PSD
original conserve son SHA-256
`8c0cb6c1e1491c40a417e467f171584f9cd2fceb947a07532355f73117a85314`.

## Documentation et limites restantes

Le [guide PSD → Phaser](psd-to-phaser.md), copié comme `INTEGRATION.md` dans le
projet autonome, détaille import, rig/animation, sauvegarde, preset, toutes les
pages d’atlas, API publiques, unités de temps, événements, v1/v2, versions
testées et lancement. Les README root/core/Phaser renvoient au parcours et
évitent une promesse de fidélité complète.

- Teintes sombres : limitation de bout en bout connue, non corrigée ici.
- Physique graphique, déformations pondérées complexes, linked meshes,
  clipping et combinaisons rotated/trimmed : pas de qualification dédiée.
- Les clips en transition suivent le comportement existant du player ; seuls
  les événements entrants sont livrés. Aucun fichier audio n’est fourni.
- Les sources sont des rigs de test simples. Un GPU/navigateur et une session
  de cinq minutes ne constituent pas une qualification multi-machine ou un
  profil mémoire longue durée sur un personnage de production.
- Les packages gardent leurs numéros locaux antérieurs : une publication
  demandera une décision explicite de versions et de distribution. Aucun
  paquet du registre portant le même numéro n’est déclaré équivalent.

Lancement : `npm ci`, `npm run check`, `npm start` dans
`examples/phaser-game`, puis ouvrir `http://127.0.0.1:4173`.
La commande root `npm run test:game` rejoue le contrôle de cinq minutes ;
`npm run test:webgl` rejoue les 13 cas graphiques.

Arrêt après M003.2 : pas de M004/M005, d’IA, de push, merge ou release.
Attendre la revue finale avant toute publication.
