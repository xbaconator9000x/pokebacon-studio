// Bounded preparation only. Never merges code or recursively dispatches CI.
import fs from 'node:fs';
import path from 'node:path';
const inventory=JSON.parse(fs.readFileSync('docs/feature-audit/inventory.json'));
const queue=[
 {id:'PR17-export',sourcePR:17,scope:'Reconcile palette export, prepared artwork and independent pin visibility',files:['dist/rom-writer.js','dist/app.js'],gate:'Preserve main allocation/adapters; palette export and pin browser regression checks'},
 {id:'PR11-pages',sourcePR:11,scope:'Reconcile priority event pages with current compiler, validation and preview',files:['dist/authoring-model.js','dist/event-model.js','dist/scene-compiler.js','dist/scene-ui.js'],gate:'Disabled/malformed pages, priority branches, persistence and native export/reimport'},
 {id:'ART10',scope:'Complete Shattered player activity and colour bindings',files:['dist/wardrobe-native.js','dist/sprite-ui.js','dist/native-sprites.js'],gate:'Correct colour/name/group mapping; edit/save/reopen/export/execute/reimport'}
];
const completed=new Set(JSON.parse(fs.readFileSync('docs/feature-audit/completed-deliveries.json')));
const next=queue.find(batch=>!completed.has(batch.id));
const directory=process.argv[2]||'delivery-preparation';fs.mkdirSync(directory,{recursive:true});
const result={schemaVersion:1,sourceCommit:process.env.DELIVERY_SOURCE_SHA||null,mode:'prepared-not-dispatched-to-agent',next:next||null,relatedCapabilities:next?inventory.features.filter(f=>next.id==='ART10'?f.id==='ART10':next.id==='PR11-pages'?f.backlogGroup==='EVT':f.backlogGroup==='REL').map(f=>({id:f.id,status:f.status,acceptanceCriteria:f.acceptanceCriteria})):[]};
fs.writeFileSync(path.join(directory,'next-delivery.json'),JSON.stringify(result,null,2)+'\n');
console.log(next?'Prepared '+next.id+': '+next.scope:'No pending delivery batches.');
