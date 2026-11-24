import {startRecording,saveRecording} from './browser-recording.mjs';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)('playwright');
const out=process.env.QA_CAPTURE_DIR??'qa/v3',base=process.env.QA_URL??'http://127.0.0.1:8090';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:640,height:416}});
 page.setDefaultTimeout(120000);page.on('pageerror',console.error);
 await page.addInitScript(()=>localStorage.setItem('gdg.settings',JSON.stringify({quality:'PERFORMANCE',scale:.75,audio:false})));
 await page.route('**/app.js',async route=>{
  const response=await route.fetch();
  await route.fulfill({response,body:await response.text()+'\nwindow.getShift=()=>session;'});
 });
 await page.goto(base);await page.click('#start');
 await page.waitForFunction(()=>!document.querySelector('#play').hidden&&document.querySelector('#loading').hidden);
 const stats=await page.evaluate(async()=>{
  const durations=[],s=getShift();let last=performance.now();
  for(let i=0;i<42;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>1)durations.push(now-last);last=now;}
  durations.sort((a,b)=>a-b);
  return {fps:durations.length*1000/durations.reduce((a,b)=>a+b),p95Ms:durations[Math.ceil(durations.length*.95)-1]};
 });
 const baseline=process.env.QA_BASELINE==='1';
 await page.screenshot({path:out+'/'+(baseline?'before':'after')+'-spawn.jpg',quality:88});
 if(!baseline){
  await startRecording(page);
  for(let kind=0;kind<4;kind++){
   await page.evaluate(kind=>{
    const s=getShift();Object.assign(s,{x:-18.3,y:0,z:14,yaw:Math.PI/2,pitch:-.08,hauntCooldown:0,hauntDirector:{delay:100,bag:[]}});
    s.haunt=[{x:-21,z:14,yaw:Math.PI/2,kind,state:'patrol',speed:.6,age:3,life:40,phase:.1,timer:0,aggression:0,path:[[-19,14],[-23,14]],pathIndex:0,direction:1}];
   },kind);
   await page.waitForFunction(()=>getShift().haunt[0]?.state==='charge');
   await page.screenshot({path:out+'/encounter-'+kind+'.jpg',quality:82});
  }
  await page.evaluate(()=>Object.assign(getShift(),{x:-21,y:0,z:7,yaw:Math.PI/2,pitch:-.35,vx:0,vy:0,vz:0,grounded:true,haunt:[],hauntDirector:{delay:100,bag:[]}}));
  await page.keyboard.down('Control');await page.waitForFunction(()=>getShift().bodyHeight<1.07);
  for(const height of [.45,.96,2.355]){
   await page.keyboard.down('w');await page.keyboard.press('Space');
   await page.waitForFunction(()=>!!getShift().vault);await page.keyboard.up('w');
   await page.waitForFunction(h=>getShift().grounded&&Math.abs(getShift().y-h)<.01,height);
  }
  await page.screenshot({path:out+'/upper-shelf.jpg'});
  await page.keyboard.up('Control');
  await page.keyboard.down('s');await page.waitForFunction(()=>getShift().y<.01);await page.keyboard.up('s');
 }
 if(!baseline)await saveRecording(page,out+'/encounters.webm');
 console.log(JSON.stringify(stats));await writeFile(out+'/'+(baseline?'before':'after')+'-timing.json',JSON.stringify(stats));
}finally{await browser.close();}
