import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../ios/Bridge.js',import.meta.url),'utf8');
function bridge(handler){
 const window={webkit:{messageHandlers:{studioExport:{postMessage:handler}}}};
 class Reader{readAsDataURL(blob){blob.arrayBuffer().then(data=>{this.result='data:application/octet-stream;base64,'+Buffer.from(data).toString('base64');this.onload();},error=>{this.error=error;this.onerror();});}}
 vm.runInNewContext(source,{window,FileReader:Reader,Error});return window.NativeBridge;
}
test('iOS exports preserve every byte while bounding bridge messages',async()=>{
 const bytes=Uint8Array.from({length:1300000},(_,i)=>i%251),messages=[];
 const native=bridge(async message=>messages.push(message));
 await native.exportBlob(new Blob([bytes]),'test.gba');
 assert.equal(messages[0].action,'begin');assert.equal(messages[0].size,bytes.length);assert.equal(messages.at(-1).action,'finish');
 const chunks=messages.filter(x=>x.action==='chunk');assert.equal(chunks.length,3);
 assert.ok(chunks.every(x=>x.data.length<=699052));
 assert.deepEqual(Buffer.concat(chunks.map(x=>Buffer.from(x.data,'base64'))),Buffer.from(bytes));
});
test('iOS export failures abort temporary output and allow retry',async()=>{
 const messages=[];let fail=true;
 const native=bridge(async message=>{messages.push(message);if(message.action==='chunk'&&fail)throw Error('Disk full');});
 await assert.rejects(native.exportBlob(new Blob(['notes']),'song.mid'),/Disk full/);
 assert.equal(messages.at(-1).action,'abort');fail=false;
 await native.exportBlob(new Blob(['notes']),'song.mid',true);
 assert.equal(messages.at(-1).action,'finish');assert.equal(messages.filter(x=>x.action==='begin').at(-1).share,true);
});
