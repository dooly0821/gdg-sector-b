import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const out=process.env.QA_CAPTURE_DIR??'qa/v3';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:720,height:624}});
 page.on('pageerror',console.error);
 await page.goto((process.env.QA_URL??'http://127.0.0.1:8090')+'/characters.html');
 await page.waitForSelector('[data-ready]',{timeout:90000});
 for(const [i,name] of ['worker','flicker','boxhead','imp','wraith'].entries()){
  await page.locator('select').selectOption({index:i});
  for(const angle of i===0?[0,45,90,180]:[12]){
   await page.locator('input[type=range]').fill(String(angle));
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   await page.locator('canvas').screenshot({path:out+'/'+name+'-'+angle+'.jpg',quality:88});
  }
 }
 const times=await page.evaluate(async()=>{const samples=[];let last=performance.now();for(let i=0;i<60;i++){await new Promise(requestAnimationFrame);const now=performance.now();samples.push(now-last);last=now;}return samples.sort((a,b)=>a-b);});
 console.log('Character studio, 720px, WebGL2: FPS',60000/times.reduce((a,b)=>a+b),'P95 ms',times[56]);
}finally{await browser.close();}
