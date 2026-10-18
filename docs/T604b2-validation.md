# T-604b.2 — Animation, crossfade et événements PixiJS

17 octobre 2026. Qualification limitée aux régions PixiJS v8 / WebGL2.

## Périmètre et checkpoints

Branche locale `feat/t604b2-pixijs-animation`, créée depuis
`6ad0bf46cfaa8da682d1aaf50bda6d46e6939bf5` (b.1 propre).
Le préalable partagé, autorisé séparément après reproduction, est le commit
`97805ba` : demi-tour négatif signé, ordre chronologique stable et événements
à zéro ignorés à chaque tour, conformément au choix explicite de la revue.
Voir [le contrat partagé](shared-playback-boundaries.md).

L'éditeur reste propre sur `feat/t2093-mirrored-key-blocks`,
`1d3da31a29d2c9e39f19715d55baae840220714b`.
La branche Phaser gelée `demo/m0070-crapaud-pharaon` reste à
`56dc0f10ca27806fcb88839f782a585438bf226a`.
Aucun fichier de l'adaptateur Phaser, de l'éditeur ou des projets protégés
n'est modifié. Aucun push, merge, amend, tag, packaging ou changement de version.

## Architecture et API

`instance.playback` crée paresseusement un `PixiPlayback` propre à l'instance.
Il utilise un seul `RigPlayer` commun, puis la méthode de rendu des régions b.1.
Aucun sampling, solveur, mélangeur ou calcul géométrique supplémentaire.
L'émission est celle de `RigPlayer.events`; le wrapper ajoute abonnement,
désabonnement et nettoyage, sans rechercher des clés pour fabriquer des événements.

API : `play(name,{loop?})`, `pause`, `resume`, `stop`, `crossFade(name,duration,
{loop?})`, `speed`, `update(dtSeconds)`, `animation`, `time`, `playing`, `events`,
`onEvent(listener)` et `destroy`. Le jeu fournit le temps, sans ticker global.
Le [README](../pixi/README.md) documente les bornes, erreurs, callbacks et l'exemple.

Les flags de boucle sont copiés localement dans les métadonnées des clips ;
tracks et textures restent partagés en lecture. Deux états RigPlayer et deux
ensembles de buffers restent indépendants. La source chargée est une copie
privée du JSON : supprimer un clip du JSON du jeu ne modifie pas une instance.
Il n'existe pas d'API de mutation dynamique des clips.

Un `setTime`/`setPose` réussi détache le transport et sa transition. Une entrée
directe invalide ne le détache pas. `resume` sans clip ne fait rien. `stop`
affiche le setup ; un clip non bouclé conserve sa pose finale. Le contrôleur
reste actif en fin de clip pour permettre à un fondu plus long de se terminer.
Détruire l'instance détruit le contrôleur ; détruire seulement le contrôleur
laisse la vue utilisable par échantillonnage direct.

## Contrat temporel et limites

* Temps en secondes, vitesse strictement positive et finie. Delta fini positif
  ou nul ; delta négatif/non fini et produit delta×vitesse non fini refusés.
* Départ à zéro ; fin non bouclée clampée, fin bouclée modulo. Durée zéro :
  temps zéro et aucun événement. Durée négative ou non finie refusée au chargement.
* Événements dans `(from,to]`, zéro exclu à chaque tour, borne positive de fin
  incluse, tri stable dans chaque tour. Pause et delta zéro n'émettent rien.
* Crossfade : événements du clip entrant uniquement. Durée en temps de lecture
  après vitesse. Durée zéro : changement direct ; même clip : pas de restart,
  comme le cœur. Une transition interrompue repart de l'ancien clip entrant,
  pas d'une capture du mélange visible. Ce comportement existant est documenté.
* Callbacks synchrones après affichage, batch immuable. Destruction interrompt
  immédiatement les callbacks restants ; update récursif refusé. Une exception
  du code utilisateur est propagée après avancement, sans rollback de la pose.
* Une borne conservatrice supérieure à 100 000 événements pour un update bouclé
  est refusée avant avancement ; le jeu doit fractionner ce delta. Ce garde-fou
  évite une boucle ou allocation sans limite, sans changer le sampler.

Le contrôle de capacité b.1 accepte désormais les événements typés, finis et
dans la durée. Ses autres refus sont conservés. Le test historique qui refusait
tout événement devient un refus d'événement invalide ; cette extension est
intentionnelle. Aucun JSON natif historique n'a été changé.

## Preuves rouge → vert

| Régression | Rouge conservé | Vert |
|---|---|---|
| API playback absente | 1 test échoué sur b.1 | API disponible par instance |
| 0 → −180°, t=0,5 | +90° au lieu de −90° ; erreur de pointe 20 unités pour longueur 10 | −90°, direction Rust conservée |
| Événements non triés | `late, early-1, early-2` | `early-1, early-2, late`, égalités stables |
| t=0 après un overshoot | `[1.25]` émet `start`, `[1,.25]` ne l'émet pas | zéro ignoré dans les deux découpages |

La première tentative de build rouge a rencontré un refus d'écriture du sandbox
sur `core/dist`. Elle n'est pas comptée comme preuve rouge ; le test a été
relancé avec les permissions nécessaires et les deux assertions ont réellement
échoué. Le générateur Rust a également nécessité une relance autorisée dans
un nouveau dossier après un refus Windows de staging ; aucun résultat partiel
n'a été réutilisé comme export valide, aucun dossier préexistant écrasé.

## Tests automatisés et fidélité

* `npm test` : **37 tests core et 42 tests PixiJS**, tous verts. Phaser compile
  et typecheck via sa commande de test ; il n'a pas de suite Node distincte.
  Soit 19 tests Node supplémentaires : trois core, seize PixiJS.
* `npm run build` et `npm run typecheck` : core, Phaser, PixiJS verts.
* Parité native historique : 128 cas / 3 328 composants,
  erreur absolue maximale **0,00000643730700744527**.
* Nouvel export natif `playback` : deux clips région-only, deux sens de demi-tour,
  événements, dix références PNG CPU, dix poses de clips, cinq poses de fondu et
  sept fenêtres d'événements Rust. Source auteur et générateur archivés à côté.
  Le générateur utilise les API Rust et le preset natif réels, sans patch du JSON.
* Quinze poses comparées numériquement : 90 composants affines,
  maximum **0,00000019091555214512113**, tolérance 0,01.
* Lecture incrémentale de tagged_rig comparée aux os et coins Rust b.1.
* Tests de pause, vitesse, boucle/non-boucle, durée zéro, exact end, multiloop,
  interruptions de fade, entrée invalide atomique, direct pose, destruction,
  abonnements, isolation et réemploi de buffers pendant 600 mises à jour.

Le test du contrôleur face au même cœur est une preuve d'intégration, pas un
oracle indépendant. Les comparaisons Rust ci-dessus sont distinctes.

## Navigateur réel

Brave/Chromium **155.0.8059.80**, PixiJS **8.17.0**, Phaser **3.90.0**,
Windows, WebGL2 ANGLE **NVIDIA GeForce RTX 3090 / D3D11**.
Lancement headless avec GPU matériel identifié ; aucun rendu CPU-only présenté
comme preuve WebGL. Node **24.18.0**, npm **11.16.0**, TypeScript **5.9.3**.

| Banc | Résultat |
|---|---|
| Pixi b.1 | 33/33 scénarios, 31 captures PNG byte-identiques aux preuves b.1 |
| Pixi b.2 | 20/20 : 10 poses, 5 fondus, boucle, événement, deux vitesses, replay déterministe, exemple interactif |
| Phaser historique | 21/21 |
| Phaser dark tint | 32/32 |
| Phaser skin UV / stress | 153/153 |
| Phaser clipping | 74/74 scénarios, 296 poses |
| Phaser clipping concave | 8/8 scénarios, 32 poses |
| Jeu Phaser historique | 300,78 s réelles, 43 411 frames, 602 événements, 300 boucles ; aucune erreur, warning ou ressource manquante |

Mesures b.2 : coins **0,000006198883056640625** ; positions réellement soumises
au GPU **0,00000762939453125** ; UV **0** ; intérieur RGB **1/255** maximum,
alpha **0** ; fraction maximale de désaccord aux bords **0,0068817138671875**.
Tolérances inchangées : géométrie 0,01 ; UV 1e-6 ; intérieur RGB 2/255 et
alpha 1/255 ; bords <=2% du canvas. Aucun intérieur hors tolérance.
Mesures par lectures des buffers à `drawElements` et `gl.readPixels`.
Les références pixels de clips viennent du CPU Rust. Le pixel oracle des fondus
est Canvas2D alimenté par les coins Rust, pas une nouvelle référence de fade CPU.
Les captures deux instances, fade médian et exemple ont été inspectées visuellement.
Les captures seules ne constituent pas la preuve numérique.
Les compteurs du jeu sont une preuve de fonctionnement continu, pas une mesure
de performance garantie. Le nouveau démonstrateur PixiJS a été testé séparément
par ses contrôles publics ; aucune endurance de cinq minutes Pixi n'est revendiquée.

## Préservation

Sur 706 fichiers historiques : **704 byte-identiques**, les deux modifications
autorisées sont exclusivement `core/src/evaluate.ts` et `core/src/player.ts`.
Les 23 copies natives/oracles b.1 et leurs sources restent identiques. Le manifeste
inclut désormais 15 nouveaux fichiers de qualification, soit 38 copies vérifiées.
`package-lock.json` reste byte-identique au checkpoint b.1 ; aucune dépendance ou
version n'est modifiée. Les ajouts de scripts npm ne changent pas le lockfile.

Les **57** projets/assets/sauvegardes/autosaves Crapaud et **207** références
historiques sont identiques. ZIP alpha inchangé :
`7b3e04396d8a145546212cbf9ee784325decf3805602bbcb5f048426b1c6acad`.

## Limites et revue suivante

GO pour le code b.2 et les cas WebGL mesurés. GO pour **proposer** b.3 à la revue,
aucune autorisation d'en commencer l'implémentation. HOLD pour une affirmation
de fidélité générale, de performance/60 FPS, WebGL1, WebGPU, meshes/FFD, clipping,
linked meshes, dark tint, blending non Normal, contraintes/physique/paths ou
composition dynamique des skins. Les refus conservateurs restent actifs.
Les performances et la mémoire totale conservée par le renderer/navigateur ne
sont pas qualifiées. Les conventions historiques corrigées du cœur sont
explicitement signalées ; aucun changement silencieux de Phaser.
