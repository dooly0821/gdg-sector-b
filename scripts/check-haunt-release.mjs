import {spawnSync} from 'node:child_process';
for(const name of ['check-coop','check-coop-stability','check-haunt-tactics','check-survival-response','check-haunt-navigation','check-locker-hiding','check-spawn-balance','check-freerun','check-shift-events','check-physics','check-coop-fast-sync','check-coop-smooth','check-warehouse-layout','check-shift-difficulty','check-cargo-glow','check-shift-art','check-coop-jitter-recovery','check-coop-revive-dispatch']){
 const result=spawnSync(process.execPath,['scripts/'+name+'.mjs'],{stdio:'inherit',timeout:120000});
 if(result.error||result.status!==0){console.error('FAIL',name,result.error??result.status);process.exit(1);}
}
console.log('PASS: release checks');
