# M005.4b3 — Clipping Phaser WebGL, A03

Validation du 15 octobre 2026. Base propre runtime
`9baba5a59fda2f57ba8f0da64bdcb0630dbe489c`, branche
`fix/m0054b3-phaser-clipping`. Éditeur `develop` propre à
`17d85aec3da14e82d3e7f1d5b65cea1844c8619c`, entièrement en lecture seule.

## Causes et choix des API

Dans Phaser 3.90.0, `ContainerWebGLRenderer` transmet sa matrice au rendu du mesh,
mais appelle le masque sans cette matrice. `GeometryMask.applyStencil` appelle
directement le Graphics, sans matrice de parent. Le Graphics enfant invisible du
rig dessinait donc le polygone dans un autre espace que les triangles.

Les API publiques suffisent : `scene.make.graphics({}, false)`,
`getWorldTransformMatrix`, `getX/getY`, commandes de Graphics, `setScrollFactor`,
événement Scene `prerender`, événement Container `destroy` et `GeometryMask.destroy`.
Le polygone passe de l'espace rig Y-up à l'espace local écran Y-down, puis dans
l'espace monde de Phaser par la matrice complète du root et de ses ancêtres.
Le Graphics, hors Display List et Container, reste à transformation identité.
Phaser applique ensuite normalement chaque caméra. Aucune inversion de caméra,
translation de compensation, décomposition approximative d'affine, modification
de prototype ou fork de Phaser.

Le suivi intervient juste avant le rendu : changer un Container après
`rig.update()` est pris en compte dans la même frame. Les facteurs de scroll du
root et de ses ancêtres sont multipliés pour reproduire ceux des meshes. Le coût
est proportionnel aux sommets de clipping et à la profondeur des Containers ;
un listener par rig possédant du clipping. Les Graphics et GeometryMasks sont
réutilisés et libérés à la destruction du root, listener compris. Les rigs sans
clipping n'installent aucun listener de synchronisation.

L'autre défaut venait des `continue` avant la fermeture de `end_slot`. La boucle
retient maintenant le masque applicable au slot courant, puis clôture le groupe
pour les slots suivants avant toute sortie anticipée. Ainsi un slot de fin
dessiné reste masqué ; son successeur ne l'est plus, même si le slot de fin est
vide, invisible, non résolu ou non dessiné par cette cible.

## Preuve rouge / verte

Avant modification produit, 268 poses ont été mesurées : 11 réussites et
257 échecs. Le contrôle Container identité passe 4/4 ; les régressions isolées
Container transformé et fin vide échouent chacune 4/4. Un cas supplémentaire
d'ordre de dessin rejoué contre le build de référence échoue 28/28.
Total de référence rectangulaire : **285 échecs sur 296 poses**.

Après correction : **296/296 poses rectangulaires**, réparties en 74 scénarios.
Les 5 exports M005.4a et leurs atlas restent identiques octet pour octet.
Les autres cas viennent du vrai exporteur natif, sans retoucher le JSON.

| Contrôle | Preuve |
|---|---|
| Container réellement identité | `audit-identity`, 4 poses |
| Translation, échelle uniforme et non uniforme | exports d'audit et cas dédiés |
| Rotation, parent avec rotation/échelle non uniforme | modes rotated/nested |
| Caméra scroll/zoom/rotation et scroll factor | modes camera/parallax |
| Transformations après update pendant le clip | mode dynamic, quatre temps |
| end_slot vide, inconnu, invisible, path non dessiné | cas end-* |
| end_slot dessiné et changements d'attachment | end-visible/end-animated |
| Plusieurs groupes successifs | successive |
| Mesh, trois pages d'atlas, dark tint et alpha | mesh-multi-dark |
| Activation/désactivation de clipping | toggle |
| Ordre de dessin animé, slot déplacé dans le groupe | draw-order |

Le mode nommé `identity` des nouveaux cas centre le rig par une translation
viewport ; le véritable Container identité est testé séparément par
`audit-identity`, avec les positions monde du document d'audit.

Les 296 poses ont **zéro pixel intérieur hors seuil**. Écart maximal CPU/WebGL
prémultiplié : **1/255 RGB, 0/255 alpha** ; sondes dédiées ≤ 1/255.
Seuils fixés dans le banc avant correction : 2/255 RGB, 1/255 alpha dans les zones
plates, au plus 2 % de pixels de bord divergents. Les rasterizers CPU/GPU ont des
conventions de couverture différentes ; ces seuils ne sont pas une promesse
d'identité pixel parfaite sur tous les contours.

Sur la fixture historique fin vide à 0,5 s : le pixel suivant le groupe, écran
(180,128), devait être rouge `[255,32,16,255]` ; il était transparent avant et
est exactement rouge après. La sonde masquée (148,112) reste `[0,0,0,0]` et la
sonde intérieure (116,112) conserve `[32,64,96,128]` prémultiplié. Les 484 pixels
intérieurs incorrects de cette pose passent à zéro.

## Concavité et ressources

Le polygone simple en L est testé séparément : 32/32 poses passent après
correction, contre 0/32 avant. Il ne subsiste pas de divergence sur **ces deux
fixtures simples**. Aucune qualification générale de concavité, trous,
auto-intersections, dégénérescences, masques imbriqués ou combinaisons complexes.
L'avertissement existant de qualification du clipping reste intact.

Deux stress tests exécutent 32 créations/destructions chacun, avec quatre
changements de pose/activation/rotation rendus par rig : **64 rigs et
256 changements**. Destruction alternée via `PhaserRig.destroy` et
`root.destroy`. Après chaque cycle : aucun enfant Scene ni listener prerender
retenu ; Graphics détruits, `GeometryMask.geometryMask=null`, textures et
compteurs d'allocations/suppressions buffers/textures GL stables. Le stencil de
GeometryMask n'alloue pas de texture de masque privée. Ces mesures bornées ne
constituent pas une preuve universelle d'absence de fuite mémoire JavaScript.

## Non-régression

- 34/34 tests TypeScript, build et typecheck core/Phaser : OK.
- 77/77 cas WebGL historiques : 21 personnages/projection, 32 dark tint,
  20 FFD et 4 bornes décimales FFD.
- 153/153 cas WebGL skins M005.4b2, dont leurs 2 304 changements rendus.
- 128 références Rust/TypeScript d'animation et quatre round trips de chaînes
  correspondent à l'exporteur Rust actuel. v1/v2 et FFD restent inchangés.
- 400 fichiers de fixtures/source vérifiés par hash ; 395 sorties du générateur
  reproduites octet pour octet. Formatage et Clippy du générateur avec
  `-D warnings` : OK.
- Sur 230 captures historiques, 228 sont pixel-identiques ; deux captures
  walker_dark (0,25 et 0,75 s) diffèrent d'un niveau sur un pixel de bord chacune.
  Répétitions avant/après : écarts limités au même ordre de grandeur, avec la
  variation à 0,25 s également reproduite par le build non corrigé.
  Aucun seuil de validation historique n'a été élargi.

Tests sur Windows, Brave/Chromium 155.0.8059.80, Phaser 3.90.0, véritable WebGL
ANGLE/NVIDIA RTX 3090 Direct3D11. Aucun warning de compilation/typecheck/Clippy
ni erreur, warning ou ressource manquante dans les validations navigateur réussies.
Le jeu autonome utilise des archives locales du build courant, avec 56 fichiers
installés identiques ; sa session prolongée et les contrôles post-commit sont
consignés dans la livraison.

## Reproduction et limites

`npm test`, `npm run build`, `npm run typecheck`, `npm run test:clipping`, puis
`ANKHIMATE_CLIPPING_CONCAVE=1` pour le run concave séparé. Les commandes WebGL
historiques restent `test:webgl`, `test:dark-tint`, `test:skin-uv`. Voir
`tools/clipping-reference/README.md` pour le générateur indépendant et le choix
du navigateur. Le banc externe M005.4b1 est réutilisé pour ses 24 poses FFD.

Les changements de transforms doivent être faits avant le hook Scene prerender,
selon le parcours normal update/rendu. Les mutations tardives effectuées par un
autre hook après cette synchronisation, les effets caméra, post-process,
plusieurs caméras simultanées, miroirs/échelles négatives et masques de Container
externes ne sont pas qualifiés par cette matrice. Le calcul de matrice complète
ne dépend pas d'une caméra particulière, mais cela ne suffit pas à qualifier
toutes ces interactions.

Aucune modification Rust éditeur, évaluateur, modèle, schéma, format v1/v2,
physique, Path constraints ou blending. La suite Rust workspace complète n'est
pas relancée : l'éditeur reste exactement au checkpoint accepté ; ses références
pertinentes sont exécutées en lecture seule. Aucune suppression d'avertissement.
Arrêt après M005.4b3 ; aucune publication ni démarrage de M006.
