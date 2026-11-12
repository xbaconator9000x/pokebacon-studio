// Legacy Android WebViews used code-size-mapTable as a ROM source ID.
// Never infer source identity from that weak value alone. Attest it using
// current byte-level SHA-256, preserved native map baselines, and an explicit
// user review. Existing source ID keys are deliberately never rewritten.
const HEX_SHA=/^[a-f0-9]{64}$/;
const same=(a,b)=>a===b;
const reason=(messages,condition,message)=>{if(!condition)messages.push(message);};
export function legacyROMSourceKey(reader){
 if(!reader||typeof reader.code!=='string'||!Number.isInteger(reader.size)||!Number.isInteger(reader.mapTable))
  throw Error('A fully decoded source GBA ROM is required.');
 return reader.code+'-'+reader.size+'-'+reader.mapTable;
}
export function inspectROMSourceBinding(project,reader,fingerprint){
 if(!HEX_SHA.test(fingerprint))throw Error('Expected the complete lowercase SHA-256 ROM fingerprint.');
 const canonical={status:'canonical',sourceId:fingerprint,legacyId:null,verifiedMaps:0,problems:[]};
 if(!project||!Array.isArray(project.maps))return canonical;
 const bound=project.maps.filter(map=>map?.rom?.sourceId===fingerprint);
 if(bound.length)return {...canonical,status:'existing-canonical',verifiedMaps:bound.length};
 const legacyId=legacyROMSourceKey(reader);
 const maps=project.maps.filter(map=>map?.rom?.sourceId===legacyId&&!map.rom.isCopy&&!map.rom.generated);
 if(!maps.length)return canonical;
 const records=(project.romSources||[]).filter(source=>source?.id===legacyId);
 const failed={status:'blocked-legacy',sourceId:fingerprint,legacyId,verifiedMaps:0,problems:[]};
 if(records.length!==1)return {...failed,problems:['Expected exactly one saved source descriptor for the historical ROM ID.']};
 const record=records[0],signed=record.verifiedSha256;
 if(signed!==undefined){
  if(!HEX_SHA.test(signed))return {...failed,problems:['The saved ROM verification digest is malformed.']};
  if(signed!==fingerprint)return {...failed,problems:['This ROM does not match the previously verified original ROM. Open the correct ROM or review a new revision.']};
  return {status:'verified-legacy',sourceId:legacyId,legacyId,verifiedMaps:maps.length,problems:[]};
 }
 const roundTrip=project.romRoundTrip;
 if(roundTrip?.sourceId===legacyId&&roundTrip.sourceFingerprint===fingerprint)
  return {status:'verified-sidecar',sourceId:legacyId,legacyId,verifiedMaps:maps.length,problems:[]};
 const problems=[];
 const summary=reader.summary();
 for(const key of ['code','engine','mapTable','mapCount','banks'])
  if(record[key]!==undefined)reason(problems,same(record[key],summary[key]),'Saved ROM '+key+' differs from the opened source.');
 reason(problems,record.code===summary.code&&record.mapTable===summary.mapTable,'Saved ROM game code/map-table provenance is incomplete.');
 for(const map of maps){
  const source=reader.byKey(map.rom.key),prior=map.rom;
  if(!source){problems.push('Native map '+String(prior.key)+' does not exist.');continue;}
  const label=String(prior.key);
  for(const [oldValue,newValue,name] of [
   [prior.engine,reader.engine,'engine'],[prior.headerAddress,source.address,'header'],[prior.layoutAddress,source.layout.address,'layout'],
   [prior.blocksAddress,source.layout.blocks,'blocks pointer'],[prior.scriptsAddress,source.scripts,'script pointer'],
   [prior.originalWidth,source.layout.width,'original width'],[prior.originalHeight,source.layout.height,'original height']
  ])if(!same(oldValue,newValue))problems.push('Native map '+label+' '+name+' differs from the saved original.');
  const blocks=prior.originalBlocks;
  if(!Array.isArray(blocks)||blocks.length!==source.layout.width*source.layout.height){
   problems.push('Native map '+label+' lacks a complete original block baseline.');continue;
  }
  const actual=reader.blocks(source);
  if(actual.length!==blocks.length||blocks.some((cell,index)=>cell!==actual[index]))
   problems.push('Native map '+label+' original tile/collision blocks do not match.');
  if(problems.length>24)break;
 }
 return problems.length?{...failed,problems:problems.slice(0,25)}:
 {status:'review-legacy',sourceId:fingerprint,legacyId,verifiedMaps:maps.length,problems:[]};
}
export function approveLegacyROMBinding(project,reader,fingerprint,expectedLegacyId){
 const review=inspectROMSourceBinding(project,reader,fingerprint);
 if(review.status!=='review-legacy'||review.legacyId!==expectedLegacyId)
  throw Error('The proposed original ROM binding is no longer safe to approve. Reopen the matching original ROM.');
 const descriptor=project.romSources.find(row=>row.id===review.legacyId);
 // This appends an auditable cryptographic binding only. All maps, artwork,
 // event, hex, game-data and cross-project identity keys stay exactly as saved.
 descriptor.verifiedSha256=fingerprint;
 descriptor.verificationMethod='manual-source-baseline-v1';
 return {sourceId:review.legacyId,verifiedMaps:review.verifiedMaps,fingerprint};
}
