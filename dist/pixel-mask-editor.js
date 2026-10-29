import{compositePlanes}from'./object-cutouts.js';
export function pixelMaskEditor({canvas,planes,original,onChange,erase,restore,undo,size}){
 let tool='erase',active=null,history=[];canvas.style.touchAction='none';
 const draw=()=>{const ctx=canvas.getContext('2d'),im=ctx.createImageData(canvas.width,canvas.height);im.data.set(compositePlanes(planes));ctx.putImageData(im,0,0);onChange();};
 const paint=e=>{const r=canvas.getBoundingClientRect(),x=Math.floor((e.clientX-r.left)*canvas.width/r.width),y=Math.floor((e.clientY-r.top)*canvas.height/r.height),brush=+size.value||1;for(let yy=y;yy<y+brush;yy++)for(let xx=x;xx<x+brush;xx++){if(xx<0||yy<0||xx>=canvas.width||yy>=canvas.height)continue;const i=(yy*canvas.width+xx)*4;for(let p=0;p<planes.length;p++)tool==='erase'?planes[p].fill(0,i,i+4):planes[p].set(original[p].subarray(i,i+4),i);}draw();};
 erase.onclick=()=>{tool='erase';erase.setAttribute('aria-pressed','true');restore.setAttribute('aria-pressed','false');};restore.onclick=()=>{tool='restore';restore.setAttribute('aria-pressed','true');erase.setAttribute('aria-pressed','false');};undo.onclick=()=>{if(!history.length)return;const before=history.pop();planes.forEach((p,i)=>p.set(before[i]));draw();};
 canvas.onpointerdown=e=>{e.preventDefault();active=e.pointerId;canvas.setPointerCapture?.(e.pointerId);history.push(planes.map(p=>p.slice()));if(history.length>20)history.shift();paint(e);};canvas.onpointermove=e=>{if(active===e.pointerId){e.preventDefault();paint(e);}};canvas.onpointerup=canvas.onpointercancel=()=>{active=null;};
 return{draw};
}
