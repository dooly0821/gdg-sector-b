import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createRoom,operateRoom,snapshot} from '../server/room-core.js';
const now=Date.now(),{room,player}=createRoom('CHAT23',now,'작업자01');
for(const name of ['작업자02','작업자03','작업자04'])operateRoom(room,{op:'join',nickname:name},now);
operateRoom(room,{op:'start',token:player.token,level:'normal'},now);
for(const p of Object.values(room.players))operateRoom(room,{op:'ready',token:p.token},now);
const snap=snapshot(room,player);
const root=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),path=resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!path.startsWith(root+'/'))throw Error('path');if(u.pathname==='/api/chat'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({messages:[]}));return;}res.setHeader('Content-Type',mime[extname(path)]??'application/octet-stream');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080}});page.on('pageerror',e=>console.log('PAGE_ERROR',e.message));
 await page.route('**/app.js*',async route=>{const res=await route.fetch();await route.fulfill({response:res,body:(await res.text())+'\n;window.__captureChat=async(snap)=>{settings.quality="PERFORMANCE";settings.scale=.7;settings.audio=false;coop=new CoopClient(onCoopState,()=>{},coopInput);coop.token="a".repeat(48);coop.room=snap.room;coop.snapshot=snap;coop.enableMotion=false;coop.action=async()=>{};onCoopState(snap);};window.__captureReady=()=>mode==="game"&&!!renderer&&!$("#play").hidden;window.__chatPhoto=()=>{cancelAnimationFrame(raf);keys.clear();session.flashlight=true;session.flashAmount=1;const eye=[session.x,session.y+CONFIG.eye,session.z],pose=choreography(session,eye,false,false,false,session.elapsed);pose.flashlight=1;pose.actors=[...lockerLayers(session,LOCKER_DOOR_GROUP),...peerLayers(coop,session,0,TEAM_WORKER_GROUP)];renderer.render(eye,forward(session),parcelPositions(session,pose.hidden,Boolean(renderer.gl)),pose,.7);const ps=coop.snapshot.players;teamChat.ingest({messages:[{seq:1,name:ps[1].name,player:ps[1].id,text:"야 뒤에 적재귀 있다"},{seq:2,name:ps[2].name,player:ps[2].id,text:"ㅋㅋㅋㅋ 살려줘"},{seq:3,name:ps[0].name,player:ps[0].id,text:"상자 먼저 배송하고 갈게"},{seq:4,name:ps[3].name,player:ps[3].id,text:"퇴사합니다."}]});$("#radio").textContent="";openTeamChat();$("#team-chat-input").value="지금 구조하러 갑니다";};window.__chatSentPhoto=()=>{closeTeamChat(false);teamChat.ingest({messages:[{seq:5,name:coop.snapshot.players[0].name,player:coop.snapshot.you,text:"지금 구조하러 갑니다"}]});};'});});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.__captureChat);await page.evaluate(s=>window.__captureChat(s),snap);
 await page.waitForFunction(()=>window.__captureReady(),null,{timeout:120000});
 await page.evaluate(()=>window.__chatPhoto());await page.waitForTimeout(250);await mkdir('/tmp/gdg-chat-shots',{recursive:true});
 assert(await page.locator('#team-chat-form').isVisible());
 await page.screenshot({path:'/tmp/gdg-chat-shots/01-chat-input.png',timeout:60000});
 await page.locator('#team-chat').screenshot({path:'/tmp/gdg-chat-shots/01-chat-input-detail.png',timeout:60000});
 await page.evaluate(()=>window.__chatSentPhoto());await page.waitForTimeout(200);
 await page.screenshot({path:'/tmp/gdg-chat-shots/02-chat-sent.png',timeout:60000});
 await page.locator('#team-chat').screenshot({path:'/tmp/gdg-chat-shots/02-chat-sent-detail.png',timeout:60000});
 console.log('CHAT_SCREENSHOTS_OK');
}finally{await browser.close();await new Promise(r=>server.close(r));}
