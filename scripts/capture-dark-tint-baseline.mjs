// Compile a historical source snapshot outside the checkout, without switching
// branches or overwriting any working files. For the before/after WebGL runner.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import ts from "typescript";
const [commit, directory]=process.argv.slice(2);
if(!commit||!directory)throw new Error("Usage: node scripts/capture-dark-tint-baseline.mjs <commit> <new-output-directory>");
const output=resolve(directory);await mkdir(output); // refuse an existing output
const files=execFileSync("git",["ls-tree","-r","--name-only",commit,"--","core/src","phaser/src"],{encoding:"utf8"}).trim().split("\n").filter(f=>f.endsWith(".ts"));
const hashes={};
for(const file of files){
  const source=execFileSync("git",["show",`${commit}:${file}`],{encoding:"utf8"});
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,verbatimModuleSyntax:true}}).outputText;
  const destination=resolve(output,file.replace("/src/","/").replace(/\.ts$/,".js"));
  await mkdir(dirname(destination),{recursive:true});await writeFile(destination,compiled);
  hashes[file]=createHash("sha256").update(source).digest("hex");
}
await writeFile(resolve(output,"provenance.json"),JSON.stringify({commit,typescript:ts.version,sourceHashes:hashes},null,2));
console.log(`${files.length} baseline modules captured from ${commit}`);
