# T-604b.4.1 — Skins, teintes et blending PixiJS

17 octobre 2026. Base runtime `fe40533546e21e8fcb996ba2f0f41b09f4d0aa6e`, branche locale `feat/t604b41-pixijs-appearance`. Aucun changement du cœur, de Phaser, du format v2 ou du dépôt éditeur.

## Résultat et contrat

| Fonction | Résultat qualifié |
|---|---|
| Skin dynamique | `instance.setSkin(name)` / `instance.playback.setSkin(name)`, lecture via `skinName` |
| Résolution | Un skin sélectionné, puis fallback par slot/attachment vers default ; aucune composition multi-skins |
| Apparence | Régions ↔ meshes, textures/pages différentes, topologies différentes, attachment animé/masqué et draw order |
| Transport | Temps, vitesse, pause, crossfade, callbacks et lot d’événements préservés ; aucun événement créé par setSkin |
| FFD | Skins compatibles qualifiés, y compris poids, trim et alpha ; refus d’une variante incompatible avant mutation visible |
| Teintes | Light RGB/alpha animés et dark RGBA statique, régions et meshes pondérés/FFD |
| Normal | Source-over PMA, fonds transparent et opaque qualifiés |
| Additive / Multiply / Screen | Refus explicite au chargement : absence de contrat général commun démontrée par les contrôles |
| Clipping, linked meshes, séquences mesh | Refus conservés ; aucune implémentation b.4.2 |

`RigPlayer.setSkin` ne remet à zéro ni les pistes ni le fondu. Le contrôleur Pixi l’appelle, prépare la pose sans avancer le temps puis publie toute l’apparence. Un refus restaure le nom du skin côté player ; il ne touche ni la pose visible ni le lot d’événements. Un skin incompatible avec **n’importe quelle piste FFD du rig** est refusé, même si cette piste n’est pas active. Ce choix conservateur garantit que le changement n’accepte pas un futur clip impossible. Il vérifie les dimensions, pas une correspondance sémantique/retargeting entre maillages arbitraires.

Un seek/setPose direct reste détaché du transport ; setSkin conserve sa pose, au lieu de revenir au setup. Les commandes play/stop et la politique historique d’événements `(from,to]`, t=0 ignoré, restent inchangées. Les textures empruntées détruites par l’appelant constituent une mauvaise utilisation ; le test de page cible détruite démontre le refus sans mutation supplémentaire, pas la réparation de cette texture.

## Audit et formule exacte

Sources : `core/src/player.ts` (setSkin/pose), `core/src/attachments.ts` (fallback), `core/src/types.ts`, `phaser/src/dark-tint.ts`, `phaser/src/phaser.ts`, et éditeur `render/src/lib.rs:908–966`.

Avec texel prémultiplié `(P,a)`, light `(L,o)` et dark `(D,q)` :

```
RGBp = [P*L + (a-P)*D*q] * o
A    = a*o
```

`q` est l’intensité de l’ombre, pas une opacité supplémentaire. Les composantes sont finies dans [0,1]. Le v2 réel représente dark statique ; aucun canal d’animation dark n’est inventé. L’arithmétique conserve les conventions existantes des composantes PNG, sans nouveau modèle colorimétrique.

Un petit shader WebGL ciblé applique cette formule, y compris D=0. Il évite la seconde quantification de tint PMA dans les attributs 8 bits du batcher Pixi. Mesh, MeshGeometry, atlas, coordonnées et moteur commun restent réutilisés ; aucun nouveau renderer/sampler. Transformations, teinte et alpha des parents passent par les uniforms Pixi. Les uniforms de teinte sont propres à chaque slot/instance et copiés depuis la pose. Le programme est partagé par le cache Pixi ; ses bindings privés sont libérés à la destruction.

**Coût explicite : les meshes utilisant ce shader ne sont plus batchés.** Les 165 captures historiques comparables restent néanmoins identiques octet par octet. Aucune promesse de 60 FPS, de VRAM totale stable ou de performance mobile n’est faite. Le renderer possède son cache de programmes ; détruire une instance ne détruit pas le programme partagé.

### Pourquoi ne pas mapper les noms des blends

Rust CPU utilise des couleurs source/destination droites S,D et alpha a :

| Mode | RGB CPU avant saturation | Alpha CPU | Convention Pixi PMA |
|---|---|---|---|
| Normal | `(S*a + D*Da*(1-a))/Ao` | `a+Da*(1-a)` | Équivalent source-over |
| Additive | `S*a + D` | `Da` | ONE/ONE augmente aussi alpha |
| Multiply | `S*D + D*(1-a)` | `Da` | DST_COLOR/ONE_MINUS_SRC_ALPHA multiplie des composantes PMA et utilise alpha-over |
| Screen | `S + D*(1-S)` | `a+Da*(1-a)` | ONE/ONE_MINUS_SRC_COLOR emploie source PMA |

Add peut coïncider sur fond opaque, mais cela ne prouve rien sur fond transparent. Son contrôle opaque conserve la mesure sans exiger artificiellement une divergence ou une égalité (les arrondis peuvent varier de quelques octets). Le refus est global : aucune exception « opaque seulement » et aucune détection implicite de la cible de rendu. Phaser reste inchangé. Les contrôles expérimentaux construisent des Mesh Pixi depuis les exports natifs non modifiés, avec le même shader source, puis emploient les facteurs de blend natifs ; ils ne contournent jamais la gate de l’adaptateur pour un usage produit.

## Références et rouge → vert

Huit nouveaux projets auteur minimaux, hors dépôts, sont convertis par les vraies API Rust (`Document`, rebind, preset natif, run::plan/write) : skins, ffd_alt, tint_grid, tint_mesh et quatre modes de blend. Aucun JSON runtime n’est patché.

343 fichiers copiés : 8 projets auteur, 8 JSON runtime, 31 pages atlas, 8 fichiers de poses/fondus et 288 PNG CPU indépendants. Les skins CPU sont résolus en fusionnant les entries du skin sélectionné sur default via le modèle Rust, puis restaurés ; aucun changement du renderer/exporteur. Les variantes incompatibles sont exclues des oracles positifs et testées comme refus.

* Avant correction : **10 échecs sur 14 tests Node**, API absente, topologies refusées globalement et dark tint refusé ; 2/2 reproductions WebGL rouges. Les 4 tests verts étaient les refus attendus.
* Après correction : **18 nouvelles régressions Node** (17 apparence + un test vérifiant les 288 décodages PNG), ajoutées aux 98 tests précédents.
* Les tests couvrent instanciation alternative, fallback, région/mesh/topologie, FFD, skin inconnu/incompatible, page cible détruite, temps/fondu/événements/pause, callback changeant le skin, deux instances, données immuables et libération des ressources.

### Correction du banc, sans élargissement de tolérance

Les essais intermédiaires passaient les PNG CPU par Canvas2D avant comparaison. Ce passage prémultiplie et déprémultiplie en 8 bits : il altérait certains octets droits de référence et créait un dépassement flottant artificiel, par exemple 2,0588 au lieu du seuil 2. Un essai diagnostique PMA8 arrondi et un essai sans dithering sont conservés, mais **ne constituent pas la qualification finale**.

Le banc final décode directement les octets RGBA8 des PNG Rust. Son décodeur limité aux fixtures de confiance RGBA8 non entrelacées est vérifié contre **288 SHA-256 RGBA produits indépendamment par Pillow 12.3.0**. Il ne sert pas au chargement produit et n’ajoute aucune dépendance npm. La comparaison finale reste flottante `RGB * alpha / 255`, **sans arrondi ajouté**, comme les seuils b.1–b.3 : RGB 2/255, alpha 1/255, zéro mauvais pixel plat, bords ≤2% du canvas. Le dithering GL par défaut reste actif.

Les lecteurs GPU historiques prennent en compte l’uniform de modèle réellement soumis pour les meshes non batchés, au lieu de supposer des attributs déjà en coordonnées écran. Leurs oracles et comparaisons flottantes sont inchangés. Le test négatif dark valide est remplacé par un dark invalide ; l’alpha est vérifié sur la pose plutôt que sur une propriété interne maintenant transportée par uniform.

## Résultats finaux

| Contrôle | Résultat |
|---|---|
| Node workspace | **116/116**, 37 core + 79 Pixi, zéro skip |
| Build / typecheck workspace | Core, Phaser et Pixi verts |
| Nouveaux scénarios navigateur | **232/232**, dont 226 qualifications et 6 contrôles de blends |
| Renforcement multi-instance | 2/2 rejoués avec clips/couleurs différents et pixels identiques après destruction de l’autre instance |
| Pixi historique | **33/33 + 20/20 + 115/115** |
| Phaser historique | **21/21 + 32/32 + 153/153 + 74/74 + 8/8** ; clipping : 296 + 32 poses |
| Captures historiques comparables | **165/165 identiques** : 31 b.1 + 19 b.2 + 115 b.3 ; exemple b.2 à ticker autonome exclu de cette égalité stricte |
| Fixtures | 191 anciennes intactes, 343 nouvelles épinglées ; 534 hashes vérifiés |
| Préservation | core/Phaser inchangés, 57 fichiers Crapaud, 207 références historiques et ZIP alpha intacts |

Les 232 scénarios incluent 192 poses (4 temps, 2 clips, skins et fonds), 24 fondus, 3 stress de 600 changements, 2 multi-instances, 2 constructions directes, 2 tests d’isolation de pose, 1 callback et 6 contrôles de blend. Les deux cas multi-instance ont ensuite été renforcés et rejoués ; les résultats agrégés indiquent explicitement ces deux sources. Les catégories incluent chargements/contrôles ; ce ne sont pas toutes des mesures de poses indépendantes. Aucun nouveau warning produit dans les tests/compilations finaux.

Backend mesuré : Brave/Chromium **155.0.8059.80**, Pixi **8.17.0**, Phaser **3.90.0**, WebGL2 matériel **ANGLE / NVIDIA RTX 3090 / D3D11**. Node 24.18.0, npm 11.16.0, TypeScript 5.9.3. Les avertissements initiaux de canonicalisation/hard-link du sandbox Rust sont des avertissements d’environnement du générateur externe, pas des warnings ajoutés au produit.

| Mesure maximale nouvelle | Valeur | Limite |
|---|---:|---:|
| Affines Rust/TS | 0,000001908 | 0,01 |
| Sommets Rust/Pixi | 0,000005004 | 0,01 |
| UV hors rectangle (arrondi flottant) | 0,00000001118 | 0,000001 |
| Attributs GPU vs géométrie/uniforms soumis | 0 position / 0 UV | 0,01 / 0,000001 |
| Pixels plats | RGB 2 / alpha 1, 0 mauvais | 2 / 1 |
| Fraction de bords divergents | 1,387% | 2% |

Cycles de 600 rendus, après warmup de toutes les pages/skins exercés : skins 42 créations/42 destructions de buffers GL ; FFD compatible 0/0 ; dark+trim 1800/1800. Dans les trois cas : deux géométries vivantes, deux Mesh, zéro nouvelle texture/programme GL après warmup. Le trim change la topologie entre variantes et reconstruit donc la géométrie ; cela est équilibré, sans promesse d’absence de churn ni de mesure totale VRAM.

Contrôles blending : alpha maximal divergent de **83/255** pour Add/Multiply sur fond transparent ; RGB jusqu’à environ 31–37/255 sur ce fond, Multiply jusqu’à 42/255 et Screen 60/255 sur fond opaque. Les mesures détaillées, captures et la variation d’arrondi du contrôle Add opaque sont conservées dans les JSON ; ces écarts justifient le refus, pas une annonce de prise en charge.

## Fichiers et reproduction

* Produit : `pixi/src/rig.ts`, `playback.ts`, `validate.ts`, nouveau `tint.ts`.
* Tests : apparence Node/WebGL, décodeur et hashes indépendants PNG, adaptation minimale des trois lecteurs GPU historiques et du test régions.
* Données : `pixi/test/fixtures/appearance/` et ajout au manifeste de provenance.
* Entrée de validation : `scripts/test-pixi-appearance.mjs`, commande `test:pixi-appearance` ; documentation `pixi/README.md` et ce rapport.
* Aucun changement de versions/dépendances ou de package-lock.

```
npm test
npm run build
npm run typecheck
npm run test:pixi-appearance
npm run test:pixi-webgl
npm run test:pixi-playback
npm run test:pixi-meshes
# puis les bancs Phaser test:webgl / test:dark-tint / test:skin-uv / test:clipping
# ANKHIMATE_CLIPPING_CONCAVE=1 pour le lot concave
```

Définir `ANKHIMATE_BROWSER_PATH` vers le navigateur matériel testé et `ANKHIMATE_TEST_OUTPUT` vers un dossier neuf. Les sources Rust du générateur, logs rouges/verts, mesures brutes GPU, PNG, diff et contrôles d’intégrité sont livrés hors dépôt dans `outputs/T604b41-PixiJS-appearance/`.

## Limites et verdict

**GO pour la revue de T-604b.4.2**, avec le périmètre explicite Normal + skins/FFD compatibles + teintes qualifiées. Ce GO ne constitue ni autorisation d’implémenter le clipping ni publication.

Restent volontairement refusés : blending non Normal, clipping/masques, linked meshes, séquences de meshes, contraintes/physique/paths non qualifiés. Pas de retargeting, composition multi-skins, WebGPU, nouveau format ou nouveau sampler. WebGL1/mobile, FPS et mémoire GPU totale ne sont pas qualifiés. Les anciens tests d’endurance de cinq minutes conservent leur preuve historique ; ils ne sont pas présentés comme rejoués ici.

L’éditeur reste sur `1d3da31a29d2c9e39f19715d55baae840220714b`, branche `feat/t2093-mirrored-key-blocks`, propre. La branche Phaser historique reste sur `56dc0f10ca27806fcb88839f782a585438bf226a`. ZIP alpha : `7b3e04396d8a145546212cbf9ee784325decf3805602bbcb5f048426b1c6acad`. Aucun push, merge, amend, tag, publication ou packaging. STOP après ce checkpoint.
