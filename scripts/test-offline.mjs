import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const c={self:{addEventListener(){}},URL};vm.createContext(c);vm.runInContext(fs.readFileSync('dist/sw.js','utf8')+';globalThis.entries=CORE;',c);const entries=new Set(c.entries.map(s=>s.replace(/^\.\//,'')));
for(const file of entries)assert.ok(fs.existsSync('dist/'+file),'Missing offline file: '+file);
for(const file of fs.readdirSync('dist').filter(s=>s.endsWith('.js')))for(const m of fs.readFileSync('dist/'+file,'utf8').matchAll(/(?:from\s*|import\s*)['"]\.\/([^'"]+\.js)['"]/g))assert.ok(entries.has(m[1]),file+' imports uncached '+m[1]);
for(const m of fs.readFileSync('dist/index.html','utf8').matchAll(/(?:src|href)="([^"?#]+\.(?:css|js))"/g))assert.ok(entries.has(m[1]),'HTML references uncached '+m[1]);
console.log(JSON.stringify({pass:true,cachedCoreFiles:entries.size,allModuleImportsAndStylesCached:true}));
