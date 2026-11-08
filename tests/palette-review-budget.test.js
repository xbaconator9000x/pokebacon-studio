import test from 'node:test';
import assert from 'node:assert/strict';
import {planArtworkPalettes} from '../dist/native-artwork-pack.js';
const planNativePalettes=(sets,nativeSets,freq,allowColorChanges,limit)=>planArtworkPalettes(sets,freq,{nativeSets,allowColorChanges,limit});
function fixture(n){const sets=new Map(),freq=new Map();for(let i=0;i<n;i++){const s=new Set(Array.from({length:15},(_,j)=>i*15+j));sets.set([...s].join(','),s);for(const c of s)freq.set(c,1);}return{sets,freq};}
test('reviewed conversion consolidates native tiles that exceed the shared budget',()=>{const{sets,freq}=fixture(18),original=JSON.stringify([...sets].map(([k,s])=>[k,[...s]]));const plan=planNativePalettes(sets,sets,freq,true,13);assert.equal(plan.palettes.length,13);assert.ok(plan.palettes.every(p=>p.length<=15));assert.equal(plan.convertedOriginal,true);assert.equal(JSON.stringify([...sets].map(([k,s])=>[k,[...s]])),original);});
test('exact export refuses the same overflow without reviewed conversion',()=>{const{sets,freq}=fixture(18);assert.throws(()=>planNativePalettes(sets,sets,freq,false,13),/Artwork needs 18 palettes/);});
test('native colours remain exact when they fit',()=>{const{sets,freq}=fixture(2);const plan=planNativePalettes(sets,sets,freq,true,13);assert.ok(!plan.convertedOriginal);assert.equal(plan.nativeExactPalettes,2);assert.deepEqual(new Set(plan.palettes.flat()),new Set([...freq.keys()]));});
test('reduced graphics retry budget also permits reviewed native consolidation',()=>{const{sets,freq}=fixture(3);const plan=planNativePalettes(sets,sets,freq,true,2);assert.equal(plan.palettes.length,2);assert.equal(plan.convertedOriginal,true);});
