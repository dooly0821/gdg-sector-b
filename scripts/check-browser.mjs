import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {join} from 'node:path';

const {chromium}=createRequire(import.meta.url)('playwright');
const capture=process.env.QA_CAPTURE_DIR;
const base=process.env.QA_URL??'http://127.0.0.1:8090';
const browser=await chromium.launch({
 executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',
 args:['--no-sandbox','--enable-unsafe-swiftshader']
});
try{
 const page=await browser.newPage({viewport:{width:1120,height:630}});
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.setDefaultTimeout(60_000);
 await page.addInitScript(()=>localStorage.setItem('gdg.settings',JSON.stringify({
  quality:'PERFORMANCE',scale:.75,audio:false
 })));
 // Use actual input with deterministic positions. This hook is only served to the test browser.
 await page.route('**/app.js',async route=>{
  const response=await route.fetch();
  const source=await response.text();
  await route.fulfill({response,body:source+'\nwindow.qa={get shift(){return session}};'});
 });
 const take=async name=>{
  if(capture){await mkdir(capture,{recursive:true});await page.screenshot({path:join(capture,name+'.png')});}
 };
 await page.goto(base);
 await page.click('#start');
 await page.waitForFunction(()=>!document.querySelector('#play').hidden&&document.querySelector('#loading').hidden);
 assert.ok(await page.locator('#world').evaluate(canvas=>!!canvas.getContext('webgl2')));
 await page.keyboard.press('q');
 await page.waitForFunction(()=>qa.shift.flashAmount===1);
 assert.match(await page.locator('#torch-status').textContent(),/ON/);
 await take('forward');
 await page.keyboard.press('q');
 await page.waitForFunction(()=>qa.shift.flashAmount===0);
 await page.evaluate(()=>Object.assign(qa.shift,{x:1.12,z:13.72,yaw:.3187,pitch:-.48}));
 await page.keyboard.press('e');
 await page.waitForFunction(()=>qa.shift.carried===0);
 await page.evaluate(()=>Object.assign(qa.shift,{x:-17,z:14,yaw:Math.PI/2,pitch:-.12}));
 await page.keyboard.press('q');
 await page.waitForFunction(()=>qa.shift.flashAmount===1);
 assert.match(await page.locator('#carry-status').textContent(),/한 손/);
 await take('annex-dual');
 await page.keyboard.press('e');
 await page.waitForFunction(()=>qa.shift.carried===-1&&qa.shift.parked?.[0]&&qa.shift.flashAmount===1);
 await page.evaluate(()=>{
  const s=qa.shift,[x,,z]=s.parked[0];
  s.pitch=Math.atan2(.24-1.58,Math.hypot(s.x-x,s.z-z));
 });
 await page.keyboard.press('e');
 await page.waitForFunction(()=>qa.shift.carried===0&&qa.shift.flashAmount===1);
 await page.evaluate(()=>Object.assign(qa.shift,{x:4.6,z:-18.52,yaw:0,pitch:-.65}));
 await page.keyboard.press('e');
 await page.waitForFunction(()=>qa.shift.states[0]==='DELIVERED');
 await page.evaluate(()=>Object.assign(qa.shift,{x:-32,z:2,yaw:.38,pitch:.03}));
 await page.waitForFunction(()=>qa.shift.haunt?.length===4);
 await take('containment');
 assert.deepEqual(errors,[]);
 console.log('PASS Chromium WebGL2: actual Q/E input, dual carry, floor drop/retrieve, delivery and C-01');
}finally{
 await browser.close();
}
