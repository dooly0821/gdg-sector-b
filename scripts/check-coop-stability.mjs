import {recordCoopPrediction,applyCoopSnapshot,advanceCoopPrediction,interpolateCoopHaunt} from '../dist/multiplayer.js';
import {createRoom,tickRoom} from '../server/room-core.js';
const check=(x,msg)=>{if(!x)throw Error(msg)};
const make=()=>({x:0,y:0,z:0,vx:4.5,vy:0,vz:0,steps:0,grounded:true,bodyHeight:1.7,carried:-1,elapsed:0});
const snap=(s,x,t,rtt=280,ghost=[])=>({self:{...s,x,grounded:true,flashlight:false},you:"a",players:[{id:"a"}],elapsed:t/1000,netSample:t,netReceived:t+rtt/2,netRtt:rtt,haunt:ghost});
let snaps=0,maxCorrection=0;
for(const rtt of [80,140,280,480,700]){
 const state=make();for(let i=0;i<=600;i++){const now=i*1000/60;state.x=i*4.5/60;recordCoopPrediction(state,now);
 if(now>rtt/2+100&&i%18===0){const time=now-rtt/2;applyCoopSnapshot(state,snap(state,time/1000*4.5,time,rtt));maxCorrection=Math.max(maxCorrection,Math.hypot(...state.netCorrection));check(Math.abs(state.x-i*4.5/60)<1e-8,"stale snap moved player");snaps++;}}
}
check(maxCorrection<.001,"steady prediction corrected unnecessarily");
let state=make();state.x=.15;state.netGrounded=true;state.netCorrection=[1,0];for(let i=0;i<100;i++)advanceCoopPrediction(state,[[.5,-2,.7,2,-1,2]],[],1/60,i*1000/60);check(state.x<.246,"wall crossed");
state=make();state.netGrounded=true;state.netCorrection=[-.6,0];for(let i=0;i<100;i++)advanceCoopPrediction(state,[],[],1/60,i*1000/60);check(state.x<-.55&&state.x>=-.601,"correction failed");
state=make();const g={kind:1,x:0,z:0,yaw:0,phase:2,age:3,speed:2,timer:1};applyCoopSnapshot(state,snap(state,0,0,100,[g]),true);for(let i=0;i<12;i++)interpolateCoopHaunt(state,1/60);check(state.haunt[0].phase>2.4,"ghost phase stopped");

const {room}=createRoom('ABC234',1000);tickRoom(room,1100);tickRoom(room,900);check(room.lastTick===1100,'server clock reversed');console.log('PASS',snaps,'delayed snapshots; collision, correction, ghost phase, server clock');