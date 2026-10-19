// Fetch/parse local source only. This does not start a browser or execute a demo.
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {serve} from '../../scripts/web-server.mjs';
const pages=['examples/phaser-pixi-parity/index.html','examples/pixi-regions/index.html','examples/pixi-playback/index.html',...readdirSync(new URL('./',import.meta.url)).filter(f=>f.endsWith('.html')).map(f=>`phaser/test/${f}`),...readdirSync(new URL('../../pixi/test/',import.meta.url)).filter(f=>f.endsWith('.html')).map(f=>`pixi/test/${f}`)];
test('built import maps resolve shared render support and every static browser module, without a browser',async()=>{
 const server=await serve();const cache=new Map();let count=0;
 const text=async url=>{if(!cache.has(url)){const r=await fetch(url);assert.ok(r.ok,`${r.status}: ${url}`);cache.set(url,await r.text());}return cache.get(url);};
 try{for(const name of pages){const page=new URL(name,server.url+'/'),html=await text(page.href),map=JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  assert.ok(map['@ankhimate/runtime/render']);const queue=[...html.matchAll(/<script type="module" src="([^"]+)"/g)].map(m=>new URL(m[1],page).href),seen=new Set();
  while(queue.length){const url=queue.pop();if(seen.has(url))continue;seen.add(url);assert.ok(seen.size<150);const source=ts.createSourceFile(url,await text(url),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);count++;
   for(const statement of source.statements){const module=(ts.isImportDeclaration(statement)||ts.isExportDeclaration(statement))&&statement.moduleSpecifier;if(!module||!ts.isStringLiteral(module))continue;
    const spec=module.text,target=spec.startsWith('.')?new URL(spec,url):new URL(map[spec]??assert.fail(`Missing browser specifier ${spec} in ${name}`),page);assert.equal(target.origin,page.origin);queue.push(target.href);
   }
  }
 }console.log(`Resolved ${pages.length} source pages and ${count} static module references over local HTTP; no browser/GL execution.`);}finally{await server.close();}
});
