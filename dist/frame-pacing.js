// View interpolation never modifies authoritative collision coordinates.
export const posePoint=s=>[s.x,s.y,s.z];
export function renderPosition(s,previous,fraction){
 const now=posePoint(s);
 if(!previous||previous.some(v=>!Number.isFinite(v))||Math.hypot(...now.map((v,i)=>v-previous[i]))>.65)return now;
 const t=Math.max(0,Math.min(1,fraction));return now.map((v,i)=>previous[i]+(v-previous[i])*t);
}
export function shiftPrevious(previous,before,after){return previous?.map((v,i)=>v+after[i]-before[i]);}
export function mouseDelta(value,sensitivity){
 if(!Number.isFinite(value))return 0;
 // Never let a single coalesced/synthetic mouse event turn the view by 180 degrees.
 const gain=.0021*Math.max(.1,Math.min(5,Number(sensitivity)||1));
 return Math.max(-.60,Math.min(.60,value*gain));
}
export function blockGameplayShortcut(e){
 return !!(e.ctrlKey||e.metaKey||e.altKey||['ControlLeft','ControlRight','AltLeft','AltRight','MetaLeft','MetaRight','Tab','F1','F5','F7','F10','F11','F12','ContextMenu'].includes(e.code));
}
export function frameBudget(raw,accumulator,tick){
 const dt=Math.max(0,Math.min(.067,Number.isFinite(raw)?raw:0)),total=Math.max(0,Math.min(tick*8+tick*.999,accumulator+dt));
 const steps=Math.min(8,Math.floor((total+1e-9)/tick));
 return {dt,steps,remainder:Math.max(0,total-steps*tick)};
}
