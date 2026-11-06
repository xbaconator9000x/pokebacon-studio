// Shared workspaces ask for capabilities. Platform adapters keep game-specific
// layouts, codecs and build rules out of editor UI.
const shared=Object.freeze({project:true,maps:true,tilesets:true,sprites:true,animations:true,scripts:true,events:true,text:true,trainers:true,pokemon:true,items:true,abilities:true,moves:true,encounters:true,uiTemplates:true,validate:true});
const make=(id,value)=>Object.freeze({id,...value,capabilities:Object.freeze({...shared,...value.capabilities})});
export const PLATFORM_ADAPTERS=Object.freeze({
 'gba-rom-frlg':make('gba-rom-frlg',{label:'Game Boy Advance · FireRed/LeafGreen ROM',platform:'gba',generation:3,delivery:'rom',family:'frlg',capabilities:{build:true,sourceExport:false,uiTemplates:false}}),
 'gba-rom-rse':make('gba-rom-rse',{label:'Game Boy Advance · Ruby/Sapphire/Emerald ROM',platform:'gba',generation:3,delivery:'rom',family:'rse',capabilities:{build:true,sourceExport:false,uiTemplates:false}}),
 'gba-source-pokefirered':make('gba-source-pokefirered',{label:'Game Boy Advance · pokefirered source',platform:'gba',generation:3,delivery:'source',family:'pokefirered',capabilities:{build:true,sourceExport:true}}),
 'gba-source-pokeemerald':make('gba-source-pokeemerald',{label:'Game Boy Advance · pokeemerald source',platform:'gba',generation:3,delivery:'source',family:'pokeemerald',capabilities:{build:true,sourceExport:true}}),
 'gba-source-cfru':make('gba-source-cfru',{label:'Game Boy Advance · Complete FireRed Upgrade source',platform:'gba',generation:3,delivery:'source',family:'cfru',capabilities:{build:true,sourceExport:true}}),
 'gba-source-shiny':make('gba-source-shiny',{label:'Game Boy Advance · Shiny CFRU source',platform:'gba',generation:3,delivery:'source',family:'shiny',capabilities:{build:true,sourceExport:true}}),
});
export const sourceAdapterId=engine=>'gba-source-'+engine;
export const romAdapterId=engine=>engine==='frlg'?'gba-rom-frlg':engine==='rse'?'gba-rom-rse':null;
export function getPlatformAdapter(id){const adapter=PLATFORM_ADAPTERS[id];if(!adapter)throw Error('Unsupported platform adapter: '+id);return adapter;}
export function adapterForSourceEngine(engine){return getPlatformAdapter(sourceAdapterId(engine));}
export function adapterForRomEngine(engine){const id=romAdapterId(engine);return id?getPlatformAdapter(id):null;}
export function supportsCapability(adapter,capability){return!!adapter?.capabilities?.[capability];}
export function requireCapability(adapter,capability){if(!supportsCapability(adapter,capability))throw Error((adapter?.label||'This project')+' does not support '+capability+'.');return adapter;}
export function projectAdapters(project){const adapters=[];if(project?.sourceEngine?.engine)adapters.push(adapterForSourceEngine(project.sourceEngine.engine));for(const engine of new Set((project?.maps||[]).map(map=>map?.rom?.engine).filter(Boolean))){const adapter=adapterForRomEngine(engine);if(adapter)adapters.push(adapter);}return adapters;}