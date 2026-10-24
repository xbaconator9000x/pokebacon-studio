import{upgradeFormat,formatFingerprint}from'./format-upgrade.js';
import {validateSourceSettings} from './source-project.js';
import {assertAssemblyEdit,validateAssemblies} from './native-assemblies.js';
import {validateTilesetAnimations} from './tileset-animation.js';
import {validateTravelEdits} from './travel-editor.js';
import {validateHMRules} from './hm-rules.js';
import {validateCryEdits} from './cry-editor.js';
import {validateDoorAnimations} from './door-animation.js';
import {validateRegionEdits} from './region-map.js';
import{validateSeams}from'./map-seams.js';
import{validateCreature,creatureDefaults}from'./creature-model.js';
import {validateAuthoring} from './authoring-model.js';
import {validateStory} from './story-model.js';
import {withNativeRule} from './movement-defaults.js';
import{validateSpriteStudio}from'./sprite-workbench.js';
import{validateQuests}from'./quest-model.js';
import{validateGameEdits}from'./game-edits.js';
import{removeFieldObject}from'./field-model.js';
import{validateBuilder}from'./builder-model.js';
import {cropMap} from './crop-model.js';
import {interiorAssets,validateInterior} from './interior-model.js';
import {validateSmart} from './smart-model.js';
import {validateWorld} from './world-model.js';
export const FORMAT = 'pokebacon-map-studio';
export const VERSION = 1;
export const TILE = 16;
export const LAYERS = ['ground', 'details', 'objects', 'overhead'];
export const LIMIT = 256;
export const uid = () => globalThis.crypto?.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const clone = value => JSON.parse(JSON.stringify(value));
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export function newMap(name = 'Untitled map', width = 32, height = 24) {
  width = clamp(Math.round(width), 1, LIMIT); height = clamp(Math.round(height), 1, LIMIT);
  return {id: uid(), name, width, height, background: '#aacb85', layers: Object.fromEntries(LAYERS.map(k => [k, Array(width * height).fill(null)])), objects: [], markers: [], reference: null, notes: '', world: {x: 0, y: 0}};
}
export function newProject(name = 'My map project') {
  const m = newMap('Map 1');
  return {format: FORMAT, version: VERSION, id: uid(), name, tileSize: TILE, activeMapId: m.id, maps: [m], assets: [], links: [], updatedAt: new Date().toISOString()};
}
export function inBounds(m, x, y) { return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < m.width && y < m.height; }
export function setTile(m, layer, x, y, tile) {
 if(!LAYERS.includes(layer)||!inBounds(m,x,y))return;const i=y*m.width+x;assertAssemblyEdit(m,x,y);
 m.layers[layer][i]=tile?withNativeRule(m,{...tile}):null;
 if(layer==='ground'&&tile&&tile.a===m.rom?.atlasId&&m.rom?.layerAtlasIds)for(const upper of ['details','overhead'])if(m.rom.layerAtlasIds.includes(m.layers[upper][i]?.a))m.layers[upper][i]=null;
}
export function getTile(m, layer, x, y) { return inBounds(m, x, y) ? m.layers[layer]?.[y * m.width + x] ?? null : null; }
export function paint(m, layer, x, y, brush, erase = false) {
  const bw = erase ? 1 : brush.cols, bh = erase ? 1 : brush.rows;
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) setTile(m, layer, x + bx, y + by, erase ? null : {a: brush.assetId, sx: brush.sx + bx * brush.tileSize, sy: brush.sy + by * brush.tileSize, size: brush.tileSize,...(brush.movementMode?{movementMode:brush.movementMode}:{}),...(brush.movementBehavior!==undefined?{movementBehavior:brush.movementBehavior}:{})});
}
export function line(x0, y0, x1, y1, visit) {
  if(![x0,y0,x1,y1].every(Number.isSafeInteger)||Math.max(Math.abs(x1-x0),Math.abs(y1-y0))>65536)throw Error('The drawing coordinates are invalid. Start a new stroke.');
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
  for (;;) { visit(x0, y0); if (x0 === x1 && y0 === y1) break; const e = 2 * err; if (e >= dy) {err += dy; x0 += sx;} if (e <= dx) {err += dx; y0 += sy;} }
}
export function rectangle(m, layer, a, b, brush, erase = false) {
  const left = Math.max(0, Math.min(a.x, b.x)), top = Math.max(0, Math.min(a.y, b.y)), right = Math.min(m.width - 1, Math.max(a.x, b.x)), bottom = Math.min(m.height - 1, Math.max(a.y, b.y));
  for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) setTile(m, layer, x, y, erase ? null : {a: brush.assetId, sx: brush.sx + ((x - left) % brush.cols) * brush.tileSize, sy: brush.sy + ((y - top) % brush.rows) * brush.tileSize, size: brush.tileSize,...(brush.movementMode?{movementMode:brush.movementMode}:{}),...(brush.movementBehavior!==undefined?{movementBehavior:brush.movementBehavior}:{})});
}
const sameTile = (a, b) => a === b || (!!a && !!b && a.a === b.a && a.sx === b.sx && a.sy === b.sy && a.size === b.size);
export function flood(m, layer, x, y, brush) {
  if (!inBounds(m, x, y) || !LAYERS.includes(layer)) return;
  const start = getTile(m, layer, x, y), next = {a: brush.assetId, sx: brush.sx, sy: brush.sy, size: brush.tileSize,...(brush.movementMode?{movementMode:brush.movementMode}:{}),...(brush.movementBehavior!==undefined?{movementBehavior:brush.movementBehavior}:{})};
  if (sameTile(start, next)) return;
  const todo = [y * m.width + x], seen = new Uint8Array(m.width * m.height);
  while (todo.length) {
    const i = todo.pop(); if (seen[i]) continue; seen[i] = 1;
    if (!sameTile(m.layers[layer][i], start)) continue;
    setTile(m,layer,i%m.width,Math.floor(i/m.width),next); const cx = i % m.width, cy = Math.floor(i / m.width);
    if (cx > 0) todo.push(i - 1); if (cx < m.width - 1) todo.push(i + 1); if (cy > 0) todo.push(i - m.width); if (cy < m.height - 1) todo.push(i + m.width);
  }
}
export function resizeMap(project, mapId, width, height) {
  return cropMap(project,mapId,{x:0,y:0,width:clamp(Math.round(width),1,LIMIT),height:clamp(Math.round(height),1,LIMIT)});
}
export function removeMap(project, mapId) {
  if (project.maps.length < 2) throw new Error('Keep at least one map.');
  project.maps = project.maps.filter(m => m.id !== mapId);
  project.links = project.links.filter(l => l.from.mapId !== mapId && l.to.mapId !== mapId);
  for(const map of project.maps)for(const o of map.objects)if(o.building?.interiorId===mapId)delete o.building.interiorId;
  if (project.activeMapId === mapId) project.activeMapId = project.maps[0].id;
}
export function addLink(project, from, to, kind = 'door', twoWay = true, label = '') {
  for (const p of [from, to]) {const m = project.maps.find(m => m.id === p.mapId); if (!m || !inBounds(m, p.x, p.y)) throw new Error('The connection must land on a tile inside its map.');}
  const link = {id: uid(), from: {...from}, to: {...to}, kind, twoWay, label}; project.links.push(link); return link;
}
export function usedAssetIds(project) {
  const ids = new Set();
  for(const t of project.romObjects||[])for(const id of t.overlay?.planeAssetIds||[])ids.add(id);
  for(const m of project.maps)for(const a of m.nativeAssemblies||[])for(const id of a.overlay?.planeAssetIds||[])ids.add(id);
  for(const t of project.romObjects||[])for(const cells of Object.values(t.layers))for(const v of cells)if(v)ids.add(v.a);
  for(const m of project.maps)for(const a of m.nativeAssemblies||[])for(const data of [a.before,a.expected])for(const cells of Object.values(data.layers))for(const v of cells)if(v)ids.add(v.a);
  for(const actor of project.authoring?.actors||[])if(actor.native?.assetId)ids.add(actor.native.assetId);
  for(const map of project.maps)for(const n of map.markers)if(n.rom?.npcAppearance?.assetId)ids.add(n.rom.npcAppearance.assetId);
  for(const scene of project.authoring?.presentation?.scenes||[])for(const step of scene.steps||[])if(step.assetId)ids.add(step.assetId);
  for(const d of Object.values(project.spriteStudio?.drafts||{}))if(d.reference)ids.add(d.reference.assetId);
  for(const terrain of project.terrainSets||[]){ids.add(terrain.assetId);if(terrain.eraseTile?.a)ids.add(terrain.eraseTile.a);for(const id of terrain.variants||[])ids.add(id);}
  for(const prefab of project.prefabs||[]){ids.add(prefab.assetId);if(prefab.sourceAssetId)ids.add(prefab.sourceAssetId);}
  for(const g of project.gateStyles||[]){ids.add(g.closedAssetId);if(g.openAssetId)ids.add(g.openAssetId);}
  for(const b of project.buildingTemplates||[]){ids.add(b.assetId);for(const key of ['extensionXAssetId','extensionYAssetId','extensionXYAssetId'])if(b[key])ids.add(b[key]);}
  for(const style of project.wallStyles||[])ids.add(style.assetId);
  for(const style of project.roomStyles||[]){ids.add(style.floor.a);ids.add(style.wall.a);}
  for(const t of project.interiorTemplates||[])for(const id of interiorAssets(t))ids.add(id);
  for (const m of project.maps) {
    for (const k of LAYERS) for (const t of m.layers[k]||[]) if (t) ids.add(t.a);
    for (const o of m.objects) ids.add(o.assetId);
    for(const o of m.fieldObjects||[])ids.add(o.assetId);
    for(const n of m.markers)if(n.npc)ids.add(n.npc.assetId);
    for(const g of m.gates||[]){ids.add(g.closedAssetId);if(g.openAssetId)ids.add(g.openAssetId);}
    if (m.reference) ids.add(m.reference.assetId);
  }
  return ids;
}
export function snapshot(project) { return JSON.stringify({name: project.name, activeMapId: project.activeMapId, maps: project.maps, links: project.links,sourceEngine:project.sourceEngine||undefined,authoring:project.authoring||undefined,terrainSets:project.terrainSets||[],prefabs:project.prefabs||[],roomStyles:project.roomStyles||[],wallStyles:project.wallStyles||[],gateStyles:project.gateStyles||[],buildingTemplates:project.buildingTemplates||[],interiorTemplates:project.interiorTemplates||[],romEdits:project.romEdits||{},textEdits:project.textEdits||{},regionMaps:project.regionMaps||{},travelEdits:project.travelEdits||{},tilesetAnimations:project.tilesetAnimations||{},doorAnimations:project.doorAnimations||{},cryEdits:project.cryEdits||{},hmRules:project.hmRules||undefined,developer:project.developer||{enabled:false},questFlags:project.questFlags||[],questToken:project.questToken||0,spriteStudio:project.spriteStudio||{version:1,groups:[],palettes:[],drafts:{}}}); }
export function restore(project, value) { const data=JSON.parse(value);if(!Object.hasOwn(data,'authoring'))delete project.authoring;if(!Object.hasOwn(data,'sourceEngine'))delete project.sourceEngine;Object.assign(project,data); }
export function validateProject(p, catalog = []) {
  const fail = message => {throw new Error(message);};
  upgradeFormat(p,FORMAT,0x199556ed);
  if(p&&formatFingerprint(p.name)===0x133eb465)p.name='PokéBacon · map workshop';
  if (!p || p.format !== FORMAT || p.version !== VERSION) fail('Choose a PokéBacon Studio v1 project (.pokebacon.json).');
  if (!Array.isArray(p.maps) || p.maps.length < 1 || p.maps.length > 80) fail('A project needs 1–80 maps.');
  if (!Array.isArray(p.assets) || p.assets.length > 512 || !Array.isArray(p.links) || p.links.length > 2000) fail('This project has too many assets or connections.');
  const ids = new Set(), assetIds = new Set(catalog.map(a => a.id)), embeddedIds = new Set();
  for (const a of p.assets) {
    if (!a || typeof a.id !== 'string' || typeof a.name !== 'string' || !Number.isInteger(a.width) || !Number.isInteger(a.height) || a.width < 1 || a.height < 1 || a.width > 8192 || a.height > 16384 || a.width * a.height > 32e6) fail('An image in this project is invalid or too large.');
    if (a.data && !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\r\n]+$/.test(a.data)) fail('Only embedded PNG, JPG, WebP and GIF images can be opened.');
    if (!a.data && !catalog.some(c => c.id === a.id && c.src === a.src)) fail('This project needs an embedded image that is missing.');
    if (embeddedIds.has(a.id)) fail('Duplicate image ID.');
    if (![8,16,24,32,48,64].includes(a.tileSize ?? 16)) fail('Unsupported source tile size.');
    assetIds.add(a.id); embeddedIds.add(a.id);
  }
  let cells = 0;
  for (const m of p.maps) {
    if (!m || typeof m.id !== 'string' || ids.has(m.id) || typeof m.name !== 'string' || !Number.isInteger(m.width) || !Number.isInteger(m.height) || m.width < 1 || m.height < 1 || m.width > LIMIT || m.height > LIMIT) fail('A map has an invalid name, size, or ID.'); ids.add(m.id);
    if(m.rom?.sourceCells&&(!Array.isArray(m.rom.sourceCells)||m.rom.sourceCells.length!==m.width*m.height||m.rom.sourceCells.some(i=>i!==null&&(!Number.isInteger(i)||i<0||i>=(m.rom.originalBlocks?.length||0)))))fail('The retained ROM tile grid is invalid.');
    if(m.rom?.cropOffset&&![m.rom.cropOffset.x,m.rom.cropOffset.y].every(Number.isInteger))fail('The ROM crop origin is invalid.');
    cells += m.width * m.height; if (cells > 400000) fail('This project is too large for the phone editor.');
    if (!m.layers || !Array.isArray(m.objects) || !Array.isArray(m.markers) || m.objects.length > 5000 || m.markers.length > 5000) fail('Map data is incomplete.');
    if(m.layers.objects===undefined)m.layers.objects=Array(m.width*m.height).fill(null);
    for (const k of LAYERS) {
      if (!Array.isArray(m.layers[k]) || m.layers[k].length !== m.width * m.height) fail('The tile grid is incomplete.');
      for (const t of m.layers[k]) if (t && (!assetIds.has(t.a) || !Number.isFinite(t.sx) || !Number.isFinite(t.sy) || !Number.isFinite(t.size) || t.size < 1 || t.size > 128)) fail('A tile references a missing image or invalid crop.');
    }
    for(const n of m.markers)if(n.creatureGift&&(!/^[a-f0-9]{64}$/.test(n.creatureGift.hash)||!p.spriteStudio?.groups?.some(g=>g.id===n.creatureGift.groupId)||!n.runtime))fail('A custom Pokémon gift is invalid.');
    for(const n of m.markers)if(n.npc&&(!assetIds.has(n.npc.assetId)||!['down','up','left','right'].includes(n.npc.facing)||!n.runtime||!n.npc.customOnly&&(typeof n.npc.sourceId!=='string'||!/^\d+\.\d+$/.test(n.npc.mapKey)||!Number.isInteger(n.npc.index)||n.npc.index<0||n.npc.index>254||!Number.isInteger(n.npc.graphics)||n.npc.graphics<16||n.npc.graphics>91)))fail('A character template is invalid.');
    for (const o of m.objects) if (!o || typeof o.id !== 'string' || !assetIds.has(o.assetId) || ![o.x,o.y,o.w,o.h,o.sx,o.sy,o.sw,o.sh].every(Number.isFinite) || o.w <= 0 || o.h <= 0 || o.w > 512 || o.h > 512 || o.sw <= 0 || o.sh <= 0 || Math.abs(o.x) > 10000 || Math.abs(o.y) > 10000) fail('An object has an invalid image, crop or size.');
    for (const n of m.markers) if (!n || typeof n.id !== 'string' || !inBounds(m, n.x, n.y) || typeof n.title !== 'string' || typeof n.text !== 'string') fail('A note has an invalid tile position or text.');
    if (m.reference && (!assetIds.has(m.reference.assetId) || ![m.reference.x,m.reference.y,m.reference.w,m.reference.h,m.reference.opacity].every(Number.isFinite) || m.reference.w <= 0 || m.reference.h <= 0)) fail('A reference image is invalid.');
    if (!m.world || !Number.isFinite(m.world.x) || !Number.isFinite(m.world.y) || Math.abs(m.world.x)>100000 || Math.abs(m.world.y)>100000) m.world = {x: (ids.size - 1) % 4 * 240, y: Math.floor((ids.size - 1) / 4) * 200};
    m.notes = typeof m.notes === 'string' ? m.notes : ''; m.background = /^#[0-9a-fA-F]{6}$/.test(m.background) ? m.background : '#aacb85';
  }
  const linkIds = new Set();
  for (const l of p.links) {
    if (!l || typeof l.id !== 'string' || linkIds.has(l.id) || typeof l.kind !== 'string' || typeof l.label !== 'string' || typeof l.twoWay !== 'boolean') fail('A connection has invalid labels or identifiers.');
    linkIds.add(l.id);
    for (const end of [l.from, l.to]) {const m = p.maps.find(m => m.id === end?.mapId); if (!m || !inBounds(m, end.x, end.y)) fail('A connection points outside a map.');}
  }
  if(!Array.isArray(p.interiorTemplates||[])||(p.interiorTemplates||[]).length>2048||(p.interiorTemplates||[]).reduce((n,t)=>n+(t.width||0)*(t.height||0),0)>400000)fail('The saved interior collection is too large.');
  for(const t of p.interiorTemplates||[])validateInterior(t,assetIds);
  p.tileSize = TILE; p.name = String(p.name || 'Imported project').slice(0,120); p.id = typeof p.id === 'string' ? p.id : uid();
  if (!ids.has(p.activeMapId)) p.activeMapId = p.maps[0].id;
  validateRegionEdits(p.regionMaps);validateTravelEdits(p.travelEdits);validateTilesetAnimations(p.tilesetAnimations);validateDoorAnimations(p.doorAnimations);validateCryEdits(p.cryEdits);validateHMRules(p);validateSpriteStudio(p,assetIds);for(const g of p.spriteStudio?.groups||[])if(g.creature)validateCreature(creatureDefaults(g));for(const e of Object.values(p.romEdits||{}))for(const f of e.forms||[])if(!p.spriteStudio?.groups?.some(g=>g.id===f.groupId))throw Error('A native form references a missing sprite group.');if(p.developer!==undefined&&(!p.developer||typeof p.developer.enabled!=='boolean'))throw Error('Invalid developer mode.');if(p.textEdits!==undefined&&(!p.textEdits||Array.isArray(p.textEdits)||JSON.stringify(p.textEdits).length>8e6||Object.keys(p.textEdits).some(h=>!(/^[a-f0-9]{64}$/).test(h))))throw Error('Invalid dialogue edits.');validateQuests(p);validateGameEdits(p);validateAssemblies(p,assetIds);validateSmart(p,assetIds);validateWorld(p,assetIds);validateSeams(p);validateBuilder(p,assetIds);
  validateSourceSettings(p.sourceEngine);validateAuthoring(p);validateStory(p);return p;
}
