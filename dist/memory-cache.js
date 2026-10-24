// Weighted LRU with a working set: active map images survive thumbnail browsing.
export class MemoryCache{
 constructor(maxBytes=64*1024*1024){this.maxBytes=maxBytes;this.entries=new Map();this.bytes=0;this.pinned=new Set();this.hits=0;this.misses=0;}
 has(id){return this.entries.has(id);}get size(){return this.entries.size;}
 get(id){const item=this.entries.get(id);if(!item){this.misses++;return undefined;}this.hits++;this.entries.delete(id);this.entries.set(id,item);return item.value;}
 set(id,value,bytes=value.width*value.height*4){this.delete(id);this.entries.set(id,{value,bytes});this.bytes+=bytes;this.trim(id);return this;}
 delete(id){const item=this.entries.get(id);if(!item)return false;this.bytes-=item.bytes;return this.entries.delete(id);}
 clear(){this.entries.clear();this.bytes=0;this.pinned.clear();}
 protect(ids){this.pinned=new Set(ids);this.trim();}
 trim(keep=null){for(const [id]of this.entries){if(this.bytes<=this.maxBytes)break;if(id!==keep&&!this.pinned.has(id))this.delete(id);}}
 stats(){return{bytes:this.bytes,budget:this.maxBytes,images:this.size,pinned:this.pinned.size,hits:this.hits,misses:this.misses};}
}
