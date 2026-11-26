import assert from 'node:assert/strict';
import {createScene,newShift,randomCargo,step,interact,parcelPositions} from '../dist/mission.js';
import {docksFor} from '../dist/dispatch-bays.js';
import {lockersFor} from '../dist/lockers.js';
import {hasExtension,EXTENSION_STAIRS,EXTENSION_CARGO} from '../dist/map-layout.js';
import {mapMarkup} from '../dist/facility-map.js';
import {indexBlocks,freeAt} from '../dist/haunt-navigation.js';
import {createRoom,operateRoom,tickRoom} from '../server/room-core.js';
const body={r:.255,y:0,h:1.7},dt=1/60;
for(const level of ['easy','normal','hard','hell']){
 const wide=['hard','hell'].includes(level),[w]=createScene(level),nav=indexBlocks(w.blocks),s=newShift(()=>.42,level);
 assert.equal(hasExtension(w.blocks),wide);assert.equal(docksFor(level).length,wide?5:3);assert.equal(freeAt(nav,-30,90,body),wide);assert.equal(lockersFor(level).length,lockersFor('normal').length+(wide?6:0));
 assert(mapMarkup(w.blocks,s).includes(wide?'E-01 대형 화물동':'0 0 306 516'));
 for(const count of [30,40,50,70]){const cargo=randomCargo(()=>.42,count,level);assert.equal(cargo.length,count);assert.equal(new Set(cargo.map(p=>p.pos.join(','))).size,count);assert.equal(cargo.some(p=>p.pos[2]>78),wide);if(wide)for(const p of cargo.filter(p=>p.pos[2]>78))assert(freeAt(nav,p.pos[0],p.pos[2],{r:.28,y:0,h:.5}),'cargo clear '+p.pos);}
 if(!wide)continue;
 for(const x of [-30,0]){const q=Object.assign(newShift(undefined,level),{x,z:76,yaw:Math.PI});for(let i=0;i<90;i++)step(q,new Set(['KeyW']),w.blocks,dt);assert(q.z>80,'open connecting doorway');}
 for(const [x,z] of EXTENSION_STAIRS){const q=Object.assign(newShift(undefined,level),{x,z:z-3.45,yaw:Math.PI});for(let i=0;i<95;i++)step(q,new Set(['KeyW']),w.blocks,dt);assert(q.y>=1.40,'extension stairs '+x+','+z);}
 for(const [bay,dock] of docksFor(level).entries()){if(bay<3)continue;const q=Object.assign(newShift(undefined,level),{x:dock[0],z:dock[2]-1.45,yaw:Math.PI,pitch:-.4,carried:0});q.states[0]='CARRIED';assert.equal(interact(q,{dock:true,bay,pos:dock},w.blocks,true),'delivered');assert(parcelPositions(q).some(p=>Math.abs(p[2]-dock[2])<.4));}
 for(const count of [2,3,4]){let now=100000;const {room,player}=createRoom('EXP234',now);const tokens=[player.token];for(let i=1;i<count;i++)tokens.push(operateRoom(room,{op:'join'},now).token);operateRoom(room,{op:'start',token:tokens[0],level},now);for(const token of tokens)operateRoom(room,{op:'ready',token},now);for(const p of Object.values(room.players)){p.state.x=-30;p.state.z=80;p.state.y=0;p.state.yaw=Math.PI;p.input.yaw=Math.PI;p.input.keys=['KeyW'];}now+=100;tickRoom(room,now);assert.equal(room.shared.difficultyLevel,level);assert(Object.values(room.players).every(p=>p.state.z>80&&p.state.difficultyLevel===level));}
}
console.log('PASS difficulty-specific map, expanded cargo/dispatch, six lockers, four stairs, 2/3/4 player server layout');
