import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const css=read('dist/ui-original-art.css').toString(),app=read('dist/app.js').toString();
assert(!css.includes('background:var(--original-paper) repeat'));
const note=css.match(/#modal \.paper-note\s*\{([^}]+)\}/)?.[1]??'';
assert.match(note,/paper-repair\.webp/);assert.match(note,/background-repeat:no-repeat,no-repeat/);
assert.match(css,/#modal\[data-layout=pause\] \{?|#modal\[data-layout=pause\]\{/);
assert.match(css,/max-height:100%;overflow:auto/);assert(app.includes('scroller.scrollTop=0'));
for(const file of ['paper-repair.webp','stripe-repair.webp']){const b=read('dist/assets/interface/'+file);assert.equal(b.toString('ascii',0,4),'RIFF');assert.equal(b.toString('ascii',8,12),'WEBP');assert.equal(b.readUInt32LE(4)+8,b.length);assert(b.length<4096);}
console.log('PASS user-source UI textures, non-repeating paper, viewport scrolling and original asset integrity');
