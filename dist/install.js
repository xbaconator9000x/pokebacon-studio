// Installation stays under the browser's control; never substitute a share prompt.
const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const apple=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
let pending;
const page=document.querySelector('[data-install-page]');
const native=!!window.NativeBridge;
const content=document.createElement('dialog');
content.id='installHelp';
content.setAttribute('aria-labelledby','installTitle');
content.innerHTML=`<h2 id="installTitle">Install PokéBacon Studio</h2><div id="installInstructions"></div><form method="dialog"><button autofocus>Close</button></form>`;
document.body.append(content);
function render(){
 const installed=standalone()||native;
 const text=installed?'Already running as an app. Open the editor to carry on.':apple?
 `<p>The iPhone and iPad version runs as a Home Screen web app. Apple requires signing and provisioning for a native app; our native iOS build is not yet signed for public installation. This version uses the web editor, so you don’t need a developer account or the App Store.</p><ol><li>Open this page in Safari.</li><li>Tap <strong>Share</strong> (the square with an upward arrow).</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Keep <strong>Open as Web App</strong> enabled if shown, then tap <strong>Add</strong>.</li></ol><p>Apple doesn’t let a website open that installation prompt for you. Once added, launch PokéBacon from its own icon.</p>`:
 pending?'<p>Add PokéBacon to your device. Your browser will ask you to confirm.</p>':'<p>Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>. On desktop, look for an install icon in the address bar. If your browser doesn’t offer installation, you can still use the editor here.</p>';
 const body=`${text.startsWith('<')?text:`<p>${text}</p>`}<p>Let the editor finish loading online before trying it offline. Export project backups; installing doesn’t create a cloud backup.</p>`;
 content.querySelector('#installInstructions').innerHTML=body;
 if(page){page.querySelector('[data-install-copy]').innerHTML=body;page.querySelector('[data-install-action]').hidden=!pending||installed;}
 document.querySelectorAll('[data-install-link]').forEach(el=>el.hidden=installed);
}
async function install(){
 if(standalone()||native){if(page)location.replace('./');return;}
 if(pending){const prompt=pending;pending=null;render();try{await prompt.prompt();await prompt.userChoice;}catch{if(!content.open)content.showModal();}return;}
 render();if(!page&&!content.open)content.showModal();
}
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();pending=event;render();});
window.addEventListener('appinstalled',()=>{pending=null;render();if(content.open)content.close();if(page)location.replace('./');});
matchMedia('(display-mode: standalone)').addEventListener('change',render);
document.querySelectorAll('[data-install-link],[data-install-action]').forEach(el=>el.addEventListener('click',event=>{event.preventDefault();install();}));
render();
if(page){if(standalone()||native)location.replace('./');else if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});}
