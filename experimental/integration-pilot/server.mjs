import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

/** Static file server only. No simulation, supervisor, browser control or RPC. */
export async function serve(root,port=4188){
    root=resolve(root);
    const server=createServer(async(req,res)=>{
        try{
            const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),path=resolve(root,'.'+pathname);
            if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end();return;}
            const file=(await stat(path)).isDirectory()?resolve(path,'index.html'):path;
            const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.png':'image/png','.css':'text/css'};
            res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','Cache-Control':'no-store'});res.end(await readFile(file));
        }catch{res.writeHead(404).end('Not found');}
    });
    await new Promise((ok,bad)=>{server.once('error',bad);server.listen(port,'127.0.0.1',ok);});
    return{server,url:`http://127.0.0.1:${server.address().port}`};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
    const {url}=await serve(process.argv[2]??fileURLToPath(new URL('../../',import.meta.url)),Number(process.env.ANKHIMATE_PORT??4188));
    console.log(`Application pilot: ${url}/pixi.html and ${url}/phaser.html — Ctrl+C to stop`);
}
