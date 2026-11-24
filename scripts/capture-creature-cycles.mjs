import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {startRecording,saveRecording} from './browser-recording.mjs';
const {chromium}=createRequire(import.meta.url)('playwright');
const out=process.env.QA_CAPTURE_DIR??'qa/v3';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:640,height:416}});
 page.setDefaultTimeout(120000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>localStorage.setItem('gdg.settings',JSON.stringify({quality:'PERFORMANCE',scale:.75,audio:false})));
 await page.route('**/app.js',async route=>{
  const r=await route.fetch(),source=await r.text();
  const frame='const threat=updateHaunt(s,worlds[0].blocks,facing,dt);';
  assert.ok(source.includes(frame));
  const tap=frame+`
   const cycle=window.cycle, actor=s.haunt?.[0];
   if(cycle){
    const state=actor?.state??'gone';
    if(cycle.at(-1)?.state!==state)cycle.push({state,t:s.elapsed,player:[s.x,s.z],actor:actor?[actor.x,actor.z]:null});
   }`;
  await route.fulfill({response:r,body:source.replace(frame,tap)+'\nwindow.getShift=()=>session;'});
 });
 await page.goto(process.env.QA_URL??'http://127.0.0.1:8090');
 await page.click('#start');
 await page.waitForFunction(()=>!document.querySelector('#play').hidden&&document.querySelector('#loading').hidden);
 await startRecording(page);
 const logs=[];
 for(let kind=0;kind<4;kind++){
  await page.evaluate(kind=>{
   const s=getShift();
   Object.assign(s,{x:-25.4,y:0,z:14,yaw:Math.PI/2,pitch:0,vx:0,vy:0,vz:0,grounded:true,encounterHit:null,
    hauntCooldown:0,hauntDirector:{delay:200,bag:[]},noise:null});
   s.haunt=[{kind,x:-28.1,z:14,yaw:Math.PI/2,state:'patrol',age:0,life:2.1,speed:0,phase:.1,
    timer:0,aggression:0,path:[[-27.8,14],[-28.8,14]],pathIndex:0,direction:1}];
   window.cycle=[{state:'patrol',t:s.elapsed,player:[s.x,s.z],actor:[-28.1,14]}];
  },kind);
  await page.waitForFunction(()=>cycle.some(e=>e.state==='windup'));
  await page.keyboard.down('Shift');await page.keyboard.down('s');
  try{await page.waitForFunction(()=>getShift().x> -16.80);}
  finally{await page.keyboard.up('s');await page.keyboard.up('Shift');}
  try{await page.waitForFunction(()=>cycle.some(e=>e.state==='gone'),null,{timeout:45000});}
  catch(error){console.error(await page.evaluate(()=>({events:cycle,x:getShift().x,actor:getShift().haunt[0]})));throw error;}
  const events=await page.evaluate(()=>window.cycle);
  for(const state of ['charge','recovery','disappear','gone'])assert.ok(events.some(e=>e.state===state),JSON.stringify(events));
  logs.push({kind,events});console.log('PASS C-01 rendered cycle',kind,events.map(e=>e.state).join(' > '));
 }
 assert.deepEqual(errors,[]);
 await saveRecording(page,out+'/creature-cycles.webm');
 await writeFile(out+'/creature-cycles.json',JSON.stringify(logs,null,2)+'\n');
}finally{await browser.close();}
