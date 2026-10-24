#!/usr/bin/env python3
"""Update web assets in an already signed native shell, then align and sign.

Refuses changed native Java/resources. Use build.py for native changes.
Requires the official Android build tools, the existing signing key, and a
base source commit corresponding to the base APK. Never pass passwords on argv.
"""
import argparse, hashlib, os, re, struct, subprocess, tempfile, zipfile
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parent.parent

def manifest_version(data, version_name=None, version_code=None):
    data=bytearray(data);strings=[];offsets=[];utf8=False;code_at=name_index=None
    pos=8
    def length(at,wide=False):
        if wide:
            n=struct.unpack_from('<H',data,at)[0]
            return (((n&0x7fff)<<16)|struct.unpack_from('<H',data,at+2)[0],at+4) if n&0x8000 else (n,at+2)
        n=data[at];return (((n&127)<<8)|data[at+1],at+2) if n&128 else (n,at+1)
    while pos+8<=len(data):
        kind,header,size=struct.unpack_from('<HHI',data,pos)
        if size<8 or pos+size>len(data):raise ValueError('Invalid binary manifest chunk')
        if kind==1:
            count,styles,flags,start=struct.unpack_from('<IIII',data,pos+8);utf8=bool(flags&256)
            for i in range(count):
                at=pos+start+struct.unpack_from('<I',data,pos+header+i*4)[0]
                n,at=length(at,not utf8)
                if utf8:n,at=length(at)
                raw=bytes(data[at:at+n*(1 if utf8 else 2)])
                strings.append(raw.decode('utf-8' if utf8 else 'utf-16le'));offsets.append((at,len(raw)))
        if kind==0x102 and strings[struct.unpack_from('<I',data,pos+20)[0]]=='manifest':
            start,stride,count=struct.unpack_from('<HHH',data,pos+24)
            for i in range(count):
                at=pos+16+start+i*stride;name=strings[struct.unpack_from('<I',data,at+4)[0]]
                if name=='versionCode':
                    if data[at+15] not in (0x10,0x11):raise ValueError('Unexpected version code encoding')
                    code_at=at+16
                if name=='versionName':
                    if data[at+15]!=3:raise ValueError('Unexpected version name encoding')
                    name_index=struct.unpack_from('<I',data,at+16)[0]
        pos+=size
    if code_at is None or name_index is None:raise ValueError('Manifest version fields missing')
    old=(strings[name_index],struct.unpack_from('<I',data,code_at)[0])
    if version_name is not None:
        at,n=offsets[name_index];raw=version_name.encode('utf-8' if utf8 else 'utf-16le')
        if len(raw)!=n:raise ValueError('This asset-only builder requires equal-length version names; use build.py otherwise')
        data[at:at+n]=raw;struct.pack_into('<I',data,code_at,version_code)
    return bytes(data),old

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--base-apk',required=True,type=Path);parser.add_argument('--base-commit',required=True);parser.add_argument('--build-tools',required=True,type=Path);args=parser.parse_args()
    if not re.fullmatch('[a-f0-9]{40}',args.base_commit):raise ValueError('Use a full source commit')
    subprocess.run(['git','diff','--exit-code',args.base_commit,'--','android/src','android/res'],cwd=ROOT,check=True,stdout=subprocess.DEVNULL)
    attrs=ET.parse(ROOT/'android/AndroidManifest.xml').getroot().attrib;ns='{http://schemas.android.com/apk/res/android}'
    version=attrs[ns+'versionName'];code=int(attrs[ns+'versionCode']);out=ROOT/'dist'/f'PokeBacon_Studio_v{version}.apk'
    bt=args.build_tools.resolve();env=os.environ.copy()
    signer=['java','-jar',str(bt/'lib/apksigner.jar')]
    def run(cmd,**kw):return subprocess.run([str(a) for a in cmd],check=True,**kw)
    def certificate(file):
        result=run(signer+['verify','--print-certs',file],capture_output=True,text=True).stdout
        return re.findall(r'certificate SHA-256 digest: ([a-fA-F0-9]+)',result)
    native={};assets={}
    with tempfile.TemporaryDirectory(prefix='pokebacon-apk-') as temp:
        temp=Path(temp);unsigned=temp/'unsigned.apk';aligned=temp/'aligned.apk'
        with zipfile.ZipFile(args.base_apk) as base,zipfile.ZipFile(unsigned,'w',zipfile.ZIP_DEFLATED) as target:
            for item in base.infolist():
                if item.filename.startswith(('assets/','META-INF/')):continue
                data=base.read(item);native[item.filename]=data
                if item.filename=='AndroidManifest.xml':
                    data,old=manifest_version(data,version,code)
                    if code<=old[1]:raise ValueError('Version code must advance')
                target.writestr(item,data)
            for file in sorted((ROOT/'dist').rglob('*')):
                relative=file.relative_to(ROOT/'dist')
                if relative.parts[0]=='examples' or not file.is_file() or any(p.startswith('.') for p in relative.parts) or file.suffix in ('.apk','.idsig'):continue
                name='assets/'+relative.as_posix();data=file.read_bytes();assets[name]=hashlib.sha256(data).digest();target.writestr(name,data)
        run([bt/'zipalign','-f','-p','4',unsigned,aligned])
        run(signer+['sign','--ks',env['MAP_STUDIO_KEYSTORE'],'--ks-key-alias',env['MAP_STUDIO_KEY_ALIAS'],'--ks-pass','env:MAP_STUDIO_KEY_PASSWORD','--key-pass','env:MAP_STUDIO_KEY_PASSWORD','--v4-signing-enabled','false','--out',out,aligned],env=env,capture_output=True)
        cert=certificate(out)
        if not cert or cert!=certificate(args.base_apk):raise ValueError('Signing certificate changed')
        run([bt/'zipalign','-c','4',out],capture_output=True)
        with zipfile.ZipFile(out) as apk:
            assert manifest_version(apk.read('AndroidManifest.xml'))[1]==(version,code)
            for name,data in native.items():
                if name!='AndroidManifest.xml':assert apk.read(name)==data,name
            assert {n for n in apk.namelist() if n.startswith('assets/')}==set(assets)
            for name,digest in assets.items():assert hashlib.sha256(apk.read(name)).digest()==digest,name
    print(f'APK verified: {out.name}; version {version} ({code}); {len(assets)} matching assets; native code/resources and certificate unchanged; {out.stat().st_size:,} bytes')
if __name__=='__main__':main()
