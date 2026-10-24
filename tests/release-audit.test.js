import test from 'node:test';
import assert from 'node:assert/strict';
import {releaseAudit} from '../dist/release-audit.js';
import {newProject,newMap} from '../dist/model.js';
import {STOCK_FIRE_RED_SHA} from '../dist/verified-frlg.js';
test('release preflight flags planning maps and unknown save layouts before compilation',()=>{
 const p=newProject(),m=p.maps[0];m.rom={key:'0.0'};
 m.markers.push({id:'once',x:1,y:1,runtime:{action:'dialogue',text:'Hello',onceFlag:'done'}});
 const unknown=releaseAudit(p,{sourceHash:'unknown'});assert.ok(unknown.findings.some(f=>f.code==='save-adapter'));assert.equal(unknown.readyToCompile,false);
 assert.equal(releaseAudit(p,{sourceHash:STOCK_FIRE_RED_SHA}).findings.some(f=>f.code==='save-adapter'),false);
 const extra=newMap('Unbound');p.maps.push(extra);assert.ok(releaseAudit(p).findings.some(f=>f.code==='unbound-map'&&f.mapId===extra.id));
});
test('release preflight checks endpoints and does not invent reverse connections',()=>{
 const p=newProject(),a=p.maps[0],b=newMap('Other');p.maps.push(b);for(const m of p.maps)m.rom={key:'0.0'};
 p.links=[{runtime:true,from:{mapId:a.id,x:0,y:0},to:{mapId:b.id,x:0,y:0}}];
 assert.equal(releaseAudit(p,{startMapId:a.id}).findings.some(f=>f.code==='reachability-unproven'),false);
 assert.ok(releaseAudit(p,{startMapId:b.id}).findings.some(f=>f.code==='reachability-unproven'&&f.mapId===a.id));
 p.links[0].to.x=b.width;assert.ok(releaseAudit(p).findings.some(f=>f.code==='exit-invalid'));
});
