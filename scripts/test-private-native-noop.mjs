// A fresh native import/export control, with no authored map or story changes.
import {session,fs,newProject,importRomMaps} from './qa-harness.mjs';
import {prepareNativeArtwork}from'../dist/native-artwork-pack.js';
import{createHash}from'node:crypto';
import {gunzipSync} from 'node:zlib';
let finished=false;process.on('beforeExit',()=>{if(!finished){console.error('FAIL native no-edit control did not complete.');process.exitCode=1;}});
const fixture=JSON.parse(fs.readFileSync(process.env.MAP_STUDIO_TEST_PROJECT)),source=process.env.MAP_STUDIO_TEST_SOURCE?fs.readFileSync(process.env.MAP_STUDIO_TEST_SOURCE):gunzipSync(Buffer.from(fixture.romRoundTrip.sourceGzip,'base64')),id=process.env.MAP_STUDIO_TEST_SOURCE?createHash('sha256').update(source).digest('hex'):fixture.romRoundTrip.sourceId,s=await session({},true);
try{
 const reader=await s.qa.readROM(source,id),keys=process.env.MAP_STUDIO_TEST_KEYS?.split(',')||fixture.maps.map(m=>m.rom.key);
 const {project}=await importRomMaps(newProject('Native control'),reader,keys,{sourceId:id,includeEvents:false,includeStory:false,encodeAtlas:async a=>{const c=s.w.document.createElement('canvas');c.width=a.width;c.height=a.height;const ctx=c.getContext('2d'),d=ctx.createImageData(a.width,a.height);d.data.set(a.pixels);ctx.putImageData(d,0,0);return c.toDataURL();}});
 await s.qa.switchProject(project);if(process.env.MAP_STUDIO_TEST_PREPARE){const packed=await prepareNativeArtwork(s.qa.state.project,reader,id,s.qa.renderForRom,{allowColorChanges:true,nativeMiniatures:s.qa.originalArtworkMiniatures,progress:console.log});Object.assign(s.qa.state.project,{nativeArtworkPacks:packed.nativeArtworkPacks});}const r=await s.qa.compileROM({staticArtwork:!!process.env.MAP_STUDIO_TEST_PREPARE,progress:console.log});
 const summary={control:'fresh native import, no edits'+(process.env.MAP_STUDIO_TEST_PREPARE?', reviewed palette preparation':', no palette repack'),maps:r.reports.length,changed:r.reports.filter(m=>m.changed).length,allocationBytes:r.allocations.reduce((n,a)=>n+a.length,0),allocations:r.allocations.map(a=>({bytes:a.length,reason:a.reason})),verified:r.nativeVerification,integrity:r.romIntegrity};console.log(JSON.stringify(summary,null,2));if(process.env.MAP_STUDIO_TEST_REPORT)fs.writeFileSync(process.env.MAP_STUDIO_TEST_REPORT,JSON.stringify(summary));
}catch(error){if(process.env.MAP_STUDIO_TEST_REPORT)fs.writeFileSync(process.env.MAP_STUDIO_TEST_REPORT,JSON.stringify({status:'failed',error:error.message}));throw error;}finally{await s.close();finished=true;}
