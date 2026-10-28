import fs from 'node:fs';
import {createHash} from 'node:crypto';

// Prevent legacy GitHub code passing QA as if it were the user's newer APK.
const info=JSON.parse(fs.readFileSync('qa/recovery-466-manifest.json','utf8'));
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const parse=s=>String(s).split('.').map(n=>Number(n)||0);
const cmp=(a,b)=>{const x=parse(a),y=parse(b);for(let i=0;i<3;i++)if((x[i]||0)!==(y[i]||0))return (x[i]||0)>(y[i]||0)?1:-1;return 0;};
const version=pkg.version;
const failures=[];
if(cmp(version,info.release)<0) failures.push('Repository version '+version+' predates recovered Studio '+info.release+'. Synchronise production sources FIRST.');
if(version===info.release){
  for(const [path,hash] of Object.entries(info.expected_sha256)){
    if(!fs.existsSync(path)){failures.push('Missing '+path);continue;}
    const actual=createHash('sha256').update(fs.readFileSync(path)).digest('hex');
    if(actual!==hash)failures.push('4.66 source mismatch: '+path+' (actual '+actual+')');
  }
}else if(cmp(version,info.release)>0){
  console.log('Version '+version+' is newer than the 4.66 recovery baseline; individual 4.66 file fingerprints are not release gates for newer versions.');
}
if(failures.length){for(const error of failures)console.error('SOURCE NOT READY: '+error);process.exitCode=1;}
else console.log('Source version gate PASSED: '+version+'. This does not verify Android native code, signing, physical devices or real-ROM fixtures.');
