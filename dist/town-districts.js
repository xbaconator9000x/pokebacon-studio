// Layout grammars describe neighbourhoods and street hierarchy, not copied maps.
// Buildings keep their native footprint, collision rules and south-facing doors.
export const CITY_LAYOUTS=[
 {id:'olivine',name:'Olivine · harbour districts',coastal:true,names:['Old town','Civic quarter','Harbour homes'],seats:[[0,0],[1,0],[0,1]],gap:9,stagger:5,park:0,pier:[.30,.72]},
 {id:'vermilion',name:'Vermilion · port neighbourhoods',coastal:true,names:['Residential quarter','Service quarter','Port homes','Harbour square'],gap:11,stagger:3,park:0,pier:[.40,.67]},
 {id:'slateport',name:'Slateport · market and marina',coastal:true,names:['Old town','Civic quarter','Market district','Marina quarter'],gap:13,stagger:0,park:1,pier:[.28,.70]},
 {id:'lilycove',name:'Lilycove · bayside neighbourhoods',coastal:true,names:['Garden homes','Shopping quarter','Old town'],seats:[[0,0],[1,0],[0,1]],gap:12,stagger:7,park:0,pier:[.60]},
 {id:'saffron',name:'Saffron · crossroads and blocks',names:['Northwest neighbourhood','Business quarter','Residential quarter','Civic quarter'],gap:8,stagger:0,park:2},
 {id:'goldenrod',name:'Goldenrod · high street districts',names:['Station neighbourhood','Shopping quarter','Garden homes','Civic quarter','Southside homes','Leisure quarter'],seats:[[0,0],[1,0],[0,1],[1,1],[0,2],[1,2]],gap:10,stagger:6,park:2},
 {id:'celadon',name:'Celadon · gardens and shopping',names:['Garden homes','Shopping quarter','Leisure quarter'],seats:[[0,0],[1,0],[0,1]],gap:13,stagger:4,park:2}
];
export function planDistricts({config,seed,buildings,exits,random,layout='auto'}){
 const coastal=config.biome==='coastal',pool=CITY_LAYOUTS.filter(s=>!coastal||s.coastal),schema=layout==='auto'?pool[Math.floor(random()*pool.length)]:pool.find(s=>s.id===layout);
 if(!schema)throw Error('Choose a layout compatible with this settlement preset.');
 const shuffle=a=>{for(let i=a.length-1;i;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
 const seats=schema.seats||[[0,0],[1,0],[0,1],[1,1]],groups=Array.from({length:seats.length},()=>[]),houses=shuffle(buildings.filter(t=>!t.kind||t.kind==='house'));
 for(const t of buildings.filter(t=>t.kind&&t.kind!=='house')){const d=t.kind==='department-store'||t.kind==='mart'||t.kind==='game-corner'?1:t.kind==='centre'?0:3;groups[Math.min(d,groups.length-1)].push(t);}
 const order=shuffle(groups.map((_,i)=>i));for(const t of houses){const least=Math.min(...groups.map(g=>g.length)),d=order.find(i=>groups[i].length===least);groups[Math.min(d,groups.length-1)].push(t);}
 const districts=groups.map((items,index)=>{
  // A short frontage belongs to a local cluster; it never crosses the whole city.
  const columns=items.length>6?3:2,rowWidth=Math.max(8,items.map(t=>t.w).sort((a,b)=>b-a).slice(0,columns).reduce((n,w)=>n+w+2,0)),rows=[];let row=[],used=0;
  for(const t of shuffle([...items])){if(row.length&&used+t.w+2>rowWidth){rows.push(row);row=[];used=0;}row.push(t);used+=t.w+2;}if(row.length)rows.push(row);
  const plots=[],lanes=[];let y=3;for(let r=0;r<rows.length;r++){const line=rows[r],h=Math.max(...line.map(t=>t.h)),span=line.reduce((n,t)=>n+t.w+2,0)-2,offset=2+Math.floor(random()*Math.max(1,rowWidth-span-2));let x=offset;
   for(const t of line){plots.push({t,x,y:y+h-t.h});x+=t.w+2;}
   lanes.push({x:offset-1,y:y+h+1,w:span+2});y+=h+4;
  }
  return{index,name:schema.names[index],plots,lanes,w:rowWidth+4,h:Math.max(14,y+1)};
 });
 const columnWidths=[0,0],rowHeights=[];for(const d of districts){const[c,r]=seats[d.index];columnWidths[c]=Math.max(columnWidths[c],d.w);rowHeights[r]=Math.max(rowHeights[r]||0,d.h);}const left=columnWidths[0],right=columnWidths[1],top=rowHeights[0],gap=Math.max(7,schema.gap-3+Math.floor(random()*3)),margin=6,stagger=schema.stagger?Math.floor(random()*4)+1:0,width=margin*2+left+gap+right+stagger,height=margin*2+rowHeights.reduce((a,b)=>a+b,0)+gap*(rowHeights.length-1)+stagger+(coastal?15:0),cells=width*height;
 const mirror=random()<.5,plots=[],localLanes=[];
 for(const d of districts){const[c,r]=seats[d.index];d.x=margin+(c?left+gap:0)+(d.index===2?stagger:0);d.y=margin+rowHeights.slice(0,r).reduce((a,b)=>a+b,0)+r*gap+(d.index===1?stagger:0);for(const p of d.plots)plots.push({...p,x:d.x+p.x,y:d.y+p.y,district:d.index});for(const l of d.lanes)localLanes.push({x:d.x+l.x,y:d.y+l.y,w:l.w});}
 const endpoints=exits.map(e=>{const hor=e.edge==='north'||e.edge==='south',n=hor?width:height,p=Math.max(3,Math.min(n-4,Math.round((n-1)*e.position/100)));return{...e,x:hor?p:e.edge==='west'?0:width-1,y:hor?e.edge==='north'?0:height-1:p};});
 for(let i=0;i<endpoints.length;i++)for(let j=0;j<i;j++)if(Math.abs(endpoints[i].x-endpoints[j].x)+Math.abs(endpoints[i].y-endpoints[j].y)<6)throw Error('Leave six tiles between exits.');
 const blocked=new Uint8Array(cells);for(const p of plots)for(let y=p.y;y<p.y+p.t.h;y++)for(let x=p.x;x<p.x+p.t.w;x++)blocked[y*width+x]=1;
 const water=new Set(),shore=[];
 if(coastal){for(let x=0;x<width;x++){const u=x/width,variation=schema.id==='lilycove'?(u>.65?-5:u<.25?1:0):schema.id==='olivine'?(u>.60?-3:u<.32?2:0):schema.id==='slateport'?(u<.30?-2:u>.68?1:0):(u>.32&&u<.70?-3:1),bay=['olivine','lilycove'].includes(schema.id)&&x>margin+left+gap+2,y=bay?margin+top+gap+4:height-12+variation;shore[x]=y;for(let yy=y;yy<height;yy++)water.add(yy*width+x);}}
 const road=new Set(),spine=new Set(),add=(x,y,target=road)=>{if(x>=0&&y>=0&&x<width&&y<height&&!blocked[y*width+x])target.add(y*width+x);},line=(x,y,xx,yy,target=road)=>{while(x!==xx||y!==yy){add(x,y,target);if(x!==xx)x+=Math.sign(xx-x);else y+=Math.sign(yy-y);}add(x,y,target);};
 const cx=margin+left+Math.floor(gap/2),cy=margin+top+Math.floor(gap/2),plaza={x:cx-3,y:cy-3,w:7+(schema.id==='slateport'?4:0),h:7};
 // Main avenues meet at a civic / market square, then bend towards the waterfront.
 line(cx,margin-2,cx,cy,spine);line(cx,cy,cx+(schema.id==='goldenrod'?3:0),height-(coastal?15:margin),spine);
 if(schema.id==='saffron'){line(margin-2,cy,cx,cy,spine);line(cx,cy,width-margin+1,cy,spine);}else{line(cx-3,cy,cx+3,cy,spine);}
 if(coastal){for(let x=margin;x<width-margin;x++){const y=shore[x]-3,yy=shore[x+1]-3;if(yy<y){line(x,y,x,yy,spine);line(x,yy,x+1,yy,spine);}else line(x,y,x+1,yy,spine);}line(cx,cy,cx,shore[cx]-3,spine);}
 for(const i of spine)road.add(i);for(let y=plaza.y;y<plaza.y+plaza.h;y++)for(let x=plaza.x;x<plaza.x+plaza.w;x++)add(x,y);
 // Connect one district street at a time to the existing network. This avoids a
 // regular lattice and keeps gardens between neighbourhoods rather than per-lot squares.
 const connect=n=>{const start=n.y*width+n.x,prev=new Int32Array(cells).fill(-2),queue=[start];prev[start]=-1;let end=null;
  for(let at=0;at<queue.length;at++){const i=queue[at];if(road.has(i)){end=i;break;}const x=i%width,y=Math.floor(i/width);for(const[dx,dy]of[[0,1],[1,0],[-1,0],[0,-1]]){const xx=x+dx,yy=y+dy,j=yy*width+xx;if(xx<0||yy<0||xx>=width||yy>=height||blocked[j]||prev[j]!==-2||((xx===0||yy===0||xx===width-1||yy===height-1)&&j!==start)||water.has(j)&&!n.exit)continue;prev[j]=i;queue.push(j);}}
  if(end===null)throw Error('A district cannot reach the main street.');for(let i=end;i!==-1;i=prev[i])road.add(i);
 };
 for(const l of localLanes){connect({x:l.x+Math.floor(l.w/2),y:l.y});line(l.x,l.y,l.x+l.w-1,l.y);}
 for(const p of plots)for(const e of p.t.entrances?.length?p.t.entrances:[{x:Math.floor(p.t.w/2)}])connect({x:p.x+e.x,y:p.y+p.t.h});
 if(!mirror)for(const e of endpoints)connect({...e,exit:true});
 // Piers start at the promenade; they are deliberate walkable structures over water.
 if(coastal)for(const u of schema.pier){const x=Math.round(width*u),y=shore[x]-3;line(x,y,x,Math.min(height-4,shore[x]+6));}
 const paved=new Set();for(const i of [...road]){const x=i%width,y=Math.floor(i/width);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const j=(y+dy)*width+x+dx;if(!water.has(i)&&water.has(j))continue;add(x+dx,y+dy,paved);}}for(const i of paved)road.add(i);
 for(const i of [...road]){const x=i%width,y=Math.floor(i/width);if((x===0||y===0||x===width-1||y===height-1)&&!endpoints.some(e=>Math.abs(e.x-x)+Math.abs(e.y-y)<=1))road.delete(i);}
 const docks=new Set([...road].filter(i=>water.has(i))),parks=[{x:margin+1,y:margin+top+2,w:Math.max(6,left-4),h:Math.max(4,gap-4)},{x:cx+5,y:margin,w:Math.max(5,gap-6),h:Math.max(6,top-4)}];
 // Mirror complete topology together, preserving south-facing building artwork.
 if(mirror){for(const p of plots)p.x=width-p.x-p.t.w;for(const d of districts)d.x=width-d.x-d.w;for(const e of endpoints){e.x=width-1-e.x;e.edge=e.edge==='west'?'east':e.edge==='east'?'west':e.edge;e.position=['north','south'].includes(e.edge)?100-e.position:e.position;}for(const p of parks)p.x=width-p.x-p.w;plaza.x=width-plaza.x-plaza.w;for(const set of[road,spine,water,docks]){const v=[...set];set.clear();for(const i of v)set.add(Math.floor(i/width)*width+width-1-i%width);}
  // Door positions are local to artwork, so re-route approaches after mirroring.
  blocked.fill(0);for(const p of plots)for(let y=p.y;y<p.y+p.t.h;y++)for(let x=p.x;x<p.x+p.t.w;x++)blocked[y*width+x]=1;
  for(const p of plots)for(const e of p.t.entrances?.length?p.t.entrances:[{x:Math.floor(p.t.w/2)}]){const x=p.x+e.x,y=p.y+p.t.h;connect({x,y});}
 }
 // User-selected exits keep their exact edges and percentages, even on mirrored seeds.
 if(mirror){for(let i=0;i<endpoints.length;i++){const e=exits[i],hor=['north','south'].includes(e.edge),n=hor?width:height,p=Math.max(3,Math.min(n-4,Math.round((n-1)*e.position/100)));Object.assign(endpoints[i],e,{x:hor?p:e.edge==='west'?0:width-1,y:hor?e.edge==='north'?0:height-1:p});connect({...endpoints[i],exit:true});}for(const i of [...road]){const x=i%width,y=Math.floor(i/width);if((x===0||y===0||x===width-1||y===height-1)&&!endpoints.some(e=>Math.abs(e.x-x)+Math.abs(e.y-y)<=1))road.delete(i);}for(const i of road)if(water.has(i))docks.add(i);}
 for(const e of endpoints)for(const delta of[-1,0,1]){const hor=['north','south'].includes(e.edge),x=e.x+(hor?delta:0),y=e.y+(hor?0:delta);connect({x,y,exit:true});}for(const i of road)if(water.has(i))docks.add(i);
 return{...config,width,height,plots,road,exits:endpoints,random,layoutSample:'district-'+schema.id,layoutName:schema.name,districts:districts.map(({index,name,x,y,w,h})=>({index,name,x,y,w,h})),plazas:[plaza],parks,water,docks,urban:true,clustered:true,frontRows:[]};
}
