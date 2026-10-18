// Prepare an offline browser example from the pinned, installed local snapshot.
// This is packaging only: no evaluator, renderer or export data is changed.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { repository } from "./web-server.mjs";

const destination = process.argv[2];
if (!destination) throw Error("Usage: node scripts/prepare-alpha-game.mjs <new-output-directory>");
const output = resolve(destination), example = resolve(repository, "examples/phaser-game");
const provenance = JSON.parse(await readFile(resolve(example, "vendor/provenance.json")));
assert.equal(provenance.snapshot, "m0061-8888e0e");
assert.equal(provenance.runtimeCodeCommit, "8888e0e74ad642818c076c6446cca3d9358dd05f");
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
for (const [path, expected] of Object.entries(provenance.sha256)) assert.equal(sha(await readFile(resolve(example, path))), expected, path);
for (const [path, expected] of Object.entries(provenance.codeFilesSha256)) assert.equal(sha(await readFile(resolve(repository, path))), expected, path);
assert.equal(sha(await readFile(resolve(repository, "phaser/dist/phaser.js"))), provenance.rendererJavaScriptSha256, "renderer build differs");
for (const [pkg, source] of [["runtime", "core"], ["phaser-runtime", "phaser"]]) {
  for (const file of await readdir(resolve(repository, source, "dist"))) {
    assert.equal(sha(await readFile(resolve(example, "node_modules/@ankhimate", pkg, "dist", file))), sha(await readFile(resolve(repository, source, "dist", file))), `installed snapshot differs: ${pkg}/${file}`);
  }
}
assert.equal(JSON.parse(await readFile(resolve(example, "node_modules/phaser/package.json"))).version, "3.90.0");
assert.equal(JSON.parse(await readFile(resolve(example, "node_modules/fflate/package.json"))).version, "0.8.3");
await mkdir(output); // Refuse an existing output, including a prior candidate.
await mkdir(resolve(output, "runtime/core"), { recursive: true });
await mkdir(resolve(output, "runtime/adapter"));
await mkdir(resolve(output, "licenses"));
for (const file of ["style.css", "server.mjs"]) await cp(resolve(example, file), resolve(output, file));
for (const dir of ["assets", "src"]) await cp(resolve(example, dir), resolve(output, dir), { recursive: true });
for (const [pkg, dir] of [["runtime", "core"], ["phaser-runtime", "adapter"]]) {
  const source = resolve(example, "node_modules/@ankhimate", pkg, "dist");
  for (const file of await readdir(source)) if (file.endsWith(".js")) await cp(resolve(source, file), resolve(output, "runtime", dir, file));
}
await cp(resolve(example, "node_modules/phaser/dist/phaser.min.js"), resolve(output, "runtime/phaser.min.js"));
await cp(resolve(example, "node_modules/fflate/esm/browser.js"), resolve(output, "runtime/fflate.js"));
const html = (await readFile(resolve(example, "index.html"), "utf8"))
  .replace("node_modules/phaser/dist/phaser.min.js", "runtime/phaser.min.js")
  .replace("./node_modules/@ankhimate/runtime/dist/index.js", "./runtime/core/index.js")
  .replace("./node_modules/@ankhimate/phaser-runtime/dist/index.js", "./runtime/adapter/index.js")
  .replace("./node_modules/fflate/esm/browser.js", "./runtime/fflate.js");
await writeFile(resolve(output, "index.html"), html);
for (const file of ["LICENSE-APACHE", "LICENSE-MIT"]) await cp(resolve(repository, file), resolve(output, "licenses", file));
await cp(resolve(example, "node_modules/phaser/LICENSE.md"), resolve(output, "licenses/PHASER-LICENSE.md"));
await cp(resolve(example, "node_modules/fflate/LICENSE"), resolve(output, "licenses/FFLATE-LICENSE"));
await cp(resolve(example, "node_modules/eventemitter3/LICENSE"), resolve(output, "licenses/EVENTEMITTER3-LICENSE"));
await writeFile(resolve(output, "README.md"), `# Démonstration Phaser — candidat local M006.1

Prérequ : Node 24.18.0 (version testée), ou Node 22+. Node n'est pas inclus.
L'éditeur Ankhimate n'a pas besoin de Node ; seul ce serveur de démonstration l'utilise.

Dans un terminal ouvert dans ce dossier :

    node server.mjs

Ouvrir http://127.0.0.1:4173 dans un navigateur WebGL. Arrêter le serveur avec Ctrl+C.
Aucune installation npm, dépendance globale, compilation TypeScript ou connexion CDN.
Ne pas ouvrir index.html avec file://. Aucun lancement par double-clic n'est promis.

Flèches/A/D : déplacer ; boutons walk/leg_ik ou Espace : changer de clip.
Les pas affichés sont de vrais événements exportés. La transition dure 0,25 s.
Les deux personnages utilisent les vrais exports walker et tagged_rig inchangés.

Snapshot exact : m0061-8888e0e, code runtime 8888e0e74ad642818c076c6446cca3d9358dd05f.
Core 0.1.1, adapter 0.1.0, Phaser 3.90.0, fflate 0.8.3. Ces labels ne suffisent
pas seuls : SNAPSHOT.json contient les empreintes des bibliothèques réellement servies.
Dark tint, FFD, skin et clipping corrigés sont présents dans ces bibliothèques.
Le jeu simple ne démontre pas à lui seul toutes ces fonctions ; leurs preuves WebGL
dédiées sont dans le rapport M006.1. La physique native ne s'active pas dans le
runtime TS actuel. Les autres limites sont dans ../docs/alpha-scope.md.
`);
const manifest = { snapshot: provenance.snapshot, runtimeCodeCommit: provenance.runtimeCodeCommit, versions: { core: "0.1.1", adapter: "0.1.0", phaser: "3.90.0", fflate: "0.8.3", testedNode: "24.18.0" }, archiveSha256: provenance.sha256, files: {} };
async function collect(dir, prefix = "") {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = prefix + entry.name, path = resolve(dir, entry.name);
    if (entry.isDirectory()) await collect(path, name + "/"); else manifest.files[name] = sha(await readFile(path));
  }
}
await collect(output);
await writeFile(resolve(output, "SNAPSHOT.json"), JSON.stringify(manifest, null, 2) + "\n");
console.log(`Prepared ${Object.keys(manifest.files).length} pinned offline game files: ${output}`);
