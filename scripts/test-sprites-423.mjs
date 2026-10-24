import {session,fs,assert,newProject} from './qa-harness.mjs';
import {readNativeSprite,discoverNativeSprites} from '../dist/native-sprites.js';
const root=process.env.ROM_SAMPLE_ROOT||'../upload';
for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.gba'))){const s=await session({},true),{$,qa,input,pointer}=s,source=fs.readFileSync(root+'/'+file);await qa.switchProject(newProject('Sprite edit'));await qa.readROM(source,'sprite423');const spr=qa.state.spriteTools;
 await spr.open();assert.ok($('#spriteCanvas'),'native canvas: '+file);assert.equal(spr.state.choice.kind,'mon');const c=spr.state.context,before=readNativeSprite(source,c.sprites,{kind:'mon',id:1,side:'front'});assert.deepEqual(Array.from(spr.state.pixels),Array.from(before.frames[0]));
 // Paint through the actual touch-capable canvas then compile, never mutating source.
 spr.state.color=(before.frames[0][1300]+1)%16;spr.draw();const z=spr.state.zoom,canvas=$('#spriteCanvas');pointer('pointerdown',20.5*z,20.5*z,canvas);pointer('pointerup',20.5*z,20.5*z,canvas);assert.equal(spr.state.pixels[1300],spr.state.color);spr.save();
 const result=await qa.compileROM(),read=readNativeSprite(result.bytes,c.sprites,{kind:'mon',id:1,side:'front'});assert.equal(read.frames[0][1300],spr.state.color);assert.equal(Buffer.compare(source,Buffer.from(c.reader.bytes)),0);
 const copy=await spr.cloneGroup();assert.equal(spr.state.choice.kind,'custom');assert.ok($('#spriteBrowseROM'));$('#spriteBrowseROM').click();assert.equal(spr.state.choice.kind,'mon');spr.newGroupDialog();assert.ok($('#newSpriteBrowseROM'));$('#newSpriteBrowseROM').click();assert.equal(spr.state.choice.kind,'mon');
 // Actual edited ROM reopens with a new digest, retaining verified graphics tables.
 const profile=await discoverNativeSprites(result.bytes,{engine:c.reader.engine});assert.ok(profile,'edited image discovery: '+file);assert.equal(readNativeSprite(result.bytes,profile,{kind:'mon',id:1,side:'front'}).frames[0][1300],spr.state.color);await s.close();console.log('PASS template, paint, ROM export, custom copy and edited-ROM rediscovery:',file);
}
const s=await session({},true);await s.qa.state.spriteTools.open();assert.ok(s.$('#newSpriteOpenROM'),'template upload reachable without loaded ROM');await s.close();
