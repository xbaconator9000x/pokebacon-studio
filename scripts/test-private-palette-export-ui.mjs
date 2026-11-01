// Actual export dialog regression. Private ROM/project paths stay outside Git.
import{session,fs,GbaMaps,assert}from'./qa-harness.mjs';import{createHash}from'node:crypto';
const projectPath=process.env.MAP_STUDIO_TEST_PROJECT,romPath=process.env.MAP_STUDIO_TEST_SOURCE;if(!projectPath||!romPath)throw Error('Set MAP_STUDIO_TEST_PROJECT and MAP_STUDIO_TEST_SOURCE');
const p=JSON.parse(fs.readFileSync(projectPath)),bytes=fs.readFileSync(romPath),hash=x=>createHash('sha256').update(x).digest('hex'),id=hash(bytes),mapsBefore=JSON.stringify(p.maps),s=await session({},true,w=>{Object.assign(w,{Blob,CompressionStream,DecompressionStream});});let saved;
const waitFor=async(fn)=>{const deadline=Date.now()+240000;let progress='';while(!fn()){const error=s.$('#dialogError');if(error&&!error.hidden&&error.textContent.trim())throw Error(error.textContent);const next=s.$('#romCompileProgress')?.textContent;if(next&&next!==progress){console.log(next);progress=next;}if(Date.now()>deadline)throw Error('Export UI timeout');await new Promise(r=>setTimeout(r,100));}};
try{
 await s.qa.switchProject(p);await s.qa.readROM(bytes,id);s.qa.setSaveHook(async(blob,filename)=>{saved={filename,bytes:new Uint8Array(await blob.arrayBuffer())};});
 for(let iteration=0;iteration<2;iteration++){
  await s.qa.exportRomDialog();assert.ok(s.$('#staticRomArt'));if(iteration)assert.equal(s.$('#convertRomPalettes').checked,true,'successful reviewed conversion is remembered');s.$('#staticRomArt').checked=true;s.$('#convertRomPalettes').checked=true;s.submit();await waitFor(()=>!!s.$('#saveCompiledRom'));
  assert.equal(s.$('#romReviewMap').options.length,p.maps.length);s.$('#saveCompiledRom').click();await waitFor(()=>!!saved);const reader=await new GbaMaps(saved.bytes).discover();for(const map of p.maps){const native=reader.byKey(map.rom.key);assert.ok(native);assert.equal(native.layout.width,map.width);assert.equal(native.layout.height,map.height);}assert.equal(JSON.stringify(p.maps),mapsBefore,'original map data preserved');assert.equal(s.qa.state.project.romExportPreferences.reviewedPaletteConversion,true);assert.ok(s.qa.state.project.nativeArtworkPacks.length);
  const checksum=hash(saved.bytes);console.log('PASS real dialog export',iteration+1,p.maps.length,'maps',checksum);if(iteration===0){globalThis.firstHash=checksum;if(process.env.MAP_STUDIO_TEST_OUTPUT)fs.writeFileSync(process.env.MAP_STUDIO_TEST_OUTPUT,saved.bytes);}else assert.equal(checksum,globalThis.firstHash,'repeat export is identical');saved=null;s.$('#dialog').close();
 }
 console.log('PASS checked palette conversion, review, save, persisted pack/preferences and repeat export through app UI');
}finally{await s.close();}
