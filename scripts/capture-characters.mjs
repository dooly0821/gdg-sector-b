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
 for(const [i,name] of ['worker','flicker','boxhead','imp','wraith','glove'].entries()){
  await page.locator('select').selectOption({index:i});
  if(i===1)await page.locator('#motion').uncheck();
  for(const angle of i===0?[0,45,90,-90,180]:i===5?[-42,35]:[12]){
   await page.locator('input[type=range]').first().fill(String(angle));
   await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const canvas=page.locator('canvas');
   await canvas.screenshot({path:out+'/'+name+'-'+angle+'.jpg',quality:88});
   if((i===0&&angle===45)||(i>0&&i<5)||(i===5&&angle===-42)){
    await page.locator('#clay').check();
    await canvas.screenshot({path:out+'/'+name+'-clay.jpg',quality:90});
    if(i===5){
     for(const flex of [0,100]){
      await page.locator('#bend').fill(String(flex));
      await canvas.screenshot({path:out+'/glove-flex-'+flex+'.jpg',quality:90});
     }
    }
    if(i===5)await page.locator('#bend').fill('50');
    await page.locator('#clay').uncheck();
   }
  }
 }
 console.log('Captured 6 game subjects, clay comparisons, worker turnaround and glove articulation.');
}finally{await browser.close();}
