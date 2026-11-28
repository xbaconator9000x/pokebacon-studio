import { runRom, judge } from './export-doctor.js';
import { loadPlaytestCore } from './playtest-core.js';

const COLOUR = { pass: '#2f6b2f', warn: '#8a6100', fail: '#a32020' };
const readFile = f => f.arrayBuffer().then(b => new Uint8Array(b));

export function openExportDoctor(api, { loadCore = loadPlaytestCore } = {}) {
  const { modal, esc } = api;
  const current = api.session()?.reader?.bytes || null;
  modal('Export Doctor', `<p>Starts a ROM in the built-in engine for about 40 seconds of play, pressing A and Start for you, and tells you whether it boots. Nothing is saved or changed.</p>
  ${current ? '<button id="doctorCurrent" type="button" class="export-option"><div><strong>Test the ROM I am editing</strong><small>The source ROM currently open in the Studio.</small></div></button>' : ''}
  <label class="export-option" for="doctorFile"><div><strong>Choose a ROM file…</strong><small>Test an exported .gba, for example one you just built.</small></div></label><input id="doctorFile" type="file" accept=".gba,.bin" hidden>
  <label class="export-option" for="doctorBase"><div><strong>Compare with the original (optional)</strong><small id="doctorBaseName">Pick the unedited ROM first to tell a bad edit from a ROM that never worked.</small></div></label><input id="doctorBase" type="file" accept=".gba,.bin" hidden>
  <div id="doctorOut" aria-live="polite"></div>`, null);
  const $ = s => document.querySelector('#dialogBody ' + s);
  let base = null;
  $('#doctorBase').onchange = async e => { const f = e.target.files[0]; if (f) { base = await readFile(f); $('#doctorBaseName').textContent = 'Comparing against ' + f.name; } };
  const go = async (bytes, name) => {
    const out = $('#doctorOut');
    out.innerHTML = '<progress id="doctorBar" max="1" value="0" style="width:100%"></progress><p id="doctorMsg">Starting the engine…</p>';
    const bar = $('#doctorBar');
    try {
      const core = await loadCore();
      let baseRun = null;
      if (base) { $('#doctorMsg').textContent = 'Testing the original ROM first…'; baseRun = await runRom(core, base, { onProgress: p => { bar.value = p / 2; } }); }
      $('#doctorMsg').textContent = 'Testing ' + name + '…';
      const run = await runRom(core, bytes, { onProgress: p => { bar.value = base ? 0.5 + p / 2 : p; } });
      const j = judge(run, baseRun);
      out.innerHTML = `<div style="border:2px solid ${COLOUR[j.verdict]};border-radius:12px;padding:12px;margin-top:10px"><h3 style="margin:0 0 6px;color:${COLOUR[j.verdict]}">${esc(j.title)}</h3>${j.notes.map(n => `<p>${esc(n)}</p>`).join('')}<div id="doctorShots" style="display:flex;gap:6px;flex-wrap:wrap"></div><small>Screenshots are taken during play, about every 2 seconds when the picture changes.</small></div>`;
      const strip = $('#doctorShots');
      for (const s of run.shots) {
        const c = document.createElement('canvas'); c.width = s.width; c.height = s.height; c.style.cssText = 'width:112px;image-rendering:pixelated;border:1px solid #888;border-radius:4px';
        c.setAttribute('role', 'img'); c.setAttribute('aria-label', 'Screen at about ' + Math.round(s.frame / 60) + ' seconds');
        c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(s.pixels.buffer, s.pixels.byteOffset, s.pixels.length), s.width, s.height), 0, 0);
        strip.append(c);
      }
    } catch (e) { out.innerHTML = `<p class="error-text" role="alert">${esc(e?.message || String(e))}</p>`; }
  };
  const cur = $('#doctorCurrent'); if (cur) cur.onclick = () => go(current, 'your ROM');
  $('#doctorFile').onchange = async e => { const f = e.target.files[0]; if (f) go(await readFile(f), f.name); };
}
