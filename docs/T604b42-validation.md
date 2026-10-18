# T-604b.4.2 — Clipping natif PixiJS / WebGL2

17 octobre 2026. Base `5762e4b40133c4f50178ee78e299e7eab7f3f832`, branche locale `feat/t604b42-pixijs-clipping`. Aucun changement de format, du cœur partagé, de Phaser ou de l’éditeur.

## Verdict

**GO pour le sous-ensemble démontré, après revue.** Clipping géométrique natif, simple périmètre convexe/concave, régions et meshes rigides/pondérés/FFD, atlas trimés/multipages, skins compatibles pendant un fondu et teintes Normal. Aucune nouvelle API publique de masquage à appeler.

**HOLD pour toute extension non qualifiée** : trous, intersection de masques imbriqués, masque FFD/pondéré, linked meshes, séquences mesh, contraintes/physique/paths, blends non Normal, composition multi-skins, atlas tourné, WebGPU/WebGL1, performances mobile/six personnages. Aucun démonstrateur de combat ni publication ne fait partie de ce checkpoint.

## Audit et choix technique

Sources inspectées : éditeur `core/src/attachment.rs` (ClippingAttachment), `core/src/clipping.rs` (triangulation/découpe), `render/src/lib.rs:438–512` (portée et visibilité) ; runtime `core/src/types.ts`, `core/src/attachments.ts`, `core/src/rig.ts`, `phaser/src/phaser.ts` et son banc clipping ; Pixi `rig.ts`, `mesh.ts`, `validate.ts`, `tint.ts` ; code installé PixiJS 8.17.0 `StencilMaskPipe`.

Le cœur expose déjà `attachmentWorldVertices` : il est réutilisé pour le périmètre transformé. Il n’expose pas de découpe de triangles. Le nouvel auxiliaire **dans pixi/** reprend l’approche Rust : triangulation par oreilles du périmètre, puis Sutherland–Hodgman contre chaque triangle, avec interpolation des UV déjà calculés. Il ne réévalue ni animation, ni skinning, ni FFD. Le monde natif Y-up devient Y-down une seule fois, puis les transformations du Container s’appliquent à l’ensemble.

Le stencil Pixi v8 est présent, mais implique des instructions de masque, une cible depth/stencil et des push/pop de portée. La découpe conserve les Mesh/MeshGeometry et le shader two-color existants, sans texture intermédiaire, état stencil/scissor, listener ou passe de masque. C’est une extension locale, et non un second renderer. Le petit garde de parallèle `1e-9` provient de Rust `intersect` ; aucune tolérance de découpe n’a été ajoutée pour masquer des échecs.

## Contrat de portée

- Parcourir le draw order évalué. Un attachment `clipping` introduit un seul masque actif ; une nouvelle introduction **remplace** l’ancien. Aucune pile d’intersections n’est inventée.
- Le slot `end_slot` est inclus. Il termine la portée même invisible ou sans attachment. Null signifie jusqu’à la fin du rig. Une fin déjà passée dans l’ordre ne sera pas rencontrée ensuite. Une fin égale au slot introducteur conserve le comportement Rust jusqu’à la fin : l’introduction fait `continue`.
- Le périmètre est exprimé dans le bone du slot introducteur. Il n’a ni influences, ni FFD dans le contrat natif testé. Il ne dessine aucun pixel.
- Rust CPU introduit le masque **avant** le contrôle de visibilité du slot ; ce comportement est qualifié, y compris l’introduction invisible. Le Phaser historique saute ce slot invisible avant introduction ; cette différence préexistante est documentée, sans toucher Phaser.
- Attachment null : aucune nouvelle introduction. Skins : résolution sélectionné puis default ; changement compatible sans réinitialiser transport/fondu.
- Répétitions, points colinéaires, auto-intersections, dimensions incohérentes, non-finis, aire nulle/non finie, périmètre monde effondré, fin inconnue ou champs de masque non représentés sont refusés. C’est volontairement plus strict que les fallbacks Rust pour un masque mal formé.
- Toute la pose est préparée avant mutation visible. `setPose`/seek invalide préserve l’affichage ; `setSkin` conserve son rollback existant. La politique générale du transport en cas d’exception de rendu reste inchangée : un `playback.update` peut avoir avancé son player avant l’exception ; l’appelant doit traiter l’erreur. Aucun rollback universel du temps n’est annoncé.

## Preuves rouges et références

Avant modification : 1/1 test ciblé rouge, `Attachment mask: clipping unsupported`. Après : **20 nouvelles régressions Node vertes**, dont toutes les poses/fondus Rust, portée historique, refus malformés et préservation de la pose, orientation inverse, réemploi et décodage PNG indépendant.

Trois nouveaux projets auteur isolés (`ffd_alt`, `tint_mesh`, `replacement`) utilisent les vraies API Rust Document/conversion/rebind/preset/run::plan/write. Les projets auteur canoniques, exports natifs et références sont copiés sans patch. Les oracles géométriques appellent Rust `pose::evaluate`, le skinning existant et `core::clipping::clip_triangles`. Les PNG viennent du renderer CPU inchangé. Pour une variante de skin, le générateur fusionne les entries sélectionnées sur default dans le modèle Rust temporaire, puis restaure celui-ci ; l’export natif est produit auparavant.

Douze ensembles Phaser réels sont réutilisés, seulement aux transformations audit/identity correspondantes : rectangle/concave, racine transformée, fins visible/vide/invisible/animée, succession, toggle, mesh multipage dark et draw order. `end-animated` contient un nom d’attachment inexistant à partir de 0,5 s : ces poses restent un **refus**, pas une réussite artificielle. Les autres modes caméra/ancêtres du banc Phaser restent qualifiés côté Phaser seulement.

346 nouveaux fichiers de provenance portent le total à **880**, avec les 534 précédents inchangés. Les 288 PNG CPU supplémentaires sont décodés directement, sans Canvas2D, et vérifiés contre les SHA-256 RGBA de Pillow 12.3.0. Les négatifs synthétiques sont séparés des exports natifs positifs.

## Mesures WebGL

PixiJS 8.17.0 ; Brave/Chromium 155.0.8059.80 ; WebGL2 ANGLE, NVIDIA GeForce RTX 3090, D3D11. Dithering par défaut conservé. Géométrie, buffers/attributs réellement soumis à `drawElements`, uniforms de modèle et `gl.readPixels` sont mesurés. Aucun résultat purement visuel ne tient lieu de preuve.

| Mesure maximale | Résultat | Limite conservée |
|---|---:|---:|
| Position interpolée / référence Rust | 0,000005004 unité | 0,01 |
| Périmètre monde du masque | 0,00003132 unité | 0,01 |
| Distance des vertices aux triangles Rust découpés | 0,000005836 unité | 0,01 |
| Aire des triangles, sources non trimées | 0,0002695 unité² | 0,01 unité² |
| UV page reconstruits depuis Rust | 0,0000001178 | 0,000001 |
| Positions et UV GPU vs buffers mesurés | 0 / 0 | 0,01 / 0,000001 |
| RGB / alpha plats | 2/255 / 1/255 | 2/255 / 1/255 |
| Mauvais pixels plats | 0 | 0 |
| Désaccords de bord | 1,409 % du canvas | 2 % |
| Draw calls de masque | 0 | 0 |

**352 scénarios** : 240 poses natives sur deux fonds, 46 poses historiques, 60 fondus numériques/GPU, 3 stress et 3 doubles instances. Les temps échantillonnés comprennent 0, 0,25, 0,5 et 0,75 s. Les fondus ont des poses Rust indépendantes et des mesures GPU ; aucune image CPU indépendante de fondu n’est revendiquée.

Trois relectures renforcées contrôlent aussi les géométries/UV Rust et les attributs GPU des deux rigs qui se recouvrent, des captures avant/après destruction et un sprite Pixi extérieur. Un replay indépendant, dessin par dessin hors des deux rigs, produit les **mêmes octets**. Le sprite opaque et le second personnage restent identiques après destruction du premier ; stencil/scissor/color write state et listeners/ticker restent stables. Les pages partagées survivent aux instances, puis sont libérées par leur asset propriétaire.

## Ressources et limites de coût

| Rig, après warmup | Rendus | Buffers créés / détruits | Meshes / géométries encore vivantes | Draw calls totaux |
|---|---:|---:|---:|---:|
| ffd_alt | 600 | 2970 / 2970 | 4 / 4 | 2070 |
| tint_mesh | 600 | 2835 / 2835 | 4 / 4 | 2070 |
| replacement | 600 | 1308 / 1308 | 3 / 3 | 1695 |

Zéro création/destruction de texture ou programme après warmup. Les deux moitiés de 300 rendus ne montrent pas de croissance des ressources vivantes. Le Mesh du slot est conservé ; une géométrie de même cardinalité réemploie ses buffers. Une cardinalité différente remplace la géométrie et détruit ses anciens buffers. Les compteurs de géométries observées dans le banc ne comptent que celles effectivement rendues, pas tous les intermédiaires CPU d’un setSkin suivi d’update.

Ce churn est **important** et ne constitue pas une performance optimale. Des capacités de buffers réutilisables, l’évitement de poses intermédiaires non rendues et une triangulation locale mise en cache pourraient le réduire ; aucune refonte n’est engagée. Le shader two-color reste non batché : un draw par slot visible, zéro draw supplémentaire de masque. Complexité CPU liée aux triangles source et aux pièces du périmètre. VRAM totale, mobiles, grands polygones, FPS et six personnages non mesurés.

## Essais intermédiaires conservés

1. Le premier générateur externe utilisait `x` au lieu de `offset_x` pour un calque « after ». Celui-ci se retrouvait au centre, au lieu de vérifier la sortie de portée et le second masque à x=62. Le générateur a été corrigé et de nouveaux exports Rust complets ont été produits dans un nouveau dossier. Les sorties et résultats provisoires restent archivés, sans écrasement.
2. Cette composition provisoire supplémentaire présente 18 pixels plats à 3/255 RGB sur quatre cas opaques trimés ; ces essais ne sont **pas** déclarés qualifiés. Il ne s’agit pas d’un élargissement de tolérance : la qualification finale porte sur le scénario auteur corrigé. La fidélité générale de cette superposition supplémentaire n’est pas établie et reste à revoir séparément. Aucun changement de shader, sampler ou blending n’a été introduit pour la faire passer.
3. Recomposer en double précision deux images de rigs déjà quantifiées RGBA8 n’est pas un oracle exact du rendu multi-draw : le GPU arrondit après chaque slot. Le diagnostic (écart maximal 1,1412 octet) est conservé ; le test d’isolation a été remplacé par le replay exact par draw hors rig. Les comparaisons CPU restent flottantes `RGB*alpha/255`, sans arrondi ajouté et sans modification des seuils.

## Validation générale et préservation

- `npm test` : **136 tests**, 37 core + 99 Pixi, tous verts, dont 20 nouveaux. Contrôles de provenance de tous les jeux Phaser/Pixi verts.
- Build et typecheck des trois workspaces verts. Aucune dépendance/version/lock modifiée ; aucun nouveau warning produit ou console dans les nouveaux cas.
- Bancs Pixi : b.1 33, b.2 20, b.3 115, b.4.1 232, tous verts.
- Bancs Phaser : base 21, dark 32, skins 153, clipping 74 scénarios ×4 poses, concave 8 ×4 poses, tous verts.
- Total : **1040 scénarios navigateur uniques**, plus 3 relectures renforcées ; les scénarios historiques clipping Phaser contiennent chacun quatre poses.
- **165 captures b.1–b.3 identiques octet par octet**, et 232 captures b.4.1 également identiques.
- Éditeur propre : `feat/t2093-mirrored-key-blocks`, `1d3da31a29d2c9e39f19715d55baae840220714b`. Référence Phaser `demo/m0070-crapaud-pharaon` inchangée à `56dc0f10ca27806fcb88839f782a585438bf226a`. Ancienne branche b.4.1 conservée.
- Cœur, Phaser et package-lock inchangés ; 534 fixtures/oracles, 57 fichiers Crapaud et 207 références historiques inchangés. ZIP candidate1 SHA-256 `7b3e04396d8a145546212cbf9ee784325decf3805602bbcb5f048426b1c6acad` préservé.

## Fichiers et reproduction

Production : `pixi/src/clipping.ts` (nouveau), `pixi/src/rig.ts`, `pixi/src/validate.ts`. Aucun changement de `tint.ts`, `mesh.ts`, playback ou cœur partagé.

Tests : `pixi/test/clipping.test.mjs`, `clipping-measure.mjs`, `clipping-webgl.mjs`, `clipping-webgl.html`, `clipping-png-rgba.json`, 346 fixtures et provenance. Exécution : `scripts/test-pixi-clipping.mjs`, script npm correspondant ; README et ce rapport.

```
npm test
npm run build
npm run typecheck
npm run test:pixi-webgl
npm run test:pixi-playback
npm run test:pixi-meshes
npm run test:pixi-appearance
npm run test:pixi-clipping
npm run test:webgl
npm run test:dark-tint
npm run test:skin-uv
npm run test:clipping
# ANKHIMATE_CLIPPING_CONCAVE=1 : rejouer le dernier banc pour ses cas concaves.
```

`ANKHIMATE_BROWSER_PATH` peut désigner un navigateur installé. `ANKHIMATE_TEST_OUTPUT` choisit un dossier de preuves. Les générateurs externes, journaux, mesures complètes, diffs et captures sont remis dans le dossier de livraison T604b42. Pas de push, merge, amend, tag, version, publication ou packaging. Arrêt après ce checkpoint pour revue.
