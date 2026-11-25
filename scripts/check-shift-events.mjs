import assert from 'node:assert/strict';
import {markSpecialCargo,createShiftEvents,tickShiftEvents,eventLighting,beginSpecial,cargoSignal,specialLabel} from '../dist/shift-events.js';
const c=markSpecialCargo(Array.from({length:30},(_,i)=>({id:'B-'+i})),()=>.42);
assert.equal(c.length,30);assert.equal(c.filter(p=>p.special).length,8);for(const k of ['noisy','heavy','urgent','cursed'])assert.equal(c.filter(p=>p.special===k).length,2);
const s={cargo:c,cargoDeadlines:{},elapsed:100,states:Array(30).fill('AVAILABLE'),shiftEvents:createShiftEvents(()=>.42),x:0,y:0,z:0};
const urgent=c.findIndex(p=>p.special==='urgent');s.carried=urgent;beginSpecial(s,urgent);assert.equal(s.cargoDeadlines[urgent],170);s.elapsed=120;beginSpecial(s,urgent);assert.equal(s.cargoDeadlines[urgent],170);
s.elapsed=171;cargoSignal(s);assert.ok(s.noise.radius>=8);assert.ok(specialLabel(s,urgent).includes('지연'));
const noisy=c.findIndex(p=>p.special==='noisy');s.carried=noisy;beginSpecial(s,noisy);s.elapsed+=1;cargoSignal(s);assert.ok(s.noise.radius>=9);
s.states[0]='DELIVERED';s.elapsed=100;s.shiftEvents.nextAt=99;const a=tickShiftEvents(s,()=>.42);assert.equal(a.kind,'blackout');s.elapsed+=1;assert.ok(eventLighting(s).power<.15&&eventLighting(s).torch===1);
s.elapsed=s.shiftEvents.active.until;assert.equal(tickShiftEvents(s,()=>.42).phase,'end');assert.equal(eventLighting(s).power,1);
assert.equal(s.states.filter(p=>p==='DELIVERED').length,1);console.log('PASS cargo mix, deadlines, signals, blackout recovery');

import {createRoom,operateRoom,tickRoom,snapshot} from '../server/room-core.js';
const {room,player}=createRoom('ABC234',1000),joined=operateRoom(room,{op:'join'},1010);const second=Object.values(room.players).find(p=>p.token===joined.token);
operateRoom(room,{op:'start',token:player.token},1020);operateRoom(room,{op:'ready',token:player.token},1030);operateRoom(room,{op:'ready',token:second.token},1040);
room.shared.elapsed=71;room.shared.shiftEvents.nextAt=70;room.shared.hauntDirector.delay=1e6;tickRoom(room,1100);
const a1=snapshot(room,player),a2=snapshot(room,second);assert.equal(a1.shiftEvents.active.kind,'blackout');assert.deepEqual(a1.shiftEvents,a2.shiftEvents);assert.deepEqual(a1.cargo,a2.cargo);assert.equal(a1.cargo.filter(p=>p.special).length,8);assert.equal(room.events.filter(e=>e.type==='anomaly').length,1);
console.log('PASS shared multiplayer anomaly and cargo');
