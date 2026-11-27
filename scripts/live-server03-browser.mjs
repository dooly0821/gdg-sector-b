import {chromium} from 'playwright';
import {CoopClient,retryLeave} from '../dist/multiplayer.js';
const origin='https://gdg-sector-b.vercel.app',room='GDGS24',native=globalThis.fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms));
globalThis.fetch=(u,o)=>native(new URL(u,origin),o);
const status=async()=>(await new CoopClient().request('list')).servers.find(s=>s.id===room);
let deployed=false;for(let i=0;i<20;i++){const css=await fetch('/style.css?qa='+i).then(r=>r.text());if(/#reticle\{[^}]*pointer-events:none/.test(css)){deployed=true;break;}await sleep(1500);}if(!deployed)throw Error('Production reticle fix not visible yet');
if((await status())?.count!==0){console.log('BROWSER_SKIP_OCCUPIED');process.exit(0);}
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:960,height:540}}),bots=[],errors=[];let browserToken=null;
try{
 await page.addInitScript(()=>{localStorage.setItem('gdg.settings',JSON.stringify({quality:'PERFORMANCE',scale:.7,audio:false,motion:false}));});
 page.on('pageerror',e=>errors.push(e.message));
 page.on('response',async r=>{if(r.url().endsWith('/api/room'))try{const a=await r.json();if(a.token)browserToken=a.token;}catch{}});
 await page.route('**/app.js',async route=>{const res=await route.fetch();const body=await res.text();await route.fulfill({response:res,body:body+'\n;window.__gdgQA=()=>({mode,session,coop,renderer,worlds});'});});
 await page.goto(origin,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'멀티플레이'}).click();await page.locator('#coop-nickname').fill('QAVisual');await page.locator('[data-action="coop-select-GDGS24"]').click();await page.locator('#server-join').click();await page.waitForFunction(()=>window.__gdgQA?.().coop?.snapshot?.phase==='lobby');
 for(let i=0;i<3;i++){const input={keys:[],yaw:0,pitch:0},c=new CoopClient(null,null,()=>input);bots.push({c,input});await c.connect('enter',room,'QABrowser'+(i+1));}
 await page.waitForFunction(()=>window.__gdgQA?.().coop?.snapshot?.players?.length===4);const safe=await page.evaluate(()=>{const c=window.__gdgQA().coop;return c.snapshot.host===c.snapshot.you&&c.snapshot.players.every(p=>['QAVisual','QABrowser1','QABrowser2','QABrowser3'].includes(p.name));});if(!safe)throw Error('non-test participant');
 await page.locator('[data-action="coop-difficulty-easy"]').click();await page.locator('[data-action="coop-start"]').click();
 for(let i=0;i<120&&!bots.every(b=>b.c.snapshot?.phase==='loading'||b.c.snapshot?.phase==='playing');i++)await sleep(100);
 await Promise.all(bots.map(b=>b.c.action('ready')));
 await page.waitForFunction(()=>{const q=window.__gdgQA?.();return q?.mode==='game'&&q.coop?.snapshot?.phase==='playing';},{},{timeout:90000});
 await page.evaluate(()=>{const samples=[];window.__qaSamples=samples;let last=performance.now(),old=null,oldCorrection=null;const frame=t=>{const q=window.__gdgQA(),s=q.session,c=q.coop;if(s&&c){const p=[s.x,s.y,s.z],v=Math.hypot(s.vx,s.vz),r=t-last,delta=old?Math.hypot(p[0]-old[0],p[1]-old[1],p[2]-old[2]):0;const corr=[s.netAppliedX??0,s.netAppliedZ??0],back=oldCorrection&&v>.5?Math.max(0,-((corr[0]-oldCorrection[0])*s.vx+(corr[1]-oldCorrection[1])*s.vz)/v):0;oldCorrection=corr;samples.push({ms:r,v,delta,back,hard:s.netHardCorrections??0,rtt:c.rtt,gap:c.snapshotGap,lag:c.snapshot.simLagMs,failed:s.failed});old=p;}last=t;requestAnimationFrame(frame);};requestAnimationFrame(frame);});
 // Keyboard events take the same input path as normal gameplay; no synthetic position changes.
 await page.locator('#world').click({position:{x:480,y:270}});await page.keyboard.down('Shift');await page.keyboard.down('w');
 for(let i=0;i<4;i++){for(const b of bots){b.input.keys=['KeyW','ShiftLeft'];b.c.inputChanged();}await sleep(750);await page.keyboard.press('v');await sleep(800);await page.keyboard.press('Space');await sleep(350);await page.keyboard.up('w');await page.keyboard.down('s');await sleep(600);await page.keyboard.up('s');await page.keyboard.down('w');}
 await page.keyboard.up('w');await page.keyboard.up('Shift');
 const result=await page.evaluate(()=>{const a=window.__qaSamples,q=window.__gdgQA(),p=v=>{const b=v.filter(Number.isFinite).sort((x,y)=>x-y);return b.length?{n:b.length,p50:b[Math.floor((b.length-1)*.5)],p95:b[Math.floor((b.length-1)*.95)],max:b.at(-1)}:null;};return {renderer:q.renderer.gl?'WebGL':'software',pointerLocked:document.pointerLockElement===document.querySelector('#world'),frames:a.length,over33ms:a.filter(x=>x.ms>33.4).length,over67ms:a.filter(x=>x.ms>67).length,backwardCorrectionM:p(a.map(s=>s.back)),frameMs:p(a.map(s=>s.ms)),deltaM:p(a.map(s=>s.delta)),speed:p(a.map(s=>s.v)),rttMs:p(a.map(s=>s.rtt)),gapMs:p(a.map(s=>s.gap)),lagMs:p(a.map(s=>s.lag)),hardSnaps:Math.max(0,...a.map(s=>s.hard)),failed:q.session.failed,phase:q.coop.snapshot.phase};});
 console.log('BROWSER_RESULT',JSON.stringify({...result,errors}));
}finally{await browser.close();for(const b of bots)await b.c.leave();if(browserToken)await retryLeave(new CoopClient().request.bind(new CoopClient()),room,browserToken);console.log('BROWSER_AFTER',JSON.stringify(await status()));}
