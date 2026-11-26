// The selected mode and quota are frozen at shift start; only live-player scaling changes.
export const DIFFICULTIES=Object.freeze({
 easy:{label:'쉬움',speed:.88,range:.82,hearing:.80,interval:1.25,memory:-2,event:1.35,special:.20,description:'초보 작업자 · 추격과 감지 완화'},
 normal:{label:'보통',speed:1,range:1,hearing:1,interval:1,memory:0,event:1,special:.267,description:'표준 야간 근무'},
 hard:{label:'어려움',speed:1.08,range:1.12,hearing:1.15,interval:.80,memory:2,event:.82,special:.32,description:'더 빠른 추격 · 빈번한 이상 현상'},
 hell:{label:'헬 / HELL',speed:1.14,range:1.24,hearing:1.25,interval:.65,memory:4,event:.65,special:.36,description:'극한 추격 · 높은 감지 · 잦은 정전'}
});
export const normalizeDifficulty=value=>typeof value==='string'&&Object.hasOwn(DIFFICULTIES,value)?value:'normal';
export const effectiveDifficulty=(value,startCount=1)=>normalizeDifficulty(value);
export const cargoQuota=count=>[30,40,50,70][Math.max(1,Math.min(4,Math.trunc(count)||1))-1];
export const missionTotal=s=>s?.cargo?.length??30;
export const difficultyLabel=value=>DIFFICULTIES[normalizeDifficulty(value)].label;
export const difficultyProfile=s=>DIFFICULTIES[normalizeDifficulty(s?.difficultyLevel)];
