// Optional APK-only artwork catalogue. The generated file is local to a build
// and is never part of a project export or repository source tree.
let pending=null;
export async function bundledSpriteLibrary(){
 if(!pending)pending=fetch('assets/private-sprite-library.json').then(r=>r.ok?r.json():null).catch(()=>null);
 return pending;
}
export function bundledPixels(row){return Array.from(Uint8Array.from(atob(row.pixels),c=>c.charCodeAt(0)));}
