# T-604b.3 — Meshes pondérés, FFD et WebGL PixiJS

17 octobre 2026. Périmètre limité à l'adaptateur PixiJS et à sa qualification.

## Verdict

**GO code et rendu pour les cas WebGL2 mesurés. GO pour proposer b.4 à la revue,
aucune autorisation d'en commencer l'implémentation.** HOLD pour une fidélité
générale, WebGL1/mobile, WebGPU, 60 FPS ou mémoire GPU totale garantie.

Le cœur partagé et Phaser sont inchangés. Aucun défaut nécessitant une correction
du cœur ou du format n'a été démontré. Aucun nouveau sampler FFD ni solveur de
skinning ; aucun shader, renderer ou changement du contrat natif v2.

## Bases et isolation

| Dépôt / branche | Checkpoint |
|---|---|
| Runtime de départ, propre | `a8a25550d976d8904dd947e23c409e706770b310` |
| Préalable partagé accepté, conservé | `97805ba0dfaf85a5e57d6ef292b92d42a3cc4118` |
| Nouvelle branche runtime | `feat/t604b3-pixijs-mesh-ffd` |
| Branche Phaser gelée, conservée | `demo/m0070-crapaud-pharaon`, `56dc0f10ca27806fcb88839f782a585438bf226a` |
| Éditeur propre, conservé | `feat/t2093-mirrored-key-blocks`, `1d3da31a29d2c9e39f19715d55baae840220714b` |

Aucun push, merge, amend, tag, changement de version, dépendance, packaging ou
publication. Aucun accès en écriture au dépôt éditeur.

## État initial et réutilisation

b.2 refusait volontairement les meshes et les deforms. Son rendu préparait
quatre coins et six indices de région, et exigeait un `pose.deforms` vide.
Sept tests positifs sur de vrais exports ont donc réellement échoué avant toute
modification de production. Ce refus conservateur n'était pas une perte silencieuse.

L'audit a retrouvé :

* Le modèle `MeshAttachment` v2 : vertices, UV normalisées, triangles, influences
  et flag weighted, déjà disponible dans `core/src/types.ts`.
* `core/src/attachments.ts::attachmentWorldVertices`, API publique existante
  pour les transformations rigides et le skinning pondéré normalisé.
* `core/src/evaluate.ts`, déjà responsable de l'interpolation et du mélange FFD.
* La géométrie privée Phaser, utilisée comme référence d'interprétation ; elle
  n'est ni déplacée ni recopiée comme deuxième solveur.
* Le bind et le skinning Rust de `core/src/attachment.rs`, l'export de
  `export/src/context.rs`, les références M005.4a/M005.4b1 et le crop b.1.

## Chemin effectivement implémenté

```text
RigPlayer / evaluate existants → bones.world + pose.deforms
  → MeshBinding : préparation d'une vue d'attachment privée avec offsets évalués
  → attachmentWorldVertices existant : skinning et normalisation des poids
  → frontière Y-up → Y-down, une seule fois
  → MeshAtlas : UV de page / découpe statique des triangles au trim
  → mêmes Mesh / MeshGeometry PixiJS, même publication de pose complète
```

`MeshBinding` ne lit aucune clé. Pour une influence, l'offset déjà interpolé est
transformé par la partie linéaire `inverse(B_setup) × H_setup`, puis ajouté aux
coordonnées bind locales natives. L'API commune calcule ensuite les positions
pondérées avec les mondes évalués. Le rig source et le RigPose fourni restent
intacts. La vue privée ne déclenche aucune autre évaluation des animations.

## Contrat et diagnostics

| Fonction | Contrat obtenu / limite |
|---|---|
| Mesh rigide | Vertices dans le repère du bone du slot ; triangles et UV natifs |
| Mesh pondéré | Bones exacts, coordonnées bind natives, poids non négatifs finis ; normalisation par somme positive dans le cœur existant |
| Poids partiels | Vertex sans influence : transformation rigide du host ; aucun offset FFD pondéré réservé pour ce vertex |
| FFD rigide | Un XY par vertex, dans l'ordre natif |
| FFD pondéré | Un XY par influence, ordre vertex puis influence ; dimensions exactes |
| Interpolation | Linear, Stepped, Bézier et overshoot fournis par le cœur ; fondus conformes aux poses Rust |
| Réflexions et hiérarchie | Rotation, scale, shear et scale négatif combinés dans les fixtures réelles |
| Atlas complet | Indices natifs préservés, UV converties vers la page |
| Atlas trimé | Intersection des triangles dans le domaine UV ; vertices de bord interpolés barycentriquement, sans étirer le contenu recadré |
| Multipage / changement d'attachment | Page, UV et topologie actualisées ; une vraie fixture alterne pentagone et triangle sur des pages différentes |
| Draw order / alpha | Ordre animé de deux meshes, alpha clair et PMA, fonds transparents et opaques |
| Skins | Mécanisme statique b.1 conservé ; dimensions FFD incohérentes entre variantes refusées. Aucune certification visuelle générale nouvelle de meshes par skin |

Les bones manquants, affines setup d'influence singulières, indices hors limites,
triangles à indices répétés, dimensions incohérentes, UV hors source, poids
négatifs/non finis ou de somme nulle, FFD inconnus/mal dimensionnés et courbes
invalides sont refusés avec un diagnostic. Les mondes des bones et toutes les
déformations d'une pose directe sont validés avant d'altérer les vues.

Clipping attachments, linked meshes, dark tint, blending non Normal,
contraintes/physique/paths et composition dynamique de skins restent refusés.
Les **séquences d'images de meshes** sont refusées jusqu'à qualification dédiée ;
la séquence de régions b.1 demeure inchangée. Atlas tournés et UV répétées restent
exclus. WebGPU et Canvas sont désormais refusés explicitement à l'étape de rendu
par `root.onRender`, hook réservé à ce contrôle. Son test négatif utilise des
types de renderer contrôlés ; ce n'est pas une qualification réelle de WebGPU.
Les Applications doivent sélectionner WebGL ; seul WebGL2 est mesuré ici.

## Ressources et comportement des mises à jour

Chaque instance possède ses bindings, données temporaires, meshes et buffers.
Les pages d'atlas sont partagées. Une mise à jour FFD ordinaire réutilise les
objets et leurs buffers. Si le nombre de vertices ou d'indices change réellement,
seule la géométrie est remplacée et ses anciens buffers détruits ; le Mesh reste.
Un changement d'indices de même taille met à jour le buffer existant.

La découpe UV du trim est préparée par attachment/texture. Elle peut introduire
des triangles de bord : leur topologie diffère alors volontairement du mesh
source, tout en conservant sa couverture visible. Ce traitement d'atlas ne
rend pas les attachments Clipping disponibles.

Des tests vérifient 600 mises à jour entre deux instances indépendantes et
600 vrais rendus FFD après warmup : **aucun nouveau buffer GL** pendant cette
dernière boucle. Les ressources des instances et les pages possédées sont
détruites ; les textures empruntées restent au propriétaire. Les caches globaux
du renderer et la mémoire totale navigateur/GPU ne sont pas mesurés.

## Fixtures et preuves indépendantes

Sept ensembles copiés sans modification : weighted, weighted_partial,
weighted_ffd, weighted_ffd_linear, ffd_linear, ffd_stepped, ffd_bezier.
Les FFD proviennent des exports corrigés M005.4b1, les deux premiers de M005.4a.

Cinq ensembles nouveaux, construits dans un outil Rust externe au dépôt :

* `asymmetric` : polygone non rectangulaire à cinq vertices.
* `weighted_complex` : deux influences par vertex, bones hiérarchiques,
  rotation/scale/shear, réflexion et FFD Bézier.
* `partial_ffd` : influences partielles et FFD Stepped par influence.
* `trim_multi` : deux meshes, deux pages, bordures source transparentes,
  trim et draw order animé.
* `topology` : changement pentagone/triangle et de page, retour et cycles.

Chaque nouveau projet est converti avec les API Rust réelles, rebindé puis exporté
avec le preset natif. Dix PNG CPU et quinze poses Rust (dont cinq fondus) sont
archivés par projet. Aucun JSON runtime n'a été patché. La source auteur et le
générateur sont conservés ; les cas API négatifs/synthétiques sont distincts.

Les 153 nouveaux fichiers de qualification sont byte-identiques à leurs
sources exportées/oracles ; avec b.1/b.2, **191 fichiers** sont épinglés.

## Rouge → vert et essais de développement

* Rouge initial : **7/7** tests mesh/FFD échouent sur le refus b.2 ; vert :
  tous chargent et correspondent aux références Rust.
* Régression du binding de noms pendant le développement : un découpage de clé
  composite perdait les caractères de contrôle. Les noms auteur sont désormais
  conservés séparément ; le test Unicode/NUL est vert, sans changer le format.
* Rouge du contrôle backend : aucun refus WebGPU/Canvas ; vert : diagnostic
  explicite, sans mutation de la vue. Les séquences d'images de meshes ont
  également un test rouge/vert de refus conservateur.
* Deux erreurs du générateur de fixtures ont été corrigées **dans sa source** :
  champ auteur `value` de l'attachment et normalisation du temps entrant bouclé
  à la fin du fondu. Les exports ont été régénérés dans de nouveaux dossiers.
  Aucune correction du cœur ni retouche de JSON n'en découle.
* Le premier banc WebGL rééchantillonnait le clip pendant neuf scénarios
  relax/fade de topologie. Ce défaut de banc a été corrigé ; les seuils n'ont
  jamais été élargis. Les logs des tentatives restent disponibles.

## Validation finale

| Contrôle | Résultat |
|---|---|
| `npm test` | **37 core + 61 PixiJS = 98 tests Node**, tous verts ; Phaser build/typecheck et hashes historiques verts |
| `npm run build` / `npm run typecheck` | Core, Phaser, PixiJS verts |
| Parité native historique | 128 cas, 3 328 composants ; max **0,00000643730700744527** |
| Parité nouvelle géométrie | 884 coordonnées de vertices ; max **0,000008106231689453125** |
| Géométrie des sept ensembles antérieurs | Max **0,00001049041748046875** |
| WebGL PixiJS b.3 | **115/115** scénarios |
| WebGL PixiJS b.1 / b.2 | **33/33 + 20/20** |
| Phaser base / dark tint / skins | **21/21 + 32/32 + 153/153** |
| Phaser clipping / concave | **74/74 + 8/8**, soit 328 poses |

Soit **456 scénarios navigateur**, dont les tests historiques inchangés.
Les 31 captures b.1 et 19 captures déterministes b.2 sont byte-identiques aux
checkpoints acceptés. L'exemple b.2 animé est testé mais exclu de cette comparaison
de bytes. Les cinq minutes du jeu Phaser acceptées en b.2 ne sont pas revendiquées
comme un nouveau test d'endurance b.3.

Environnement : Node **24.18.0**, npm **11.16.0**, TypeScript **5.9.3**, PixiJS
**8.17.0**, Phaser **3.90.0**, Brave/Chromium **155.0.8059.80**, Windows,
WebGL2 ANGLE **NVIDIA GeForce RTX 3090 / D3D11**. Le GPU réel est identifié dans
chaque résultat. Aucun rendu CPU-only n'est compté comme preuve WebGL.

Mesures b.3 par barycentriques indépendantes sur UV auteur, lecture des buffers
réels à `drawElements` et `gl.readPixels` :

| Mesure maximale | Obtenu | Tolérance conservée |
|---|---:|---:|
| Affines face à Rust | 0,0000016550439401186168 | 0,01 |
| Vertices, y compris trim | 0,00000983199230830678 | 0,01 |
| Positions réellement soumises au GPU | 0,0000152587890625 | 0,01 |
| UV GPU | 0 | 0,000001 |
| RGB intérieur | 2/255 | 2/255 |
| Alpha intérieur | 1/255 | 1/255 |
| Pixels intérieurs hors seuil | 0 | 0 |
| Fraction de désaccord aux bords | 0,01629638671875 | 0,02 |

Les PNG de clips proviennent du renderer CPU Rust. Pour les fondus, le pixel
oracle Canvas2D utilise les triangles/UV natifs et positions Rust ; il ne lit
pas la géométrie PixiJS. Les deux sources de preuve sont distinguées. Une
capture seule n'est pas utilisée comme mesure numérique. Aucun warning
TypeScript ni console navigateur nouveau. Les messages de canonicalisation du
Cargo externe sous sandbox et de conversion de fins de ligne Git ne sont pas
des warnings du produit.

## Fichiers et préservation

Production : `pixi/src/rig.ts`, `pixi/src/validate.ts`, nouveau `pixi/src/mesh.ts`.
Scripts/docs : un script npm ajouté dans `package.json`, `pixi/README.md`,
`docs/T604b3-validation.md`, `scripts/test-pixi-meshes.mjs`.
Tests : `meshes.test.mjs`, `meshes-webgl.html/mjs`, le refus de mesh mal formé
remplace l'ancien refus global dans `regions.test.mjs`, nouvelles fixtures sous
`pixi/test/fixtures/meshes/`, manifeste étendu sans altérer les 38 entrées initiales.

Tout `core/` et `phaser/`, les fixtures/oracles b.1/b.2 et le lock npm sont
byte-identiques au départ b.3. L'inventaire préalable de 680 fichiers ne change
que pour l'extension attendue du manifeste de provenance. Les 706 fichiers
historiques n'ont aucune modification supplémentaire par rapport à b.2.
Les **57** fichiers Crapaud et **207** références historiques restent intacts.
ZIP candidate1 inchangé :
`7b3e04396d8a145546212cbf9ee784325decf3805602bbcb5f048426b1c6acad`.

Les anciens checkpoints et branches restent conservés. Commit local ciblé après
validation ; états Git et SHA complets dans le rapport de livraison externe.
**STOP après T-604b.3 ; b.4 non commencé.**
