import {spawnSync} from 'node:child_process';
for(const name of ['check-coop','check-coop-stability','check-haunt-tactics','check-survival-response','check-haunt-navigation','check-locker-hiding','check-spawn-balance','check-freerun','check-shift-events','check-physics','check-coop-fast-sync','check-coop-smooth','check-warehouse-layout','check-shift-difficulty','check-cargo-glow','check-shift-art','check-coop-jitter-recovery','check-coop-revive-dispatch','check-coop-spectator','check-movement-rescue','check-coop-release-matrix','check-server-01-reset','check-frame-pacing','check-smooth-stairs-ai','check-haunt-escape','check-expanded-layout','check-facility-actions','check-forward-bhop','check-threat-warning','check-player-overlap','check-smooth-contact','check-unstuck-worker','check-qa-followup','check-ui-paper-repair','check-ui-sprite-audit']){
 const result=spawnSync(process.execPath,['scripts/'+name+'.mjs'],{stdio:'inherit',timeout:120000});
 if(result.error||result.status!==0){console.error('FAIL',name,result.error??result.status);process.exit(1);}
}
console.log('PASS: release checks');
