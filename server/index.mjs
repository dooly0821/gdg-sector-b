import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {roomRequest} from './room-service.js';
const root=fileURLToPath(new URL('../dist/',import.meta.url)),port=Number(process.env.PORT)||8080;
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.json':'application/json'};
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/room'){
   if(req.method!=='POST'){json(res,405,{error:'POST only'});return;}
   let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>12000){json(res,413,{error:'요청이 너무 큽니다.'});return;}parts.push(chunk);}
   const data=JSON.parse(Buffer.concat(parts).toString('utf8'));json(res,200,await roomRequest(data,{allowMemory:true}));return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!path.startsWith(resolve(root)+sep)){res.writeHead(403).end();return;}
  const info=await stat(path);if(!info.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Content-Length':info.size,'Cache-Control':extname(path)==='.html'?'no-cache':'public, max-age=60'});
  if(req.method==='HEAD'){res.end();return;}res.end(await readFile(path));
 }catch(e){if(!res.headersSent)json(res,e.status||(['ENOENT','ENOTDIR'].includes(e.code)?404:500),{error:e.status?e.message:'요청을 처리하지 못했습니다.'});else res.end();}
});
server.listen(port,'0.0.0.0',()=>console.log('GDG cooperative server listening on port '+port));
