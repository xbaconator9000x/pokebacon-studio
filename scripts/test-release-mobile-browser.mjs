// Runs the actual editor modules/CSS with synthetic, non-game fixtures.
// Instrumentation exists only in the HTTP test response, never in the APK.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const runtime=process.env.MAP_STUDIO_QA_RUNTIME;
if(!runtime)throw Error('Set MAP_STUDIO_QA_RUNTIME to the installed QA dependencies.');
const require=createRequire(path.resolve(runtime,'package.json')),{chromium}=require('playwright');
const root=path.resolve('dist'),screens=path.resolve(process.env.MAP_STUDIO_SCREENSHOTS||'/tmp/pokebacon-release-screens');fs.mkdirSync(screens,{recursive:true});
const hook='\nglobalThis.__releaseQA={project:()=>project,sprites:()=>spriteTools,events:()=>eventsUI,story:()=>storyTools,presentation:()=>presentationTools,workspaceMenu,openWorkspace,persist,change,attachROM(reader,id){romSession={reader,id};}};';
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost'),name=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
 if(name==='__fixture.mjs'){res.setHeader('Content-Type','text/javascript');res.end(fs.readFileSync('scripts/synthetic-map-rom.mjs'));return;}
 const file=path.resolve(root,name);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 const mime=({'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.wasm':'application/wasm'})[path.extname(file)]||'application/octet-stream';
 if(mime==='application/octet-stream'&&req.headers['sec-fetch-dest']==='script')console.log('Unknown script MIME:',name);
 res.setHeader('Content-Type',mime);
 const bytes=fs.readFileSync(file);res.end(name==='app.js'?bytes.toString()+hook:bytes);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
// The local serverless Chromium needs a single process and bundled SwiftShader.
// Desktop/CI Chrome must use its normal process/GPU configuration instead.
const localBrowser=!process.env.MAP_STUDIO_CHROMIUM;
const browser=await chromium.launch({executablePath:process.env.MAP_STUDIO_CHROMIUM||'/tmp/chromium',headless:true,args:localBrowser?['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--single-process']:['--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:412,height:915},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'}),page=await context.newPage(),errors=[],pending=new Set();
page.on('request',r=>pending.add(r.url()));page.on('requestfinished',r=>pending.delete(r.url()));page.on('requestfailed',r=>{pending.delete(r.url());errors.push(r.url()+': '+r.failure()?.errorText);});
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(r.request().resourceType()==='script'&&!/javascript|json/.test(r.headers()['content-type']||''))console.log('Script response:',r.url(),r.headers()['content-type']);});
try{
 await page.goto('http://127.0.0.1:'+server.address().port);try{await page.waitForFunction(()=>globalThis.__releaseQA&&document.querySelector('#loading')?.hidden,{},{timeout:15000});}catch(error){throw Error('Editor did not open: '+errors.join('; ')+' / pending '+JSON.stringify([...pending])+' / '+await page.evaluate(()=>JSON.stringify({project:globalThis.__releaseQA?.project()?.name,images:[...document.images].map(i=>({src:i.src,complete:i.complete}))}))+' / '+await page.locator('body').innerText());}
 await page.evaluate(async()=>{
  document.querySelector('#dialog').close();const qa=globalThis.__releaseQA,{makeSpriteGroup}=await import('/sprite-workbench.js'),g=makeSpriteGroup('Player outfit test');
  // Simple original pixel figure; no ROM or bundled character artwork.
  const pixels=g.views.front.frames[0];for(let y=12;y<48;y++)for(let x=23;x<41;x++)if(y<26||x<30||x>33)pixels[y*64+x]=y<26?5:3;
  qa.change(()=>{qa.project().spriteStudio={version:1,groups:[g],palettes:[],drafts:{}};});await qa.sprites().open({kind:'custom',id:g.id,side:'front'});
 });
 await page.locator('.sprite-mobile-shell').waitFor({state:'visible'});
 for(const [width,height] of [[360,800],[412,915],[640,360]]){
  await page.setViewportSize({width,height});
  const bounds=await page.evaluate(()=>{const stage=document.querySelector('.sprite-mobile-stage').getBoundingClientRect(),rail=document.querySelector('.sprite-mobile-rail').getBoundingClientRect(),save=document.querySelector('#spriteMobileSave').getBoundingClientRect();return{stageHeight:stage.height,stageBottom:stage.bottom,railTop:rail.top,railRight:rail.right,saveBottom:save.bottom,windowHeight:innerHeight,windowWidth:innerWidth};});
  assert.ok(bounds.stageHeight>=85,JSON.stringify(bounds));assert.ok(bounds.stageBottom<=bounds.railTop+1);assert.ok(bounds.railRight<=width+1);assert.ok(bounds.saveBottom<=height);
  for(const tool of ['pencil','erase','fill','pick','pan','select'])await page.locator('.sprite-mobile-rail [data-sprite-tool="'+tool+'"]').click();
 }
 await page.setViewportSize({width:412,height:915});await page.locator('[data-sprite-tool="pencil"]').click();
 const before=await page.evaluate(()=>[...__releaseQA.sprites().state.pixels]);const canvas=await page.locator('#spriteCanvas').boundingBox();
 await page.touchscreen.tap(canvas.x+canvas.width*.2,canvas.y+canvas.height*.2);await page.locator('#spriteMobileSave').click();
 const painted=await page.evaluate(()=>[...__releaseQA.sprites().state.pixels]);assert.notDeepEqual(painted,before);
 await page.locator('#spriteUndo').click();assert.deepEqual(await page.evaluate(()=>[...__releaseQA.sprites().state.pixels]),before);await page.locator('#spriteRedo').click();
 await page.screenshot({path:path.join(screens,'sprite-workspace-412.png')});
 for(const [label,pane] of [['Colours','palette'],['Frames','frames'],['Layers','layers'],['Trace','reference'],['File','file'],['Tools','tools']]){
  await page.locator('.sprite-mobile-rail').getByRole('button',{name:label,exact:true}).click();await page.locator('#sprite-mobile-'+pane).waitFor({state:'visible'});
  if(pane==='tools')assert.equal(await page.locator('#spriteCopy').isVisible(),true);
  if(pane==='reference')assert.equal(await page.locator('#spriteComparisonPin').isVisible(),true);
  if(pane==='palette'){
   const palette=await page.locator('#spritePalette').boundingBox();for(const swatch of await page.locator('#spritePalette button').all()){const rect=await swatch.boundingBox();assert.ok(rect.x>=palette.x-1&&rect.x+rect.width<=palette.x+palette.width+1,'All sixteen swatches fit the phone pane');}
   await page.screenshot({path:path.join(screens,'sprite-colours-412.png')});
  }
  await page.locator('.sprite-mobile-sheet-close').click();
 }
 await page.evaluate(async()=>{await __releaseQA.persist();});await page.reload();await page.waitForFunction(()=>__releaseQA&&document.querySelector('#loading')?.hidden);
 assert.deepEqual(await page.evaluate(()=>__releaseQA.project().spriteStudio.groups[0].views.front.frames[0]),painted);
 await page.evaluate(async()=>{
  document.querySelector('#dialog').close();const qa=__releaseQA,{syntheticROM}=await import('/__fixture.mjs'),{compileScript}=await import('/script-engine.js'),{GbaMaps}=await import('/rom.js'),{indexNativeStory}=await import('/native-story.js');
  const bytes=syntheticROM(),compiled=compileScript('@start:\ncheckflag 0x200\nmessage @text\nend\n@text:\n= Ren: Find the Aipom key.$\n',0x5000,'frlg');bytes.set(compiled.bytes,0x5000);new DataView(bytes.buffer).setUint32(0x3060,0x08005000,true);
  const reader=await new GbaMaps(bytes).discover(),graph=await indexNativeStory(reader,{mapKeys:['0.0']});qa.attachROM(reader,'synthetic-event');qa.change(()=>{qa.project().nativeStory={'synthetic-event':graph};});qa.story().open();
 });
 await page.locator('#nativeStoryFind').click();await page.locator('#storyEventQuery').fill('Aipom');
 assert.match(await page.locator('#storyEventResults').innerText(),/Ren/);await page.screenshot({path:path.join(screens,'event-finder-412.png')});
 await page.locator('[data-story-event-result]').first().click();await page.locator('#nativeStoryFind').waitFor({state:'visible'});
 await page.locator('#nativeStoryArrange').click();await page.locator('#flowConditionQuick').click();
 await page.locator('#flowConditionName').fill('Has the gate key');await page.locator('#flowConditionNameSave').click();
 await page.locator('#flowConditionTrueText').fill('The gate is open.');await page.locator('#flowConditionFalseText').fill('Find the key first.');
 await page.locator('#flowConditionPanel > summary').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(screens,'guided-condition-412.png')});
 const footer=await page.locator('#dialogFooter').boundingBox();assert.ok(footer.y>=0&&footer.y+footer.height<=915,'Flow save controls stay inside the phone viewport');
 await page.locator('#flowConditionInsert').click();assert.equal(await page.locator('#flowError').innerText(),'');
 assert.match(await page.locator('#flowList').innerText(),/The gate is open/);assert.match(await page.locator('#flowList').innerText(),/Find the key first/);
 await page.locator('#submitDialog').click();
 const event=await page.evaluate(async()=>{await __releaseQA.persist();const g=__releaseQA.project().nativeStory['synthetic-event'];return{symbols:g.symbols,flowCount:Object.keys(g.edits.flows).length};});
 assert.equal(event.symbols.flags[512],'Has the gate key');assert.equal(event.flowCount,1);
 await page.reload();await page.waitForFunction(()=>globalThis.__releaseQA&&document.querySelector('#loading')?.hidden);
 assert.equal(await page.evaluate(()=>__releaseQA.project().nativeStory['synthetic-event'].symbols.flags[512]),'Has the gate key');
 assert.equal(await page.evaluate(()=>Object.keys(__releaseQA.project().nativeStory['synthetic-event'].edits.flows).length),1);
 // Shared-script safety on a real 412px browser: where-used list, confirmation
 // gate on shared edits, no gate for an event with its own script, and the
 // "Edit only this event" route into the flow editor.
 await page.evaluate(async()=>{
  document.querySelector('#dialog')?.close();
  const qa=__releaseQA,{syntheticROM}=await import('/__fixture.mjs'),{compileScript}=await import('/script-engine.js'),{GbaMaps}=await import('/rom.js'),{indexNativeStory}=await import('/native-story.js');
  const bytes=syntheticROM(),dv=new DataView(bytes.buffer);
  bytes[0x3000]=3;dv.setUint32(0x3004,0x08003200,true);
  for(let i=0;i<3;i++){bytes[0x3200+i*24]=i+1;dv.setUint32(0x3210+i*24,i<2?0x08005000:0x08005100,true);}
  bytes.set(compileScript('@start:\nmessage @text\nend\n@text:\n= Shared dialogue.$\n',0x5000,'frlg').bytes,0x5000);
  bytes.set(compileScript('@start:\nmessage @text\nend\n@text:\n= Private dialogue.$\n',0x5100,'frlg').bytes,0x5100);
  const reader=await new GbaMaps(bytes).discover(),graph=await indexNativeStory(reader,{mapKeys:['0.0']});
  qa.attachROM(reader,'shared-event');qa.change(()=>{qa.project().nativeStory={...qa.project().nativeStory,'shared-event':graph};});qa.story().open();
 });

 const sharedPick=async(query)=>{await page.locator('#nativeStoryFind').click();await page.locator('#storyEventQuery').fill(query);await page.locator('[data-story-event-result]').first().click();await page.locator('#nativeStoryFind').waitFor({state:'visible'});await page.selectOption('#nativeStoryView','steps');};
 const sharedOpenCommand=async()=>{const closed=page.locator('details:has([data-native-command]):not([open]) > summary');if(await closed.count())await closed.first().click();await page.locator('[data-native-command]:visible').first().click();};
 const sharedEdits=()=>page.evaluate(()=>{const n=__releaseQA.project().nativeStory['shared-event'];return{commands:Object.keys(n.edits.commands).length,texts:Object.keys(n.edits.texts).length,flows:Object.keys(n.edits.flows||{}).length};});
 // 1. A shared command: the dialog itemises every entry and asks for confirmation.
 await sharedPick('Shared');
 await sharedOpenCommand();await page.locator('#nativeSharedOk').waitFor({state:'visible'});
 assert.match(await page.locator('.native-shared-note').innerText(),/also affects 1 other event in 1 map/);
 assert.match(await page.locator('.native-where-used > summary').innerText(),/Where this is used \(2\)/);
 await page.locator('.native-where-used > summary').click();
 const sharedListed=await page.locator('.native-where-used li').allInnerTexts();
 assert.equal(sharedListed.length,2);assert.ok(sharedListed.some(t=>/\(this event\)/.test(t)),'current event is marked');assert.ok(sharedListed.every(t=>/PALLET TOWN/.test(t)));
 await page.locator('#nativeSharedOk').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(screens,'shared-command-412.png')});
 const sharedBox=await page.locator('#nativeSharedOk').boundingBox();assert.ok(sharedBox.width>=24&&sharedBox.height>=24,'confirm tick is a phone-sized target');
 assert.ok(await page.locator('#nativeEditOnlyThis').isVisible());
 const sharedFooter=await page.locator('#dialogFooter').boundingBox();assert.ok(sharedFooter.y>=0&&sharedFooter.y+sharedFooter.height<=915,'save controls stay inside the viewport');
 // Saving without confirming is refused and changes nothing.
 await page.locator('#submitDialog').click();await page.locator('#dialogError').waitFor({state:'visible'});
 assert.match(await page.locator('#dialogError').innerText(),/also changes 1 other event\. Tick the box/);
 assert.ok(await page.locator('#nativeSharedOk').isVisible(),'dialog stays open');assert.deepEqual(await sharedEdits(),{commands:0,texts:0,flows:0});
 // Confirmed saves go through.
 await page.locator('#nativeSharedOk').check();await page.locator('#submitDialog').click();await page.locator('#nativeSharedOk').waitFor({state:'hidden'});
 // 2. Shared dialogue is gated the same way.
 await page.locator('[data-native-text]:visible').first().click();await page.locator('#nativeText0').waitFor({state:'visible'});
 await page.locator('#nativeText0').fill('Changed for everyone.');
 await page.locator('#submitDialog').click();await page.locator('#dialogError').waitFor({state:'visible'});assert.deepEqual(await sharedEdits(),{commands:0,texts:0,flows:0});
 await page.locator('#nativeSharedOk').check();await page.locator('#submitDialog').click();await page.locator('#nativeText0').waitFor({state:'hidden'});
 assert.equal((await sharedEdits()).texts,1);
 await page.evaluate(()=>{const n=__releaseQA.project().nativeStory['shared-event'];__releaseQA.change(()=>{n.edits.texts={};});});
 // 3. An event with its own script is not gated.
 await sharedPick('Private');
 await sharedOpenCommand();await page.locator('.native-shared-note').waitFor({state:'visible'});
 assert.match(await page.locator('.native-shared-note').innerText(),/No other event uses this/);
 assert.equal(await page.locator('#nativeSharedOk').count(),0);assert.equal(await page.locator('#nativeEditOnlyThis').count(),0);
 await page.screenshot({path:path.join(screens,'private-command-412.png')});
 await page.locator('#cancelDialog').click();
 // 4. "Edit only this event" opens the flow editor and saves nothing by itself.
 await sharedPick('Shared');
 await sharedOpenCommand();await page.locator('#nativeEditOnlyThis').waitFor({state:'visible'});
 await page.locator('#nativeEditOnlyThis').click();await page.locator('#flowList').waitFor({state:'visible'});
 await page.screenshot({path:path.join(screens,'edit-only-this-event-412.png')});
 assert.deepEqual(await sharedEdits(),{commands:0,texts:0,flows:0});
 // Actual 412px mobile-browser flow: original ROM byte -> typed table -> HMA
 // anchor import -> split IndexedDB project save and re-open.
 await page.evaluate(async()=>{
  document.querySelector('#dialog')?.close();
  const {syntheticROM}=await import('/__fixture.mjs'),{GbaMaps}=await import('/rom.js');
  const rom=syntheticROM();new DataView(rom.buffer).setUint32(0x550,0x08000680,true);
  const reader=await new GbaMaps(rom).discover();
  __releaseQA.attachROM(reader,'hma-fixture');
  await __releaseQA.openWorkspace('source');
 });
 await page.locator('#sourceHexWorkspace').click();
 await page.locator('#hmaGoto').fill('0xA0');await page.locator('#hmaGo').click();
 assert.equal(await page.locator('#hmaEditAt').inputValue(),'0xA0');
 await page.locator('#hmaEditHex').fill('5A');
 await page.locator('#hmaStage').click();
 assert.equal(await page.evaluate(()=>__releaseQA.project().hexStudio.sources['hma-fixture'].patches.find(p=>p.at===0xa0)?.after),90);
 await page.locator('[data-hex-tab="tables"]').click();
 await page.locator('#hmaCreateTable').click();
 await page.locator('#hmaLayoutName').fill('Imported original table');
 await page.locator('#hmaLayoutAt').fill('0x680');
 await page.locator('#hmaLayoutStride').fill('4');
 await page.locator('#hmaLayoutCount').fill('3');
 await page.locator('#submitDialog').click();
 await page.locator('[data-table-row="0"]').click();
 await page.locator('#hmaCellValue').fill('25');
 await page.locator('#submitDialog').click();
 assert.equal(await page.evaluate(()=>__releaseQA.project().hexStudio.sources['hma-fixture'].tables[0].count),3);
 await page.locator('[data-hex-tab="metadata"]').click();
 const metadataText=["[[NamedAnchors]]","Name = '''test.original.records'''","Address = 0x000680","Format = '''[value::]3'''","[[Unknown]]","Future = '''preserve me'''"].join('\n')+'\n';
 await page.locator('#hmaTomlInput').setInputFiles({name:'user-hma.toml',mimeType:'text/plain',buffer:Buffer.from(metadataText)});
 await page.waitForFunction(()=>document.querySelectorAll('[data-hma-anchor]').length===1);
 assert.match(await page.locator('#hmaHexBody').innerText(),/test.original.records/);
 await page.locator('[data-hma-refs]').first().click();
 assert.match(await page.locator('#hmaPointerReport').innerText(),/0x550/i);
 await page.locator('#hmaPointerSite').fill('0x550');
 await page.locator('#hmaInspectPtr').click();
 await page.locator('#hmaJumpPtr').click();
 assert.equal(await page.locator('#hmaEditAt').inputValue(),'0x680');
 await page.locator('[data-hex-tab="metadata"]').click();
 await page.locator('[data-hma-auto]').first().click();
 assert.match(await page.locator('#hmaHexBody').innerText(),/test.original.records/);
 await page.locator('#hmaRepointTable').click();
 assert.match(await page.locator('#dialog').innerText(),/0x550/i);
 await page.locator('#submitDialog').click();
 assert.equal(await page.evaluate(()=>__releaseQA.project().hexStudio.sources['hma-fixture'].repoints?.[0]?.sites[0]),0x550);
 await page.locator('[data-hex-tab="metadata"]').click();
 await page.locator('[data-hma-anchor]').first().click();
 assert.equal(await page.locator('#hmaEditAt').inputValue(),'0x680');
 await page.locator('#hmaGo').click();
 await page.locator('#hmaGoto').fill('0x550');
 await page.locator('#hmaGo').click();
 await page.locator('#hmaBack').click();
 assert.equal(await page.locator('#hmaEditAt').inputValue(),'0x680');
 await page.locator('#hmaForward').click();
 assert.equal(await page.locator('#hmaEditAt').inputValue(),'0x550');
 await page.locator('[data-hex-tab="changes"]').click();
 assert.match(await page.locator('#hmaHexBody').innerText(),/staged bytes/);
 await page.screenshot({path:path.join(screens,'hma-hex-tables-412.png')});
 await page.evaluate(async()=>{await __releaseQA.persist();});
 await page.reload();await page.waitForFunction(()=>__releaseQA&&document.querySelector('#loading')?.hidden);
 const restored=await page.evaluate(()=>{
  const state=__releaseQA.project().hexStudio?.sources?.['hma-fixture'];
  return {writes:state?.patches?.length,hex:state?.patches?.find(p=>p.at===0xa0)?.after,value:state?.patches?.find(p=>p.at===0x680)?.after,table:state?.tables?.[0]?.name,toml:state?.hmaToml,repoint:state?.repoints?.[0]?.sites[0],autoTable:state?.tables?.length};
 });
 assert.equal(restored.hex,90);assert.equal(restored.value,25);
 assert.equal(restored.table,'Imported original table');
 assert.equal(restored.toml,metadataText);
 assert.equal(restored.repoint,0x550);
 assert.equal(restored.autoTable,2);

 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS mobile sprite tools, IndexedDB reload, event search, named-state branch creation, saved structure after reload and shared-script confirmation. Screenshots: '+screens);
}finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
