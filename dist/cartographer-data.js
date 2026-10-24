import {load,JSON_SCHEMA,Type} from './vendor/js-yaml/js-yaml.mjs';
const integer=(n,min,max)=>Number.isInteger(n)&&n>=min&&n<=max;
const ruby=new Type('!ruby/object:',{kind:'mapping',multi:true,construct:(data,tag)=>({...data,$class:tag.slice(13)})});
const binary=new Type('!binary',{kind:'scalar',construct:s=>new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g,'')),c=>c.charCodeAt(0)))});
const schema=JSON_SCHEMA.extend([ruby,binary]);
export function cartographerYAML(text){
 if(typeof text!=='string'||text.length>32*1024*1024)throw Error('Cartographer YAML exceeds 32 MB.');
 text=text.replace(/\r\n?/g,'\n');
 if((text.match(/(?:^|\s)[*&][\w-]+/g)||[]).length>20000)throw Error('Too many YAML references.');
 const result=load(text.replace(/^(\s*-\s+)([0-9a-fA-F]{4}(?:[ \t]+[0-9a-fA-F]{4})*)[ \t]*$/gm,(_,prefix,row)=>prefix+JSON.stringify(row)),{schema,json:false});
 const active=new WeakSet(),seen=new WeakSet();let nodes=0;function check(value,depth=0){if(!value||typeof value!=='object')return;if(depth>96||++nodes>1500000)throw Error('YAML object graph exceeds limits.');if(active.has(value))throw Error('Cyclic YAML references are unsupported.');if(seen.has(value))return;active.add(value);for(const key of Object.keys(value)){if(['__proto__','constructor','prototype'].includes(key))throw Error('Unsafe YAML key.');check(value[key],depth+1);}active.delete(value);seen.add(value);}check(result);return result;
}
export function cartographerTable(table,{width,height,depth}={}){
 if(!table||!integer(table.x,1,65536)||!integer(table.y??1,1,512)||!integer(table.z??1,1,3))throw Error('Invalid RPG Maker tile table.');
 const x=table.x,y=table.y??1,z=table.z??1,total=x*y*z;if(total>1200000||width!==undefined&&width!==x||height!==undefined&&height!==y||depth!==undefined&&depth!==z)throw Error('RPG Maker table dimensions do not match the map.');
 let values;
 if(table.$dump){const b=table.$dump,v=new DataView(b.buffer,b.byteOffset,b.byteLength);if(b.length<20||v.getUint32(4,true)!==x||v.getUint32(8,true)!==y||v.getUint32(12,true)!==z||v.getUint32(16,true)!==total||b.length!==20+total*2)throw Error('Invalid binary RPG Maker table.');values=Array.from({length:total},(_,i)=>v.getUint16(20+i*2,true));}
 else {const rows=Array.isArray(table.data)?table.data:[table.data];values=rows.flatMap(row=>{if(typeof row==='number'){if(!integer(row,0,65535))throw Error('Invalid table value.');return[row];}if(typeof row!=='string'||!/^[\da-fA-F\s]+$/.test(row))throw Error('Invalid hexadecimal tile row.');return row.trim().split(/\s+/).map(n=>{if(!/^[\da-fA-F]{4}$/.test(n))throw Error('Use four-digit hexadecimal tile IDs.');return parseInt(n,16);});});}
 if(values.length!==total)throw Error('RPG Maker table has missing or extra cells.');return values;
}
// Ruby Marshal is decoded as inert data. No Ruby classes, hooks or scripts run.
export function readRPGMarshal(input){
 const b=input instanceof Uint8Array?input:new Uint8Array(input);let at=2,nodes=0;const symbols=[],objects=[];
 if(b.length>32*1024*1024||b[0]!==4||b[1]!==8)throw Error('Use an RPG Maker XP Marshal 4.8 file.');
 const byte=()=>{if(at>=b.length)throw Error('Truncated RPG Maker data.');return b[at++];};
 function long(){let c=byte();if(c>127)c-=256;if(!c)return 0;if(c>4)return c-5;if(c< -4)return c+5;const count=Math.abs(c);let n=c<0?-1:0;for(let i=0;i<count;i++)n=(n&~(255<<(8*i)))|byte()<<(8*i);return n;}
 function raw(){const n=long();if(n<0||n>32*1024*1024||at+n>b.length)throw Error('Invalid Ruby string size.');const v=b.slice(at,at+n);at+=n;return v;}
 const text=v=>new TextDecoder().decode(v);
 function read(depth=0){if(++nodes>1000000||depth>96)throw Error('RPG Maker object graph exceeds limits.');const t=String.fromCharCode(byte());
  if(t==='0')return null;if(t==='T')return true;if(t==='F')return false;if(t==='i')return long();
  if(t===':'){const s=text(raw());symbols.push(s);return s;}if(t===';'){const i=long();if(!integer(i,0,symbols.length-1))throw Error('Invalid Ruby symbol reference.');return symbols[i];}
  if(t==='@'){const i=long();if(!integer(i,0,objects.length-1))throw Error('Invalid Ruby object reference.');return objects[i];}
  if(t==='"'){const s=text(raw());objects.push(s);return s;}
  if(t==='I'){const value=read(depth+1),n=long();if(n<0||n>1024)throw Error('Invalid Ruby attributes.');for(let i=0;i<n;i++){read(depth+1);read(depth+1);}return value;}
  if(t==='['){const n=long();if(n<0||n>400000)throw Error('Ruby array exceeds limits.');const a=[];objects.push(a);for(let i=0;i<n;i++)a.push(read(depth+1));return a;}
  if(t==='{'||t==='}'){const n=long();if(n<0||n>100000)throw Error('Ruby hash exceeds limits.');const o=Object.create(null);objects.push(o);for(let i=0;i<n;i++){const k=read(depth+1);if(!['number','string'].includes(typeof k)||['__proto__','constructor','prototype'].includes(k))throw Error('Unsafe Ruby hash key.');o[k]=read(depth+1);}if(t==='}')read(depth+1);return o;}
  if(t==='o'){const cls=read(depth+1),o=Object.create(null);o.$class=cls;objects.push(o);const n=long();if(n<0||n>1024)throw Error('Ruby object exceeds limits.');for(let i=0;i<n;i++){const key=String(read(depth+1)).replace(/^@/,'');if(['__proto__','constructor','prototype'].includes(key))throw Error('Unsafe Ruby field.');o[key]=read(depth+1);}return o;}
  if(t==='u'){const cls=read(depth+1),dump=raw(),o={$class:cls,$dump:dump};objects.push(o);if(cls!=='Table')throw Error('Unsupported Ruby binary object: '+cls);if(dump.length<20)throw Error('Truncated Ruby Table.');const v=new DataView(dump.buffer);Object.assign(o,{dim:v.getUint32(0,true),x:v.getUint32(4,true),y:v.getUint32(8,true),z:v.getUint32(12,true)});return o;}
  throw Error('Unsupported Ruby data type '+t+'. Use unpacked YAML instead.');
 }
 const result=read();if(at!==b.length)throw Error('Extra bytes after RPG Maker data.');return result;
}
export function parseCartographerMaps(entries){
 const maps=[];let total=0;for(const[path,bytes]of entries){const match=/(?:^|\/)Map(\d+)\.ya?ml$/i.exec(path);if(!match)continue;const source=cartographerYAML(new TextDecoder().decode(bytes)),id=+match[1],width=source.width,height=source.height;if(!integer(id,1,99999)||!integer(width,1,512)||!integer(height,1,512))throw Error('Invalid dimensions in '+path);if((total+=width*height)>400000)throw Error('This region exceeds the 400,000-tile project budget. Import a smaller region.');const cells=cartographerTable(source.data,{width,height,depth:3});if(maps.some(m=>m.id===id))throw Error('Duplicate Cartographer map ID '+id);maps.push({id,width,height,tilesetId:source.tileset_id,cells,events:source.events||{},bgm:source.bgm?.name||'',source});}
 if(!maps.length)throw Error('No MapXXX.yaml files found. Choose Cartographer’s generated project files, not its application download.');return maps.sort((a,b)=>a.id-b.id);
}
export function parseCartographerConnections(text){
 const rows=[];for(const raw of text.split(/\r?\n/)){const line=raw.replace(/#.*/,'').trim();if(!line)continue;const p=line.split(',').map(s=>s.trim());if(p.length!==6||![p[0],p[2],p[3],p[5]].every(n=>/^\d+$/.test(n))||!['North','South','East','West'].includes(p[1])||!['North','South','East','West'].includes(p[4]))throw Error('Invalid Cartographer connection: '+line);const opposite={North:'South',South:'North',East:'West',West:'East'};if(opposite[p[1]]!==p[4])throw Error('Connection edges are not opposites.');rows.push({from:+p[0],to:+p[3],direction:p[1].toLowerCase(),offset:+p[2]-+p[5]});}return rows;
}
