import assert from 'node:assert/strict';import {performance} from 'node:perf_hooks';
import {newMap} from '../dist/model.js';import {movementAt,createMovementQuery} from '../dist/world-model.js';
const map=newMap('Dense object benchmark',140,140);
for(let i=0;i<1000;i++)map.objects.push({id:String(i),x:i*7%136,y:Math.floor(i*7/136)*3%136,w:3,h:4,collisionChoice:'footprint',footprint:{x:1,y:3,w:1,h:1}});
const run=query=>{let sum=0;for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){const r=query(x,y);sum+=r.collision+Number(r.behind);}return sum;};
run((x,y)=>movementAt(map,x,y));const times=[];let expected;
for(let n=0;n<3;n++){let t=performance.now();expected=run((x,y)=>movementAt(map,x,y));const direct=performance.now()-t;t=performance.now();const actual=run(createMovementQuery(map));const indexed=performance.now()-t;assert.equal(actual,expected);times.push({directMs:+direct.toFixed(2),indexedIncludingBuildMs:+indexed.toFixed(2),speedup:+(direct/indexed).toFixed(2)});}
console.log(JSON.stringify({environment:'Server JavaScript; physical Android timing unverified',cells:19600,objects:1000,identicalResults:true,runs:times},null,2));
