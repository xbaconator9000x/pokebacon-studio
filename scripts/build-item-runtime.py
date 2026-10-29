from pathlib import Path
import subprocess,json,struct
root=Path('..').resolve();tc=root/'native-toolchain/usr/bin';out=Path('build/item-runtime');out.mkdir(exist_ok=True,parents=True)
subprocess.run([str(tc/'arm-none-eabi-gcc'),'-B'+str(root/'native-toolchain/usr/lib/arm-none-eabi/bin')+'/', '-mcpu=arm7tdmi','-mthumb','-Os','-fno-builtin','-ffreestanding','-nostdlib','-fno-unwind-tables','-fno-asynchronous-unwind-tables','-Wl,-Ttext=0x08000000','-Wl,--entry=PBItem_Sanitize','native/item-runtime.c','native/item-runtime-config.S','-o',str(out/'runtime.elf')],check=True)
subprocess.run([str(tc/'arm-none-eabi-objcopy'),'-O','binary',str(out/'runtime.elf'),str(out/'runtime.bin')],check=True)
symbols={v[2]:(int(v[0],16)&~1)-0x08000000 for l in subprocess.check_output([str(tc/'arm-none-eabi-nm'),'-n',str(out/'runtime.elf')],text=True).splitlines()if len(v:=l.split())==3 and (v[2].startswith('PBItem_')or v[2]=='pbItemConfig')}
b=(out/'runtime.bin').read_bytes();relocations=[i for i in range(0,len(b)-3,4)if 0x08000000<=struct.unpack_from('<I',b,i)[0]<0x08000000+len(b)];data={'version':2,'linkBase':0x08000000,'bytes':b.hex(),'offsets':symbols,'relocations':relocations};Path('dist/item-runtime-data.js').write_text('export const ITEM_RUNTIME='+json.dumps(data,separators=(',',':'))+';\n');print('native item runtime',len(b),'bytes',symbols,'relocations',len(relocations))
