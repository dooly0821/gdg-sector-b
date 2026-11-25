import assert from 'node:assert/strict';
import {createRoom,operateRoom,snapshot,serializeRoom,tickRoom} from '../server/room-core.js';
import {teamDifficulty} from '../dist/haunt.js';
const t0=100000,{room,player:a}=createRoom('ABC234',t0);
const b=operateRoom(room,{op:'join'},t0+10);const pb=Object.values(room.players).find(p=>p.token===b.token);
operateRoom(room,{op:'start',token:a.token},t0+20);
operateRoom(room,{op:'ready',token:a.token},t0+30);
const p=operateRoom(room,{op:'ready',token:b.token},t0+40);
assert.equal(p.snapshot.phase,'playing');
const x=a.state.x,z=a.state.z;
for(let i=1;i<=10;i++){const now=t0+40+i*100;operateRoom(room,{op:'sync',token:a.token,input:{keys:['KeyW'],yaw:0,pitch:0},commands:[]},now);operateRoom(room,{op:'sync',token:b.token,input:{keys:[],yaw:0,pitch:0},commands:[]},now+10);}
const moved=Math.hypot(a.state.x-x,a.state.z-z);assert.ok(moved>.5&&moved<6);
assert.ok(Math.hypot(pb.state.x-.7,pb.state.z-15)<.08);
const snapA=snapshot(room,a),snapB=snapshot(room,pb);
assert.equal(snapA.cargo,snapB.cargo);assert.equal(snapA.states,snapB.states);assert.equal(snapA.difficulty.maxActive,3);
assert.equal(teamDifficulty(4).maxActive,4);assert.ok(teamDifficulty(4).memory>teamDifficulty(1).memory);
operateRoom(room,{op:'sync',token:a.token,input:{keys:[],yaw:0,pitch:0},commands:[{seq:1,type:'torch'}]},t0+1200);
operateRoom(room,{op:'sync',token:a.token,input:{keys:[],yaw:0,pitch:0},commands:[{seq:1,type:'torch'}]},t0+1210);
assert.equal(a.state.flashlight,true);
// Controlled room fixture: two workers attempt to pick up the same one box.
room.shared.hauntDirector.delay=1e6;room.shared.haunt=[];
room.shared.cargo[0]={id:'B-01',area:'test',pos:[3,0,17]};room.shared.states.fill('CARRIED');room.shared.states[0]='AVAILABLE';
for(const player of [a,pb]){Object.assign(player.state,{x:3,y:0,z:18.1,yaw:0,pitch:-.75,bodyHeight:1.7,grounded:true,vx:0,vy:0,vz:0,carried:-1,flashlight:false,flashAmount:0});player.input={keys:[],yaw:0,pitch:-.75};}
operateRoom(room,{op:'sync',token:a.token,input:a.input,commands:[{seq:2,type:'use'}]},t0+1220);
operateRoom(room,{op:'sync',token:pb.token,input:pb.input,commands:[{seq:1,type:'use'}]},t0+1221);
for(let i=1;i<=6;i++)tickRoom(room,t0+1221+i*100);
assert.equal(room.shared.states[0],'CARRIED');
assert.equal([a,pb].filter(p=>p.state.carried===0).length,1);
const before=serializeRoom(room),restored=JSON.parse(before);
assert.equal(restored.shared.states[0],'CARRIED');
assert.ok(!before.includes('"navIndex"'));
// Target selection across distant workers (same shared monster array).
room.shared.hauntDirector.delay=1e6;
for(const [player,px,pz] of [[a,0,34],[pb,-30,40]])Object.assign(player.state,{x:px,y:0,z:pz,failed:false,grounded:true,bodyHeight:1.7,carried:-1,vx:0,vy:0,vz:0});
room.shared.haunt=[{kind:0,x:0,z:30,yaw:0,phase:0,age:3,life:50,state:'patrol',path:[[0,30],[0,34]],pathIndex:0,direction:1,speed:0,timer:0,aggression:0},{kind:1,x:-30,z:35,yaw:0,phase:0,age:3,life:50,state:'patrol',path:[[-30,35],[-30,40]],pathIndex:0,direction:1,speed:0,timer:0,aggression:0}];
tickRoom(room,t0+1840);
assert.equal(room.shared.haunt[0].targetId,a.id);assert.equal(room.shared.haunt[1].targetId,pb.id);
const denied=()=>operateRoom(room,{op:'sync',token:'incorrect'},t0+1850);let auth=false;try{denied();}catch(e){auth=e.status===401;}assert.ok(auth);
console.log('PASS: room lifecycle, movement, shared cargo, exclusive pickup, command dedup, target distribution, difficulty, auth');
