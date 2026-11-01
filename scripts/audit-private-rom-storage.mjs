// Inspect a user-supplied project locally; never include ROM/project bytes in output.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {GbaMaps} from '../dist/rom.js';
import {indexNativeStory} from '../dist/native-story.js';
import {erasedROMSpans} from '../dist/rom-free-space.js';
const path=process.env.MAP_STUDIO_TEST_PROJECT;
if(!path)throw Error('Set MAP_STUDIO_TEST_PROJECT');
const project=JSON.parse(fs.readFileSync(path)),bytes=gunzipSync(Buffer.from(project.romRoundTrip.sourceGzip,'base64')),reader=await new GbaMaps(bytes).discover();
assert.equal(createHash('sha256').update(bytes).digest('hex'),project.romRoundTrip.sourceFingerprint);
const graph=await indexNativeStory(reader),packedPointerSites=new Set();
for(const root of graph.roots)if(Number.isInteger(root.reference))packedPointerSites.add(root.reference);
for(const node of Object.values(graph.nodes))if(node.opaque){for(let at=node.at;at<Math.min(reader.size-3,node.at+256);at++)packedPointerSites.add(at);}else for(const arg of node.args||[])if(arg.width===4)packedPointerSites.add(arg.at);
for(let at=512;at+5<=reader.size;at++)if(bytes[at]===0xb2||bytes[at]===0xb3)packedPointerSites.add(at+1);
const limited=graph.notices.some(n=>/limit reached|cancelled/i.test(n.message)),spans=erasedROMSpans(bytes,{packedPointerSites:limited?null:packedPointerSites}),generic=erasedROMSpans(bytes),runs=[];
for(let at=512;at<bytes.length;){if(bytes[at]!==255){at++;continue;}const begin=at;while(at<bytes.length&&bytes[at]===255)at++;if(at-begin>=256)runs.push(at-begin);}
const report={romBytes:bytes.length,nativeMaps:reader.maps.length,projectMaps:project.maps.length,nativeTilesetPairs:new Set(reader.maps.map(m=>reader.pairKey(m))).size,projectTilesetPairs:new Set(project.maps.filter(m=>m.rom?.key).map(m=>reader.pairKey(reader.byKey(m.rom.key)))).size,erasedPatternBytesInRuns4096:runs.filter(n=>n>=4096).reduce((a,b)=>a+b,0),largestErasedPatternRun:Math.max(...runs),guardedUsableBytes:spans.reduce((n,s)=>n+s.end-s.start,0),largestGuardedSpan:Math.max(...spans.map(s=>s.end-s.start)),guardedSpanCount:spans.length,genericGuardedUsableBytes:generic.reduce((n,s)=>n+s.end-s.start,0),genericLargestSpan:Math.max(...generic.map(s=>s.end-s.start)),packedIndexLimited:limited};
if(process.env.MAP_STUDIO_TEST_REPORT&&fs.existsSync(process.env.MAP_STUDIO_TEST_REPORT)){
 const result=JSON.parse(fs.readFileSync(process.env.MAP_STUDIO_TEST_REPORT)),byReason={};for(const a of result.allocations){const row=byReason[a.reason]??={bytes:0,count:0};row.bytes+=a.length;row.count++;}
 Object.assign(report,{newAllocationBytes:result.allocations.reduce((n,a)=>n+a.length,0),allocationCount:result.allocations.length,byReason,changedMapCount:result.reports.filter(m=>m.changed).length,verified:result.verification});
}
console.log(JSON.stringify(report,null,2));
