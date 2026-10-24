#!/usr/bin/env python3
"""Rebuild the pinned Expanded FireRed engine privately from a supplied base ROM."""
import argparse, hashlib, os, shutil, subprocess, tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
DONORS=[('dpe','Shiny-Miner/Dynamic-Pokemon-Expansion-Gen-9','d60fab11918abe5ac666fa1db50697bade35d612','dpe-arm7.patch'),('cfru','Shiny-Miner/CFRU-expansion','ee26cd152e9daf6e7ec0a39f66cd7d2cf489bc62','cfru-studio.patch')]
def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('--rom',type=Path,required=True);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
 data=a.rom.read_bytes()
 if hashlib.sha256(data).hexdigest()!='3d0c79f1627022e18765766f6cb5ea067f6b5bf7dca115552189ad65a5c3a8ac':raise SystemExit('Use clean FireRed USA 1.0 (BPRE).')
 if a.output.exists():raise SystemExit('Choose a new output filename.')
 for tool in ['git','arm-none-eabi-gcc','arm-none-eabi-as','arm-none-eabi-ld','arm-none-eabi-objcopy','grit','wav2agb']:
  if not shutil.which(tool):raise SystemExit('Missing build tool: '+tool)
 with tempfile.TemporaryDirectory(prefix='pokebacon-engine-') as tmp:
  for name,repo,commit,patch in DONORS:
   dest=Path(tmp)/name;subprocess.run(['git','init',str(dest)],check=True,stdout=subprocess.DEVNULL)
   subprocess.run(['git','-C',str(dest),'fetch','--depth','1','https://github.com/'+repo+'.git',commit],check=True)
   subprocess.run(['git','-C',str(dest),'checkout','--detach','FETCH_HEAD'],check=True,stdout=subprocess.DEVNULL)
   subprocess.run(['git','-C',str(dest),'apply',str(ROOT/'scripts/engine-patches'/patch)],check=True)
   if name=='cfru':shutil.copyfile(ROOT/'scripts/engine-patches/studio_save.c',dest/'src/studio_save.c')
   (dest/'BPRE0.gba').write_bytes(data)
   result=subprocess.run([os.sys.executable,'scripts/make.py'],cwd=dest,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
   print(result.stdout)
   if result.returncode or any(s in result.stdout.lower() for s in ['fatal error:','symbol missing:','there was an error','error compiling']):raise SystemExit('Engine build failed. No output written.')
   product=dest/'test.gba'
   if not product.is_file():raise SystemExit('Engine build produced no ROM.')
   data=product.read_bytes()
  a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_bytes(data)
  print('Candidate saved:',a.output,'\nSHA256:',hashlib.sha256(data).hexdigest())
  print('Validate with the native fixture test and emulator before making a distributable patch.')
if __name__=='__main__':main()
