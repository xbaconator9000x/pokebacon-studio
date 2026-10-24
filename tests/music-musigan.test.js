import test from 'node:test';
import assert from 'node:assert/strict';
import {composeSong} from '../dist/music-song.js';
import {quickTrackSettings} from '../dist/music-quick-presets.js';
import {musiganPlan,applyMusiganPhrases} from '../dist/music-musigan-score.js';
import {checkScore,compileMusic} from '../dist/music-compose.js';

test('Contour plan is bounded and its phrases compile through the normal arranger',()=>{
 const source=composeSong(quickTrackSettings('cave',{seed:12})),plan=musiganPlan(source,{seed:12,temperature:.9});
 assert.ok(plan.jobs.length>=2&&plan.jobs.length<=4);
 const results=plan.jobs.map(job=>({notes:[{step:0,key:60,duration:24,token:'C4$1.0'},{step:8,key:64,duration:12,token:'E4$0.5'}]}));
 const score=applyMusiganPhrases(source,plan,results),stats=checkScore(score);
 assert.ok(stats.notes>0);compileMusic(score);assert.equal(score.composition.neural.engine,'Contour-guided arranger');
});

test('Contour stage requires a usable result for every planned section',()=>{
 const source=composeSong(),plan=musiganPlan(source,{seed:1});
 assert.throws(()=>applyMusiganPhrases(source,plan,[]),/incomplete/);
 assert.throws(()=>applyMusiganPhrases(source,plan,plan.jobs.map(()=>({notes:[]}))),/silence/);
});
