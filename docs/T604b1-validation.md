# T-604b.1 — Premier adaptateur PixiJS v8 / WebGL

17 octobre 2026. Mission terminée, limitée aux régions. Aucun travail b.2 engagé.

## Verdicts

**GO code pour le périmètre b.1. GO visuel borné aux fixtures et au backend mesurés.**
GO pour proposer T-604b.2 à la revue ; aucune autorisation implicite d'implémenter b.2.
HOLD pour toute promesse de fidélité générale, WebGPU, physique/paths, meshes/FFD,
clipping, dark tint, blending avancé ou performance de combat à 60 FPS.

Le format natif v2 est conservé sans extension. Le cœur TypeScript indépendant
est importé directement ; aucun évaluateur, sampling ou solveur n'est réécrit.
Le lecteur v1 du core reste inchangé et testé ; le nouvel adaptateur refuse v1
explicitement dans ce premier contrat.

## Bases et isolation

| Dépôt | Branche / base |
|---|---|
| Éditeur, inchangé | `feat/t2093-mirrored-key-blocks` à `1d3da31a29d2c9e39f19715d55baae840220714b` |
| Runtime, branche de travail créée | `feat/t604b1-pixijs-regions` depuis `56dc0f10ca27806fcb88839f782a585438bf226a` |
| Runtime, branche historique conservée | `demo/m0070-crapaud-pharaon` reste à `56dc0f10ca27806fcb88839f782a585438bf226a` |

États initiaux propres et checkpoints conformes, après vérification réelle des
racines Git. Les six livrables T-604b.0 sont accessibles et ont servi au périmètre.
Aucun merge, amend, tag, push, version bump d'un paquet existant, publication,
packaging, sauvegarde de projet ou modification de référence historique.
Le nouveau workspace privé utilise une version initiale `0.0.0` ; aucun paquet publié.

## Architecture réellement ajoutée

```text
JSON runtime v2 + atlas PNG
  → PixiRigAsset.load / gate regionRig
  → core evaluate (inchangé)
  → PixiRigInstance.setPose ou setTime
  → regionQuad (crop dans les dimensions source, transform locale, world core)
  → MeshGeometry / Mesh / Container PixiJS → WebGL
```

- `pixi/src/validate.ts` : parsing via le lecteur existant puis contrôles de
  capacité, atlas, régions, références et refus explicites du périmètre exclu.
- `pixi/src/load.ts` : PNG HTTP, signature/décodage/dimensions, annulation,
  HTMLImageElement et prémultiplication à l'upload, object URLs révoquées.
- `pixi/src/region.ts` : crop source/UV, pivot et offsets, rotation/scale locale,
  affine monde fournie par core ; Y-up → Y-down une seule fois. Aucun sampling.
- `pixi/src/rig.ts` : asset partagé, poses/meshes indépendants, quads et buffers
  réutilisés, couleur/alpha Normal, ordre, snapshot du rig source, lifecycle.
- `pixi/src/index.ts` : surface publique minimale. `setTime` est un échantillonnage
  direct en secondes dans `[0,duration]`, pas un transport de lecture.
- `pixi/test` : tests Node/numériques et véritable banc navigateur/GL ; copies
  natives/oracles avec empreintes, sans patch de JSON pour les cas positifs.
- `examples/pixi-regions` : page dédiée à deux instances, curseurs indépendants,
  API publique et serveur local existant. Requiert le checkout/dépendances,
  pas une nouvelle archive de distribution.
- Deux scripts dédiés aux empreintes et au navigateur ; manifests/lock nécessaires.
  Une règle `.gitattributes` pour les seules nouvelles fixtures empêche une
  conversion CRLF et garantit leurs empreintes lors d'un checkout Windows.

Le trim est appliqué en intersectant les UV source avec les bounds du crop puis
en replaçant ce sous-rectangle dans la géométrie auteur. Le rectangle d'atlas
n'est jamais étiré à la taille originale. Les pages restent des textures entières.
La couleur alpha est comparée en PMA. Aucune implémentation de shader premium
ou nouveau moteur de rendu : meshes de quads Pixi standard uniquement.

## API et propriété des ressources

`loadPixiRig(url,{signal})` possède les pages qu'il décode ;
`PixiRigAsset.from(source,pageMap)` emprunte des textures complètes résolution1
PMA. `asset.createInstance({skin?})` choisit un seul skin statique avec fallback
default, sans composition. `instance.root`, `setPose`, `setTime`, `destroy` sont
les opérations utiles. L'asset se détruit après ses instances ; une tentative
prématurée est refusée au lieu d'invalider un autre personnage.

Un échec de pose est validé avant mutation de l'affichage. Les poses source et
le JSON ne sont pas modifiés. Les buffers d'une instance sont distincts ; les
textures sont partagées. Destroy libère meshes/géométries/buffers et ne détruit
pas les pages des autres instances. La destruction du root reste sûre, même
avec l'option children/true de Pixi. L'asset emprunté ne détruit pas ses textures.
Le loader attend tous les chargements avant de signaler une erreur et détruit
les pages déjà préparées. Un réseau bloqué peut retarder ce règlement sans signal
d'annulation. Aucun cache global Assets, ticker ou listener renderer ajouté.

Le renderer Pixi et le navigateur conservent leurs propres caches/batch buffers ;
ces tests ne constituent pas une preuve d'absence de toute rétention mémoire
du navigateur ni une mesure VRAM complète.

## Dépendances verrouillées

PixiJS **8.17.0**, Node testé **24.18.0**, npm **11.16.0**, TypeScript **5.9.3**.
Core **0.1.1**, Phaser adapter **0.1.0**, Phaser **3.90.0**, fflate **0.8.3**,
Playwright **1.58.2** conservés. Aucun changement de version/intégrité d'un
paquet préexistant. `eventemitter3@5.0.4` perd seulement son marqueur `dev`
dans le lock, parce que Pixi réutilise cette même dépendance existante.

| Nouvelle dépendance dans le lock | Version |
|---|---|
| `@pixi/colord` | `2.9.6` |
| `@types/earcut` | `3.0.0` |
| `@webgpu/types` | `0.1.74` |
| `@xmldom/xmldom` | `0.8.15` |
| `earcut` | `3.2.4` |
| `gifuct-js` | `2.1.2` |
| `ismobilejs` | `1.1.1` |
| `js-binary-schema-parser` | `2.0.3` |
| `parse-svg-path` | `0.1.2` |
| `pixi.js` | `8.17.0` |
| `tiny-lru` | `11.4.7` |

Les types WebGPU sont une dépendance standard de Pixi ; aucun backend WebGPU
n'est implémenté ou qualifié ici. Les empreintes et licences sont dans le lock.
Installation restreinte via npm, sans scripts d'installation ni mise à jour
générale. La jonction du workspace a d'abord été refusée par la sandbox Windows
(`EPERM`) ; la même installation autorisée hors sandbox a réussi. Aucun npm ci,
pack, publication ou téléchargement de navigateur effectué pendant la mission.

## Rouge → vert et résultats

| Contrôle | Résultat réellement exécuté |
|---|---|
| Deux tests initiaux avant intégration | 0/2, modules adaptateur absents ; log rouge conservé |
| Nouveaux tests Node PixiJS | **26/26**, aucun skip |
| Core TypeScript | **34/34** ; parité Rust historique 128 poses /3328 composantes, max `0.00000643730700744527` |
| Workspace npm test | Exit0, inclut core/Phaser/Pixi et tous les checkers de fixtures |
| Workspace typecheck et build | Exit0 chacun, trois workspaces |
| Provenance PixiJS | **23** fichiers natifs/atlas/oracles inchangés, empreintes sources identiques |
| Phaser WebGL | **21/21** cas |
| Phaser dark tint | **32/32** cas |
| Phaser skin UV | **153/153** cas, stress inclus, relance isolée réussie |
| Phaser clipping rectangles | **74/74** scénarios, **296/296** poses, stress historique inclus |
| Phaser clipping concave | **8/8** scénarios, **32/32** poses |
| Nouveaux scénarios navigateur | **33/33** :30 comparaisons WebGL +2 échecs loader attendus +1 exemple WebGL interactif |

Les tests Node couvrent oracles Rust réels, hiérarchie/shear/pivots/offsets via
attentes affines calculées indépendamment, rotation locale/scale réfléchie,
source UV hors crop, ordre/visibilité, deux instances, 200 updates sans création
de géométrie, destruction, refus et conservation de l'affichage après échec.
Les entrées synthétiques et les corruptions de tests négatifs sont identifiées,
jamais présentées comme de vrais exports natifs.

La première exécution de la suite skins historique a atteint 15 cas réussis puis
un timeout de démarrage30s. La relance seule, sans navigateur concurrent,
passe les153cas avec le script inchangé. La cause du timeout n'est pas démontrée ;
aucun échec de comparaison n'a été constaté sur les cas terminés. Le premier log
est conservé et ce résultat n'est pas remplacé silencieusement.

Deux erreurs de montage du nouveau banc ont été corrigées sans toucher aux
données natives ni aux seuils : fond transparent initialement configuré avec RGB
non noir et alpha0 ; quatre PNG oracles alternate non encore copiés (404/décodage).
Les copies finales sont byte-identiques. Ces échecs sont des défauts du banc,
distincts du test rouge démontrant l'absence initiale de l'adaptateur.

## Preuve GPU et tolérances

**Brave/Chromium155.0.8059.80, WebGL2, ANGLE NVIDIA GeForce RTX3090 Direct3D11.**
Les attributs interleavés réellement soumis à `drawElements` sont lus dans les
buffers GL et les pixels sont comparés avec `gl.readPixels`, pas un mock.
Les captures ont été inspectées, dont l'exemple à deux poses et le crop royal.

| Mesure maximale des fixtures qualifiées | Valeur |
|---|---|
| Composante affine monde vs oracle Rust | `3.719322137385461e-05` |
| Vertex vs oracle Rust, tagged/multipage | `3.0517578125e-05` unité |
| Position effectivement soumise GPU vs géométrie transformée | `2.5600194931030273e-05` pixel de scène |
| UV effectivement soumise GPU | `0` |
| RGB plat PMA | `1/255` |
| Alpha plat | `0/255` |
| Pixels de bord hors seuil /canvas, maximum | `0.934982 %` |

Temps0/.25/.5/.75s ; trim également à1.5333333s, autour de l'impact. Matrices
et vertices sont soumis au seuil0.01 ; UV1e-6. Multipage/trim : RGB intérieur2/255,
alpha1/255, zéro pixel plat hors seuil ; tagged reprend son seuil historique
8/255 et99.5% de conformité intérieure. Seuil bord2% du canvas. **Aucun seuil
n'est élargi après observation ; aucune revendication pixel-perfect.**

Le fixture trim est un ancien export réel de la copie de test M007.1b3, jamais
le projet protégé. Source480×440, crop457×406, offset(12,15). Comparaison indépendante
au PNG source entier non trimé dessiné par Canvas2D et matrices Rust déjà
enregistrées, sur fond transparent puis opaque. Ce n'est pas une image CPU Rust
du skin royal : le renderer CPU est limité au default. Aucun oracle de vertices
Rust spécifique au crop n'est revendiqué ; attentes analytiques séparées +buffers
GPU +pixels source donnent la preuve complémentaire. Le JSON est intact ; seul
un RigPose fourni masque les autres slots pour isoler la région testée.

Multipages : vraie fixture native à2pages, construction default/alternate,
quatre temps et deux fonds ; pas d'API dynamique de changement de skin.
Atlas rotated:true : refus explicite, pas de fixture native tournée qualifiée.
Rotation locale/pivot non central/offsets sont couverts par tests analytiques ;
ne pas en déduire une certification visuelle de toutes les régions pivotées.

## Limites conservées

Régions seulement ; tous les skins sont vérifiés de façon conservatrice.
Refus de meshes/poids/FFD/linked/clipping/non-region, dark tint, blend autre que
Normal, contraintes y compris IK/transform/physics/path, timelines associées
et clips avec événements. Pas de correction `target`/`bones[0]`. Pas de public
play/crossfade/event/speed/reverse, pas de `.ankh` converti dans le navigateur,
pas de composition multi-skins, pas de formats modifiés. Les séquences régions
affichent le sequenceFrame du core ; seule la boucle tagged incluse est
qualifiée, pas l'ensemble des modes séquence.

Textures empruntées : pages complètes résolution1/PMA ; UV croissantes dans[0,1],
couleurs claires[0,1]. WebGL1/mobile et WebGPU non qualifiés. Pas de mesure
générale de débit/latence, scène de combat, longue session ou tous profils couleur.
Le jeu autonome Phaser est préservé et ses empreintes vérifiées ; son soak5min
n'est pas rejoué, car son code/archives sont gelés. Aucune vérification Rust
nouvelle : aucune nécessité technique, aucun build éditeur ni export reconstruit.

## Commandes et preuves

Toutes les preuves nouvelles sont extérieures aux dépôts, sous
`work/t604b1`, et la livraison sous `outputs/T604b1-PixiJS-regions`.

| Commande exécutée | Trace / commentaire |
|---|---|
| `git rev-parse --show-toplevel`, `branch --show-current`, `rev-parse HEAD`, `status --porcelain=v1`, `diff`, `show-ref` | Vérifications initiales/finales et contrôle de périmètre ; escalade en lecture si sandbox Windows bloque worktree |
| `git switch -c feat/t604b1-pixijs-regions 56dc0f10ca27806fcb88839f782a585438bf226a` | Nouvelle branche uniquement |
| `npm view pixi.js@8.17.0 version engines dependencies --json`, `npm ls --depth=0` | Version et toolchain présentes ; aucun update global |
| `node --test pixi/test/regions.test.mjs` avant intégration | `logs/red.txt`, 2 échecs attendus |
| `npm install --ignore-scripts --no-audit --no-fund` | EPERM jonction sandbox puis succès hors sandbox, 12 packages ajoutés dont workspace ; lock examiné |
| `npm run build --workspace pixi`, `npm run test --workspace pixi` | Pass ciblés pendant développement, `logs/pixi-unit-first.txt` |
| `npm test` | `logs/final-npm-test.txt`, exit0 |
| `npm run typecheck`, `npm run build` | `logs/final-typecheck.txt`, `logs/final-build.txt`, exit0 |
| `node scripts/check-pixi-fixtures.mjs` | 23 copies immuables ; checker aussi dans npm test |
| `node scripts/test-pixi-webgl.mjs` | `logs/webgl-first/second/green/final.txt`, dossiers résultats correspondants ; final33/33 |
| `node scripts/test-webgl.mjs`, `test-dark-tint.mjs`, `test-skin-uv.mjs`, `test-clipping.mjs` | `logs/phaser-*.txt` ; navigateur existant via ANKHIMATE_BROWSER_PATH, sortie extérieure ANKHIMATE_TEST_OUTPUT |
| `ANKHIMATE_CLIPPING_CONCAVE=1` puis `node scripts/test-clipping.mjs` | `logs/phaser-clipping-concave.txt`, 32 poses |
| `python -X utf8 work/t604b1/check_preservation.py` | 706 sources gelées et 23 copies intègres ; comparaison précise lock |
| `python -X utf8 work/m0071a/preserve.py` | 57 fichiers protégés identiques au manifeste antérieur |
| `python -X utf8 work/t604b0/check_references.py` | 207 références historiques byte-identiques, aucune régénération |
| `Get-FileHash -Algorithm SHA256 outputs/M0072/Ankhimate-M007.2-Windows-x64-candidate1.zip` | Empreinte de référence inchangée |
| `git diff --check`, `git add -- <liste explicite>`, `git diff --cached --binary --output=...`, `git commit ...` | Checkpoint local après résultats, liste et diff fournis à la livraison ; aucun git add . |
| `git -c core.autocrlf=true cat-file --filters :pixi/test/fixtures/tagged/skeleton.json` | Avant règle : conversion CRLF, empreinte différente ; après règle -text : copie exacte. Contrôle étendu aux23fixtures indexées |

Inspections supplémentaires en lecture : `Get-Content`, `rg`, inventaires Python
des fixtures et empreintes, documentation officielle PixiJS8.17.0 (Mesh/MeshGeometry/
TextureSource). Les scripts de préparation/copier/rapports sont dans le dossier
de travail extérieur. Aucun Computer Use ni installation de navigateur.
Les commandes de lancement recommandées README (`npm ci`, serveur manuel) sont
distinctes de ces exécutions : exemple effectivement lancé par le banc HTTP.
Pas de nouveau warning produit : typechecks/build sans diagnostic et scénarios
navigateur réussis sans warning/erreur JS. Les avis npm d'une nouvelle version
et le message de localisation du Python système sont de l'outillage préexistant,
pas des warnings du runtime ; aucun outil n'est mis à jour pour les supprimer.
Les avertissements Git de conversion LF/CRLF sur les sources suivent sa
configuration existante ; aucune configuration globale modifiée. Pour les
fixtures à empreintes, le risque était réel et est corrigé uniquement par la
nouvelle règle ciblée, sans toucher aux attributs historiques.

## Préservation et état final

**706 fichiers** core/Phaser/anciens scripts/outils/exemples gelés identiques.
**57 fichiers** Crapaud/assets/sauvegardes/autosaves protégés identiques ;
**207 références historiques** identiques ; aucun original modifié/régénéré.
ZIP M007.2 candidate1 SHA-256 :
`7b3e04396d8a145546212cbf9ee784325decf3805602bbcb5f048426b1c6acad`.
Le recalage et l'apparence sans pagne sont conservés par identité des fichiers,
sans réouverture/sauvegarde du projet. La branche historique Phaser est inchangée.

Le SHA du commit local final, les deux états Git après commit, le patch binaire
complet et le manifeste de preuves figurent dans la livraison extérieure.

## Fichiers ciblés (45)

- `.gitattributes`
- `docs/T604b1-validation.md`
- `examples/pixi-regions/README.md`
- `examples/pixi-regions/example.mjs`
- `examples/pixi-regions/index.html`
- `examples/pixi-regions/server.mjs`
- `package-lock.json`
- `package.json`
- `pixi/README.md`
- `pixi/package.json`
- `pixi/src/index.ts`
- `pixi/src/load.ts`
- `pixi/src/region.ts`
- `pixi/src/rig.ts`
- `pixi/src/validate.ts`
- `pixi/test/fixtures/multipage/atlas.png`
- `pixi/test/fixtures/multipage/atlas_2.png`
- `pixi/test/fixtures/multipage/cpu-alternate-0.png`
- `pixi/test/fixtures/multipage/cpu-alternate-1.png`
- `pixi/test/fixtures/multipage/cpu-alternate-2.png`
- `pixi/test/fixtures/multipage/cpu-alternate-3.png`
- `pixi/test/fixtures/multipage/cpu-default-0.png`
- `pixi/test/fixtures/multipage/cpu-default-1.png`
- `pixi/test/fixtures/multipage/cpu-default-2.png`
- `pixi/test/fixtures/multipage/cpu-default-3.png`
- `pixi/test/fixtures/multipage/reference.json`
- `pixi/test/fixtures/multipage/skeleton.json`
- `pixi/test/fixtures/provenance.json`
- `pixi/test/fixtures/tagged/atlas.png`
- `pixi/test/fixtures/tagged/cpu-0.png`
- `pixi/test/fixtures/tagged/cpu-1.png`
- `pixi/test/fixtures/tagged/cpu-2.png`
- `pixi/test/fixtures/tagged/cpu-3.png`
- `pixi/test/fixtures/tagged/cpu-reference.json`
- `pixi/test/fixtures/tagged/skeleton.json`
- `pixi/test/fixtures/trim/atlas.png`
- `pixi/test/fixtures/trim/coiffe_royale_test.png`
- `pixi/test/fixtures/trim/rust-poses.json`
- `pixi/test/fixtures/trim/skeleton.json`
- `pixi/test/regions.test.mjs`
- `pixi/test/webgl.html`
- `pixi/test/webgl.mjs`
- `pixi/tsconfig.json`
- `scripts/check-pixi-fixtures.mjs`
- `scripts/test-pixi-webgl.mjs`

## Prochaine revue

T-604b.2 peut être proposée sur ce socle borné. Avant de promettre le transport
complet : tests ±180°, événements t0/fin exacte/boucles et crossfade. Tout changement
du cœur partagé nécessite une revue explicite ; aucune correction de ces points
n'est glissée dans b.1. Arrêt après ce checkpoint, sans publication.
