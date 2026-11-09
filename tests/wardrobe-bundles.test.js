import test from 'node:test';
import assert from 'node:assert/strict';
import {wardrobeBundleKey,wardrobeBundleRows} from '../dist/wardrobe-native.js';

test('wardrobe browser groups poses without joining different wardrobe resources',()=>{
 const rows=[
  {id:0,category:'outfit',gender:'male',slot:1,view:'walking'},
  {id:1,category:'outfit',gender:'male',slot:1,view:'running'},
  {id:2,category:'outfit',gender:'male',slot:1,view:'portrait'},
  {id:3,category:'hair',gender:'male',slot:1,view:'walking'},
  {id:4,category:'hair',gender:'female',slot:1,view:'walking'}
 ];
 assert.deepEqual(wardrobeBundleRows(rows).map(row=>row.id),[0,3,4]);
 assert.equal(wardrobeBundleKey(rows[0]),wardrobeBundleKey(rows[1]));
 assert.notEqual(wardrobeBundleKey(rows[0]),wardrobeBundleKey(rows[3]));
 assert.notEqual(wardrobeBundleKey(rows[3]),wardrobeBundleKey(rows[4]));
});
