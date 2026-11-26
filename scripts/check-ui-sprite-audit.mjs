import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../dist/'+p,import.meta.url));
const html=read('index.html').toString(),css=read('ui-repair-v2.css').toString();
assert(html.indexOf('ui-repair-v2.css')>html.indexOf('spectator.css'));
assert.match(css,/#modal \.gdg-section\.paper-note\s*\{[^}]*background-repeat:no-repeat,no-repeat!important/);
for(const [file,w,h] of [['paper-fill-v2.webp',240,104],['metal-fill-v2.webp',240,155],['hazard-v2.webp',120,16]]){const b=read('assets/interface/'+file);assert.equal(b.toString('ascii',8,12),'WEBP');assert.equal(b.readUInt32LE(4)+8,b.length);assert.equal(b.readUInt16LE(26)&16383,w);assert.equal(b.readUInt16LE(28)&16383,h);}
console.log('PASS final UI cascade, exact sprite crop dimensions and cache-busted entry');
