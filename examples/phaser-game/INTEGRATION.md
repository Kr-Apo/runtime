> Candidat M006.1 : consulter `alpha-snapshot.md` et la matrice canonique
> `editor/docs/alpha-scope.md`. Le jeu préparé dans le ZIP se lance avec
> `node server.mjs`, sans npm ni construction. Les commandes npm ci ci-dessous
> concernent le checkout source. Physique native incompatible ; anciens v2 à
> FFD non linéaire incorrecte à réexporter. Les qualifications avancées sont
> limitées aux scénarios M005.3/M005.4, pas à toutes les compositions.

# D’un PSD à une animation jouable dans Phaser

Ce parcours utilise l’éditeur Ankhimate pour fabriquer les données, puis les
API publiques du runtime dans un jeu Phaser indépendant. Le navigateur ne lit
pas directement le PSD : il charge le JSON runtime et ses pages d’atlas PNG.

## Versions et sources réellement testées

| Élément | Référence |
|---|---|
| Éditeur | référence `17d85aec3da14e82d3e7f1d5b65cea1844c8619c` + préparation M006.1 |
| Code runtime corrigé | snapshot `m0061-8888e0e`, code `8888e0e74ad642818c076c6446cca3d9358dd05f` |
| Packages locaux | `@ankhimate/runtime` 0.1.1, `@ankhimate/phaser-runtime` 0.1.0 |
| Phaser | **3.90.0**, verrouillé dans l’exemple |
| Node | **24.18.0** pendant la validation ; exemple prévu pour Node 22+ |
| Tests navigateur | Playwright **1.58.2**, navigateur Brave installé signalant Chromium **155.0.8059.80** |
| WebGL Windows | ANGLE / Direct3D11, NVIDIA GeForce **RTX 3090** |

Ces packages sont des **archives locales testées**, pas une publication npm.
Les versions 0.1.1 / 0.1.0 ne prouvent pas à elles seules la présence du lecteur
v2 ou du correctif Phaser. L’exemple fournit les archives, leurs intégrités dans
le lockfile et leurs SHA-256 dans `vendor/provenance.json`.

## 1. Préparer et importer le PSD

Conserver les parties articulables sur des couches distinctes. Les groupes et
les tags du nom de couche pilotent l’inférence du rig. Par exemple, `bras
[bone]` demande un bone ; `[ignore]` exclut une référence de dessin. Éviter de
fusionner toutes les parties en une seule image avant l’import. Les conventions
complètes restent celles de `editor/docs/psd-import.md`.

Dans Ankhimate, utiliser **File > Import > Photoshop PSD** pour le parcours
validé de chargement. Après succès, le workspace et le rapport d’import sont
visibles. Lire les approximations et les couches ignorées avant de poursuivre.
Le PSD de test donne 4 bones, 9 slots et 11 images ; deux couches sont ignorées.

File Import, Assets et le glisser-déposer PSD ouvrent la même preview avec Scale,
Skip hidden layers et choix Replace/Merge. L'import confirmé utilise la commande
undoable existante ; annuler conserve le document courant. Les protections
Save/Discard/Cancel et l'historique sont conservés. Un Redo ne relit pas le PSD.

## 2. Rigger, animer et sauvegarder

En **Setup**, vérifier le parentage, les pivots, le placement des images et les
slots. Tester la rotation d’une articulation avant de construire tout le cycle.
En **Animate**, créer/sélectionner un clip, poser des clés, déplacer le playhead
et vérifier le résultat. Pour une intégration avec changement d’animation,
préparer deux vrais clips dans le document ; le runtime n’en crée aucun.

Les références de cette mission sont :

- `walker.ankh` : `walk` et `leg_ik`, deux clips d’une seconde en boucle ; `walk`
  contient des événements `footstep` avec les payloads `left` / `right`.
- `tagged_rig.psd`, importé puis animé dans l’éditeur pendant M002 :
  `animation_1`, une seconde en boucle, avec root X de 0 à 1 et une séquence
  d’attachment de trois images. Ce PSD géométrique n’a pas deux clips jouables.

Pour votre personnage, ajouter un événement au clip concerné si le jeu doit
réagir à un pas ou à une action. Sauvegarder le **projet auteur** avec File >
Save / Save As avant d’exporter. Ctrl+S et Ctrl+Shift+S ont été qualifiés en M005.1, y compris avec un champ
de saisie focalisé ; Settings conserve sa capture de raccourcis.

## 3. Exporter les données et l’atlas

Afficher le panneau **Export** depuis View, choisir le preset intégré
**Ankhimate runtime**, puis sélectionner un dossier de sortie dédié. L’export
doit contenir `skeleton.json` et toutes les pages d’atlas référencées dans
`atlas.pages`. Copier l’ensemble du dossier dans les ressources du jeu.

Vérifier le succès de l’export et ses avertissements. Un vieux preset enregistré
dans un projet peut conserver son ancien corps v1 : sélectionner le preset
intégré actuel pour produire le v2. Ne pas simplement modifier `format_version`
dans le JSON ; les structures des canaux sont différentes.

Le projet `.ankh` reste la source à conserver. Le JSON runtime n’est pas un
fichier d’édition et ne doit pas être corrigé à la main pour compenser une
inversion, un canal perdu ou une courbe dégradée.

## 4. Lancer l’exemple autonome

```powershell
cd D:\Ankhimate\runtime\examples\phaser-game
npm ci
npm run check
npm start
```

Ouvrir `http://127.0.0.1:4173`. Flèches gauche/droite ou A/D déplacent le
personnage ; les cinq éclats sont collectables. Les boutons et Espace changent
entre les **vrais** clips `walk` / `leg_ik` avec une transition de 0,25 s.
Le compteur montre les événements reçus. À droite, le PSD exporté joue son
unique clip. Tous les fichiers sont locaux, sans CDN ni processus éditeur.

Le dossier `phaser-game` peut être copié hors du dépôt puis lancé avec les mêmes
commandes. Ses dépendances, archives et assets ne renvoient pas au dossier
parent. `npm run check` protège les artefacts de validation livrés ; si vous
remplacez intentionnellement ces exports dans votre propre projet, conservez
une nouvelle provenance vérifiée plutôt que de masquer un échec de checksum.

## 5. Intégrer votre propre export

Lire `src/game.js` de l’exemple. Le schéma minimal est le suivant ; les clés
de texture peuvent être choisies par le jeu, mais doivent suivre l’ordre des
pages de l’export :

```js
import { parseRig, PhaserRig } from "@ankhimate/phaser-runtime";

const response = await fetch("hero/skeleton.json");
if (!response.ok) throw new Error("Export hero manquant");
const data = parseRig(await response.json());
const keys = data.atlas.pages.map((_, index) => `hero-page-${index}`);

new Phaser.Game({
  type: Phaser.WEBGL,
  width: 960,
  height: 560,
  parent: "game",
  scene: {
    preload() {
      this.load.on("loaderror", file => console.error("Texture manquante", file.key));
      data.atlas.pages.forEach((page, index) => {
        this.load.image(keys[index], `hero/${page.file}`);
      });
    },
    create() {
      this.hero = new PhaserRig(this, data, { pageTextureKeys: keys });
      this.hero.root.setPosition(300, 340).setScale(1);
      this.hero.play(Object.keys(data.animations)[0]);
    },
    update(_time, delta) {
      this.hero.update(delta); // millisecondes Phaser
      for (const event of this.hero.player.events) {
        console.log(event.name, event.string, event.int, event.float);
      }
    },
  },
});
```

Dans un projet sans bundler, charger Phaser avant ce module et fournir une
import map comme `index.html` dans l’exemple. Dans un projet avec bundler,
importer Phaser selon sa configuration normale. Les archives locales se
réutilisent comme dépendances `file:vendor/...tgz`, en conservant les deux
packages et le lockfile. Aucun sous-chemin privé du runtime n’est nécessaire.

Positionner `hero.root` en coordonnées écran. Les bones et sommets Mesh restent
en Y vers le haut ; la projection Mesh de Phaser convertit Y vers le bas.
Garder une échelle positive pour le parcours validé : ne pas inverser la caméra,
les sommets, les UV ou le JSON pour remettre le personnage à l’endroit.

Pour changer de clip, appeler `hero.crossFade(nomExistant, 0.25)` ou `hero.play`.
Les noms proviennent de `data.animations`. Les boucles suivent le champ
`looping` exporté. `RigPlayer.update` utilise des **secondes**, tandis que
`PhaserRig.update` accepte les **millisecondes** de Phaser.

Consommer `player.events` après chaque update : le tableau est renouvelé à la
prochaine avance. Pendant une transition, les événements suivent le clip
entrant ; `leg_ik` n’a pas d’événement dans cet exemple. Aucun son n’est fourni :
le compteur prouve la livraison des événements sans requête audio manquante.

## Compatibilité v1 / v2

| Export | Lecture par les artefacts livrés |
|---|---|
| `format_version` absent ou 1 | Canaux historiques Translate/Scale/Shear appariés et courbe commune ; compatibilité conservée |
| `format_version: 2` | Canaux scalaires X/Y indépendants, temps et courbes séparés ; validés par la parité Rust/TypeScript |
| Versions inconnues ou canaux v1/v2 mélangés | Rejet par `parseRig` |

Une donnée déjà perdue par un ancien export ne peut pas être reconstruite par
le lecteur v1. Réexporter depuis le projet auteur avec le preset v2 actuel.
Ne pas confondre `context_version` et `format_version`, ni déduire le format à
partir du numéro de version npm.

## Ce qui a été validé, et les limites

Les deux clips de walker et celui du PSD sont comparés au renderer CPU Rust à
0, 0,25, 0,5 et 0,75 s : 12 poses réelles. Le contrôle GPU vérifie affines,
sommets projetés, triangles, UV et alpha ; les sondes synthétiques ajoutent
l’ordre de dessin animé dans un Container, l’alpha superposé et v1/v2. Voir
`phaser/test/README.md` pour les tolérances et les hashes des références.

Le test du jeu vérifie des entrées clavier/bouton, un déplacement avec collecte,
un changement de clip et un événement, puis exige au moins cinq minutes réelles
avec le playback qui avance, sans erreur JavaScript, warning ou ressource en
échec. Il ne remplace pas un essai sur plusieurs GPU et projets de production.

- Le preset actuel transmet la teinte sombre statique. Le snapshot local
  m0061-8888e0e du jeu inclut son application Normal et les correctifs FFD,
  changement de skin/UV GPU et clipping. Les archives historiques restent
  conservées séparément ; seuls les hashes identifient le snapshot courant.
- Les tests dédiés M005.3/M005.4 couvrent les cas décrits dans la matrice alpha
  canonique `editor/docs/alpha-scope.md`. Ils ne qualifient pas toutes les
  combinaisons de contraintes, skins, atlas et polygones concaves.
- La physique du véritable export natif **ne s'active pas** dans le consommateur
  TS actuel : target contient le bone simulé, bones est vide, TS utilise bones[0].
  C'est une incompatibilité démontrée, exclue de l'alpha.
- Paths avancés, blending non-Normal, FFD hérité par linked meshes côté CPU,
  chaînes de linked meshes et compositions multi-skins restent exclus des
  promesses de fidélité alpha. Lire les avertissements de préflight.
- `unsupported: []` ne signifie pas que tout le projet est pris en charge.
- WebGL est requis ; Canvas et Phaser 4 ne sont pas qualifiés.

La préparation M006.1 est locale. Elle n'est ni une publication npm/GitHub,
ni une qualification sur Windows propre M006.2.
