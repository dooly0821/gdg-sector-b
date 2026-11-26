import {DIFFICULTIES,normalizeDifficulty,difficultyProfile} from './difficulty.js';
// Shared shift rules. Room authority runs these once for every team.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const SPECIAL=Object.freeze({noisy:{label:'소음 화물',period:2.5,radius:9},heavy:{label:'중량 화물'},urgent:{label:'긴급 화물',deadline:70,period:3,radius:8},cursed:{label:'격리 화물',period:4,radius:11}});
export function markSpecialCargo(cargo,rng=Math.random,count=8){
 const order=cargo.map((_,i)=>i);
 for(let i=order.length-1;i>0;i--){const j=Math.min(i,Math.floor(rng()*(i+1)));[order[i],order[j]]=[order[j],order[i]];}
 const types=Array.from({length:Math.min(cargo.length,Math.max(0,count))},(_,i)=>['noisy','heavy','urgent','cursed'][i%4]);
 return cargo.map((p,i)=>{const n=order.indexOf(i);return n<types.length?{...p,special:types[n]}:p;});
}
export function createShiftEvents(rng=Math.random,level='normal'){return {nextAt:(38+rng()*24)*DIFFICULTIES[normalizeDifficulty(level)].event,serial:0,active:null};}
export function beginSpecial(s,index){
 if(s.cargo?.[index]?.special==='urgent'){const deadlines=s.cargoDeadlines??={};if(!Number.isFinite(deadlines[index]))deadlines[index]=s.elapsed+SPECIAL.urgent.deadline;}
 s.nextCargoSignal=s.elapsed+.75;s.signalCargo=index;s.cargoSignalAt=null;
}
export function cargoSignal(s){
 if(s.carried<0)return;
 const type=s.cargo?.[s.carried]?.special,p=SPECIAL[type];if(!p?.period)return;
 if(type==='urgent'&&!(s.elapsed>=(s.cargoDeadlines?.[s.carried]??Infinity)))return;
 if(s.signalCargo!==s.carried){s.signalCargo=s.carried;s.nextCargoSignal=s.elapsed+.75;s.cargoSignalAt=null;}
 if(s.elapsed+.00001>=(s.nextCargoSignal??0)){s.nextCargoSignal=s.elapsed+p.period;s.cargoSignalAt=s.elapsed;}
 if(Number.isFinite(s.cargoSignalAt)&&s.elapsed-s.cargoSignalAt<.48){
  s.noise={x:s.x,y:s.y+.5,z:s.z,radius:Math.max(p.radius,s.noise&&s.elapsed-s.noise.time<.25?s.noise.radius:0),time:s.cargoSignalAt};
 }
}
export function tickShiftEvents(s,rng=Math.random){
 const d=s.shiftEvents;if(!d)return null;
 const t=s.elapsed??0;
 if(d.active&&t>=d.active.until){const old=d.active;d.active=null;d.nextAt=t+(48+rng()*42)*difficultyProfile(s).event;return {type:'anomaly',kind:old.kind,phase:'end',message:old.kind==='blackout'?'전력 복구 · 정상 조명 복귀':'이상 신호가 사라졌습니다.'};}
 if(d.active||t<d.nextAt)return null;
 const n=s.states?.filter(v=>v==='DELIVERED').length??0;
 if(!n&&t<70*difficultyProfile(s).event)return null;
 const kind=d.serial===0?'blackout':rng()<.66?'blackout':'interference';
 const duration=kind==='blackout'?10+rng()*6:7+rng()*4;
 d.active={kind,start:t,until:t+duration,id:++d.serial,seed:rng()*100};
 return {type:'anomaly',kind,phase:'start',message:kind==='blackout'?'비상: 창고 전력 차단 · 비상등 작동':'경고: 미확인 전파 간섭 · 전등 불안정'};
}
export function eventLighting(s){
 const a=s.shiftEvents?.active,t=s.elapsed??0;if(!a||t>=a.until)return {power:1,torch:1};
 const age=Math.max(0,t-a.start),tail=Math.min(1,(a.until-t)/.65),fade=clamp(age/.5,0,1)*tail;
 if(a.kind==='blackout')return {power:1-.91*fade,torch:1};
 const wave=.5+.5*Math.sin((age+a.seed)*4.1);
 return {power:1-fade*(.20+.49*wave*wave),torch:1};
}
export function specialLabel(s,index){
 const type=s.cargo?.[index]?.special;if(!SPECIAL[type])return '';
 const label=SPECIAL[type].label,deadline=s.cargoDeadlines?.[index];
 if(type==='urgent'&&Number.isFinite(deadline)){const left=Math.ceil(deadline-s.elapsed);return label+' · '+(left>0?left+'초':'지연 / 소음 발생');}
 return label;
}
