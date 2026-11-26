import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=resolve('dist'),mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.glb':'model/gltf-binary'};
const server=createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),path=resolve(root,'.'+(u.pathname==='/'?'/index.html':u.pathname));if(!path.startsWith(root+'/'))throw Error('path');if(u.pathname==='/api/room'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({servers:[1,2,3].map(i=>({id:'GDGS'+(21+i),name:'서버 0'+i,count:0,max:4,phase:'empty',joinable:true}))}));return;}res.setHeader('Content-Type',mime[extname(path)]??'application/octet-stream');res.end(await readFile(path));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Inject test-only fixture into the real application module; no production hooks, no game server traffic.
 await page.route('**/app.js*',async route=>{const res=await route.fetch();await route.fulfill({response:res,body:(await res.text())+'\n;window.__uiTest=(name)=>{if(name==="pause"){session=newShift(Math.random,"normal");mode="paused";}else if(name==="failed"){session=newShift(Math.random,"normal");mode="game";failShift("녹령");return;}else{mode="menu";}openPane(name);};'});});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>!!window.__uiTest);
 for(const [w,h] of [[1920,1080],[1366,768],[1157,402],[800,600]]){
  await page.setViewportSize({width:w,height:h});
  for(const pane of ['pause','settings','manual','quit','cargo','anomalies','failed']){
   await page.evaluate(p=>window.__uiTest(p),pane);
   const data=await page.evaluate(()=>{const modal=document.querySelector('#modal'),panel=modal.querySelector('.panel'),note=modal.querySelector('.paper-note'),r=panel.getBoundingClientRect(),nav=document.querySelector('#paneNav'),n=nav.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,scroll:panel.scrollTop,repeat:note?getComputedStyle(note).backgroundRepeat:null,image:note?getComputedStyle(note).backgroundImage:null,navHidden:nav.hidden,navTop:n.top,navBottom:n.bottom,navScroll:nav.scrollHeight,navClient:nav.clientHeight};});
   assert(data.top>=-1&&data.bottom<=h+1&&data.left>=-1&&data.right<=w+1,pane+' bounds '+w+'x'+h+' '+JSON.stringify(data));
   assert(data.scroll<2,pane+' initial scroll');
   if(pane==='pause'){assert(data.repeat.split(',').every(v=>v.trim()==='no-repeat'));assert(data.image.includes('paper-fill-v2.webp'));assert(!data.navHidden&&data.navTop>=-1&&data.navBottom<=h+1);const decoded=await page.evaluate(async()=>{const im=new Image();im.src='assets/interface/paper-fill-v2.webp';await im.decode();return [im.naturalWidth,im.naturalHeight]});assert.deepEqual(decoded,[240,104]);}
   if(pane==='pause'||(w===1366&&['settings','manual','failed'].includes(pane)))await page.screenshot({path:'/tmp/gdg-ui-'+pane+'-'+w+'x'+h+'.png'});
   console.log('UI_OK',pane,w,h,JSON.stringify(data));
  }
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();await new Promise(r=>server.close(r));}
