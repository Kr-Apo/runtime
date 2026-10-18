# M005.3b — Dark tint TypeScript / Phaser WebGL

Validation du 15 octobre 2026. Modifications produit limitées au runtime.
Pas de publication npm, push, merge distant, amend ou release. Aucun travail
M005.4/M006/IA. Aucun patch du renderer Phaser ou de ses prototypes.

## Git et périmètre

- Éditeur propre : `develop` sur M005.2 `13f62df50bc6c603d8580129fcda0e373fa03b76`,
  M005.3a `367238cfa432fb597bbe3c40a64f1c75217a4312` était son descendant direct
  unique. Fast-forward local réalisé conformément à l'autorisation.
- L'éditeur reste ensuite propre sur `develop` / `367238c`. Son `main` reste sur
  `9ab4fa439c3690ca99325e24f57b24dd7399b90b`. Formats, renderer et warning
  `dark-tint-runtime-unapplied` ne sont pas modifiés.
- Runtime initial propre sur `fix/m0032-phaser-alpha`, HEAD
  `6d8f3454aacd6b69fbc3c242b54ba98e19c23f79`. Branche locale créée :
  `fix/m0053b-phaser-dark-tint`.
- Runtime `dev/three-webgpu` reste sur `f478463cc431550cc8faa9788e52ca5fef667c95`,
  `main` sur `513a1045d7cdb6f66323f81ac7b43aaee7074450`.

## Audit, causes et solution retenue

Le contrat Rust M005.3a fournit déjà `slots[].dark_color`, quatre f32 préservés
via le helper JSON, dans le format v2. L'ancien `parseRig` rendait l'objet brut
et conservait donc ce champ inconnu, mais ni le type public, ni la pose, ni
Phaser ne le transportaient/appliquaient visuellement.

La lecture du code installé de Phaser **3.90.0** établit :

- `MeshWebGLRenderer` emploie les pipelines standards, puis leur `onBind` public
  pour chaque GameObject ; un `SinglePipeline` peut conserver le layout des Mesh.
- Les PNG de TextureSource sont envoyés avec `WebGLTextureWrapper.pma=true`.
  La composition Normal utilise `ONE, ONE_MINUS_SRC_ALPHA`.
- Le shader doit sortir du RGB prémultiplié : appliquer directement l'équation
  straight-alpha aux texels prémultipliés serait incorrect, particulièrement aux bords.

La stratégie minimale a été présentée avant implémentation : ajouter le champ
optionnel, copier le sombre statique dans la pose et affecter aux seuls meshes
avec contribution sombre un pipeline standard personnalisé. Sa classe provient
de l'instance SinglePipeline publique du Phaser actif, sans import d'une seconde
copie de Phaser ni dépendance à une variable globale. `onBind` flush le mesh
précédent avant modification des uniforms, pour isoler les couleurs.

Une instance est créée paresseusement par renderer et appartient au gestionnaire
Phaser ; les recréations de rigs la réutilisent. Les coordonnées, projection,
triangles, UV, atlas, masques, sélection des attachments et tri restent sur le
chemin existant. Les slots sans contribution sombre gardent le pipeline initial.

L'équation implémentée pour le texel prémultiplié P est :

```text
pma.rgb = (P.rgb*L.rgb + (P.a-P.rgb)*D.rgb*D.a) * lightAlpha
pma.a   = P.a * lightAlpha
```

C'est l'équivalent de l'équation Rust, sans division par l'alpha. L'intensité
sombre n'est pas l'opacité. Les textures non prémultipliées avec sombre actif
sont refusées explicitement. Les PNG natifs satisfont cette convention.

**Défaut adjacent démontré par les références :** les clés explicites linéaires
ou Bézier de couleur claire étaient évaluées comme stepped. Après ajout de la
teinte sombre, l'écart restait jusqu'à 25 unités RGB prémultiplié / 24 alpha à
t=.25. Une régression a été ajoutée avant ce correctif. Le sampler de tableaux
numériques existant est maintenant réutilisé, sans nouveau canal ni changement
des champs exportés. Les anciennes clés sans courbe gardent leur comportement
stepped ; attachments/visibilité ne changent pas.

## Contrat de lecture et compatibilité

- `RuntimeSlot.dark_color?: [number,number,number,number]` et tuple optionnel
  readonly dans `SlotPose`, copié à l'évaluation.
- Quatre nombres finis obligatoires si le champ est présent : valeurs null/
  undefined explicites, trous, typed arrays, mauvais types/longueurs, NaN/±Inf
  et dépassement numérique JSON sont refusés par `parseRig`.
- Pas d'arrondi, clamp ou coercition f32 au parsing. Les valeurs finies hors
  0–1 sont conservées ; elles ne sont pas une promesse de qualification HDR.
- Champ absent en v1/v2 : pas de nouvelle propriété dans la pose, contribution
  sombre désactivée. Versions inconnues et axes mélangés restent refusés.
- `SlotTrackKey.curve` décrit maintenant un champ déjà écrit par le preset ;
  aucune nouvelle signification du format ni augmentation de format_version.
- Les clips dont une courbe claire explicite était auparavant ignorée retrouvent
  son interpolation : correction intentionnelle de l'ancien rendu stepped.
- API typées de calcul/player : appeler `parseRig` pour des données externes ;
  pas de promesse de validation universelle d'objets mutés après lecture.

## Régressions avant/après

Baseline : 26 tests TypeScript et 13 cas WebGL M003.2 réussis avant modification.
Les cinq nouveaux tests core couvrent le RGBA exact, les données invalides,
le transport statique avec animation/événements/crossfade, l'absence en v1/v2,
et les courbes claires linéaire/stepped/Bézier avec fallback legacy.

Deux tests échouaient avant le transport/validateur. La régression de courbe
claire échouait ensuite avant son correctif. **31 tests réussissent au final.**

Le générateur Rust de test charge le modèle/schéma et utilise réellement le
preset, planificateur et publisher M005.3a ; aucun JSON exporté n'est réparé.
Il produit indépendamment les images CPU avec le renderer Rust existant.

- `dark_tint` / `dark_tint_filtered` : 15 slots, régions et mesh non pondéré,
  quatre pages, intensités 0/.5/1, RGB extrêmes/fractionnaires f32, alpha partiel,
  texels transparents, rampe alpha filtrée, couleur claire animée, attachment,
  draw order, deux clips. Quatre temps, deux fonds, deux cadrages : **32 cas**.
- `walker_dark` : vrai `samples/walker.ankh` chargé en lecture seule, sombre
  défini dans le modèle auteur puis exporté nativement. `walk` et `leg_ik` aux
  quatre temps : **8 poses** supplémentaires.
- Les **59 fichiers** export/CPU sont hashés et ont été reproduits octet par
  octet dans trois nouveaux dossiers. Le générateur refuse un dossier existant.
- Les 19 fichiers M003.2 originaux restent inchangés. Les 13 captures canvas
  sans sombre sont identiques octet par octet à la baseline.

Pour la preuve avant/après, les modules du commit runtime `6d8f345` sont compilés
dans un dossier externe, sans checkout/reset de travail. Le runner substitue
seulement ces modules locaux ; Phaser, données, oracle et tests sont identiques.
Avec l'ancien code, **32/32 cas échouent sur le rendu**, sans erreur JS, warning
ou ressource manquante. Avec le code corrigé, **32/32 passent**. Les huit poses
walker sombres et les treize cas historiques passent également : **53 cas GPU**.

## Mesures WebGL Windows et tolérances

Windows NT 10.0.26300.0 ; exécutable Brave, Chromium **155.0.8059.80** ;
ANGLE **NVIDIA GeForce RTX 3090 / Direct3D11**. Phaser 3.90.0, Node 24.18.0,
npm 11.16.0, TypeScript 5.9.3, Playwright 1.58.2, fflate 0.8.3.
Ce sont des contextes WebGL réels sous Windows en mode headless : les mesures
lisent `gl.readPixels`, et ne reposent pas sur des captures du DOM.

| Mesure | Seuil | Maximum observé |
| --- | --- | --- |
| Zones uniformes Normal, RGB prémultiplié CPU/GPU | 2/255 | 2/255 |
| Même contrôle, alpha | 1/255 | 1/255 |
| Bord LINEAR vs oracle bilinéaire aux coordonnées GPU, RGB prémultiplié | 2/255 | 1/255 |
| Même oracle, alpha | 1/255 | 1/255 |
| Rampe alpha CPU/GPU, RGB prémultiplié | 4/255 | 3/255 |
| Même rampe, alpha | 3/255 | 2/255 |
| Walker sombre, intérieur à ≤8/255 | ≥99,5 % | 100 % des pixels intérieurs comparés |
| Walker sombre, image complète hors seuil incluant les bords | <2 % | 0,8865 % |

Les comparaisons uniformes utilisent 810 pixels/cas ; le bord utilise des milliers
de pixels/cas. Le CPU échantillonne `u*(width-1)` et le GPU `u*width-.5` : le
décalage ≤.5 texel sur la rampe de 32 texels explique environ deux unités alpha
à demi-opacité, plus les arrondis. D'où un seuil CPU distinct sur cette rampe,
maintenu avec un oracle shader indépendant strict. **Aucun décalage UV ou pixel
n'est appliqué pour masquer cet écart.** Le filtrage LINEAR est explicitement
activé, séparément de MSAA désactivé pour une couverture géométrique déterministe.

Normal est qualifié dans ces cas. Add/Multiply/Screen passent les sondes GPU
de leurs équations Phaser sur fond opaque à ≤2/255 ; pas de promesse de parité
Rust générale. Les équations Rust Multiply/Screen sur RGB straight diffèrent de
la composition PMA de Phaser. Les destinations transparentes non-Normal restent
non qualifiées, de même que HDR, textures arbitraires, clipping, atlas tournés/
trimés combinés et meshes pondérés/linked/deform complexes ou physique.

## Exemples et lecture continue

Nouvel exemple indépendant `examples/phaser-dark-tint` : vrai export natif et
quatre pages inchangés, lecture des deux clips, déplacement clavier, transition
.25 s, événements observables, transparence et compteurs de ressources.
Installation `npm ci` vérifiée dans une copie externe avec son propre lockfile.

- **300,841 s** de mur et playback avançant ; 43 319 frames, 302 événements,
  301 boucles. Zéro erreur JS, warning ou ressource manquante.
- **30 destructions/recréations** du rig : 10 pipelines, 11 wrappers de buffers,
  32 programmes, 61 textures, 1 objet de scène, 15 meshes avant/après et stables
  pendant cinq minutes. Une seule pipeline sombre supplémentaire est conservée
  par renderer jusqu'à sa destruction par Phaser.
- Le jeu M003.2 inchangé est copié hors dépôt avec les nouveaux artefacts runtime :
  **300,716 s**, 43 402 frames, 602 événements, 300 boucles, mouvement/collecte,
  changement de clips, zéro erreur/warning/manquant.
- Les archives finales actualisent la documentation des packages. Leurs **56
  fichiers compilés** sont identiques à ceux des archives ayant passé cinq minutes.
  Une copie indépendante réinstallée avec les archives finales passe aussi le
  smoke test. Les anciens vendors/assets M003.2 ne sont pas modifiés.

Ces compteurs n'établissent pas une absence universelle de fuite de heap JS.
Un GPU/navigateur seulement est qualifié ; aucun débit ou support complet de
tous les cas de two-color tint n'est annoncé.

## Contrôles finaux

| Contrôle | Résultat |
| --- | --- |
| `npm test` | 31 tests, typecheck Phaser, 19 anciens et 59 nouveaux hashes : OK |
| `npm run build` / `npm run typecheck` | Core et Phaser : OK, aucun nouveau warning |
| `npm run test:webgl` | 21 cas : 13 historiques + 8 walker sombre, OK |
| `npm run test:dark-tint` | 32 cas, OK |
| Références Rust/TypeScript existantes | 128 cas d'axes et 4 cas JSON/échappement : conservés |
| Générateur Rust | Formatage et Clippy `-D warnings` : OK |
| Deux exemples, lecture continue | Deux fois ≥300 s, OK |
| Reproduction native/CPU | 59 fichiers identiques, OK |
| Éditeur | Source, formats, renderer, warning et arbre de travail inchangés après le fast-forward |

Les 1 094 tests Rust de M005.3a ne sont pas revendiqués comme relancés ici :
aucun code éditeur n'a changé. Les références Rust et nouveaux oracles ont bien
été exécutés. Aucun nouveau package de production ou changement des dépendances
core/adapter ; le crate Rust est un outil de référence de test indépendant.

## Fichiers et livrables

- Produit : `core/src/types.ts`, `rig.ts`, `evaluate.ts`,
  `phaser/src/phaser.ts` et nouveau `phaser/src/dark-tint.ts`.
- Tests : nouveau `core/test/dark-tint.test.ts`, page/runner sombre, extensions
  du runner WebGL/mesures historiques, baseline historique et contrôle des hashes.
- Références : trois nouveaux dossiers sous `phaser/test/fixtures`, manifest
  SHA-256 et générateur `tools/dark-tint-reference` avec son lockfile.
- Exemple : `examples/phaser-dark-tint`, assets, vendors privés hashés, source,
  serveur local, lockfile, guide et contrôle d'intégrité.
- Documentation : README root/core/Phaser/tests, guide PSD,
  `docs/dark-tint.md`, ce rapport. `.gitattributes` préserve les bytes des nouveaux
  assets/vendeurs à travers les checkouts Windows. Scripts npm dédiés ajoutés.

Journaux, captures avant/après, résultats JSON, installations indépendantes et
preuve d'identité des builds sous `work/m0053b` hors dépôt produit ; paquet de
revue et diff complet dans `outputs`. Aucun original remplacé par un oracle.

## Warning Rust et suite

Le warning `dark-tint-runtime-unapplied` est volontairement conservé tel quel.
Après revue et coordination de **nouvelles versions core/adapter correspondantes**,
préciser le support statique Normal qualifié et les versions nécessaires. Si
l'éditeur ne connaît pas le runtime installé dans le jeu, conserver le consentement
avec un message de compatibilité ; v2 ou le seul nom du preset ne prouvent pas
que l'ancien lecteur applique le sombre. Les anciens presets/pertes et les
combinaisons non qualifiées doivent conserver leurs avertissements.

La recommandation détaillée et les limites sont dans [dark-tint.md](../dark-tint.md).
Attendre la revue avant toute publication, modification du warning éditeur ou suite.
