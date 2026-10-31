// Keep install/help surfaces in sync with the generated Android asset.
const oldVersion='4.34.5',newVersion='4.69.6';
const update=()=>{for(const node of document.querySelectorAll('#dialogBody a[href],#dialogBody p,#dialogBody .callout')){if(node.matches('a[href]')&&node.getAttribute('href')?.includes(oldVersion))node.setAttribute('href',node.getAttribute('href').replaceAll(oldVersion,newVersion));const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);const text=[];while(walker.nextNode())text.push(walker.currentNode);for(const t of text)if(t.nodeValue?.includes(oldVersion))t.nodeValue=t.nodeValue.replaceAll(oldVersion,newVersion);}};
new MutationObserver(update).observe(document.body,{childList:true,subtree:true});update();
