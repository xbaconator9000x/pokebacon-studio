import { readSourceUILayouts, applySourceUILayouts } from './ui-source-layouts.js';
import { catalogScreens } from './ui-screen-catalog.js';

export async function sourceUIEditor(api) {
  const source = api.source();
  if (!await source.attached()) return source.open();
  const files = source.state.files, engine = api.project().sourceEngine.engine;
  const slots = readSourceUILayouts(files, engine);
  if (!slots.length) throw Error('No literal WindowTemplate layouts were found in this source. Use a source revision with its engine UI included.');
  const screens = catalogScreens(slots);
  let selected = 0, screen = screens.findIndex(group => group.windows.some(slot => slot.id === slots[selected].id)), drag = null;
  const saved = () => api.project().authoring?.presentation?.sourceWindows || [];
  const value = slot => ({ ...slot, ...saved().find(edit => edit.id === slot.id) });
  const commit = edit => {
    const edits = [...saved().filter(row => row.id !== edit.id), edit];
    applySourceUILayouts(files, engine, edits);
    api.change(() => {
      const project = api.project(); project.authoring ??= {}; project.authoring.presentation ??= {};
      project.authoring.presentation.sourceWindows = edits;
    });
  };
  const reset = slot => api.change(() => {
    const project = api.project(); project.authoring ??= {}; project.authoring.presentation ??= {};
    project.authoring.presentation.sourceWindows = saved().filter(row => row.id !== slot.id);
  });
  const render = () => {
    const current = slots[selected], active = screens[screen] || screens[0];
    api.modal('Native interface layouts', `<p class="hint-line">${engine.toUpperCase()} source windows. Select a real source screen, then drag its frame directly. Export is source-based, never a guessed ROM patch.</p><div class="studio-tabs ui-screen-tabs">${screens.map((group, i) => `<button data-ui-screen="${i}" class="${i === screen ? 'active' : ''}" type="button">${api.esc(group.label)}</button>`).join('')}</div><div class="ui-source-top"><select id="uiSourceWindow">${active.windows.map(slot => `<option value="${slots.indexOf(slot)}" ${slot.id === current.id ? 'selected' : ''}>${api.esc(slot.table + ' · ' + slot.label)}</option>`).join('')}</select><button id="uiSourceReset" type="button">Restore</button><button id="uiSourcePackOut" type="button">Export pack</button><button id="uiSourcePackIn" type="button">Import pack</button></div><input id="uiSourcePackFile" type="file" accept="application/json,.json" hidden><canvas id="uiSourceCanvas" width="240" height="160" style="width:100%;max-height:48dvh;touch-action:none;image-rendering:pixelated"></canvas><div class="ui-source-dock"><button id="uiSourceMove" class="active" type="button">Move</button><button id="uiSourceSmaller" type="button">− Size</button><button id="uiSourceBigger" type="button">+ Size</button><button id="uiSourceUp" type="button">↑</button><button id="uiSourceDown" type="button">↓</button><button id="uiSourceLeft" type="button">←</button><button id="uiSourceRight" type="button">→</button><button id="uiSourceBuild" type="button">Review export</button></div><details><summary>What is safe to edit?</summary><p>This changes only literal source-declared window rectangles. Text coordinates, menus, background art and battle logic are intentionally not claimed as changed. The editor rejects changes needing more original tile storage.</p></details>`, null, 'Done');
    const canvas = document.querySelector('#uiSourceCanvas'), ctx = canvas.getContext('2d');
    const paint = () => {
      ctx.fillStyle = '#172029'; ctx.fillRect(0, 0, 240, 160); ctx.strokeStyle = '#30455b'; ctx.lineWidth = 1;
      for (let x = 0; x <= 240; x += 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 160); ctx.stroke(); }
      for (let y = 0; y <= 160; y += 8) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(240, y); ctx.stroke(); }
      for (const slot of active.windows) {
        const row = value(slot); ctx.strokeStyle = slot.id === current.id ? '#ff7ba4' : '#b8d878'; ctx.lineWidth = slot.id === current.id ? 3 : 1;
        ctx.strokeRect(row.tilemapLeft * 8, row.tilemapTop * 8, row.width * 8, row.height * 8);
      }
    };
    const point = event => { const r = canvas.getBoundingClientRect(); return { x: Math.floor((event.clientX - r.left) * 30 / r.width), y: Math.floor((event.clientY - r.top) * 20 / r.height) }; };
    const nudge = (x, y, w = 0, h = 0) => { const row = value(slots[selected]); try { commit({ ...row, tilemapLeft: row.tilemapLeft + x, tilemapTop: row.tilemapTop + y, width: row.width + w, height: row.height + h }); render(); } catch (error) { api.error(error); } };
    canvas.onpointerdown = event => { const p = point(event), hits = active.windows.map(slot => ({ row: value(slot), i: slots.indexOf(slot) })).filter(({ row }) => p.x >= row.tilemapLeft && p.y >= row.tilemapTop && p.x < row.tilemapLeft + row.width && p.y < row.tilemapTop + row.height); if (hits.length) selected = hits.at(-1).i; drag = { p, row: value(slots[selected]) }; canvas.setPointerCapture(event.pointerId); paint(); };
    canvas.onpointerup = event => { if (!drag) return; const p = point(event), dx = p.x - drag.p.x, dy = p.y - drag.p.y; const row = drag.row; drag = null; if (dx || dy) { try { commit({ ...row, tilemapLeft: row.tilemapLeft + dx, tilemapTop: row.tilemapTop + dy }); } catch (error) { api.error(error); } } render(); };
    document.querySelectorAll('[data-ui-screen]').forEach(button => button.onclick = () => { screen = Number(button.dataset.uiScreen); selected = slots.indexOf(screens[screen].windows[0]); render(); });
    document.querySelector('#uiSourceWindow').onchange = event => { selected = Number(event.target.value); paint(); };
    document.querySelector('#uiSourceReset').onclick = () => { reset(slots[selected]); render(); };
    document.querySelector('#uiSourceSmaller').onclick = () => nudge(0, 0, -1, -1);
    document.querySelector('#uiSourceBigger').onclick = () => nudge(0, 0, 1, 1);
    document.querySelector('#uiSourceUp').onclick = () => nudge(0, -1);
    document.querySelector('#uiSourceDown').onclick = () => nudge(0, 1);
    document.querySelector('#uiSourceLeft').onclick = () => nudge(-1, 0);
    document.querySelector('#uiSourceRight').onclick = () => nudge(1, 0);
    document.querySelector('#uiSourceBuild').onclick = () => source.open('build');
    document.querySelector('#uiSourcePackOut').onclick = () => api.save(new Blob([JSON.stringify({ format: 'pokebacon-native-layouts', version: 1, engine, windows: saved() }, null, 2)], { type: 'application/json' }), `PokeBacon_${engine}_layouts.json`);
    document.querySelector('#uiSourcePackIn').onclick = () => document.querySelector('#uiSourcePackFile').click();
    document.querySelector('#uiSourcePackFile').onchange = async event => { try { const file = event.target.files[0]; if (!file || file.size > 1e6) throw Error('Choose a layout pack below 1 MB.'); const pack = JSON.parse(await file.text()); if (pack.format !== 'pokebacon-native-layouts' || pack.version !== 1 || pack.engine !== engine || !Array.isArray(pack.windows)) throw Error('Choose a compatible layout pack.'); applySourceUILayouts(files, engine, pack.windows); api.change(() => { const project = api.project(); project.authoring ??= {}; project.authoring.presentation ??= {}; project.authoring.presentation.sourceWindows = pack.windows; }); render(); } catch (error) { api.error(error); } };
    paint();
  };
  render();
}
