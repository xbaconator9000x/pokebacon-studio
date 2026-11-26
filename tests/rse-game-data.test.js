import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverRseGameData} from '../dist/rse-game-data.js';
import {readGameData,applyGameDataEdits,discoverGameData} from '../dist/game-data.js';
import {RomOutput} from '../dist/rom-writer.js';

const enc=s=>[...s].map(c=>c===' '?0:c>='A'&&c<='Z'?0xbb+c.charCodeAt(0)-65:c>='a'&&c<='z'?0xd5+c.charCodeAt(0)-97:c==='-'?0xae:0xac);
function rom(){
 const b=new Uint8Array(0x300000),names=0x100000,N=320,M=300;
 for(let i=0;i<N;i++){const s=i===0?'??????????':'Mon'+String.fromCharCode(97+i%26)+String.fromCharCode(97+(i>>5));b.set([...enc(s),0xff],names+i*11);}
 const mn=names+N*11;
 for(let i=0;i<M;i++){const s=i===0?'-':i===1?'Pound':'Move'+String.fromCharCode(97+i%26)+String.fromCharCode(97+i%11);b.set([...enc(s),0xff],mn+i*13);}
 const stats=0x180000;
 for(let i=1;i<N;i++)b.set([40+i%50,50,60,45,55,65,12+(i%3),12,190,127,20,70,3,0x55,0x65,0],stats+i*24);
 const mv=0x1c0000;
 b.set([1],mv);
 for(let i=1;i<M;i++)b.set([0,i===1?40:i===2?50:30+i%40,i===2?1:0,i<=2?100:90,i===1?35:i===2?25:20,0,0,0],mv+i*16);
 const it=0x200000;
 for(let i=0;i<60;i++){const s=i===0?'~':i===1?'Master Ball':i===2?'Ultra Ball':'Item'+String.fromCharCode(97+i%26)+String.fromCharCode(97+(i>>3));b.set([...(i===0?[0x01]:enc(s)),0xff],it+i*32);b[it+i*32+30]=i;}
 return b;
}
test('Emerald-style hack tables are found by structure and edited in place',async()=>{
 const b=rom(),p=await discoverGameData({bytes:b,maps:[],byKey:()=>null},{sourceSha256:'a'.repeat(64)});
 assert.ok(p.rse);assert.equal(p.speciesCount,320);assert.equal(p.moveCount,300);
 assert.equal(p.capabilities.items,true);assert.equal(p.itemCount,60);assert.equal(p.capabilities.trainers,false);
 const data=readGameData(b,p);
 assert.equal(data.species[1].stats[0],41);assert.equal(data.species[1].catchRate,190);assert.equal(data.moves[1].power,40);
 const out=new RomOutput(b);
 applyGameDataEdits(b,p,{items:{5:{price:777,name:'Super Thing'}},species:{1:{name:'Newname',stats:[90,50,60,45,55,65],types:[1,2],catchRate:30,friendship:50,eggCycles:15}},moves:{1:{power:60,name:'Big Pound'}}},out);
 const back=readGameData(out.bytes,p);
 assert.deepEqual([back.species[1].name,back.species[1].stats[0],back.species[1].types,back.species[1].catchRate,back.species[1].friendship,back.species[1].eggCycles],['Newname',90,[1,2],30,50,15]);
 assert.deepEqual([back.items[5].price,back.items[5].name],[777,'Super Thing']);
 assert.deepEqual([back.moves[1].power,back.moves[1].name],[60,'Big Pound']);
 assert.equal(out.bytes.slice(p.baseStats+1*24+12,p.baseStats+1*24+16).join(),b.slice(p.baseStats+24+12,p.baseStats+24+16).join(),'unconfirmed fields are untouched');
});
test('fields with unconfirmed layout refuse changes instead of dropping them',async()=>{
 const b=rom(),p=await discoverGameData({bytes:b,maps:[],byKey:()=>null},{sourceSha256:'a'.repeat(64)});
 assert.throws(()=>applyGameDataEdits(b,p,{species:{1:{baseExp:99}}},new RomOutput(b)),/not editable yet/);
 assert.throws(()=>applyGameDataEdits(b,p,{items:{5:{holdEffect:9}}},new RomOutput(b)),/not editable yet/);
 assert.equal(discoverRseGameData(new Uint8Array(0x300000),'x'),null);
});
