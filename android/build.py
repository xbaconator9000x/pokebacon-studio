#!/usr/bin/env python3
"""Build the offline Android APK using the official Android SDK and JDK 17.

ANDROID_SDK_ROOT must contain platforms/android-35 and build-tools/35.0.0.
Set MAP_STUDIO_KEYSTORE, MAP_STUDIO_KEY_ALIAS, and MAP_STUDIO_KEY_PASSWORD.
No Gradle, Maven dependencies, internet connection, or framework is required.
"""
import os, shutil, subprocess, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
SDK=Path(os.environ['ANDROID_SDK_ROOT'])
BT=SDK/'build-tools/35.0.0'
if not BT.exists(): BT=SDK/'android-15'
PLATFORM=SDK/'platforms/android-35/android.jar'
if not PLATFORM.exists(): PLATFORM=SDK/'android-35/android.jar'
BUILD=ROOT/'android/build'
ASSETS=ROOT/'android/web-assets'
manifest=ROOT/'android/AndroidManifest.xml'
metadata=ET.parse(manifest).getroot()
android='{http://schemas.android.com/apk/res/android}'
version_code=metadata.attrib[android+'versionCode']
version_name=metadata.attrib[android+'versionName']
shutil.rmtree(BUILD,ignore_errors=True);BUILD.mkdir()
shutil.rmtree(ASSETS,ignore_errors=True)
shutil.copytree(ROOT/'dist',ASSETS,ignore=shutil.ignore_patterns('*.apk','*.idsig','examples'))

def run(*args):
    subprocess.run([str(x) for x in args],check=True)

for tool in ['aapt2','d8','zipalign','apksigner']:
    p=BT/tool;p.chmod(p.stat().st_mode|0o111)
run(BT/'aapt2','compile','--dir',ROOT/'android/res','-o',BUILD/'compiled.zip')
run(BT/'aapt2','link','-o',BUILD/'base.apk','-I',PLATFORM,'--manifest',manifest,'--min-sdk-version','26','--target-sdk-version','35','--version-code',version_code,'--version-name',version_name,'-A',ASSETS,BUILD/'compiled.zip')
(BUILD/'classes').mkdir()
java_sources=sorted((ROOT/'android/src').rglob('*.java'))
if shutil.which('javac'):
    run('javac','-source','8','-target','8','-Xlint:-options','-classpath',PLATFORM,'-d',BUILD/'classes',*java_sources)
else:
    compiler=Path(os.environ['MAP_STUDIO_ECJ_JAR'])
    run('java','-jar',compiler,'-source','8','-target','8','-nowarn','-classpath',PLATFORM,'-d',BUILD/'classes',*java_sources)
run(BT/'d8','--lib',PLATFORM,'--min-api','26','--output',BUILD,*sorted((BUILD/'classes').rglob('*.class')))
with zipfile.ZipFile(BUILD/'base.apk','a',compression=zipfile.ZIP_DEFLATED) as apk:apk.write(BUILD/'classes.dex','classes.dex')
run(BT/'zipalign','-f','-p','4',BUILD/'base.apk',BUILD/'aligned.apk')
out=ROOT/'dist'/f'PokeBacon_Studio_v{version_name}.apk'
run(BT/'apksigner','sign','--ks',os.environ['MAP_STUDIO_KEYSTORE'],'--ks-key-alias',os.environ.get('MAP_STUDIO_KEY_ALIAS','mapstudio'),'--ks-pass','env:MAP_STUDIO_KEY_PASSWORD','--key-pass','env:MAP_STUDIO_KEY_PASSWORD','--v4-signing-enabled','false','--out',out,BUILD/'aligned.apk')
run(BT/'apksigner','verify','--verbose',out)
run(BT/'zipalign','-c','4',out)
print(f'APK: {out} ({out.stat().st_size:,} bytes)')
