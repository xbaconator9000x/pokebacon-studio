import {neuralComposer,neuralFields} from './music-neural.js';
import {QUICK_TRACKS,quickTrackSettings} from './music-quick-presets.js';
import {composeSong} from './music-song.js';
import {compileMusic,checkScore,writeMIDI,MUSIC_KEYS,availableVoices,readMIDI} from './music-compose.js';
import {chooseQuickBank,fitQuickBank,quickROMBank} from './music-quick-bank.js';
import {applyAftermathTreatment} from './music-aftermath-treatment.js';
import {musicScore} from './music-motifs.js';
import {suggestMelodyPart,styleTrackBase,fitSourceVoices} from './music-track-style.js';
import {MUSIC_SCALES} from './music-styles.js';
import {developTrackArrangement} from './music-track-development.js';

const newSeed=()=>{if(globalThis.crypto?.getRandomValues){const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0];}return Math.floor(Math.random()*0x100000000);};
export function quickTrackWorkshop(api){
 const neural=api.neural||neuralComposer(),$=s=>document.querySelector(s),esc=api.esc;
 const state={preset:'sunny-route',seed:newSeed(),energy:65,bank:'auto',scope:'whole',basis:'new',sourceId:'',busy:false,serial:0};
 const decoded=new WeakMap(),midiBases=[];
 function cancel(){state.serial++;neural.cancel();api.stop();}
 function readSource(row){if(row?.score)return {...row,percussionPrograms:[],part:suggestMelodyPart(row.score)};if(!row?.asset)throw Error('Choose a track imported into your music library.');if(!decoded.has(row.asset)){const result=musicScore(row.asset),percussionPrograms=availableVoices(row.asset).filter(v=>/Drum kit|PSG noise/.test(v.name)).map(v=>v.program);decoded.set(row.asset,{...result,percussionPrograms,part:suggestMelodyPart(result.score,{percussionPrograms})});}return decoded.get(row.asset);}
 function open(preset=state.preset,{baseTrackId}={}){
  cancel();if(!QUICK_TRACKS[preset])preset='sunny-route';state.preset=preset;
  const p=QUICK_TRACKS[preset],sources=[...api.tracks(),...midiBases];state.energy=p.energy;
  if(baseTrackId){state.basis='track';state.sourceId=baseTrackId;}
  if(!sources.some(t=>t.id===state.sourceId))state.sourceId=sources[0]?.id||'';
  if(!sources.length)state.basis='new';
  const option=(value,label)=>`<option value="${esc(String(value))}">${esc(label)}</option>`;
  api.modal('Quick Track',`
   <p>Pick a vibe. Create a new song, or re-arrange a familiar track while keeping its melody recognisable.</p>
   <div class="studio-grid"><label>Starting point<select id="quickBasis"><option value="new">New track from scratch</option><option value="track" ${sources.length?'':'disabled'}>Base on track</option></select></label>
   <label id="quickSourceLabel">Base track<select id="quickSource">${sources.map(t=>option(t.id,t.name)).join('')}</select></label></div>
   <button id="quickImportMIDI" type="button">Import MIDI · choose parts from one file</button><input id="quickBaseMIDIFile" type="file" accept=".mid,.midi,.rmi,audio/midi,audio/x-midi" hidden>
   <p id="quickNoSources" class="hint-line" ${sources.length?'hidden':''}>Import a song from your ROM, MIDI or a music pack into the library to use Base on track.</p>
   <section id="quickBaseOptions"><label>Use from source<select id="quickScope"><option value="whole">Whole song · all parts</option><option value="selected">Choose multiple parts · 2, 3 or more</option><option value="single">Single melody · rebuild backing</option></select></label><fieldset id="quickPartsPanel"><legend>Parts inside this song / MIDI file</legend><p>Tick the instrument parts to use together. These are parts from one file, not separate songs.</p><div class="studio-actions"><button id="quickAllParts" type="button">Select all</button><button id="quickClearParts" type="button">Clear · choose 2–3 parts</button></div><p id="quickPartCount" role="status"></p><div id="quickPartChoices" class="studio-grid"></div></fieldset><p id="quickSourceInfo" class="callout" role="status"></p>
    <div class="studio-grid"><label>Melody part<select id="quickMelodyPart"></select></label>
    </div><button id="quickHearMelody" type="button">▶ Hear melody part</button><p class="hint-line">Whole song uses every source part. Selected parts uses the checked parts together. Hybrid recomposes a prominent backing part using the source tune, with its own rhythm and phrasing. Your original stays unchanged.</p>
   </section>
   <div class="studio-grid"><label>Key<select id="quickTargetKey"><option value="original">Keep original / preset key</option>${MUSIC_KEYS.map((name,i)=>option(i,name)).join('')}</select></label><label>Scale<select id="quickTargetScale"><option value="original">Keep original / preset scale</option><option value="vibe">Follow selected vibe</option>${Object.keys(MUSIC_SCALES).map(name=>option(name,name)).join('')}</select></label></div>
   <div id="quickVibes" class="quick-vibes">${Object.entries(QUICK_TRACKS).map(([id,v])=>`<button type="button" data-quick-vibe="${id}" aria-pressed="${id===preset}"><b>${esc(v.name)}</b><small>${esc(v.scene)}</small></button>`).join('')}</div>
   <p id="quickDescription" class="callout"></p><label>Track name<input id="quickName" maxlength="120"></label>
   <label>Energy <output id="quickEnergyValue">${state.energy}</output><input id="quickEnergy" type="range" min="0" max="100" value="${state.energy}"></label>
   <section id="quickNewOptions"><label>Atmosphere treatment<select id="quickTreatment"><option value="none">Original scene identity</option><option value="worn-subtle">Worn · preserve identity</option><option value="worn-route">Worn route · familiar but damaged</option><option value="worn-strong">Worn · damaged memory</option></select></label>
    <p id="quickTreatmentHint" class="hint-line"></p>${neuralFields('quick')}</section>
   <label>Sound palette<select id="quickBank"><option value="auto">Auto · prefer source / imported ROM instruments</option><option value="studio">Studio cartridge palette · original sounds</option>${sources.filter(t=>t.asset).map(t=>option(t.id,t.name+' — instruments')).join('')}</select></label>
   <p id="quickPaletteHint" class="hint-line"></p>
   <details><summary>Repeatable settings & new-song length</summary>
    <label>Variation seed<input id="quickSeed" type="number" min="0" max="4294967295" value="${state.seed}"></label>
    <div id="quickLengthOptions" class="studio-grid"><label>Intro bars<input id="quickIntro" type="number" min="0" max="128" value="${p.introBars}"></label><label>Main theme bars<input id="quickVerse" type="number" min="1" max="128" value="${p.verseBars}"></label><label>Bridge bars<input id="quickBridge" type="number" min="1" max="128" value="${p.bridgeBars}"></label></div>
   </details>
   <label class="check"><input id="quickLoop" type="checkbox" ${p.loop===false?'':'checked'}> Loop after the intro</label>
   <p id="quickSummary" role="status"></p><p id="quickReport" role="status"></p>
   <div class="studio-actions"><button id="quickOriginal" type="button">▶ Original</button><button id="quickPreview" class="primary" type="button">▶ Make & preview</button><button id="quickAnother" type="button">Another take</button><button id="quickStop" type="button">■ Stop</button><button id="quickArrange" type="button">Edit arrangement & notes</button><button id="quickMIDI" type="button">Export MIDI</button></div>
   <p id="quickMethodHint" class="hint-line"></p>`,async()=>{
    if(state.busy)return false;state.busy=true;const job=++state.serial;
    try{const made=await build();if(job!==state.serial)return false;api.add(made.asset);api.openLibrary();api.toast('New Quick Track copy saved. The source is unchanged.');}
    catch(e){if(e.name==='AbortError')return false;throw e;}finally{state.busy=false;}
   },'Save track');
  $('#quickScope').value=state.scope;$('#quickBasis').value=state.basis;$('#quickSource').value=state.sourceId;
  $('#quickBank').value=sources.some(t=>t.id===state.bank)||['auto','studio'].includes(state.bank)?state.bank:'auto';
  let lastDefaultName='';
  const based=()=>$('#quickBasis').value==='track';
  const sourceRow=()=>sources.find(t=>t.id===$('#quickSource').value);
  const safe=fn=>async()=>{if(state.busy)return;state.busy=true;const job=++state.serial;try{await fn(job);}catch(e){if(e.name!=='AbortError')api.error(e);}finally{state.busy=false;}};
  function options(){const o=quickTrackSettings(state.preset,{seed:Number($('#quickSeed').value),energy:Number($('#quickEnergy').value),introBars:Number($('#quickIntro').value),verseBars:Number($('#quickVerse').value),bridgeBars:Number($('#quickBridge').value)});if(!based()){if($('#quickTargetKey').value!=='original')o.key=Number($('#quickTargetKey').value);if(!['original','vibe'].includes($('#quickTargetScale').value))o.scale=$('#quickTargetScale').value;}return o;}
  function selectedBank(){const value=$('#quickBank').value;return value==='studio'?null:value==='auto'?(based()?(sourceRow()?.asset?sourceRow():null):chooseQuickBank(sources,state.preset)):sources.find(t=>t.id===value)||null;}
  function rename(){const next=based()?(sourceRow()?.name||'Source track')+' · '+QUICK_TRACKS[state.preset].name:QUICK_TRACKS[state.preset].name+' theme';if(!$('#quickName').value||$('#quickName').value===lastDefaultName)$('#quickName').value=next;lastDefaultName=next;}
  function partLabel(t,i){return (Number.isInteger(t.sourceTrack)?'MIDI track '+(t.sourceTrack+1)+' · ':'Part '+(i+1)+' · ')+(t.name||'Unnamed')+(Number.isInteger(t.channel)?' · channel '+(t.channel+1):'')+' · '+t.notes.length+' notes';}
  function sourceDetails(){
   const row=sourceRow();$('#quickMelodyPart').innerHTML='';
   if(!row)return;
   try{const info=readSource(row);$('#quickPartChoices').innerHTML=info.score.tracks.map((t,i)=>`<label class="check"><input type="checkbox" data-source-part="${i}" checked> ${esc(partLabel(t,i))}</label>`).join('');$('#quickPartChoices').querySelectorAll('input').forEach(c=>c.onchange=()=>{cancel();state.scope='selected';$('#quickScope').value='selected';syncParts();describe();});$('#quickMelodyPart').innerHTML=info.score.tracks.map((t,i)=>`<option value="${i}" ${t.notes.length?'':'disabled'}>${esc(partLabel(t,i))}</option>`).join('');$('#quickMelodyPart').value=String(info.part);$('#quickSourceInfo').textContent=`${row.name} · ${Math.ceil(info.score.length/96)} bars · ${info.score.tracks.length} parts. Melody part is suggested automatically; change it if the main tune is elsewhere.`;$('#quickLoop').checked=row.asset?.arrangement?.loop??info.score.tracks.some(t=>t.loopStart!==null&&t.loopStart!==undefined);}
   catch(e){$('#quickSourceInfo').textContent=e.message+' Original playback is still available.';}
  }
  function syncParts(){const selected=[...document.querySelectorAll('[data-source-part]:checked')].map(c=>Number(c.dataset.sourcePart)),limit=$('#quickScope').value==='selected';for(const o of $('#quickMelodyPart').options)o.disabled=limit&&!selected.includes(Number(o.value));if(!$('#quickMelodyPart').selectedOptions[0]||$('#quickMelodyPart').selectedOptions[0].disabled)$('#quickMelodyPart').value=String(selected[0]??'');}
  function describe(){
   const p=QUICK_TRACKS[state.preset],o=options(),bank=selectedBank(),t=$('#quickTreatment').value,isBase=based();const count=document.querySelectorAll('[data-source-part]:checked').length,total=document.querySelectorAll('[data-source-part]').length;$('#quickPartCount').textContent=`${count} of ${total} parts selected`+(count?' · used together as the base':' · choose at least one part');
   for(const[id,hidden]of [['quickSourceLabel',!isBase],['quickBaseOptions',!isBase],['quickOriginal',!isBase],['quickLengthOptions',isBase],['quickPartsPanel',$('#quickScope').value==='single']])$('#'+id).hidden=hidden;
   $('#quickDescription').textContent=p.description;$('#quickEnergyValue').textContent=$('#quickEnergy').value;
   $('#quickSummary').textContent=isBase?`${p.name} · ${$('#quickScope').selectedOptions[0].textContent} · ${$('#quickTargetKey').selectedOptions[0].textContent} · ${$('#quickTargetScale').selectedOptions[0].textContent}`:`${MUSIC_KEYS[o.key]} ${o.scale} · ${o.tempo} BPM · ${o.introBars+o.verseBars+o.bridgeBars} bars · main theme → bridge`;
   $('#quickPaletteHint').textContent=bank?'Instruments: '+bank.name:$('#quickBank').value==='auto'?'The opened ROM will supply instruments when compatible; otherwise the Studio palette is used.':'Original brass, flute, mallets, piano, strings, bass, guitar and bells.';
   $('#quickTreatmentHint').textContent=t==='none'?'The scene stays intact.':'Keeps the source or generated tune while darkening harmony, thinning accompaniment and adding silence.';
   $('#quickMethodHint').textContent=isBase?'The source tune stays recognisable. The selected composer develops backing and answering phrases around it; atmosphere treatment is applied afterwards. Saves a new copy.': 'Creates an original full track from scratch. Imported tracks supply instruments only in this mode.';
  }
  async function build(){
   api.stop();const revision=state.serial,o=options(),isBase=based(),row=isBase?sourceRow():null,engine=$('#quickEngine').value,treatment=$('#quickTreatment').value;
   let bank=selectedBank(),score,warnings=[];
   if(isBase){const info=readSource(row),styled=styleTrackBase(info.score,{preset:state.preset,seed:o.seed,energy:o.energy,scope:$('#quickScope').value,selectedParts:[...document.querySelectorAll('[data-source-part]:checked')].map(c=>Number(c.dataset.sourcePart)),targetKey:$('#quickTargetKey').value,targetScale:$('#quickTargetScale').value,melodyPart:Number($('#quickMelodyPart').value),identity:$('#quickTargetScale').value==='original'?'exact':'contour',percussionPrograms:info.percussionPrograms});score=styled.score;warnings.push(...info.warnings,...styled.warnings);if(engine!=='phrase')score=await developTrackArrangement(score,neural,{...o,engine,temperature:Number($('#quickTemperature').value),onProgress:message=>{if($('#quickReport'))$('#quickReport').textContent=message;}});}
   else{score=composeSong(o);if(engine!=='phrase')score=await neural.generate(score,{...o,engine,temperature:Number($('#quickTemperature').value),onProgress:message=>{if($('#quickReport'))$('#quickReport').textContent=message;}});}
   if(treatment!=='none')score=applyAftermathTreatment(score,{mode:treatment,seed:o.seed});
   if(bank&&$('#quickBank').value==='auto'){try{fitQuickBank(score,bank.asset);}catch{bank=null;warnings.push('The source instrument bank cannot play this arrangement; using compatible instruments.');}}
   if(!bank&&!isBase&&$('#quickBank').value==='auto'&&api.session?.()){$('#quickReport').textContent='Finding matching ROM instruments…';bank=await quickROMBank(api.session(),state.preset,score);if(!bank)warnings.push('No compatible ROM bank found; using the Studio palette.');}
   if(bank){const fitted=fitQuickBank(score,bank.asset);score=fitted.score;warnings.push(...fitted.warnings);
    // Preserve the imported melody's timbre when keeping its own instrument bank.
    if(isBase&&bank.asset&&bank.asset===row.asset){const program=score.tracks[0].sourceProgram,voice=availableVoices(bank.asset).find(v=>v.program===program);if(voice&&score.tracks[0].notes.every(n=>!voice.keys||voice.keys.includes(n.key)))score.tracks[0].program=program;}
   }
   if(revision!==state.serial)throw Object.assign(Error('Generation stopped.'),{name:'AbortError'});
   score=fitSourceVoices(score).score;const stats=checkScore(score),asset=compileMusic(score,{name:$('#quickName').value.trim()||lastDefaultName,loop:$('#quickLoop').checked,bankAsset:bank?.asset||null});
   asset.arrangement.quick={preset:state.preset,seed:o.seed,engine:score.composition.neural?.engine||'phrase',bankId:bank?.id||null,treatment:treatment==='none'?null:score.composition.treatment,...(isBase?{baseTrackId:row.id,baseTrackName:row.name,scope:$('#quickScope').value,selectedParts:[...document.querySelectorAll('[data-source-part]:checked')].map(c=>Number(c.dataset.sourcePart)),targetKey:$('#quickTargetKey').value,targetScale:$('#quickTargetScale').value,melodyPart:Number($('#quickMelodyPart').value),identity:$('#quickTargetScale').value==='original'?'exact':'contour'}:{})};
   $('#quickReport').textContent=(isBase?'Source melody · ':'')+(score.composition.neural?score.composition.neural.engine+(isBase?' · '+score.composition.neural.changedNotes+' developed notes':'')+' · ':'Phrase composer · ')+score.tempos[0].bpm+' BPM · '+stats.parts+' parts · '+stats.notes+' notes · '+stats.peak+' peak voices'+(warnings.length?' · '+[...new Set(warnings)].join(' '):'');
   return{asset,score,bank,warnings};
  }
  document.querySelectorAll('[data-quick-vibe]').forEach(button=>button.onclick=()=>{
   cancel();state.preset=button.dataset.quickVibe;const p=QUICK_TRACKS[state.preset];$('#quickEnergy').value=p.energy;
   if(!based()){$('#quickIntro').value=p.introBars;$('#quickVerse').value=p.verseBars;$('#quickBridge').value=p.bridgeBars;$('#quickLoop').checked=p.loop!==false;}
   $('#quickReport').textContent='';document.querySelectorAll('[data-quick-vibe]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));rename();describe();
  });
  $('#quickBasis').onchange=()=>{cancel();state.basis=$('#quickBasis').value;if(based())sourceDetails();else $('#quickLoop').checked=QUICK_TRACKS[state.preset].loop!==false;rename();describe();$('#quickEngine').onchange();};
  $('#quickSource').onchange=()=>{cancel();state.sourceId=$('#quickSource').value;sourceDetails();rename();describe();};
  $('#quickMelodyPart').onchange=()=>{cancel();describe();};$('#quickScope').onchange=()=>{cancel();state.scope=$('#quickScope').value;if(state.scope==='whole')document.querySelectorAll('[data-source-part]').forEach(c=>c.checked=true);syncParts();describe();};for(const id of ['quickTargetKey','quickTargetScale'])$('#'+id).onchange=()=>{cancel();describe();};
  $('#quickEnergy').oninput=()=>{cancel();describe();};$('#quickBank').onchange=()=>{cancel();state.bank=$('#quickBank').value;describe();};$('#quickTreatment').onchange=()=>{cancel();describe();};
  for(const id of ['quickIntro','quickVerse','quickBridge','quickSeed'])$('#'+id).oninput=()=>{cancel();try{describe();}catch(e){$('#quickSummary').textContent=e.message;}};
  $('#quickAllParts').onclick=()=>{cancel();document.querySelectorAll('[data-source-part]').forEach(c=>c.checked=true);$('#quickScope').value='whole';state.scope='whole';syncParts();describe();};
  $('#quickClearParts').onclick=()=>{cancel();document.querySelectorAll('[data-source-part]').forEach(c=>c.checked=false);$('#quickScope').value='selected';state.scope='selected';syncParts();describe();};
  $('#quickImportMIDI').onclick=()=>$('#quickBaseMIDIFile').click();$('#quickBaseMIDIFile').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;try{if(file.size>2*1024*1024)throw Error('Use a MIDI file under 2 MB.');const parsed=readMIDI(new Uint8Array(await file.arrayBuffer())),id='midi-base-'+newSeed();midiBases.push({id,name:file.name.replace(/\.(?:midi?|rmi)$/i,''),score:parsed.score,warnings:parsed.warnings,asset:null});state.basis='track';state.sourceId=id;state.scope='selected';open(state.preset,{baseTrackId:id});}catch(error){api.error(error);}};
  $('#quickHearMelody').onclick=safe(async job=>{const info=readSource(sourceRow()),part=Number($('#quickMelodyPart').value),track=info.score.tracks[part];if(!track?.notes.length)throw Error('Choose a part with notes.');const first=track.notes[0].tick,score={...structuredClone(info.score),tracks:[structuredClone(track)]};score.tracks[0].notes=score.tracks[0].notes.map(n=>({...n,tick:n.tick-first}));score.length=Math.max(...score.tracks[0].notes.map(n=>n.tick+n.duration));score.loopStart=0;delete score.songSections;delete score.composition;score.tempos=[{tick:0,bpm:info.score.tempos[0].bpm}];if(!sourceRow().asset)score.tracks[0].program=track.channel===9?3:17;score.tracks[0].automation=[{tick:0,volume:100,pan:64,bend:0,range:2}];if(job===state.serial)return api.play(compileMusic(score,{bankAsset:sourceRow().asset||null,name:'Melody part',loop:false}));});
  $('#quickOriginal').onclick=safe(async job=>{const row=sourceRow();if(!row)throw Error('Choose a base track.');if(job===state.serial)return api.play(row.asset||compileMusic(fitSourceVoices({...structuredClone(row.score),tracks:row.score.tracks.map(t=>({...t,program:t.channel===9?3:17}))}).score,{name:row.name+' · MIDI original',loop:false}));});
  $('#quickPreview').onclick=safe(async job=>{const made=await build();if(job===state.serial)return api.play(made.asset);});
  $('#quickAnother').onclick=safe(async job=>{const previous=Number($('#quickSeed').value);state.seed=newSeed();if(state.seed===previous)state.seed=(previous+1)>>>0;$('#quickSeed').value=state.seed;describe();const made=await build();if(job===state.serial)return api.play(made.asset);});
  $('#quickStop').onclick=()=>{cancel();$('#quickReport').textContent='Stopped.';};
  $('#quickArrange').onclick=safe(async job=>{const made=await build();if(job!==state.serial)return;api.arrange({score:made.score,name:made.asset.name,bankId:made.bank?.id,bankAsset:made.bank?.asset,loop:$('#quickLoop').checked,warnings:made.warnings});});
  $('#quickMIDI').onclick=safe(async job=>{const made=await build();if(job===state.serial)return api.save(new Blob([writeMIDI(made.score)],{type:'audio/midi'}),made.asset.name.replace(/[^a-z0-9]+/gi,'_')+'.mid');});
  const setEngine=()=>{cancel();const value=$('#quickEngine').value;$('#quickTemperature').disabled=value==='phrase';$('#quickEngineHint').textContent=value==='hybrid'?(based()?'Hybrid uses the source tune to develop chord-aware backing and answering phrases. The tune stays locked.':'Hybrid develops a connected, chord-aware phrase.'):value==='phrase'?'Instant scene-aware phrase composer.':'Develops new melodic phrases over the arrangement.';};
  $('#quickEngine').onchange=setEngine;$('#quickTemperature').oninput=()=>{cancel();$('#quickTemperatureValue').textContent=$('#quickTemperature').value;};
  document.querySelector('#dialog')?.addEventListener('close',cancel,{once:true});if(based())sourceDetails();setEngine();rename();describe();
 }
 return{state,open,cancel};
}
