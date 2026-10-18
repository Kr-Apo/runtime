import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export async function start(port = 4173) {
  const root = await realpath(dirname(fileURLToPath(import.meta.url)));
  const mime = { ".html":"text/html", ".js":"text/javascript", ".mjs":"text/javascript", ".json":"application/json", ".css":"text/css", ".png":"image/png" };
  const server = createServer(async (request, response) => {
    try {
      const name = decodeURIComponent(new URL(request.url,"http://localhost").pathname);
      if(name.split("/").some(part=>part.startsWith("."))) throw new Error("private path");
      const file = await realpath(resolve(root,`.${name.endsWith("/")?`${name}index.html`:name}`));
      const local = relative(root,file);
      if(isAbsolute(local)||local===".."||local.startsWith(`..${sep}`)||!(await stat(file)).isFile()) throw new Error("outside root");
      response.writeHead(200,{"Content-Type":mime[extname(file)]??"application/octet-stream","Cache-Control":"no-store"});response.end(await readFile(file));
    } catch { response.writeHead(404); response.end("Not found"); }
  });
  await new Promise((done,reject)=>{server.once("error",reject);server.listen(port,"127.0.0.1",done);});
  return {url:`http://127.0.0.1:${server.address().port}`,close:()=>new Promise((done,reject)=>server.close(error=>error?reject(error):done()))};
}
if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server=await start(Number(process.env.ANKHIMATE_PORT ?? 4173));
  console.log(`Ankhimate Phaser example: ${server.url} — Ctrl+C to stop`);
}
