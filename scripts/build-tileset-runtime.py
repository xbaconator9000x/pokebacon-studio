"""Rebuild the tileset animation runtime with the official GNU Arm toolchain."""
import base64,json,os,re,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parent.parent;out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
prefix=os.environ.get('ARM_PREFIX','arm-none-eabi');elf=out/'tileset.elf';binary=out/'tileset.bin'
args=['-mthumb','-mcpu=arm7tdmi','-Os','-ffreestanding','-fno-builtin','-fno-unwind-tables','-fno-asynchronous-unwind-tables','-fomit-frame-pointer','-fno-stack-protector','-ffunction-sections','-fdata-sections','-nostdlib','-Wl,--emit-relocs','-Wl,--gc-sections','-Wl,-T,'+str(root/'dist/native-source/tileset-runtime.ld')]
subprocess.run([prefix+'-gcc',*args,str(root/'dist/native-source/tileset-runtime.c'),'-lgcc','-o',str(elf)],check=True);subprocess.run([prefix+'-objcopy','-O','binary',str(elf),str(binary)],check=True)
symbols={}
for line in subprocess.check_output([prefix+'-nm','-n',str(elf)],text=True).splitlines():
 m=re.match(r'([0-9a-f]+)\s+[TtRrDd]\s+(\S+)',line)
 if m:symbols[m[2]]=int(m[1],16)
relocations=[]
for line in subprocess.check_output([prefix+'-readelf','-rW',str(elf)],text=True).splitlines():
 m=re.match(r'([0-9a-f]+)\s+[0-9a-f]+\s+(R_ARM_\w+)',line)
 if m:
  if m[2]=='R_ARM_ABS32':relocations.append(int(m[1],16))
  elif m[2] not in ['R_ARM_THM_CALL','R_ARM_THM_JUMP11','R_ARM_THM_JUMP8','R_ARM_JUMP24','R_ARM_CALL','R_ARM_V4BX','R_ARM_PREL31']:raise RuntimeError('Unaudited relocation: '+line)
data=binary.read_bytes()
for at in relocations:
 if int.from_bytes(data[at:at+4],'little')>=len(data):raise RuntimeError('Relocation outside runtime')
config=re.search(r'typedef struct \{u32 (magic,[^}]+)\} Config;', (root/'dist/native-source/tileset-runtime.c').read_text()).group(1).rstrip(';').split(',')
print('export const TILESET_RUNTIME='+json.dumps({'version':1,'bytes':base64.b64encode(data).decode(),'relocations':sorted(set(relocations)),'symbols':symbols,'configFields':config},separators=(',',':'))+';')
