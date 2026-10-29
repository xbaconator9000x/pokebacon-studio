#!/usr/bin/env python3
"""Overlay the music update on the supplied 4.69.2 native APK shell.

Requires Android zipalign/apksigner, a local signing JSON and its PKCS12 key.
Secrets are read locally and are never placed in the output. Does not replace
the rest of the supplied app's assets with an older repository snapshot.
"""
import argparse, hashlib, importlib.util, json, os, struct, subprocess, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MUSIC = ['music-motifs.js', 'music-quick-presets.js', 'music-quick-ui.js', 'music-ui.js', 'music-track-style.js', 'music-track-development.js']

def rewrite_strings(data, replacements):
    data = bytearray(data)
    pos = 8
    while pos < len(data):
        kind, header, size = struct.unpack_from('<HHI', data, pos)
        if kind == 1:
            count, styles, flags, start, _ = struct.unpack_from('<IIIII', data, pos + 8)
            assert styles == 0 and not flags & 256, 'Expected UTF16 unstyled manifest'
            strings = []
            for i in range(count):
                at = pos + start + struct.unpack_from('<I', data, pos + header + i * 4)[0]
                n = struct.unpack_from('<H', data, at)[0]
                assert n < 0x8000
                s = bytes(data[at + 2:at + 2 + n * 2]).decode('utf-16le')
                strings.append(replacements.get(s, s))
            raw, offsets = bytearray(), []
            for s in strings:
                offsets.append(len(raw))
                b = s.encode('utf-16le')
                raw += struct.pack('<H', len(b) // 2) + b + b'\0\0'
            raw += b'\0' * (-len(raw) % 4)
            chunk = bytearray(data[pos:pos + header])
            struct.pack_into('<I', chunk, 4, header + 4 * count + len(raw))
            struct.pack_into('<I', chunk, 20, header + 4 * count)
            chunk += struct.pack('<' + 'I' * count, *offsets) + raw
            data[pos:pos + size] = chunk
            struct.pack_into('<I', data, 4, len(data))
            return bytes(data)
        pos += size
    raise ValueError('Missing manifest strings')

def main():
    p = argparse.ArgumentParser(description=__doc__)
    for name in ['base-apk', 'signing-json', 'keystore', 'zipalign', 'apksigner-jar', 'output-dir']:
        p.add_argument('--' + name, required=True, type=Path)
    a = p.parse_args()
    cfg = json.loads(a.signing_json.read_text())
    package = cfg['package']
    assert package == 'dev.shattered.mapstudio.next', 'Use the original app identity'
    spec = importlib.util.spec_from_file_location('repack', ROOT / 'android/repack-assets.py')
    repack = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(repack)
    out = a.output_dir.resolve()
    out.mkdir(parents=True, exist_ok=True)
    version, code = '4.69.3', 116
    overlays = {'assets/' + n: (ROOT / 'dist' / n).read_bytes() for n in MUSIC}
    with zipfile.ZipFile(a.base_apk) as base:
        assert repack.manifest_version(base.read('AndroidManifest.xml'))[1] == ('4.69.2', 115)
        sw = base.read('assets/sw.js').decode().replace('4.69.2', version)
        overlays['assets/sw.js'] = sw.encode()
        overlays['assets/version-ui.js'] = base.read('assets/version-ui.js').replace(b"newVersion='4.69.2'", b"newVersion='4.69.3'")
        web = out / 'web'
        for name in base.namelist():
            if name.startswith('assets/') and not name.endswith('/'):
                target = web / name[7:]
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(overlays.get(name, base.read(name)))
        for name, data in overlays.items():
            (web / name[7:]).write_bytes(data)
        with zipfile.ZipFile(out / 'unsigned.apk', 'w', zipfile.ZIP_DEFLATED) as z:
            for info in base.infolist():
                name = info.filename
                if name.startswith('META-INF/'):
                    continue
                data = overlays.get(name, base.read(name))
                if name == 'AndroidManifest.xml':
                    data, _ = repack.manifest_version(data, version, code)
                    data = rewrite_strings(data, {'dev.pokebacon.preview': package, 'dev.pokebacon.preview.files': package + '.files'})
                z.writestr(info, data)
            for name, data in overlays.items():
                if name not in base.namelist():
                    z.writestr(name, data)
    def run(cmd, **kwargs):
        return subprocess.run([str(x) for x in cmd], check=True, capture_output=True, text=True, **kwargs)
    run([a.zipalign.resolve(), '-f', '-p', '4', out / 'unsigned.apk', out / 'aligned.apk'])
    env = os.environ.copy()
    env['PB_SIGN_PASSWORD'] = cfg['password']
    apk = out / ('PokeBacon_Studio_v' + version + '.apk')
    signer = ['java', '-jar', a.apksigner_jar.resolve()]
    run(signer + ['sign', '--ks', a.keystore.resolve(), '--ks-key-alias', cfg['alias'], '--ks-pass', 'env:PB_SIGN_PASSWORD', '--key-pass', 'env:PB_SIGN_PASSWORD', '--v4-signing-enabled', 'false', '--out', apk, out / 'aligned.apk'], env=env)
    cert = run(signer + ['verify', '--verbose', '--print-certs', apk]).stdout
    assert '9f453803f6fe2feb834fc799b8c9cfef5520bb6567b1d55e22baccfb81b59343' in cert.lower()
    run([a.zipalign.resolve(), '-c', '4', apk])
    with zipfile.ZipFile(a.base_apk) as base, zipfile.ZipFile(apk) as built:
        assert built.testzip() is None
        assert repack.manifest_version(built.read('AndroidManifest.xml'))[1] == (version, code)
        for name in base.namelist():
            if name.startswith('META-INF/') or name == 'AndroidManifest.xml':
                continue
            assert built.read(name) == overlays.get(name, base.read(name)), name
        assert {n for n in set(built.namelist()) - set(base.namelist()) if not n.startswith('META-INF/')} <= set(overlays)
    report = {'version': version, 'versionCode': code, 'package': package, 'certificateSHA256': '9f453803f6fe2feb834fc799b8c9cfef5520bb6567b1d55e22baccfb81b59343', 'base': a.base_apk.name, 'baseSHA256': hashlib.sha256(a.base_apk.read_bytes()).hexdigest(), 'apkSHA256': hashlib.sha256(apk.read_bytes()).hexdigest(), 'changedAssets': sorted(overlays), 'nativeCodeAndResourcesPreserved': True, 'zipCRC': 'pass', 'signatureVerification': 'pass', 'zipAlignment': 'pass', 'deviceInstallationTested': False}
    (out / 'build-verification.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))

if __name__ == '__main__':
    main()
