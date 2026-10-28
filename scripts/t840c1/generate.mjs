import {mkdtemp,mkdir,writeFile,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {resolve,join} from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';
if(!process.argv[2]||!process.argv[3])throw Error('generate.mjs EDITOR_PATH NEW_OUTPUT');
const editor=resolve(process.argv[2]),output=resolve(process.argv[3]),dir=await mkdtemp(join(tmpdir(),'ankhimate-c1-reference-'));await mkdir(join(dir,'src'));
const path=p=>p.replaceAll('\\','/');let manifest='[package]\nname="t840c1-reference"\nversion="0.0.0"\nedition="2024"\n[dependencies]\n';
for(const name of ['core','formats','export'])manifest+=`ankhimate-${name}={path=${JSON.stringify(path(join(editor,name)))}}\n`;
manifest+='serde_json="1.0.150"\nimage={version="0.25.10",default-features=false,features=["png"]}\n';await writeFile(join(dir,'Cargo.toml'),manifest);await copyFile(new URL('./generate-reference.rs',import.meta.url),join(dir,'src/main.rs'));
const input=fileURLToPath(new URL('../../examples/replay-pixi-pilot/assets/',import.meta.url));
const p=spawnSync('cargo',['+1.95','run','--offline','--manifest-path',join(dir,'Cargo.toml'),'--',input,output],{stdio:'inherit'});if(p.status!==0)process.exit(p.status??1);
