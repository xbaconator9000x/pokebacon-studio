/* Verified Shattered creator catalogue. Refuses incomplete/erased tables. */
import{smolInfo}from'./smol-sprites.js';

const B=0x08000000;
const HAIR_STYLES=['Bald','Asym. short','Bob','Cropped','Half tied','Layered shag','Low ponytail','Pixie','Shoulder','Side part','Swept long','Tousled','Wavy crop'];
const ok=(b,a,n=1)=>a>=0&&a+n<=b.length;
const u=(b,a)=>ok(b,a,4)?(b[a]|b[a+1]<<8|b[a+2]<<16|b[a+3]<<24)>>>0:0;
const p=(b,a)=>{const x=u(b,a)-B;return ok(b,x)?x:-1;};
const pal=(b,a)=>ok(b,a,32)&&Array.from({length:16},(_,i)=>b[a+i*2]|b[a+i*2+1]<<8).every(x=>x<0x8000);
const lz=(b,a,n)=>{try{return a>=0&&smolInfo(b,a).size===n;}catch{return false;}};

export function wardrobeBundleKey(row){return [row.category,row.gender,row.slot].join(':');}
export function wardrobeBundleRows(rows){return rows.filter(row=>row.view==='walking');}

export function discoverWardrobe(reader){
 const b=reader.bytes,candidates=[];
 for(let a=0;a<b.length-32;a+=2)if((b[a]|b[a+1]<<8)===0x40b3&&(b[a+4]|b[a+5]<<8)===0x40b1)for(let q=a;q<a+32;q+=4){const x=p(b,q);if(x>=0&&pal(b,x))candidates.push(x);}
 for(const palette of candidates){
  const body=palette-3456,hair=palette+27648,rows=[];
  let good=ok(b,body,3456)&&ok(b,hair,312);
  for(const[base,count,category]of[[body,288,'outfit'],[hair,26,'hair']])for(let i=0;i<count&&good;i++)for(const[view,off,size,width,height]of[['walking',0,9216,32,32],['running',4,2048,32,32],['portrait',8,2048,64,64]]){
   const x=p(b,base+i*12+off);if(!lz(b,x,size)){good=false;break;}
   const female=i>=count/2,slot=i%(count/2)+1,gender=female?'female':'male';
   // The 288 body records are compiled player presets. The separate clothes
   // text catalogue does not prove a one-to-one preset mapping, so it is not
   // guessed here. Hair is a real 13-style-per-gender native table.
   const label=category==='hair'?HAIR_STYLES[slot-1]:'Outfit preset '+slot;
   rows.push({id:rows.length,name:`${female?'Female':'Male'} ${category} · ${label} · ${view}`,bundleName:`${female?'Female':'Male'} ${category} · ${label}`,category,gender,slot,view,width,height,pixelRow:base+i*12+off,paletteAddress:palette+(female?192:0),pixelCompressed:true,paletteInline:true});
  }
  if(good)return{format:'shattered-creator-144',rows};
 }
 return null;
}
