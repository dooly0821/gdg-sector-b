// Small adaptive jitter buffer for remote visual actors only.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const num=(v,f=0)=>Number.isFinite(v)?v:f;
const mix=(a,b,t)=>a+(b-a)*t;
const yawMix=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
export function appendRemote(track,pose,sample,received,serverTime){
 const t=track??{samples:[],gap:145,delay:170};const a=t.samples,last=a.at(-1);
 if(last&&Number.isFinite(serverTime)&&serverTime===last.serverTime)return t;
 let time=num(sample,received);
 if(last){
  const gap=clamp(received-last.received,25,600);t.gap=mix(t.gap,gap,.18);
  const desired=clamp(t.gap*.78+45,140,265);t.delay=mix(t.delay,desired,.15);
  const serverDelta=Number.isFinite(serverTime)&&Number.isFinite(last.serverTime)?serverTime-last.serverTime:time-last.time;
  const expected=last.time+clamp(serverDelta,1,800);
  time=Math.max(last.time+1,expected+clamp(time-expected,-12,12));
  if(serverDelta<0||serverDelta>1600||Math.hypot(pose.x-last.pose.x,pose.z-last.pose.z)>12){a.length=0;delete t.renderTime;}
 }
 a.push({time,received,serverTime,pose:{...pose}});
 while(a.length>12||a.length>2&&time-a[1].time>1500)a.shift();
 return t;
}
export function remoteAt(track,now,extrapolate=false){
 const a=track?.samples;if(!a?.length)return null;
 const requested=now-track.delay,target=Math.max(requested,track.renderTime??requested),first=a[0],last=a.at(-1);
 track.renderTime=target;
 if(target<=first.time)return {...first.pose};
 for(let i=1;i<a.length;i++){
  const b=a[i],p=a[i-1];if(target>b.time)continue;
  const u=clamp((target-p.time)/Math.max(1,b.time-p.time),0,1),out={...b.pose};
  for(const k of ['x','y','z','surfaceY','bodyHeight','steps','speed','vx','vy','vz','surfaceRoll','aggression','lightReaction','reveal','fade']){
   if(Number.isFinite(p.pose[k])&&Number.isFinite(b.pose[k]))out[k]=mix(p.pose[k],b.pose[k],u);
  }
  if(Number.isFinite(p.pose.yaw)&&Number.isFinite(b.pose.yaw))out.yaw=yawMix(p.pose.yaw,b.pose.yaw,u);
  return out;
 }
 const out={...last.pose};
 if(extrapolate&&out.grounded!==false&&!out.vault){
  const age=clamp((target-last.time)/1000,0,.15);
  out.x+=num(out.vx)*age;out.z+=num(out.vz)*age;out.steps=num(out.steps)+Math.hypot(num(out.vx),num(out.vz))*age;
 }
 return out;
}
