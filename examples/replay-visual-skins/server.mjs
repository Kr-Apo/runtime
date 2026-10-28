import {serve}from '../../scripts/web-server.mjs';const s=await serve(undefined,Number(process.env.PORT??8080));console.log(s.url+'/examples/replay-visual-skins/');
