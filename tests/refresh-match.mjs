import assert from 'node:assert/strict';import{matchNativeEvent as match}from'../dist/rom-event-match.js';
const a={index:0,address:100,x:7,y:8,elevation:0,warp:2,target:'3.1'},b={...a,index:1,address:108};
assert.deepEqual(match(a,[a,b],'warp'),[a]);assert.deepEqual(match(b,[a,b],'warp'),[b]);assert.deepEqual(match(a,[b,a],'warp'),[a]);
assert.equal(match(a,[{...a,warp:4},{...b,warp:5}],'warp').length,2);
assert.deepEqual(match(a,[{...a,index:5,address:500},{...b,warp:9}],'warp'),[{...a,index:5,address:500}]);
assert.equal(match(a,[{...a,x:12},{...b,x:12}],'warp').length,0);
console.log('PASS duplicate aliases, reordered records, distinct destinations and moved conflicts');

assert.equal(match(a,[{...a,x:8},{...b,x:8}],'warp')[0].index,0);
